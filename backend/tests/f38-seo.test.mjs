import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { req, tokens, API } from "./helpers.mjs";

// As meta tags só são servidas quando existe o build do frontend (Hire/dist)
const hasBuild = fs.existsSync(path.join(import.meta.dirname, "..", "..", "Hire", "dist", "index.html"));
const html = (p, ua = "WhatsApp/2.23") => fetch(API + p, { headers: { Accept: "text/html", "User-Agent": ua }, redirect: "manual" });
const meta = (h, prop) => (h.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`)) ?? [])[1];

test("38. robots.txt bloqueia áreas privadas e aponta o sitemap", async () => {
  const r = await (await fetch(API + "/robots.txt")).text();
  for (const p of ["/home", "/business", "/admin", "/hires", "/negotiation/"]) assert.match(r, new RegExp(`Disallow: ${p}`));
  assert.match(r, /Sitemap: .*\/sitemap\.xml/);
});

test("38. sitemap só com páginas públicas que têm conteúdo", async () => {
  const x = await (await fetch(API + "/sitemap.xml")).text();
  assert.match(x, /<urlset/);
  assert.match(x, /\/prestador\/souza-eletrica</);
  assert.doesNotMatch(x, /\/prestador\/teste-checklist</, "prestador sem serviço ativo fica de fora");
  assert.doesNotMatch(x, /\/(home|business|admin|hires)</);
  const svcs = (await req("GET", "/services")).j;
  assert.ok(svcs.every((s) => x.includes(`/service/${s.id}<`)), "serviços ativos listados");
});

test("40. perfil público tem title, description, canonical e Open Graph no HTML", { skip: !hasBuild && "sem build do frontend" }, async () => {
  const r = await html("/prestador/souza-eletrica");
  assert.equal(r.status, 200);
  const h = await r.text();
  assert.match(h, /<title>Souza Elétrica — Reformas e reparos em Porto Alegre\/RS \| Hire\.<\/title>/);
  assert.match(h, /<link rel="canonical" href="[^"]+\/prestador\/souza-eletrica" \/>/);
  assert.equal(meta(h, "og:type"), "profile");
  assert.ok(meta(h, "og:description").length > 20);
  assert.match(meta(h, "og:url"), /\/prestador\/souza-eletrica$/);
  assert.match(meta(h, "robots"), /^index/);
  assert.equal((h.match(/<title>/g) ?? []).length, 1, "um title só");
  assert.doesNotMatch(h, /99999-0001|contato@souzaeletrica/, "sem contato privado no HTML");
});

test("40. link antigo redireciona (301) e páginas privadas/inexistentes não indexam", { skip: !hasBuild && "sem build do frontend" }, async () => {
  const r = await html("/provider/1?src=qr");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "/prestador/souza-eletrica?src=qr");
  assert.match(meta(await (await html("/business")).text(), "robots"), /noindex/);
  const missing = await html("/prestador/nao-existe");
  assert.equal(missing.status, 404);
  assert.match(meta(await missing.text(), "robots"), /noindex/);
  const svc = (await req("GET", "/services")).j[0];
  const sh = await (await html(`/service/${svc.id}`)).text();
  assert.match(sh, new RegExp(`<link rel="canonical" href="[^"]+/service/${svc.id}"`));
});

test("40. valores são escapados no HTML (sem injeção pela descrição)", { skip: !hasBuild && "sem build do frontend" }, async () => {
  const t = await tokens();
  const before = (await req("GET", "/providers", t.lim)).j.description;
  await req("PUT", "/providers", t.lim, { description: `Limpeza "top" <script>alert(1)</script>` });
  try {
    const h = await (await html("/prestador/lima-limpeza")).text();
    assert.doesNotMatch(h, /<script>alert\(1\)<\/script>/);
    assert.match(meta(h, "description"), /&quot;top&quot; &lt;script&gt;/);
  } finally {
    await req("PUT", "/providers", t.lim, { description: before });
  }
});

test("38. API continua respondendo JSON nas rotas que também são páginas", async () => {
  const t = await tokens();
  const r = await fetch(API + "/hires/me", { headers: { Authorization: "Bearer " + t.cli } });
  assert.match(r.headers.get("content-type"), /json/);
  const adm = await fetch(API + "/admin/overview", { headers: { Accept: "application/json" } });
  assert.equal(adm.status, 401);
});
