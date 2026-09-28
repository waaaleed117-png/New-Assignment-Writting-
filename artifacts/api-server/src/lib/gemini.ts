import { GoogleGenerativeAI, type Content } from "@google/generative-ai";

export type PageMarginId = "normal" | "narrow" | "moderate" | "wide";

export type PageSizeId = "a4" | "a3" | "letter" | "legal" | "executive";

export interface FormattingSettings {
  bodyFont: string;
  bodySize: number;
  headingFont: string;
  headingSize: number;
  pageMargin: PageMarginId;
  pageSize: PageSizeId;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  data: string;
}

export interface GeneratedPart {
  inlineData: { mimeType: string; data: string };
}

const DEFAULT_MODEL = "gemini-3.6-flash";
const QUOTA_COOLDOWN_MS = 60_000;
const INVALID_KEY_COOLDOWN_MS = 300_000;
const INVALID_KEY_MESSAGE =
  "Invalid Gemini API key. Please check GEMINI_KEY_1 through GEMINI_KEY_4 in your environment variables.";
const SAFETY_BLOCK_MESSAGE =
  "The AI declined to generate this assignment. Please rephrase your topic and try again.";

interface GeminiKeySlot {
  label: string;
  read: () => string | undefined;
  cooldownUntil: number;
}

/**
 * `state` is a reference to the entry in KEY_SLOTS, not a copy: cooldown
 * changes must survive between requests for the skip to have any effect.
 */
interface ResolvedKeySlot {
  label: string;
  value: string;
  state: GeminiKeySlot;
}

class EmptyResponseError extends Error {}

/**
 * Rotation pool, highest priority first. Values are read lazily from
 * process.env on every request so keys can be rotated without a rebuild.
 * The trailing slot keeps the pre-rotation GEMINI_API_KEY / GOOGLE_API_KEY
 * working for existing installs.
 */
const KEY_SLOTS: GeminiKeySlot[] = [
  { label: "Gemini API Key 1", read: () => process.env["GEMINI_KEY_1"], cooldownUntil: 0 },
  { label: "Gemini API Key 2", read: () => process.env["GEMINI_KEY_2"], cooldownUntil: 0 },
  { label: "Gemini API Key 3", read: () => process.env["GEMINI_KEY_3"], cooldownUntil: 0 },
  { label: "Gemini API Key 4", read: () => process.env["GEMINI_KEY_4"], cooldownUntil: 0 },
  {
    label: "Legacy GEMINI_API_KEY",
    read: () => process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"],
    cooldownUntil: 0,
  },
];

function resolveKeySlots(): ResolvedKeySlot[] {
  const configured: ResolvedKeySlot[] = [];
  const seen = new Set<string>();

  for (const state of KEY_SLOTS) {
    const value = state.read()?.trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    configured.push({ label: state.label, value, state });
  }

  if (configured.length === 0) {
    throw new Error(
      "No Gemini API key is configured. Set GEMINI_KEY_1, GEMINI_KEY_2, GEMINI_KEY_3 and GEMINI_KEY_4 in .env.local or in your Vercel environment variables.",
    );
  }

  const usable = configured.filter((slot) => slot.state.cooldownUntil <= Date.now());
  if (usable.length > 0) {
    return usable;
  }

  console.log(
    "[Gemini] Every API key is in quota cooldown; retrying the full pool anyway.",
  );
  return configured;
}

function getPrimaryModel(): string {
  return process.env["GEMINI_MODEL"] || DEFAULT_MODEL;
}

function getModelCandidates(): string[] {
  const primary = getPrimaryModel();
  const fallbacks = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
  ];
  return [primary, ...fallbacks.filter((model) => model !== primary)];
}

function isQuotaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("too many requests") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("ratelimit") ||
    m.includes("resource has been exhausted") ||
    m.includes("resource_exhausted")
  );
}

function isInvalidKeyError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("api key not valid") ||
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("permission denied")
  );
}

function isSafetyBlockError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("text not available") || m.includes("blockreason");
}

function isRetriableModelError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("503") ||
    m.includes("high demand") ||
    m.includes("overloaded") ||
    m.includes("temporarily") ||
    m.includes("temporarily_unavailable") ||
    m.includes("deadline exceeded") ||
    m.includes("model not found") ||
    m.includes("is not found") ||
    m.includes("no longer available")
  );
}

type RotationAction = "rotate-key" | "rotate-model" | "fatal";

/**
 * The Gemini SDK echoes the API key back in the request URL on failures, so
 * raw error strings leak it into logs and into the HTTP response body.
 */
