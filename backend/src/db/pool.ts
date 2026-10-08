import mysql from "mysql2/promise";
import { config } from "../config.js";

export const pool = mysql.createPool({
  uri: config.databaseUrl,
  connectionLimit: 15,
  waitForConnections: true,
  namedPlaceholders: false,
  timezone: "Z",
  dateStrings: false,
});

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = []) {
  const [res] = await pool.execute(sql, params as any[]);
  return res as mysql.ResultSetHeader;
}
