import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, login, pay, db } from "./helpers.mjs";

// Pagamento simulado: depois do aceite, antes de iniciar; taxa da plataforma e líquido do prestador
const t = await tokens();
const svc = (await req("POST", "/services", t.ele, form({ title: "Pagamento (teste)", description_service: "Teste", price: 250, categoryId: 1, duration: "1 hora", negotiable: false, requiresScheduling: false }))).j;
const newHire = async () => (await req("POST", "/hires", t.cli, { serviceId: svc.id })).j;
const hires = [];

test("47. só depois do aceite, só o cliente, forma válida, uma vez", async () => {
  const h = await newHire();
  hires.push(h.id);
  assert.match((await pay(h.id, t.cli)).j.message, /aceitar/);
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  assert.equal((await pay(h.id, t.ele)).s, 403);
  assert.equal((await pay(h.id, t.cli, "bitcoin")).s, 400);
  const before = (await req("GET", "/providers/me/earnings", t.ele)).j;
  const r = await pay(h.id, t.cli, "cartao");
  assert.equal(r.s, 200, JSON.stringify(r.j));
  const p = r.j.payment;
  assert.equal(p.status, "PAGO");
  assert.equal(p.amount, 250);
  assert.equal(p.fee + p.net, 250);
  assert.equal(p.fee, Math.round(250 * p.feePercent) / 100);
  assert.match(p.transactionCode, /^SIM-/);
  assert.equal((await pay(h.id, t.cli)).s, 400, "não paga duas vezes");
  const after = (await req("GET", "/providers/me/earnings", t.ele)).j;
  assert.equal(Math.round((after.pending - before.pending) * 100) / 100, p.net, "entra em 'a receber'");
});

test("47. conclusão confirmada libera o líquido ao prestador", async () => {
  const id = hires[0];
  const before = (await req("GET", "/providers/me/earnings", t.ele)).j;
  for (const s of ["EM ANDAMENTO", "CONCLUIDO"]) assert.equal((await req("PUT", `/hires/${id}`, t.ele, { status_provider: s })).s, 200);
  await req("PUT", `/hires/${id}`, t.cli, { status: "CONCLUIDO" });
  const [row] = await db("SELECT p.status, p.net, p.releasedAt FROM payments p WHERE p.hireId = ?", [id]);
  assert.equal(row.status, "LIBERADO");
  assert.ok(row.releasedAt);
  const after = (await req("GET", "/providers/me/earnings", t.ele)).j;
  assert.equal(Math.round((after.available - before.available) * 100) / 100, Number(row.net));
});

test("47. cancelar depois de pago estorna", async () => {
  const h = await newHire();
  hires.push(h.id);
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  await pay(h.id, t.cli, "pix");
  await req("PUT", `/hires/${h.id}`, t.cli, { status: "CANCELADO", reason: "teste" });
  const [row] = await db("SELECT status, refundedAt FROM payments WHERE hireId = ?", [h.id]);
  assert.equal(row.status, "ESTORNADO");
  assert.ok(row.refundedAt);
});

test("47. administração vê pagamentos e totais; outros não", async () => {
  assert.equal((await req("GET", "/payments", t.cli)).s, 403);
  const r = await req("GET", "/payments", await login("admin@hire.dev"));
  assert.equal(r.s, 200);
  assert.ok(r.j.payments.some((p) => p.hireId === hires[0] && p.status === "LIBERADO"));
  assert.ok(r.j.totals.some((x) => x.status === "ESTORNADO"));
  assert.equal(typeof r.j.feePercent, "number");
});

test("47. limpeza", async () => {
  await req("DELETE", `/services/${svc.id}`, t.ele);
});
