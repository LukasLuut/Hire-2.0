// Backup do Hire: banco (SQL compactado) + arquivos enviados (uploads e private_uploads).
//   npm run backup                 → backups/AAAA-MM-DD_HHMMSS/
//   BACKUP_KEEP=7 (padrão)         → mantém só os 7 backups mais recentes
// Lê a conexão do backEnd/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME); a senha não aparece em linha de comando nem em log.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 15);
const outDir = path.join(ROOT, "backups", stamp);
fs.mkdirSync(outDir, { recursive: true });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dateStrings: true,
});

const gzip = zlib.createGzip();
const file = fs.createWriteStream(path.join(outDir, "database.sql.gz"));
gzip.pipe(file);
const out = (s) => new Promise((ok) => (gzip.write(s) ? ok() : gzip.once("drain", ok)));

await out(`-- Backup do Hire (${new Date().toISOString()})\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`);
const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
const summary = {};
for (const row of tables) {
  const table = Object.values(row)[0];
  const [[create]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
  await out(`DROP TABLE IF EXISTS \`${table}\`;\n${create["Create Table"]};\n`);
  let count = 0;
  for (let offset = 0; ; offset += 500) {
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 500 OFFSET ${offset}`);
    if (!rows.length) break;
    const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ");
    // colunas JSON chegam como objeto: vão como texto JSON (escape de objeto viraria "chave = valor")
    const value = (v) => (Buffer.isBuffer(v) ? `X'${v.toString("hex")}'` : v !== null && typeof v === "object" ? conn.escape(JSON.stringify(v)) : conn.escape(v));
    const values = rows.map((r) => `(${Object.values(r).map(value).join(", ")})`).join(",\n");
    await out(`INSERT INTO \`${table}\` (${cols}) VALUES\n${values};\n`);
    count += rows.length;
  }
  summary[table] = count;
  await out("\n");
}
await out("SET FOREIGN_KEY_CHECKS = 1;\n");
gzip.end();
await new Promise((ok) => file.on("finish", ok));
await conn.end();

// arquivos enviados pelos usuários
for (const dir of ["uploads", "private_uploads"]) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(outDir, dir), { recursive: true });
}
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), database: process.env.DB_NAME, tables: summary }, null, 2));

// retenção
const keep = Number(process.env.BACKUP_KEEP) || 7;
const all = fs.readdirSync(path.join(ROOT, "backups")).filter((d) => /^\d{8}_\d{6}$/.test(d)).sort();
for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(ROOT, "backups", old), { recursive: true, force: true });

const total = Object.values(summary).reduce((a, b) => a + b, 0);
console.log(JSON.stringify({ level: "info", msg: "backup.done", dir: path.relative(ROOT, outDir), tables: Object.keys(summary).length, rows: total }));
