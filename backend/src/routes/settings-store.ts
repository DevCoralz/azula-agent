import { one, query } from "../db/pool.js";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await one<{ v: string }>("SELECT v FROM site_settings WHERE k = ?", [key]);
  return row?.v ?? fallback;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await query<{ k: string; v: string }>("SELECT k, v FROM site_settings");
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}

export async function setSetting(key: string, value: string) {
  await query("INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [key, value]);
}
