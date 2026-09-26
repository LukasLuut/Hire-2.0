import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, db } from "./helpers.mjs";

// Cliente recusa a proposta do prestador com motivo (e o prestador vê)
const t = await tokens();
const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === 1 && s.negotiable !== false);

test("48. cliente recusa a proposta respondida, com motivo", async () => {
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "Orçamento", budget: "R$ 100" }));
  await req("POST", `/conversations/${q.j.id}/respond`, t.ele, form({ title: "Proposta", description: "x", price: "R$ 300,00 • Pix", deadline: "2 horas" }));
  const r = await req("POST", `/conversations/${q.j.id}/close`, t.cli, { reason: "Valor acima do meu orçamento" });
  assert.equal(r.s, 200);
  assert.equal(r.j.closedBy, "cliente");
  assert.equal(r.j.closeReason, "Valor acima do meu orçamento");
  const seen = (await req("GET", `/conversations/${q.j.id}`, t.ele)).j;
  assert.equal(seen.status, "CLOSED");
  assert.ok(seen.messages.some((m) => /Proposta recusada pelo cliente.*Valor acima/.test(m.text)));
  const [n] = await db("SELECT body FROM notifications WHERE type = 'quote.declined' ORDER BY id DESC LIMIT 1");
  assert.match(n.body, /Motivo: Valor acima/);
  // encerrada: não recebe mais mensagens
  assert.equal((await req("POST", `/conversations/${q.j.id}/messages`, t.ele, form({ text: "E se eu baixar?" }))).s, 400);
});

test("48. encerrar sem motivo continua funcionando", async () => {
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "Outro", budget: "R$ 100" }));
  const r = await req("POST", `/conversations/${q.j.id}/close`, t.ele);
  assert.equal(r.s, 200);
  assert.equal(r.j.closedBy, "prestador");
  assert.equal(r.j.closeReason, null);
});
