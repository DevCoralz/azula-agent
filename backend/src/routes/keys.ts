import { Router } from "express";
import { z } from "zod";
import { exec, one, query } from "../db/pool.js";
import { audit, requireAuth, type AuthedRequest } from "../lib/auth.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { baseUrlFor, testKey } from "../agent/providers.js";

export const keysRouter = Router();

const PROVIDERS = ["openai", "anthropic", "google", "openrouter", "groq", "deepseek", "custom"] as const;

keysRouter.get("/api/keys", requireAuth, async (req, res) => {
  const keys = await query(
    "SELECT id, provider, label, last4, base_url, created_at FROM api_keys WHERE user_id = ? ORDER BY id DESC",
    [(req as AuthedRequest).userId],
  );
  res.json({ keys });
});

keysRouter.post("/api/keys", requireAuth, async (req, res) => {
  const parsed = z.object({
    provider: z.enum(PROVIDERS),
    label: z.string().max(60).optional().default(""),
    key: z.string().min(8).max(500),
    base_url: z.string().url().max(500).nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check the provider and key you entered." });

  const userId = (req as AuthedRequest).userId;
  const count = await one<{ c: number }>("SELECT COUNT(*) AS c FROM api_keys WHERE user_id = ?", [userId]);
  if (Number(count?.c ?? 0) >= 20) return res.status(400).json({ error: "You already have 20 saved keys." });

  await exec(
    "INSERT INTO api_keys (user_id, provider, label, key_cipher, last4, base_url) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, parsed.data.provider, parsed.data.label, encrypt(parsed.data.key), parsed.data.key.slice(-4), parsed.data.base_url ?? null],
  );
  await audit(userId, "key.add", parsed.data.provider);
  res.status(201).json({ ok: true });
});

keysRouter.post("/api/keys/:id/test", requireAuth, async (req, res) => {
  const row = await one<any>("SELECT * FROM api_keys WHERE id = ? AND user_id = ?", [req.params.id, (req as AuthedRequest).userId]);
  if (!row) return res.status(404).json({ error: "Key not found" });
  res.json(await testKey(row.provider, baseUrlFor(row.provider, row.base_url), decrypt(row.key_cipher)));
});

keysRouter.delete("/api/keys/:id", requireAuth, async (req, res) => {
  await exec("DELETE FROM api_keys WHERE id = ? AND user_id = ?", [req.params.id, (req as AuthedRequest).userId]);
  res.json({ ok: true });
});
