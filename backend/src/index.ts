import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { stopAllPreviews } from "./lib/preview.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { keysRouter } from "./routes/keys.js";
import { workspacesRouter } from "./routes/workspaces.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";
import { chatRouter } from "./routes/chat.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: config.corsOrigins.includes("*") ? true : config.corsOrigins,
  credentials: false,
}));
app.use(express.json({ limit: "4mb" }));

app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }));
app.use("/v1/chat", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use(publicRouter);
app.use(authRouter);
app.use(usersRouter);
app.use(keysRouter);
app.use(workspacesRouter);
app.use(adminRouter);
app.use(chatRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[azula]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on the server." });
});

fs.mkdirSync(config.workspacesRoot, { recursive: true });

const server = app.listen(config.port, () => {
  console.log(`[azula] API listening on :${config.port} (${config.env}, sandbox=${config.sandbox.mode})`);
});

function shutdown() {
  console.log("[azula] shutting down");
  stopAllPreviews();
  server.close(() => { void pool.end().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
