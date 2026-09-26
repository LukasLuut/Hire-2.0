import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login } from "./helpers.mjs";

test("41. retrato regional: oferta, clientes (contagem) e páginas; só administração", async () => {
  const t = await tokens();
  assert.equal((await req("GET", "/admin/regions", t.cli)).s, 403);
  const r = await req("GET", "/admin/regions", await login("admin@hire.dev"));
  assert.equal(r.s, 200);
  const poa = r.j.regions.find((x) => x.city === "Porto Alegre");
  assert.ok(poa.providers >= 1 && poa.services >= 1 && poa.categories >= 1);
  const sl = r.j.regions.find((x) => x.city === "São Leopoldo");
  assert.ok(sl && sl.clients >= 1 && sl.providers === 0 && sl.lowSupply, "demanda sem oferta aparece");
  for (const row of r.j.regions) assert.deepEqual(Object.keys(row).sort(), ["categories", "city", "clients", "lowSupply", "providers", "services", "state"], "só contagens");
  assert.ok(r.j.pages.some((p) => p.citySlug === "porto-alegre-rs"));
});
