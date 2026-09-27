import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, db } from "./helpers.mjs";

// Orçamento "Outros": pedido direto ao prestador, fora dos serviços publicados
const t = await tokens();

test("60. pedido de orçamento sem serviço (Outros)", async () => {
  assert.equal((await req("POST", "/conversations/request", t.cli, form({ description: "x", budget: "R$ 10" }))).s, 400, "sem serviço nem prestador");
  const r = await req("POST", "/conversations/request", t.cli, form({ providerId: 1, description: "Instalar um ventilador de teto", budget: "R$ 150" }));
  assert.equal(r.s, 201, JSON.stringify(r.j));
  assert.equal(r.j.service, null, "conversa sem serviço");
  assert.equal(r.j.requestStatus, "PENDENTE");
  assert.equal(r.j.request.description, "Instalar um ventilador de teto");
  const [n] = await db("SELECT title FROM notifications WHERE type = 'quote.requested' ORDER BY id DESC LIMIT 1");
  assert.match(n.title, /outro serviço/);
  // o pedido de orçamento de um serviço publicado continua separado
  const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === 1 && s.negotiable !== false);
  const s2 = await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "Outro pedido", budget: "R$ 100" }));
  assert.equal(s2.j.id, r.j.id, "mesma conversa do par");
  assert.notEqual(s2.j.negotiationId, r.j.negotiationId, "negociação própria");
  await db("UPDATE negotiations SET status = 'CLOSED' WHERE id IN (?, ?)", [r.j.negotiationId, s2.j.negotiationId]);
});
