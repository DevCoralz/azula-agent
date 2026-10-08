import { exec, one, pool } from "../db/pool.js";

const email = process.argv[2]?.toLowerCase();
if (!email) { console.error("Usage: npm run make-admin <email>"); process.exit(1); }
const user = await one<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);
if (!user) { console.error("No user with that email"); process.exit(1); }
await exec("INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, 'admin')", [user.id]);
console.log(`${email} is now an admin.`);
await pool.end();
