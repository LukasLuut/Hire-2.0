// Restaura um backup feito por scripts/backup.mjs.
//   npm run restore -- backups/AAAA-MM-DD_HHMMSS            → no banco do .env (pede --yes)
//   npm run restore -- backups/AAAA-MM-DD_HHMMSS --db=outro  → em outro banco (criado se não existir)
// Substitui as tabelas do banco de destino e copia de volta uploads/ e private_uploads/ (só no banco do .env).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const target = args.find((a) => a.startsWith("--db="))?.slice(5) || process.env.DB_NAME;
const sameDb = target === process.env.DB_NAME;
if (!dir || !fs.existsSync(path.join(ROOT, dir, "database.sql.gz"))) {
  console.error("Informe a pasta do backup, ex.: npm run restore -- backups/20260926_120000");
  process.exit(1);
}
if (!/^[\w]+$/.test(target)) {
  console.error("Nome de banco inválido");
  process.exit(1);
}
if (sameDb && !args.includes("--yes")) {
  console.error(`Isto substitui os dados do banco ${target}. Rode de novo com --yes para confirmar.`);
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${target}\` CHARACTER SET utf8mb4`);
await conn.query(`USE \`${target}\``);
const sql = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, dir, "database.sql.gz"))).toString("utf8");
await conn.query(sql);
await conn.end();

if (sameDb) {
  for (const d of ["uploads", "private_uploads"]) {
    const src = path.join(ROOT, dir, d);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(ROOT, d), { recursive: true });
  }
}
console.log(JSON.stringify({ level: "info", msg: "restore.done", database: target, from: dir }));
