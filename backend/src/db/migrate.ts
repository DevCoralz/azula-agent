import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "../config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

const conn = await mysql.createConnection({ uri: config.databaseUrl, multipleStatements: true });
await conn.query(sql);
await conn.end();
console.log("Schema applied.");
