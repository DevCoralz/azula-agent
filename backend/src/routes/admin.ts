import { Router } from "express";
import { z } from "zod";
import { exec, one, query } from "../db/pool.js";
import { audit, requireAdmin, type AuthedRequest } from "../lib/auth.js";
import { getAllSettings, setSetting } from "./settings-store.js";
import { serializePlan } from "./public.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

/* ---------- Users ---------- */

adminRouter.get("/api/admin/users", async (_req, res) => {
  const users = await query<any>(`
    SELECT u.id, u.email, u.name, u.avatar_url, u.bio, u.plan, u.referral_code, u.credits,
           u.suspended, u.created_at,
           (SELECT COUNT(*) FROM workspaces w WHERE w.user_id = u.id) AS workspaces,
           (SELECT COUNT(*) FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS is_admin
    FROM users u ORDER BY u.created_at DESC LIMIT 500`);
  res.json({
    users: users.map((u) => ({ ...u, suspended: !!u.suspended, role: u.is_admin ? "admin" : "user" })),
  });
});

adminRouter.patch("/api/admin/users/:id", async (req, res) => {
  const parsed = z.object({
    role: z.enum(["user", "admin"]).optional(),
    suspended: z.boolean().optional(),
    plan: z.string().max(40).optional(),
    credits: z.number().int().min(0).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update" });

  const id = Number(req.params.id);
  const actor = (req as AuthedRequest).userId;
  if (id === actor && (parsed.data.role === "user" || parsed.data.suspended)) {
    return res.status(400).json({ error: "You cannot demote or suspend your own account." });
  }
  if (!(await one("SELECT id FROM users WHERE id = ?", [id]))) return res.status(404).json({ error: "User not found" });

  if (parsed.data.role === "admin") await exec("INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", [id]);
  if (parsed.data.role === "user") await exec("DELETE FROM user_roles WHERE user_id = ? AND role = 'admin'", [id]);
  if (parsed.data.suspended !== undefined) await exec("UPDATE users SET suspended = ? WHERE id = ?", [parsed.data.suspended ? 1 : 0, id]);
  if (parsed.data.plan) await exec("UPDATE users SET plan = ? WHERE id = ?", [parsed.data.plan, id]);
  if (parsed.data.credits !== undefined) await exec("UPDATE users SET credits = ? WHERE id = ?", [parsed.data.credits, id]);

  await audit(actor, "admin.user.update", `${id}: ${JSON.stringify(parsed.data)}`);
  res.json({ ok: true });
});

adminRouter.delete("/api/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === (req as AuthedRequest).userId) return res.status(400).json({ error: "You cannot delete your own account." });
  await exec("DELETE FROM users WHERE id = ?", [id]);
  await audit((req as AuthedRequest).userId, "admin.user.delete", String(id));
  res.json({ ok: true });
});

/* ---------- Models ---------- */

adminRouter.get("/api/admin/models", async (_req, res) => {
  const models = await query<any>("SELECT * FROM models ORDER BY sort, id");
  res.json({ models: models.map((m) => ({ ...m, enabled: !!m.enabled })) });
});

adminRouter.post("/api/admin/models", async (req, res) => {
  const parsed = z.object({
    provider: z.string().min(1).max(40),
    model_id: z.string().min(1).max(120),
    label: z.string().max(80).optional(),
    context_window: z.number().int().positive().max(10_000_000).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check the model details." });
  await exec(
    "INSERT IGNORE INTO models (provider, model_id, label, context_window) VALUES (?, ?, ?, ?)",
    [parsed.data.provider, parsed.data.model_id, parsed.data.label || parsed.data.model_id, parsed.data.context_window ?? 128000],
  );
  res.status(201).json({ ok: true });
});

adminRouter.patch("/api/admin/models/:id", async (req, res) => {
  const parsed = z.object({
    enabled: z.boolean().optional(),
    label: z.string().max(80).optional(),
    sort: z.number().int().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update" });
  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length) {
    await exec(
      `UPDATE models SET ${fields.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...fields.map(([, v]) => (typeof v === "boolean" ? (v ? 1 : 0) : v)), req.params.id],
    );
  }
  res.json({ ok: true });
});

adminRouter.delete("/api/admin/models/:id", async (req, res) => {
  await exec("DELETE FROM models WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Plans ---------- */

adminRouter.get("/api/admin/plans", async (_req, res) => {
  const plans = await query<any>("SELECT * FROM plans ORDER BY sort, id");
  res.json({ plans: plans.map(serializePlan) });
});

adminRouter.patch("/api/admin/plans/:id", async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1).max(60).optional(),
    price_cents: z.number().int().min(0).optional(),
    interval: z.string().max(20).optional(),
    features: z.array(z.string().max(200)).max(30).optional(),
    max_workspaces: z.number().int().min(0).optional(),
    disk_mb: z.number().int().min(0).optional(),
    highlighted: z.boolean().optional(),
    enabled: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check the plan values." });

  const d = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const push = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
  if (d.name) push("name", d.name);
  if (d.price_cents !== undefined) push("price_cents", d.price_cents);
  if (d.interval) push("interval_label", d.interval);
  if (d.features) push("features", JSON.stringify(d.features.filter((f) => f.trim())));
  if (d.max_workspaces !== undefined) push("max_workspaces", d.max_workspaces);
  if (d.disk_mb !== undefined) push("disk_mb", d.disk_mb);
  if (d.highlighted !== undefined) push("highlighted", d.highlighted ? 1 : 0);
  if (d.enabled !== undefined) push("enabled", d.enabled ? 1 : 0);
  if (sets.length) await exec(`UPDATE plans SET ${sets.join(", ")} WHERE id = ?`, [...vals, req.params.id]);
  res.json({ ok: true });
});

/* ---------- Site settings & activity ---------- */

adminRouter.get("/api/admin/settings", async (_req, res) => {
  res.json({ settings: await getAllSettings() });
});

adminRouter.put("/api/admin/settings", async (req, res) => {
  const parsed = z.object({ settings: z.record(z.string().max(80), z.string().max(4000)) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings payload" });
  for (const [k, v] of Object.entries(parsed.data.settings)) await setSetting(k, v);
  await audit((req as AuthedRequest).userId, "admin.settings.update");
  res.json({ ok: true });
});

adminRouter.get("/api/admin/stats", async (_req, res) => {
  const [users, workspaces, runs, today] = await Promise.all([
    one<{ c: number }>("SELECT COUNT(*) AS c FROM users"),
    one<{ c: number }>("SELECT COUNT(*) AS c FROM workspaces"),
    one<{ c: number }>("SELECT COUNT(*) AS c FROM runs"),
    one<{ c: number }>("SELECT COUNT(*) AS c FROM runs WHERE started_at > DATE_SUB(NOW(), INTERVAL 1 DAY)"),
  ]);
  res.json({ users: users?.c ?? 0, workspaces: workspaces?.c ?? 0, runs: runs?.c ?? 0, runs_24h: today?.c ?? 0 });
});

adminRouter.get("/api/admin/audit", async (_req, res) => {
  res.json({ entries: await query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200") });
});
