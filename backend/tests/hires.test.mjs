import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens } from "./helpers.mjs";

const t = await tokens();
// Serviço 3 (tomadas) é do prestador 1 e não exige agendamento nos dados de teste
const SERVICE = 3;
const newHire = async () => {
  const r = await req("POST", "/hires", t.cli, { serviceId: SERVICE, price: 1, userId: 999 });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  return r.j;
};
const setStatus = (id, token, body) => req("PUT", `/hires/${id}`, token, body);

test("cliente vem do token e o preço vem do serviço", async () => {
  const hire = await newHire();
  const full = (await req("GET", `/hires/${hire.id}`, t.cli)).j;
  assert.equal(full.user.id, 1);
  assert.notEqual(full.price, 1);
  await setStatus(hire.id, t.cli, { status: "CANCELADO" });
});

test("prestador não contrata o próprio serviço", async () => {
  assert.equal((await req("POST", "/hires", t.ele, { serviceId: SERVICE })).s, 400);
});

test("terceiros não veem nem alteram", async () => {
  const hire = await newHire();
  assert.equal((await req("GET", `/hires/${hire.id}`, t.lim)).s, 403);
  assert.equal((await setStatus(hire.id, t.lim, { status_provider: "CANCELADO" })).s, 403);
  assert.equal((await req("GET", "/hires/provider/1", t.lim)).s, 403);
  await setStatus(hire.id, t.cli, { status: "CANCELADO" });
});

test("etapas em ordem: não pula, não volta, não cancela depois de entregue", async () => {
  const { id } = await newHire();
  assert.equal((await setStatus(id, t.cli, { status_provider: "EM ANDAMENTO" })).s, 403, "cliente não inicia");
  assert.equal((await setStatus(id, t.ele, { status_provider: "CONCLUIDO" })).s, 400, "não pula para entregue");
  assert.equal((await setStatus(id, t.ele, { status_provider: "EM ANDAMENTO" })).s, 400, "não inicia sem aceitar");
  assert.equal((await setStatus(id, t.cli, { status: "CONCLUIDO" })).s, 400, "cliente não confirma antes");
  assert.equal((await setStatus(id, t.ele, { status_provider: "ACEITO" })).s, 200);
  assert.equal((await setStatus(id, t.ele, { status_provider: "ACEITO" })).s, 400, "não aceita duas vezes");
  assert.equal((await setStatus(id, t.ele, { status_provider: "EM ANDAMENTO" })).s, 200);
  assert.equal((await setStatus(id, t.ele, { status_provider: "EM ANDAMENTO" })).s, 400, "não inicia duas vezes");
  assert.equal((await setStatus(id, t.ele, { status_provider: "CONCLUIDO" })).s, 200);
  assert.equal((await setStatus(id, t.ele, { status_provider: "EM ANDAMENTO" })).s, 400, "não volta");
  assert.equal((await setStatus(id, t.ele, { status_provider: "CANCELADO" })).s, 400, "prestador não cancela entregue");
  assert.equal((await setStatus(id, t.cli, { status: "CANCELADO" })).s, 400, "cliente não cancela entregue");
  assert.equal((await setStatus(id, t.cli, { status: "CONCLUIDO" })).s, 200);
  assert.equal((await setStatus(id, t.cli, { status: "CANCELADO" })).s, 400, "encerrada");
});

test("avaliações mútuas com fotos depois de concluída", async () => {
  const { id } = await newHire();
  await setStatus(id, t.ele, { status_provider: "ACEITO" });
  await setStatus(id, t.ele, { status_provider: "EM ANDAMENTO" });
  await setStatus(id, t.ele, { status_provider: "CONCLUIDO" });
  await setStatus(id, t.cli, { status: "CONCLUIDO" });
  const { PNG } = await import("./helpers.mjs");
  const f = new FormData();
  f.append("hireId", String(id));
  f.append("rating", "5");
  f.append("comment", "Teste automatizado");
  f.append("photos", new Blob([PNG], { type: "image/png" }), "a.png");
  const r1 = await req("POST", "/reviews", t.cli, f);
  assert.equal(r1.s, 201, JSON.stringify(r1.j));
  assert.equal(r1.j.photos.length, 1);
  const f2 = new FormData();
  f2.append("hireId", String(id));
  f2.append("rating", "4");
  assert.equal((await req("POST", "/reviews", t.ele, f2)).s, 201);
  assert.equal((await req("POST", "/reviews", t.ele, f2)).s, 400, "uma avaliação por lado");
});
