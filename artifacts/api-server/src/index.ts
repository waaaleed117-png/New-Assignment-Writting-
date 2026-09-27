import app from "./app";
import { logger } from "./lib/logger";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadLocalEnv() {
  const configDir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(configDir, "..", ".env.local");
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    }
  } catch {
    // .env.local is optional; required secrets can also come from Replit Secrets.
  }
}

loadLocalEnv();

// Vercel par PORT zaroori nahi hota, isliye default 8080 laga diya taake crash na ho
const rawPort = process.env["PORT"] || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Vercel serverless environment mein listen ki bajaye direct export use karta hai
if (process.env.NODE_ENV !== "production") {
  app.listen(port, (err?: any) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

// Yeh sabse zaroori line hai Vercel API ke liye!
export default app;
