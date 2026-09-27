import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, login, pay, db } from "./helpers.mjs";

// Carteira do prestador: saldo, extrato, saque simulado com status; etapas do pagamento do cliente
const t = await tokens();
const adm = await login("admin@hire.dev");
const svc = (await req("POST", "/services", t.ele, form({ title: "Carteira (teste)", description_service: "Teste", price: 200, categoryId: 1, duration: "1 hora", negotiable: false, requiresScheduling: false }))).j;
const hires = [];
const withdrawals = [];

test("59. instruções de Pix e boleto; cartão exige final e até 3x", async () => {
  const h = (await req("POST", "/hires", t.cli, { serviceId: svc.id })).j;
  hires.push(h.id);
  assert.equal((await req("GET", `/hires/${h.id}/pay/instructions?method=pix`, t.cli)).s, 400, "antes do aceite");
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  const pix = (await req("GET", `/hires/${h.id}/pay/instructions?method=pix`, t.cli)).j;
  assert.match(pix.code, /^000201.*BR\.GOV\.BCB\.PIX.*6304[0-9A-F]{4}$/);
  assert.match(pix.qr, /^data:image\/png;base64,/);
  const boleto = (await req("GET", `/hires/${h.id}/pay/instructions?method=boleto`, t.cli)).j;
  assert.match(boleto.barcode, /^\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d+$/);
  assert.equal((await req("GET", `/hires/${h.id}/pay/instructions?method=pix`, t.ele)).s, 403);
  assert.equal((await pay(h.id, t.cli, "cartao", { last4: "12", installments: 1 })).s, 400);
  assert.equal((await pay(h.id, t.cli, "cartao", { last4: "4242", installments: 6 })).s, 400);
  const ok = await pay(h.id, t.cli, "cartao", { last4: "4242", brand: "Visa", installments: 2, number: "4242424242424242" });
  assert.equal(ok.s, 200);
  assert.deepEqual(ok.j.payment.details, { brand: "Visa", last4: "4242", installments: 2 }, "número completo não é guardado");
});

test("59. conclusão libera saldo; saque valida valor e chave; cancela; administração paga", async () => {
  const id = hires[0];
  const before = (await req("GET", "/wallet", t.ele)).j;
  for (const s of ["EM ANDAMENTO", "CONCLUIDO"]) await req("PUT", `/hires/${id}`, t.ele, { status_provider: s });
  await req("PUT", `/hires/${id}`, t.cli, { status: "CONCLUIDO" });
  const w = (await req("GET", "/wallet", t.ele)).j;
  assert.equal(Math.round((w.available - before.available) * 100) / 100, 180, "200 − 10% de taxa");
  assert.ok(w.statement.some((e) => e.kind === "entrada" && e.hireId === id && e.amount === 180));

  assert.equal((await req("POST", "/wallet/withdrawals", t.ele, { amount: 5, pixKeyType: "email", pixKey: "a@b.com" })).s, 400, "mínimo");
  assert.equal((await req("POST", "/wallet/withdrawals", t.ele, { amount: w.available + 1, pixKeyType: "email", pixKey: "a@b.com" })).s, 400, "acima do saldo");
  assert.equal((await req("POST", "/wallet/withdrawals", t.ele, { amount: 50, pixKeyType: "cpf", pixKey: "111.111.111-11" })).s, 400, "CPF inválido");

  const a = await req("POST", "/wallet/withdrawals", t.ele, { amount: 50, pixKeyType: "email", pixKey: "souza@exemplo.com" });
  assert.equal(a.s, 201, JSON.stringify(a.j));
  assert.equal(a.j.status, "SOLICITADO");
  assert.match(a.j.pixKey, /\*\*\*/, "chave mascarada");
  withdrawals.push(a.j.id);
  assert.equal(Math.round(((await req("GET", "/wallet", t.ele)).j.available - (w.available - 50)) * 100), 0, "saque segura o saldo");
  assert.equal((await req("POST", `/wallet/withdrawals/${a.j.id}/cancel`, t.ele)).j.status, "CANCELADO");
  assert.equal(Math.round(((await req("GET", "/wallet", t.ele)).j.available - w.available) * 100), 0, "cancelado devolve");

  const b = (await req("POST", "/wallet/withdrawals", t.ele, { amount: 30, pixKeyType: "cpf", pixKey: "529.982.247-25" })).j;
  withdrawals.push(b.id);
  assert.equal((await req("GET", "/admin/withdrawals", t.cli)).s, 403);
  assert.equal((await req("POST", `/admin/withdrawals/${b.id}`, adm, { action: "process" })).j.status, "EM_PROCESSAMENTO");
  const paid = (await req("POST", `/admin/withdrawals/${b.id}`, adm, { action: "pay" })).j;
  assert.equal(paid.status, "PAGO");
  assert.match(paid.transactionCode, /^PIX-/);
  assert.equal((await req("POST", `/admin/withdrawals/${b.id}`, adm, { action: "refuse", note: "tarde demais" })).s, 400, "pago não volta");
  const after = (await req("GET", "/wallet", t.ele)).j;
  assert.ok(after.statement.some((e) => e.kind === "saque" && e.status === "PAGO" && e.amount === -30));
  assert.equal(after.lastPixKey.type, "cpf");
});

test("59. limpeza", async () => {
  if (withdrawals.length) await db(`DELETE FROM withdrawals WHERE id IN (${withdrawals.join(",")})`);
  if ((await req("DELETE", `/services/${svc.id}`, t.ele)).s >= 400) await req("PUT", `/services/${svc.id}`, t.ele, form({ active: false }));
});