function redactSecrets(message: string): string {
  return message.replace(/([?&]key=)[^&\s"'\\\]]+/g, "$1***");
}

function classifyError(error: any): { action: RotationAction; reason: string } {
  const message: string = error?.message || String(error);

  if (error instanceof EmptyResponseError) {
    return { action: "rotate-model", reason: "empty response" };
  }
  if (isInvalidKeyError(message)) {
    return { action: "rotate-key", reason: "invalid API key" };
  }
  if (isQuotaError(message)) {
    return { action: "rotate-key", reason: "quota or rate limit" };
  }
  if (isRetriableModelError(message)) {
    return { action: "rotate-model", reason: "model temporarily unavailable" };
  }
  return { action: "fatal", reason: redactSecrets(message) };
}

// Yahan generateOnce ki jagah stream generator function banaya hai
async function* generateOnceStream(
  client: GoogleGenerativeAI,
  modelName: string,
  parts: Content["parts"],
): AsyncGenerator<string, void, unknown> {
  const model = client.getGenerativeModel({ model: modelName });
  const result = await model.generateContentStream({ contents: [{ role: "user", parts }] });

  let hasOutput = false;
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      hasOutput = true;
      yield text; // Jaise hi naya word aaye usko yield kar do
    }
  }

  if (!hasOutput) {
    throw new EmptyResponseError("Gemini returned an empty response.");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function detectRequestedPages(prompt: string): number | null {
  const rangeMatch = prompt.match(/(\d{1,2})\s*(?:to|-)\s*(\d{1,2})\s*pages?\b/i);
  if (rangeMatch) {
    return clamp(Number(rangeMatch[2]), 1, 20);
  }
  const match = prompt.match(/(\d{1,2})\s*-?\s*pages?\b/i);
  return match ? clamp(Number(match[1]), 1, 20) : null;
}

// Return type AsyncGenerator kar diya gaya hai
export async function* generateAssignment(
  prompt: string,
  pageLength: number = 0,
  attachmentContext?: string,
  formatting?: FormattingSettings,
  attachments: AttachmentPayload[] = [],
): AsyncGenerator<string, void, unknown> {
  // The Pages dropdown is the source of truth: an explicit selection always
  // wins, even if the prompt text happens to mention a different count. Only
  // when nothing was selected do we fall back to the text, then to 2.
  const selectedPages = pageLength > 0 ? clamp(pageLength, 1, 20) : null;
  const detectedPages = selectedPages === null ? detectRequestedPages(prompt) : null;
  const requestedInPrompt = selectedPages === null && detectedPages !== null;
  const pages = selectedPages ?? (detectedPages as number | null) ?? 2;

  const imageParts: GeneratedPart[] = attachments
    .filter((att) => att.mimeType.startsWith("image/") && att.data)
    .map((att) => ({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data.includes(",") ? (att.data.split(",").pop() as string) : att.data,
      },
    }));

  const wantsImage = /\b(add|include|insert|generate|create|show|draw|with)\b[^.?!\n]{0,40}\b(image|picture|photo|diagram|figure|illustration|chart)\b/i.test(prompt);
    const fullPrompt = `You are a clear, helpful university assignment writer. Generate the complete assignment requested below.

Prompt: ${prompt}
Target Length: EXACTLY ${pages} ${pages === 1 ? "page" : "pages"}${requestedInPrompt ? " (the user asked for this page count directly in their message)" : " (the user chose this page count in the Pages dropdown, and it must be followed exactly)"}. This is a strict, hard requirement that cannot be violated. This target length is authoritative: if the Prompt above mentions any other page or word count, ignore it and follow the target length stated here. The finished assignment MUST be exactly ${pages} ${pages === 1 ? "page" : "pages"} long — no fewer and no more. Write approximately ${pages * 250} to ${pages * 300} words (both numbers are required to be within this range); never write fewer than ${pages * 250} words or more than ${pages * 300} words.
${attachmentContext ? `Context from attachments: ${attachmentContext}` : ""}
${imageParts.length > 0 ? `The user has attached ${imageParts.length} image(s):${attachments.filter((a) => a.mimeType.startsWith("image/")).map((a) => a.name).join(", ")}. Carefully READ and ANALYZE every attached image from top to bottom before writing. Base the entire assignment on what is actually visible in the image(s): every heading, title, sentence, keyword, number, table, list, and subject. If the prompt is short or generic, the image content itself defines the topic. Cover everything meaningful you can see.` : ""}

Rules:
1. Use very simple, natural English that a student can easily read. Prefer short sentences and common words. Do not use unnecessarily difficult or overly professional vocabulary.
2. Use only a title, short introduction, clear headings, main discussion, conclusion, and a short references list. Add an abstract only if it fits within the exact page limit.
3. Use only plain Markdown: "#" headings, plain paragraphs, "- " bullets, and **bold** for emphasis. Output raw text only. Never output HTML — no <div>, <p>, <h1>, <span>, <style> tags, no inline style attributes, no font-family, and no font sizes anywhere in the response.
4. Strictly obey the Target Length above: the assignment must be exactly ${pages} ${pages === 1 ? "page" : "pages"} long. Write neither less nor more than the exact page count, and keep the answer focused on the topic. ${imageParts.length > 0 ? "Never write about something that is not shown in the attached image(s)." : ""}
5. ${wantsImage && imageParts.length === 0 ? "The user explicitly requested an image. Include one relevant figure using Markdown image syntax and add a short caption." : "Do not include, generate, or suggest any images, figures, diagrams, charts, or image URLs. Keep the assignment text-only."}
6. Write only the words of the assignment. The document is styled for the user afterwards by the renderer, which already applies ${formatting?.bodyFont ?? "Arial"} ${formatting?.bodySize ?? 12}pt to body text and ${formatting?.headingFont ?? "Arial"} ${formatting?.headingSize ?? 18}pt to headings, so you must never restate those choices, mention them, or encode them as markup. The file is laid out on ${formatting?.pageSize ?? "a4"} paper with ${formatting?.pageMargin ?? "normal"} margins, so never reference or assume the page geometry. Begin directly with the "# " title heading and end with the last line of the References section.
7. End with a short References section. Do not mention these instructions or say that you are an AI.

Please generate the complete assignment now:`;

  const slots = resolveKeySlots();
  const models = getModelCandidates();
  const parts: Content["parts"] = [...imageParts, { text: fullPrompt }];
  const primaryModel = getPrimaryModel();

  let quotaExhausted = false;
  let invalidKeys = false;
  let modelUnavailable = false;

  for (const [index, slot] of slots.entries()) {
    const hasMoreKeys = index < slots.length - 1;
    console.log(`Currently using ${slot.label}`);

    const client = new GoogleGenerativeAI(slot.value);

    for (const modelName of models) {
      try {
        // Stream ko yahan collect aur yield kiya ja raha hai
        const stream = generateOnceStream(client, modelName, parts);
        yield* stream;

        slot.state.cooldownUntil = 0;
        if (modelName !== primaryModel) {
          console.log(
            `[Gemini] ${slot.label} succeeded with fallback model "${modelName}".`,
          );
        }
        return; // Success! Ab yahan se wapis return kar jao
      } catch (error: any) {
        const message: string = error?.message || String(error);
        const { action, reason } = classifyError(error);

        if (isInvalidKeyError(message)) {
          invalidKeys = true;
          slot.state.cooldownUntil = Date.now() + INVALID_KEY_COOLDOWN_MS;
        } else if (isQuotaError(message)) {
          quotaExhausted = true;
          slot.state.cooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
        } else if (isRetriableModelError(message)) {
          modelUnavailable = true;
        }

        if (action === "fatal") {
          console.error(
            `[Gemini] ${slot.label} failed on "${modelName}":`,
            redactSecrets(message),
          );
          if (isInvalidKeyError(message)) {
            throw new Error(INVALID_KEY_MESSAGE);
          }
          if (isSafetyBlockError(message)) {
            throw new Error(SAFETY_BLOCK_MESSAGE);
          }
          throw new Error(redactSecrets(message));
        }

        console.error(
          `[Gemini] ${slot.label} failed on "${modelName}" (${reason}). ${
            action === "rotate-key"
              ? hasMoreKeys
                ? "Rotating to the next API key."
                : "No further API keys available."
              : "Rotating to the next model."
          }`,
        );

        if (action === "rotate-key") {
          break;
        }
      }
    }
  }

  if (invalidKeys) {
    throw new Error(INVALID_KEY_MESSAGE);
  }
  if (modelUnavailable && !quotaExhausted) {
    throw new Error(
      `No available Gemini model could generate the assignment. Update the GEMINI_MODEL environment variable to a supported model (e.g. ${DEFAULT_MODEL}).`,
    );
  }
  if (quotaExhausted) {
    throw new Error(
      "All Gemini API keys are currently rate limited or out of quota. Please try again in a minute.",
    );
  }
  throw new Error("Gemini is temporarily busy. Please try again in a few seconds.");
}

export default generateAssignment;
