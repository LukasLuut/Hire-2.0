import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, db } from "./helpers.mjs";
import { negotiateUntilAgreed } from "./helpers-negotiation.mjs";

// Chat v2: uma conversa por par, negociações dentro dela, conversa segue depois do contrato
const t = await tokens();
const svc = (await req("POST", "/services", t.ele, form({ title: "Chat v2 (teste)", description_service: "Teste", price: 180, categoryId: 1, duration: "1 hora", negotiable: true, requiresScheduling: false }))).j;
const providerId = svc.provider?.id ?? (await req("GET", `/services/${svc.id}`)).j.provider.id;

test("61. uma conversa por par: chat, serviço e pedido caem na mesma", async () => {
  const chat = await req("POST", "/conversations", t.cli, { providerId });
  assert.equal(chat.s, 201, JSON.stringify(chat.j));
  const bySvc = await req("POST", "/conversations", t.cli, { serviceId: svc.id });
  assert.equal(bySvc.j.id, chat.j.id, "mesma conversa");
  assert.equal(bySvc.j.negotiation?.service?.id, svc.id, "negociação do serviço aberta");
  const again = await req("POST", "/conversations", t.cli, { serviceId: svc.id });
  assert.equal(again.j.negotiationId, bySvc.j.negotiationId, "reaproveita a negociação aberta do serviço");
  const [{ n }] = await db("SELECT COUNT(*) AS n FROM conversations c JOIN users u ON u.id = c.clientId WHERE c.id = ? ", [chat.j.id]);
  assert.equal(Number(n), 1);
});

test("61. conversa continua depois do contrato e a negociação sai de cena", async () => {
  const cid = await negotiateUntilAgreed({ client: t.cli, provider: t.ele, serviceId: svc.id });
  await req("POST", `/conversations/${cid}/accept`, t.cli);
  const done = await req("POST", `/conversations/${cid}/accept`, t.ele);
  assert.equal(done.j.formalized, true, JSON.stringify(done.j));
  const msg = await req("POST", `/conversations/${cid}/messages`, t.cli, form({ text: "Obrigado! Até amanhã." }));
  assert.equal(msg.s, 201, "mensagem liberada depois do contrato");
  const conv = (await req("GET", `/conversations/${cid}`, t.cli)).j;
  const formalized = conv.negotiations.find((x) => x.id === done.j.negotiationId);
  assert.equal(formalized.status, "FORMALIZED");
  assert.ok(formalized.contractCode, "card do contrato");
  assert.ok(conv.messages.some((m) => m.event === "negotiation.formalized" && m.negotiationId === formalized.id), "marco na linha do tempo");
});

test("61. prestador cria proposta sob medida; cliente não pode", async () => {
  const conv = (await req("POST", "/conversations", t.cli, { providerId })).j;
  const denied = await req("POST", `/conversations/${conv.id}/negotiations`, t.cli, { custom: { title: "X", description: "Y", price: "R$ 10" } });
  assert.equal(denied.s, 403);
  const r = await req("POST", `/conversations/${conv.id}/negotiations`, t.ele, { custom: { title: "Instalação sob medida", description: "Dois pontos de tomada", price: "R$ 320,00", duration: "3 horas", saveToCatalog: true } });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const n = r.j.negotiation;
  assert.equal(n.origin, "sob_medida");
  assert.equal(n.waitingFor, "cliente", "espera o cliente");
  assert.ok(n.service?.id, "salvo no catálogo");
  assert.equal(n.topics.find((x) => x.key === "payment").proposedBy, "prestador");
  await db("UPDATE negotiations SET status = 'CLOSED' WHERE id = ?", [n.id]);
  await db("UPDATE services SET active = 0 WHERE id = ?", [n.service.id]);
});

test("61. cliente propõe dentro da conversa sem apagar outra negociação", async () => {
  const conv = (await req("POST", "/conversations", t.cli, { serviceId: svc.id })).j;
  const first = conv.negotiationId;
  const p = await req("POST", `/conversations/${conv.id}/negotiations`, t.cli, { proposal: { description: "Trocar o chuveiro", budget: "R$ 90" } });
  assert.equal(p.s, 201, JSON.stringify(p.j));
  assert.notEqual(p.j.negotiationId, first);
  assert.equal(p.j.negotiation.requestStatus, "PENDENTE");
  assert.equal(p.j.negotiation.waitingFor, "prestador");
  const all = (await req("GET", `/conversations/${conv.id}`, t.cli)).j.negotiations;
  assert.ok(all.find((x) => x.id === first && x.status === "OPEN"), "a outra continua aberta");
  assert.equal((await req("POST", `/conversations/${conv.id}/negotiations`, t.ele, { proposal: { description: "a", budget: "1" } })).s, 403);
  await db("UPDATE negotiations SET status = 'CLOSED' WHERE conversationId = ?", [conv.id]);
});

test("61. não lidas no servidor, busca e filtros", async () => {
  const conv = (await req("POST", "/conversations", t.cli, { providerId })).j;
  await req("POST", `/conversations/${conv.id}/read`, t.ele);
  await req("POST", `/conversations/${conv.id}/messages`, t.cli, form({ text: "Pergunta rápida (teste de não lida)" }));
  let mine = (await req("GET", "/conversations?filter=unread", t.ele)).j.find((c) => c.id === conv.id);
  assert.ok(mine?.unread >= 1, "conta a mensagem nova");
  assert.equal((await req("POST", `/conversations/${conv.id}/read`, t.ele)).s, 200);
  mine = (await req("GET", "/conversations", t.ele)).j.find((c) => c.id === conv.id);
  assert.equal(mine.unread, 0, "lida");
  const cli = (await req("GET", "/conversations", t.cli)).j.find((c) => c.id === conv.id);
  assert.equal(cli.unread, 0, "a própria mensagem não conta");
  const page = (await req("GET", "/conversations?limit=1", t.cli)).j;
  assert.equal(page.length, 1, "paginado");
  const name = conv.provider.companyName || conv.provider.professionalName;
  assert.ok((await req("GET", `/conversations?q=${encodeURIComponent(name.slice(0, 5))}`, t.cli)).j.some((c) => c.id === conv.id), "busca pelo nome");
});

test("61. mensagem longa demais é recusada", async () => {
  const conv = (await req("POST", "/conversations", t.cli, { providerId })).j;
  const r = await req("POST", `/conversations/${conv.id}/messages`, t.cli, form({ text: "a".repeat(2001) }));
  assert.equal(r.s, 400);
  assert.match(r.j.message, /longa/);
});
