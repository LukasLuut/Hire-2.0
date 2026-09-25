import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form } from "./helpers.mjs";

const t = await tokens();
const SERVICE = 3; // prestador 1 (eletricista)

const latest = async (token) => (await req("GET", "/notifications", token)).j;
const has = (list, type) => list.items.some((n) => n.type === type && !n.read);

test("1. avisos: exigem login e começam lidos após marcar", async () => {
  assert.equal((await req("GET", "/notifications")).s, 401);
  await req("POST", "/notifications/read", t.cli);
  await req("POST", "/notifications/read", t.ele);
  assert.equal((await latest(t.cli)).unread, 0);
});

test("1. contratação gera avisos e pendências para a parte certa", async () => {
  const h = (await req("POST", "/hires", t.cli, { serviceId: SERVICE })).j;
  let ele = await latest(t.ele);
  assert.ok(has(ele, "hire.requested"), "prestador avisado do pedido");
  assert.ok(ele.items[0].link === "/progress");
  let pend = (await req("GET", "/notifications/pending", t.ele)).j;
  assert.ok(pend.some((p) => p.kind === "hire.start"), "pendência: iniciar");

  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "EM ANDAMENTO" });
  assert.ok(has(await latest(t.cli), "hire.started"), "cliente avisado do início");
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "CONCLUIDO" });
  assert.ok(has(await latest(t.cli), "hire.delivered"));
  pend = (await req("GET", "/notifications/pending", t.cli)).j;
  assert.ok(pend.some((p) => p.kind === "hire.confirm"), "pendência: confirmar");

  await req("PUT", `/hires/${h.id}`, t.cli, { status: "CONCLUIDO" });
  assert.ok(has(await latest(t.ele), "hire.done"));
  pend = (await req("GET", "/notifications/pending", t.cli)).j;
  assert.ok(pend.some((p) => p.kind === "review"), "pendência: avaliar");
});

test("1. negociação: pedido, resposta e mensagens (agrupadas)", async () => {
  await req("POST", "/notifications/read", t.cli);
  await req("POST", "/notifications/read", t.ele);
  const q = (await req("POST", "/conversations/request", t.cli, form({ serviceId: 2, description: "Aviso de teste", budget: "R$ 50" }))).j;
  assert.ok(has(await latest(t.ele), "quote.requested"));
  assert.ok((await req("GET", "/notifications/pending", t.ele)).j.some((p) => p.kind === "quote.respond"));
  await req("POST", `/conversations/${q.id}/respond`, t.ele, form({ description: "Proposta", price: "R$ 80" }));
  assert.ok(has(await latest(t.cli), "quote.responded"));
  assert.ok((await req("GET", "/notifications/pending", t.cli)).j.some((p) => p.kind === "topics.review"), "pendência: responder proposta");

  const before = (await latest(t.ele)).items.filter((n) => n.type === "message").length;
  await req("POST", `/conversations/${q.id}/messages`, t.cli, form({ text: "oi 1" }));
  await req("POST", `/conversations/${q.id}/messages`, t.cli, form({ text: "oi 2" }));
  const msgs = (await latest(t.ele)).items.filter((n) => n.type === "message");
  assert.equal(msgs.length, before + 1, "duas mensagens seguidas viram um aviso");
  assert.match(msgs[0].body, /oi 2/);
  await req("POST", `/conversations/${q.id}/reject`, t.ele, { reason: "teste" });
  assert.ok(has(await latest(t.cli), "quote.rejected"));
});

test("1. marcar como lido", async () => {
  const list = await latest(t.cli);
  const one = list.items.find((n) => !n.read);
  const after = (await req("POST", `/notifications/${one.id}/read`, t.cli)).j;
  assert.equal(after.unread, list.unread - 1);
  assert.equal((await req("POST", "/notifications/read", t.cli)).j.unread, 0);
});
