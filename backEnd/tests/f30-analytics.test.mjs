import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, db } from "./helpers.mjs";

const t = await tokens();

test("analytics: evento válido soma no dia, sem dados pessoais", async () => {
  const before = (await req("GET", "/analytics/me", t.ele)).j.totals.profile_view;
  assert.equal((await req("POST", "/analytics/event", null, { event: "profile_view", providerId: 1, source: "qr" })).s, 200);
  assert.equal((await req("POST", "/analytics/event", null, { event: "profile_view", providerId: 1, source: "qr" })).s, 200);
  const me = (await req("GET", "/analytics/me", t.ele)).j;
  assert.equal(me.totals.profile_view, before + 2);
  assert.ok(me.viewSources.qr >= 2);
  const cols = (await db("SHOW COLUMNS FROM analytics_daily")).map((c) => c.Field);
  assert.deepEqual(cols.sort(), ["count", "day", "event", "id", "providerId", "serviceId", "source"].sort(), "nenhuma coluna de IP/usuário");
});

test("analytics: serviço define o prestador; entradas inválidas recusadas", async () => {
  const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === 2);
  await req("POST", "/analytics/event", null, { event: "service_view", serviceId: svc.id, providerId: 1 });
  const [row] = await db("SELECT providerId FROM analytics_daily WHERE event='service_view' AND serviceId=? ORDER BY id DESC LIMIT 1", [svc.id]);
  assert.equal(row.providerId, 2, "prestador vem do serviço, não do cliente");
  assert.equal((await req("POST", "/analytics/event", null, { event: "hack" })).s, 400);
  assert.equal((await req("POST", "/analytics/event", null, { event: "signup_from_invite" })).s, 400, "só o servidor registra cadastro por convite");
  assert.equal((await req("POST", "/analytics/event", null, { event: "profile_view", providerId: 999999 })).s, 400);
  await req("POST", "/analytics/event", null, { event: "copy_link", providerId: 1, source: "<script>" });
  const [src] = await db("SELECT source FROM analytics_daily WHERE event='copy_link' ORDER BY id DESC LIMIT 1");
  assert.equal(src.source, "direct", "origem desconhecida vira direct");
});

test("analytics: totais só do próprio prestador; admin vê geral", async () => {
  assert.equal((await req("GET", "/analytics/me")).s, 401);
  assert.equal((await req("GET", "/analytics/me", await login("admin@hire.dev"))).s, 404, "conta sem empresa");
  const adm = (await req("GET", "/admin/overview", await login("admin@hire.dev"))).j;
  assert.ok(adm.acquisition.profile_view >= 2);
});

test("analytics: limite por IP", async () => {
  let limited = false;
  for (let i = 0; i < 70 && !limited; i++) {
    const r = await req("POST", "/analytics/event", null, { event: "share_click", providerId: 4 });
    if (r.s === 429) limited = true;
  }
  assert.ok(limited, "429 depois de 60 eventos por minuto");
});

test("analytics: limpeza dos contadores do teste", async () => {
  // os eventos do teste não devem aparecer nas estatísticas das contas de demonstração
  await db("DELETE FROM analytics_daily WHERE day >= CURDATE() - INTERVAL 1 DAY AND (providerId = 4 OR source = 'qr' OR event IN ('copy_link', 'service_view'))");
});
