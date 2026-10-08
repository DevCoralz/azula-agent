import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { exec, one, query } from "../db/pool.js";
import { publicUser, requireAuth, type AuthedRequest } from "../lib/auth.js";
import { getSetting } from "./settings-store.js";

export const usersRouter = Router();

usersRouter.patch("/api/users/me", requireAuth, async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1).max(80).optional(),
    bio: z.string().max(500).optional(),
    avatar_url: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check the values you entered." });

  const userId = (req as AuthedRequest).userId;
  const fields = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (fields.length) {
    await exec(
      `UPDATE users SET ${fields.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`,
      [...fields.map(([, v]) => v), userId],
    );
  }
  res.json({ user: await publicUser(userId) });
});

usersRouter.post("/api/users/me/password", requireAuth, async (req, res) => {
  const parsed = z.object({ current: z.string().min(1), next: z.string().min(8).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "New password must be at least 8 characters." });

  const userId = (req as AuthedRequest).userId;
  const u = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [userId]);
  if (!u || !(await bcrypt.compare(parsed.data.current, u.password_hash))) {
    return res.status(400).json({ error: "Your current password is not correct." });
  }
  await exec("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(parsed.data.next, 12), userId]);
  res.json({ ok: true });
});

usersRouter.get("/api/referrals", requireAuth, async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  const me = await one<{ referral_code: string }>("SELECT referral_code FROM users WHERE id = ?", [userId]);
  const referred = await query<any>(
    `SELECT u.name, r.created_at, r.rewarded FROM referrals r
     JOIN users u ON u.id = r.referred_id WHERE r.referrer_id = ? ORDER BY r.created_at DESC`,
    [userId],
  );
  const total = await one<{ t: number }>("SELECT COALESCE(SUM(reward),0) AS t FROM referrals WHERE referrer_id = ? AND rewarded = 1", [userId]);
  res.json({
    code: me?.referral_code ?? "",
    reward_per_signup: Number(await getSetting("referral_reward", "50")),
    total_earned: Number(total?.t ?? 0),
    referred: referred.map((r) => ({ name: r.name, created_at: r.created_at, rewarded: !!r.rewarded })),
  });
});
