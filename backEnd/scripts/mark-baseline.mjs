// Banco criado pelo synchronize (desenvolvimento) e que vai passar a usar migrations (DB_SYNC=false):
// marca a migration inicial como já aplicada, sem mexer nas tabelas.
//   npm run migration:baseline
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const file = fs.readdirSync(path.join(ROOT, "src", "migrations")).find((f) => /^\d+-InitialSchema\.ts$/.test(f));
if (!file) {
  console.error("Migration inicial não encontrada em src/migrations");
  process.exit(1);
}
const timestamp = Number(file.split("-")[0]);
const name = `InitialSchema${timestamp}`;

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
await conn.query("CREATE TABLE IF NOT EXISTS `migrations` (`id` int NOT NULL AUTO_INCREMENT, `timestamp` bigint NOT NULL, `name` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
const [rows] = await conn.query("SELECT id FROM `migrations` WHERE name = ?", [name]);
if (!rows.length) await conn.query("INSERT INTO `migrations` (`timestamp`, `name`) VALUES (?, ?)", [timestamp, name]);
await conn.end();
console.log(JSON.stringify({ level: "info", msg: rows.length ? "baseline.already" : "baseline.marked", migration: name }));
