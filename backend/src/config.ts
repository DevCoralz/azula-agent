import "dotenv/config";
import path from "node:path";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example`);
  return v;
}
const num = (name: string, def: number) => Number(process.env[name] ?? def);

export const config = {
  port: num("PORT", 8000),
  env: process.env.NODE_ENV ?? "development",
  corsOrigins: (process.env.CORS_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean),
  databaseUrl: req("DATABASE_URL"),
  jwtSecret: req("JWT_SECRET"),
  encryptionKey: req("ENCRYPTION_KEY"),
  adminEmail: (process.env.ADMIN_EMAIL ?? "").toLowerCase(),
  workspacesRoot: path.resolve(process.env.WORKSPACES_ROOT ?? "./workspaces"),
  sandbox: {
    mode: (process.env.SANDBOX_MODE ?? "process") as "process" | "docker",
    image: process.env.SANDBOX_IMAGE ?? "azula/sandbox:latest",
    memory: process.env.SANDBOX_MEMORY ?? "1g",
    cpus: process.env.SANDBOX_CPUS ?? "1",
    pids: process.env.SANDBOX_PIDS ?? "256",
  },
  agentMaxSteps: num("AGENT_MAX_STEPS", 40),
  execTimeoutSeconds: num("EXEC_TIMEOUT_SECONDS", 180),
  execOutputLimit: num("EXEC_OUTPUT_LIMIT", 20000),
  preview: {
    portStart: num("PREVIEW_PORT_START", 9100),
    portEnd: num("PREVIEW_PORT_END", 9199),
    urlTemplate: process.env.PREVIEW_URL_TEMPLATE ?? "http://localhost:{port}",
  },
};
