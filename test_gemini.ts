import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
  const apiKey = process.env["GEMINI_API_KEY"];
  console.log("GEMINI_API_KEY set:", !!apiKey);
  if (!apiKey) return;

  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("Response:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-flash:", error.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
    const result = await model.generateContent("Hello");
    console.log("Response with gemini-3.6-flash:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-3.6-flash:", error.message);
  }
}

test();
