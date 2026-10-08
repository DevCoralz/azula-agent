import { Router } from "express";
import { z } from "zod";
import { exec, one, query } from "../db/pool.js";
import { audit, requireAuth, type AuthedRequest } from "../lib/auth.js";
import { getPreview, stopPreview } from "../lib/preview.js";
import {
  deleteFileSafe, dirSizeMb, ensureWorkspace, listTree, readFileSafe, workspaceDir, writeFileSafe,
} from "../lib/workspace.js";
import fs from "node:fs/promises";

export const workspacesRouter = Router();

async function ownedWorkspace(userId: number, id: string | number) {
  return one<{ id: number; name: string }>("SELECT id, name FROM workspaces WHERE id = ? AND user_id = ?", [id, userId]);
}

workspacesRouter.get("/api/workspaces", requireAuth, async (req, res) => {
  const workspaces = await query(
    "SELECT id, name, created_at FROM workspaces WHERE user_id = ? ORDER BY created_at DESC",
    [(req as AuthedRequest).userId],
  );
  res.json({ workspaces });
});

workspacesRouter.post("/api/workspaces", requireAuth, async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(60) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Give the workspace a name." });
  const userId = (req as AuthedRequest).userId;

  const user = await one<{ plan: string }>("SELECT plan FROM users WHERE id = ?", [userId]);
  const plan = await one<{ max_workspaces: number }>("SELECT max_workspaces FROM plans WHERE slug = ?", [user?.plan ?? "free"]);
  const count = await one<{ c: number }>("SELECT COUNT(*) AS c FROM workspaces WHERE user_id = ?", [userId]);
  if (Number(count?.c ?? 0) >= (plan?.max_workspaces ?? 3)) {
    return res.status(403).json({ error: "You have reached the workspace limit for your plan." });
  }

  const result = await exec("INSERT INTO workspaces (user_id, name) VALUES (?, ?)", [userId, parsed.data.name]);
  await ensureWorkspace(userId, result.insertId);
  await audit(userId, "workspace.create", parsed.data.name);
  const workspace = await one("SELECT id, name, created_at FROM workspaces WHERE id = ?", [result.insertId]);
  res.status(201).json({ workspace });
});

workspacesRouter.delete("/api/workspaces/:id", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  stopPreview(ws.id);
  await fs.rm(workspaceDir(userId, ws.id), { recursive: true, force: true }).catch(() => {});
  await exec("DELETE FROM workspaces WHERE id = ?", [ws.id]);
  res.json({ ok: true });
});

workspacesRouter.get("/api/workspaces/:id/files", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  const root = await ensureWorkspace(userId, ws.id);
  res.json({ files: await listTree(root), preview: getPreview(ws.id) });
});

workspacesRouter.get("/api/workspaces/:id/file", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  const rel = String(req.query.path ?? "");
  if (!rel) return res.status(400).json({ error: "No file path given" });
  try {
    const root = await ensureWorkspace(userId, ws.id);
    res.json({ path: rel, content: await readFileSafe(root, rel) });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Could not read that file" });
  }
});

workspacesRouter.put("/api/workspaces/:id/file", requireAuth, async (req, res) => {
  const parsed = z.object({ path: z.string().min(1).max(500), content: z.string().max(2_000_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid file payload" });
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  try {
    const root = await ensureWorkspace(userId, ws.id);
    await writeFileSafe(root, parsed.data.path, parsed.data.content);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Could not write that file" });
  }
});

workspacesRouter.delete("/api/workspaces/:id/file", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  try {
    const root = await ensureWorkspace(userId, ws.id);
    await deleteFileSafe(root, String(req.query.path ?? ""));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Could not delete that file" });
  }
});

workspacesRouter.get("/api/workspaces/:id/history", requireAuth, async (req, res) => {
  const ws = await ownedWorkspace((req as AuthedRequest).userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  const messages = await query(
    "SELECT id, role, content, created_at FROM messages WHERE workspace_id = ? ORDER BY id ASC LIMIT 200", [ws.id],
  );
  res.json({ messages });
});

workspacesRouter.get("/api/workspaces/:id/stats", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const ws = await ownedWorkspace(userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  const root = await ensureWorkspace(userId, ws.id);
  res.json({ disk_mb: await dirSizeMb(root), preview: getPreview(ws.id) });
});

workspacesRouter.post("/api/workspaces/:id/preview/stop", requireAuth, async (req, res) => {
  const ws = await ownedWorkspace((req as AuthedRequest).userId, req.params.id!);
  if (!ws) return res.status(404).json({ error: "Workspace not found" });
  res.json({ stopped: stopPreview(ws.id) });
});
