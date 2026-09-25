import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, db } from "./helpers.mjs";

const t = await tokens();
const SERVICE = 3;
const newHire = async () => (await req("POST", "/hires", t.cli, { serviceId: SERVICE })).j;
const put = (id, token, body) => req("PUT", `/hires/${id}`, token, body);
const get = async (id, token = t.cli) => (await req("GET", `/hires/${id}`, token)).j;

test("4. prestador aceita antes de iniciar", async () => {
  const h = await newHire();
  assert.equal((await put(h.id, t.ele, { status_provider: "EM ANDAMENTO" })).s, 400);
  assert.equal((await put(h.id, t.ele, { status_provider: "ACEITO" })).s, 200);
  const after = await get(h.id);
  assert.equal(after.status_provider, "ACEITO");
  assert.ok(after.acceptedAt);
  // cliente ainda pode cancelar antes de começar, com motivo
  assert.equal((await put(h.id, t.cli, { status: "CANCELADO", reason: "Mudei de ideia" })).s, 200);
  const c = await get(h.id);
  assert.equal(c.cancelledBy, "cliente");
  assert.equal(c.cancelReason, "Mudei de ideia");
});

test("4. prestador recusa com motivo; cliente não cancela depois de começar", async () => {
  const h = await newHire();
  assert.equal((await put(h.id, t.ele, { status: "CANCELADO", status_provider: "CANCELADO", reason: "Sem agenda esta semana" })).s, 200);
  const r = await get(h.id);
  assert.equal(r.cancelledBy, "prestador");
  assert.equal(r.cancelReason, "Sem agenda esta semana");
  const notices = (await req("GET", "/notifications", t.cli)).j.items;
  assert.ok(notices.some((n) => n.type === "hire.refused" && /Sem agenda/.test(n.body)));

  const h2 = await newHire();
  await put(h2.id, t.ele, { status_provider: "ACEITO" });
  await put(h2.id, t.ele, { status_provider: "EM ANDAMENTO" });
  assert.equal((await put(h2.id, t.cli, { status: "CANCELADO" })).s, 400, "já começou");
  await put(h2.id, t.ele, { status_provider: "CANCELADO", reason: "limpeza do teste" });
});

test("4. pedido sem resposta expira e avisa as duas partes", async () => {
  const h = await newHire();
  await db("UPDATE hires SET createdAt = NOW() - INTERVAL 3 DAY WHERE id = ?", [h.id]);
  await req("GET", "/hires/me", t.cli); // a leitura já aplica a expiração
  const e = await get(h.id);
  assert.equal(e.status, "CANCELADO");
  assert.equal(e.cancelledBy, "sistema");
  assert.match(e.cancelReason, /Expirado/);
  assert.ok((await req("GET", "/notifications", t.ele)).j.items.some((n) => n.type === "hire.expired"));
});
