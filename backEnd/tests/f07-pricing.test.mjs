import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form } from "./helpers.mjs";

const t = await tokens();
const created = [];
const newService = async (fields) => {
  const r = await req("POST", "/services", t.ele, form({ title: "Preço (teste)", description_service: "Teste de preços", categoryId: 1, duration: "1 hora", negotiable: false, requiresScheduling: false, ...fields }));
  if (r.s === 201) created.push(r.j.id);
  return r;
};
const hire = (serviceId, body = {}) => req("POST", "/hires", t.cli, { serviceId, ...body });

test("7. por hora: quantidade obrigatória e total = preço × horas", async () => {
  const s = (await newService({ price: 80, priceUnit: "hora" })).j;
  assert.equal(s.priceUnit, "hora");
  assert.equal((await hire(s.id)).s, 400, "sem quantidade");
  const h = await hire(s.id, { quantity: 3 });
  assert.equal(h.s, 201, JSON.stringify(h.j));
  assert.equal(h.j.price, 240);
  assert.equal(h.j.quantity, 3);
  await req("PUT", `/hires/${h.j.id}`, t.cli, { status: "CANCELADO" });
});

test("7. pacotes: escolher um é obrigatório; preço e nome vêm do pacote", async () => {
  assert.equal((await newService({ price: 100, packages: [{ name: "", price: 10 }] })).s, 400, "pacote sem nome");
  assert.equal((await newService({ price: 100, packages: [1, 2, 3, 4].map((i) => ({ name: `P${i}`, price: i })) })).s, 400, "mais de 3");
  const s = (await newService({ price: 100, packages: [{ name: "Básico", description: "Até 2 h", price: 150 }, { name: "Completo", price: 300 }] })).j;
  assert.equal(s.packages.length, 2);
  assert.equal((await hire(s.id)).s, 400, "sem escolher pacote");
  const h = await hire(s.id, { packageIndex: 1 });
  assert.equal(h.j.price, 300);
  assert.equal(h.j.packageName, "Completo");
  assert.match(h.j.description_service, /Completo/);
  await req("PUT", `/hires/${h.j.id}`, t.cli, { status: "CANCELADO" });
});

test("7. 'a partir de' e 'sob orçamento' só por pedido de orçamento", async () => {
  const a = (await newService({ price: 150, priceUnit: "a_partir_de" })).j;
  assert.equal((await hire(a.id)).s, 400);
  const o = await newService({ price: 0, priceUnit: "orcamento" });
  assert.equal(o.s, 201, "sob orçamento aceita preço zero");
  assert.equal((await hire(o.j.id)).s, 400);
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: o.j.id, description: "Quanto fica?", budget: "R$ 500" }));
  assert.equal(q.s, 201, "pedido de orçamento funciona");
  await req("POST", `/conversations/${q.j.id}/reject`, t.ele, { reason: "teste" });
  assert.equal((await newService({ price: 0, priceUnit: "fixo" })).s, 400, "preço fixo precisa de valor");
});

test("7. limpeza dos serviços de teste", async () => {
  for (const id of created) await req("DELETE", `/services/${id}`, t.ele);
});
