// Baixa as fotos da apresentação (elenco da landing) para uploads/story — fica fora do Git, como uploads/demo.
//   npm run story:images      → baixa o que falta (pode rodar de novo)
// Fotos: Wikimedia Commons (licenças CC BY / CC BY-SA / domínio público; autor e licença em images.json
// e em uploads/story/CREDITS.json). Retratos dos clientes: randomuser.me (retratos gratuitos para protótipos).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "uploads", "story");
const { photos, avatars } = JSON.parse(fs.readFileSync(path.join(HERE, "images.json"), "utf8"));
const UA = { "User-Agent": "HireTCC-demo/1.0 (apresentacao do produto)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(path.join(OUT, "avatars"), { recursive: true });

async function save(url, file) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// endereço da imagem no Commons: miniatura de 1920 px quando o original é maior (fotos de 6000 px pesariam demais)
async function commonsUrl(title) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [k, v] of Object.entries({ action: "query", format: "json", titles: title, prop: "imageinfo", iiprop: "url|size", iiurlwidth: "1920" })) u.searchParams.set(k, v);
  let data;
  for (let attempt = 0; !data; attempt++) {
    const res = await fetch(u, { headers: UA });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) data = await res.json();
    else if (attempt < 4) { console.log("limite de requisições do Commons; aguardando 20 s"); await sleep(20000); }
    else throw new Error(`Commons respondeu ${res.status}`);
  }
  const info = Object.values(data.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info) throw new Error("arquivo não encontrado no Commons");
  return info.width > 1920 ? info.thumburl : info.url;
}

let ok = 0;
for (const p of photos) {
  const file = path.join(OUT, p.file);
  if (fs.existsSync(file)) { ok++; continue; }
  try {
    await save(await commonsUrl(p.commons), file);
    ok++;
    console.log(`✓ ${p.file}`);
  } catch (e) {
    console.log(`✗ ${p.file}: ${e.message}`);
  }
  await sleep(1500);
}
for (const a of avatars) {
  const file = path.join(OUT, a.file);
  if (fs.existsSync(file)) { ok++; continue; }
  try {
    await save(`https://randomuser.me/api/portraits/${a.randomuser}`, file);
    ok++;
  } catch (e) {
    console.log(`✗ ${a.file}: ${e.message}`);
  }
}
fs.writeFileSync(path.join(OUT, "CREDITS.json"), JSON.stringify(Object.fromEntries(photos.map((p) => [p.file, { author: p.author, license: p.license, source: p.source }])), null, 2));
console.log(`${ok}/${photos.length + avatars.length} imagens em uploads/story`);
