import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, db } from "./helpers.mjs";
import { negotiateUntilAgreed } from "./helpers-negotiation.mjs";

// Escritas críticas em transação: aceites simultâneos geram um contrato; pagamentos simultâneos, uma cobrança
const t = await tokens();
const svc = (await req("POST", "/services", t.ele, form({ title: "Concorrência (teste)", description_service: "Teste", price: 150, categoryId: 1, duration: "1 hora", negotiable: true, requiresScheduling: false }))).j;
const hires = [];

test("57. aceites ao mesmo tempo formalizam uma vez só", async () => {
  const cid = await negotiateUntilAgreed({ client: t.cli, provider: t.ele, serviceId: svc.id });
  const [a, b] = await Promise.all([req("POST", `/conversations/${cid}/accept`, t.cli), req("POST", `/conversations/${cid}/accept`, t.ele)]);
  assert.equal(a.s, 200, JSON.stringify(a.j));
  assert.equal(b.s, 200, JSON.stringify(b.j));
  const [{ n: contracts }] = await db("SELECT COUNT(*) AS n FROM contracts c JOIN negotiations v ON v.contractId = c.id WHERE v.conversationId = ? AND v.serviceId = ?", [cid, svc.id]);
  const [{ n: created }] = await db("SELECT COUNT(*) AS n FROM hires WHERE serviceId = ?", [svc.id]);
  assert.equal(Number(contracts), 1);
  assert.equal(Number(created), 1, "uma contratação");
  assert.ok(a.j.formalized || b.j.formalized, "o segundo aceite formaliza");
  hires.push((await db("SELECT id FROM hires WHERE serviceId = ?", [svc.id]))[0].id);
});

test("57. dois pagamentos ao mesmo tempo: uma cobrança", async () => {
  const id = hires[0];
  const results = await Promise.all([1, 2, 3].map(() => req("POST", `/hires/${id}/pay`, t.cli, { method: "pix" })));
  assert.equal(results.filter((r) => r.s === 200).length, 1, JSON.stringify(results.map((r) => r.s)));
  for (const r of results.filter((r) => r.s !== 200)) assert.match(r.j.message, /já foi pago/);
  const [{ n }] = await db("SELECT COUNT(*) AS n FROM payments WHERE hireId = ?", [id]);
  assert.equal(Number(n), 1);
});

test("57. limpeza", async () => {
  for (const id of hires) await req("PUT", `/hires/${id}`, t.cli, { status: "CANCELADO", reason: "teste" });
  if ((await req("DELETE", `/services/${svc.id}`, t.ele)).s >= 400) await req("PUT", `/services/${svc.id}`, t.ele, form({ active: false }));
});
