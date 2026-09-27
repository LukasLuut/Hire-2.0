import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, pay, db } from "./helpers.mjs";

// Endereço do atendimento presencial (privado até o aceite) e horários reais de início/fim
const t = await tokens();
const mk = async (online) => (await req("POST", "/services", t.ele, form({ title: `Endereço ${online ? "online" : "presencial"} (teste)`, description_service: "Teste", price: 80, categoryId: 1, duration: "1 hora", negotiable: false, requiresScheduling: false, online }))).j;
const presencial = await mk(false);
const online = await mk(true);
const ADDRESS = { postalCode: "93010-000", street: "Rua Teste", num: "123", complement: "Ap 4", neighborhood: "Centro", city: "São Leopoldo", state: "rs" };

test("49. pedido presencial copia o endereço do cadastro; online não tem endereço", async () => {
  assert.equal(online.online, true);
  const a = (await req("POST", "/hires", t.cli, { serviceId: presencial.id })).j;
  const b = (await req("POST", "/hires", t.cli, { serviceId: online.id })).j;
  const [ra] = await db("SELECT serviceAddress FROM hires WHERE id = ?", [a.id]);
  const [rb] = await db("SELECT serviceAddress FROM hires WHERE id = ?", [b.id]);
  const addr = typeof ra.serviceAddress === "string" ? JSON.parse(ra.serviceAddress) : ra.serviceAddress;
  assert.ok(addr?.street && addr.city, "endereço copiado do cadastro");
  assert.equal(rb.serviceAddress, null);
  assert.equal((await req("PUT", `/hires/${b.id}/address`, t.cli, ADDRESS)).s, 400, "online não pede endereço");
});

test("49. prestador vê só bairro/cidade antes de aceitar; completo depois", async () => {
  const h = (await req("POST", "/hires", t.cli, { serviceId: presencial.id })).j;
  const listed = () => req("GET", `/hires/provider/1`, t.ele).then((r) => r.j.find((x) => x.id === h.id));
  const before = await listed();
  assert.equal(before.serviceAddress.street, "");
  assert.ok(before.serviceAddress.city);
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  assert.ok((await listed()).serviceAddress.street, "depois do aceite vê a rua");
  const bad = await req("PUT", `/hires/${h.id}/address`, t.cli, { ...ADDRESS, postalCode: "123" });
  assert.equal(bad.s, 400);
  assert.equal((await req("PUT", `/hires/${h.id}/address`, t.ele, ADDRESS)).s, 403, "prestador não troca");
  const ok = await req("PUT", `/hires/${h.id}/address`, t.cli, ADDRESS);
  assert.equal(ok.s, 200, JSON.stringify(ok.j));
  assert.equal(ok.j.serviceAddress.state, "RS");
  assert.equal(ok.j.serviceAddress.complement, "Ap 4");
});

test("49. sem endereço o prestador não inicia; horários reais ficam registrados", async () => {
  const h = (await req("POST", "/hires", t.cli, { serviceId: presencial.id })).j;
  await db("UPDATE hires SET serviceAddress = NULL WHERE id = ?", [h.id]);
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  await pay(h.id, t.cli);
  const blocked = await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "EM ANDAMENTO" });
  assert.equal(blocked.s, 400);
  assert.match(blocked.j.message, /endereço/);
  await req("PUT", `/hires/${h.id}/address`, t.cli, ADDRESS);
  assert.equal((await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "EM ANDAMENTO" })).s, 200);
  assert.equal((await req("PUT", `/hires/${h.id}/address`, t.cli, ADDRESS)).s, 400, "não troca depois de começar");
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "CONCLUIDO" });
  await req("PUT", `/hires/${h.id}`, t.cli, { status: "CONCLUIDO" });
  const [r] = await db("SELECT startedAt, finishedAt, confirmedAt FROM hires WHERE id = ?", [h.id]);
  assert.ok(r.startedAt && r.finishedAt && r.confirmedAt);
  assert.ok(new Date(r.startedAt) <= new Date(r.finishedAt) && new Date(r.finishedAt) <= new Date(r.confirmedAt));
  const done = (await req("GET", `/hires/provider/1`, t.ele)).j.find((x) => x.id === h.id);
  assert.equal(done.serviceAddress.street, "", "encerrado: volta a esconder a rua");
});

test("49. limpeza", async () => {
  await db(`UPDATE hires SET status='CANCELADO', status_provider='CANCELADO' WHERE serviceId IN (${presencial.id}, ${online.id}) AND status = 'PENDENTE'`);
  await req("DELETE", `/services/${presencial.id}`, t.ele);
  await req("DELETE", `/services/${online.id}`, t.ele);
});
