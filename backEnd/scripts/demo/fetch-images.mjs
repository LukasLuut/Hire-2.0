// Baixa as fotos dos dados de demonstração para uploads/demo (fica fora do Git).
// Gera um conjunto bruto por busca; as fotos em uso hoje foram revisadas à mão (algumas trocadas por fotos do
// Wikimedia Commons, créditos em uploads/demo/CREDITS.json) — o backup (npm run backup) guarda a pasta uploads.
//   node scripts/demo/fetch-images.mjs            → baixa o que falta (pode rodar de novo)
// Fotos de serviços: Openverse (Creative Commons, uso comercial permitido; créditos em uploads/demo/CREDITS.json).
// Fotos de perfil: randomuser.me (retratos gratuitos para protótipos).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "./catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, "uploads", "demo");
const PER_QUERY = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// títulos/tags que não queremos ver num marketplace
const BLOCK = /\b(ass|butt|nude|naked|sexy|bikini|lingerie|gun|weapon|blood|dead|death|protest|war|police|funeral|drunk|beer|cigarette|smoking|meme|cartoon|logo|screenshot|map|diagram|text)\b/i;

fs.mkdirSync(OUT, { recursive: true });
const creditsFile = path.join(OUT, "CREDITS.json");
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, "utf8")) : {};

async function download(url, file) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "HireTCC-demo/1.0" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!/image\/(jpeg|png|webp)/.test(type)) throw new Error(`tipo ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 15000 || buf.length > 4_000_000) throw new Error(`tamanho ${buf.length}`);
  fs.writeFileSync(file, buf);
}

// 1) fotos de serviços por busca
const queries = [...new Set(Object.values(CATALOG).flatMap((c) => c.templates.map((t) => t.query)))];
let done = 0;
for (const q of queries) {
  const dir = path.join(OUT, slug(q));
  fs.mkdirSync(dir, { recursive: true });
  const have = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).length;
  if (have >= PER_QUERY) { done++; continue; }
  const api = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&license_type=commercial&mature=false&size=medium,large&aspect_ratio=wide,square`;
  let results = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(api, { headers: { "User-Agent": "HireTCC-demo/1.0" } });
    if (res.status === 429) { console.log("limite de requisições; aguardando 60 s"); await sleep(60000); continue; }
    results = (await res.json()).results ?? [];
    break;
  }
  let n = have;
  for (const r of results) {
    if (n >= PER_QUERY) break;
    const words = `${r.title ?? ""} ${(r.tags ?? []).map((t) => t.name).join(" ")}`;
    if (BLOCK.test(words)) continue;
    const file = path.join(dir, `${n + 1}.jpg`);
    try {
      await download(r.url, file);
      credits[`${slug(q)}/${n + 1}.jpg`] = { title: r.title, creator: r.creator, license: `${r.license} ${r.license_version ?? ""}`.trim(), source: r.foreign_landing_url };
      n++;
    } catch {
      // tenta a miniatura do Openverse quando o original falha
      try {
        await download(`https://api.openverse.org/v1/images/${r.id}/thumb/`, file);
        credits[`${slug(q)}/${n + 1}.jpg`] = { title: r.title, creator: r.creator, license: `${r.license} ${r.license_version ?? ""}`.trim(), source: r.foreign_landing_url };
        n++;
      } catch { /* próxima */ }
    }
  }
  done++;
  console.log(`[${done}/${queries.length}] ${q}: ${n} fotos`);
  fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
  await sleep(3500); // 20 buscas/min no acesso anônimo
}

// 2) retratos para perfis
const avatars = path.join(OUT, "avatars");
fs.mkdirSync(avatars, { recursive: true });
for (const g of ["men", "women"]) {
  for (let i = 0; i < 90; i++) {
    const file = path.join(avatars, `${g}-${i}.jpg`);
    if (fs.existsSync(file)) continue;
    try {
      const res = await fetch(`https://randomuser.me/api/portraits/${g}/${i}.jpg`);
      if (res.ok) fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } catch { /* ignora */ }
  }
}
console.log("fotos prontas em uploads/demo");
