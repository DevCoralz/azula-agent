import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config.js";
import { exec, one } from "../db/pool.js";
import { audit, publicUser, requireAuth, signToken, type AuthedRequest } from "../lib/auth.js";
import { randomCode } from "../lib/crypto.js";
import { getSetting } from "./settings-store.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  referral: z.string().max(16).optional(),
});

authRouter.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Check the details you entered." });
  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if ((await getSetting("registrations_open", "true")) !== "true") {
    return res.status(403).json({ error: "Registrations are currently closed." });
  }
  if (await one("SELECT id FROM users WHERE email = ?", [email])) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  let referrer: { id: number } | null = null;
  if (parsed.data.referral) {
    referrer = await one<{ id: number }>("SELECT id FROM users WHERE referral_code = ?", [parsed.data.referral.toUpperCase()]);
  }

  const hash = await bcrypt.hash(password, 12);
  let code = randomCode();
  while (await one("SELECT id FROM users WHERE referral_code = ?", [code])) code = randomCode();

  const result = await exec(
    "INSERT INTO users (email, password_hash, name, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)",
    [email, hash, name, code, referrer?.id ?? null],
  );
  const userId = result.insertId;

  await exec("INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, 'user')", [userId]);
  if (config.adminEmail && email === config.adminEmail) {
    await exec("INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", [userId]);
  }

  if (referrer) {
    const reward = Number(await getSetting("referral_reward", "50"));
    await exec("INSERT INTO referrals (referrer_id, referred_id, reward, rewarded) VALUES (?, ?, ?, 1)", [referrer.id, userId, reward]);
    await exec("UPDATE users SET credits = credits + ? WHERE id = ?", [reward, referrer.id]);
  }

  await audit(userId, "register", email);
  res.status(201).json({ token: signToken(userId), user: await publicUser(userId) });
});

authRouter.post("/api/auth/login", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter your email and password." });

  const user = await one<{ id: number; password_hash: string; suspended: number }>(
    "SELECT id, password_hash, suspended FROM users WHERE email = ?", [parsed.data.email.toLowerCase()],
  );
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: "That email and password do not match." });
  }
  if (user.suspended) return res.status(403).json({ error: "This account is suspended." });

  await exec("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
  await audit(user.id, "login");
  res.json({ token: signToken(user.id), user: await publicUser(user.id) });
});

authRouter.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: await publicUser((req as AuthedRequest).userId) });
});
