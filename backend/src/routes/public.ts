import { Router } from "express";
import { query } from "../db/pool.js";
import { getAllSettings } from "./settings-store.js";

export const publicRouter = Router();

publicRouter.get("/health", (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

publicRouter.get("/api/models", async (_req, res) => {
  const models = await query(
    "SELECT id, provider, model_id, label, context_window, enabled FROM models WHERE enabled = 1 ORDER BY sort, id",
  );
  res.json({ models: models.map((m: any) => ({ ...m, enabled: !!m.enabled })) });
});

publicRouter.get("/api/plans", async (_req, res) => {
  const plans = await query("SELECT * FROM plans WHERE enabled = 1 ORDER BY sort, id");
  res.json({ plans: plans.map(serializePlan) });
});

publicRouter.get("/api/site", async (_req, res) => {
  const s = await getAllSettings();
  res.json({ settings: { site_name: s.site_name, tagline: s.tagline, announcement: s.announcement, support_email: s.support_email } });
});

export function serializePlan(p: any) {
  return {
    id: p.id, slug: p.slug, name: p.name, price_cents: p.price_cents, currency: p.currency,
    interval: p.interval_label,
    features: typeof p.features === "string" ? JSON.parse(p.features) : (p.features ?? []),
    max_workspaces: p.max_workspaces, disk_mb: p.disk_mb,
    highlighted: !!p.highlighted, enabled: !!p.enabled,
  };
}
