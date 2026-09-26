import { Router, type IRouter } from "express";
import {
  generateAssignment,
  type FormattingSettings,
  type PageMarginId,
  type PageSizeId,
} from "../lib/gemini";

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  data: string;
}

const PAGE_MARGIN_IDS: readonly PageMarginId[] = ["normal", "narrow", "moderate", "wide"];
const PAGE_SIZE_IDS: readonly PageSizeId[] = ["a4", "a3", "letter", "legal", "executive"];

function parsePageMarginId(value: unknown): PageMarginId {
  return PAGE_MARGIN_IDS.includes(value as PageMarginId) ? (value as PageMarginId) : "normal";
}

function parsePageSizeId(value: unknown): PageSizeId {
  return PAGE_SIZE_IDS.includes(value as PageSizeId) ? (value as PageSizeId) : "a4";
}

const router: IRouter = Router();

router.post("/generate-assignment", async (req, res) => {
  try {
    const rawPrompt: unknown = req.body?.prompt;
    if (typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
      return res.status(400).json({ error: "Invalid prompt" });
    }

    // 0 means the Pages dropdown was left on "Select": no explicit count.
    const pageLength: number =
      typeof req.body?.pageLength === "number" &&
      Number.isFinite(req.body.pageLength) &&
      req.body.pageLength >= 0
        ? Math.floor(req.body.pageLength)
        : 0;

    const attachmentContext: string | undefined =
      typeof req.body?.attachmentContext === "string"
        ? req.body.attachmentContext
        : undefined;

    const attachments: AttachmentPayload[] = Array.isArray(req.body?.attachments)
      ? req.body.attachments
          .filter(
            (att: unknown) => typeof (att as AttachmentPayload)?.name === "string",
          )
          .map((att: unknown) => ({
            name: String((att as AttachmentPayload).name),
            mimeType: typeof (att as AttachmentPayload).mimeType === "string"
              ? (att as AttachmentPayload).mimeType
              : "application/octet-stream",
            data: typeof (att as AttachmentPayload).data === "string"
              ? (att as AttachmentPayload).data
              : "",
          }))
      : [];

    const formatting: FormattingSettings | undefined =
      typeof req.body?.formatting === "object" && req.body.formatting !== null
        ? {
            bodyFont: String(req.body.formatting.bodyFont ?? "Arial"),
            bodySize: Number(req.body.formatting.bodySize ?? 12),
            headingFont: String(req.body.formatting.headingFont ?? "Arial"),
            headingSize: Number(req.body.formatting.headingSize ?? 18),
            pageMargin: parsePageMarginId(req.body.formatting.pageMargin),
            pageSize: parsePageSizeId(req.body.formatting.pageSize),
          }
        : undefined;

    const content = await generateAssignment(
      rawPrompt,
      Math.min(Math.max(pageLength, 1), 20),
      attachmentContext,
      formatting,
      attachments,
    );

    return res.json({ content });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate assignment",
    });
  }
});

export default router;