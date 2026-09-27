import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, form, db, API } from "./helpers.mjs";
import { negotiateUntilAgreed } from "./helpers-negotiation.mjs";

// Conta suspensa some do público e não recebe pedidos; RN02; formalização reconfere o acordo
const t = await tokens();
const adm = await login("admin@hire.dev");
const [lim] = await db("SELECT p.id, p.slug, u.id AS userId FROM service_providers p JOIN users u ON u.id = p.userId WHERE p.id = 2");
const limServices = (await req("GET", "/services")).j.filter((s) => s.provider?.id === 2);
const simple = limServices.find((s) => !s.requiresScheduling && !s.packages?.length && s.priceUnit === "fixo");

// prestadores na página "Limpeza em Caxias do Sul" (a página pode ter outras contas)
const limPage = async () => (await req("GET", "/discover")).j.find((p) => p.citySlug === "caxias-do-sul-rs" && p.categoryId === 2)?.providers ?? 0;
test("RN11: conta suspensa — perfil, serviços, listas e pedidos", async () => {
  const pageBefore = await limPage();
  assert.equal((await req("POST", `/admin/users/${lim.userId}/block`, adm, { blocked: true, reason: "teste" })).s, 200);
  try {
    assert.equal((await req("GET", `/providers/${lim.slug}/public`)).s, 404, "perfil some (sem expor a suspensão)");
    assert.ok(!(await req("GET", "/services")).j.some((s) => s.provider?.id === 2), "fora da vitrine");
    assert.equal((await req("GET", `/services/${simple.id}`)).s, 404);
    assert.ok(!(await req("GET", "/providers/all")).j.some((p) => p.id === 2));
    assert.equal(await limPage(), Math.max(0, pageBefore - 1), "sai da página da cidade");
    assert.doesNotMatch(await (await fetch(API + "/sitemap.xml")).text(), new RegExp(`/prestador/${lim.slug}<`));
    assert.equal((await req("POST", "/hires", t.cli, { serviceId: simple.id })).s, 400, "não recebe pedido");
    assert.equal((await req("POST", "/conversations", t.cli, { providerId: 2 })).s, 400, "não recebe conversa");
    const fav = (await req("GET", "/services/favorites", t.cli)).j;
    for (const f of fav.filter((s) => s.provider?.id === 2)) assert.equal(f.active, false, "favorito aparece indisponível");
  } finally {
    await req("POST", `/admin/users/${lim.userId}/block`, adm, { blocked: false });
  }
  assert.equal((await req("GET", `/providers/${lim.slug}/public`)).s, 200, "reativada volta");
});

test("RN02: lista de prestadores só com quem tem serviço ativo", async () => {
  const all = (await req("GET", "/providers/all")).j;
  const [noService] = await db("SELECT p.id FROM service_providers p WHERE NOT EXISTS (SELECT 1 FROM services s WHERE s.providerId = p.id AND s.active = 1) LIMIT 1");
  if (noService) assert.ok(!all.some((p) => p.id === noService.id));
  assert.ok(all.some((p) => p.id === 1));
});

test("RN15: aceite reconfere o acordo (serviço pausado durante a negociação)", async () => {
  const cid = await negotiateUntilAgreed({ client: t.cli, provider: t.lim, serviceId: simple.id });
  try {
    await req("PUT", `/services/${simple.id}`, t.lim, form({ active: false }));
    const r = await req("POST", `/conversations/${cid}/accept`, t.cli);
    assert.equal(r.s, 400);
    assert.match(r.j.message, /pausado/);
    const [c] = await db("SELECT clientAcceptedAt FROM negotiations WHERE conversationId = ? ORDER BY updatedAt DESC, id DESC LIMIT 1", [cid]);
    assert.equal(c.clientAcceptedAt, null, "aceite não gravado");
  } finally {
    await req("PUT", `/services/${simple.id}`, t.lim, form({ active: true }));
    await db("UPDATE negotiations SET status = 'CLOSED' WHERE conversationId = ?", [cid]);
  }
});
