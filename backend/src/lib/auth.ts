import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { one, query } from "../db/pool.js";

export interface AuthedRequest extends Request<any, any, any, any> {
  userId: number;
  isAdmin: boolean;
}

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: "30d" });
}

export async function isAdmin(userId: number): Promise<boolean> {
  const r = await one("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'", [userId]);
  return !!r;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  let sub: string;
  try {
    sub = (jwt.verify(token, config.jwtSecret) as { sub: string }).sub;
  } catch {
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
  const userId = Number(sub);
  one<{ suspended: number }>("SELECT suspended FROM users WHERE id = ?", [userId])
    .then(async (u) => {
      if (!u) return res.status(401).json({ error: "Account not found" });
      if (u.suspended) return res.status(403).json({ error: "Account suspended" });
      (req as AuthedRequest).userId = userId;
      (req as AuthedRequest).isAdmin = await isAdmin(userId);
      next();
    })
    .catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!(req as AuthedRequest).isAdmin) return res.status(403).json({ error: "Admin only" });
    next();
  });
}

/** Shape returned to the frontend. Never includes password hash. */
export async function publicUser(userId: number) {
  const u = await one<any>(
    "SELECT id, email, name, avatar_url, bio, plan, referral_code, credits, created_at FROM users WHERE id = ?",
    [userId],
  );
  if (!u) return null;
  const roles = await query<{ role: string }>("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
  return { ...u, role: roles.some((r) => r.role === "admin") ? "admin" : "user" };
}

export async function audit(userId: number | null, action: string, detail?: string) {
  await query("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", [userId, action, detail?.slice(0, 2000) ?? null]).catch(() => {});
}
