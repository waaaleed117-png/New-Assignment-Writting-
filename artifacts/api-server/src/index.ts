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

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
