import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, form, PNG, API, db } from "./helpers.mjs";

const t = await tokens();
const adm = await login("admin@hire.dev");

// pedido concluído entre cliente e eletricista para disputar
const svc = (await req("POST", "/services", t.ele, form({ title: "Disputa (teste)", description_service: "Teste", price: 50, categoryId: 1, duration: "1 hora", negotiable: false, requiresScheduling: false }))).j;
const hire = (await req("POST", "/hires", t.cli, { serviceId: svc.id })).j;
for (const s of ["ACEITO", "EM ANDAMENTO", "CONCLUIDO"]) await req("PUT", `/hires/${hire.id}`, t.ele, { status_provider: s });
await req("PUT", `/hires/${hire.id}`, t.cli, { status: "CONCLUIDO" });
let report;

test("14. relatar problema: validações, anexo privado, pedido em disputa", async () => {
  assert.equal((await req("POST", "/reports", t.cli, form({ hireId: hire.id, reason: "xyz", description: "Não veio no horário combinado" }))).s, 400);
  assert.equal((await req("POST", "/reports", t.cli, form({ hireId: hire.id, reason: "servico_ruim", description: "curto" }))).s, 400);
  assert.equal((await req("POST", "/reports", t.lim, form({ hireId: hire.id, reason: "servico_ruim", description: "Não participo mas quero relatar" }))).s, 403);
  const r = await req("POST", "/reports", t.cli, form({ hireId: hire.id, reason: "servico_ruim", description: "A tomada instalada parou de funcionar no dia seguinte." }, [["files", PNG, "prova.png", "image/png"]]));
  assert.equal(r.s, 201, JSON.stringify(r.j));
  report = r.j;
  assert.equal(report.files.length, 1);
  assert.doesNotMatch(report.files[0], /^\/uploads\//, "anexo fora da pasta pública");
  assert.equal((await req("POST", "/reports", t.cli, form({ hireId: hire.id, reason: "outro", description: "Outro relato no mesmo pedido" }))).s, 409);

  // anexo: quem relatou e admin veem; a outra parte e sem login, não
  const get = (tk) => fetch(API + report.files[0], { headers: tk ? { Authorization: "Bearer " + tk } : {} }).then((x) => x.status);
  assert.equal(await get(t.cli), 200);
  assert.equal(await get(adm), 200);
  assert.equal(await get(t.ele), 403);
  assert.equal(await get(null), 401);

  const h = (await req("GET", `/hires/${hire.id}`, t.ele)).j;
  assert.equal(h.disputed, true);
  const rv = await req("POST", "/reviews", t.ele, form({ hireId: hire.id, rating: 5, comment: "ok" }));
  assert.equal(rv.s, 400);
  assert.match(rv.j.message, /análise/);
  const notes = (await req("GET", "/notifications", t.ele)).j;
  assert.ok((Array.isArray(notes) ? notes : notes.items ?? []).some((n) => n.type === "report.opened"), "outra parte avisada");
});

test("14. denúncia de perfil", async () => {
  const provider = (await req("GET", `/services/${svc.id}`, t.cli)).j.provider;
  assert.equal((await req("POST", "/reports", t.ele, form({ providerId: provider.id, reason: "fraude", description: "Denunciando a mim mesmo" }))).s, 400);
  const r = await req("POST", "/reports", t.lim, form({ providerId: provider.id, reason: "comportamento", description: "Perfil com informações falsas (teste)" }));
  assert.equal(r.s, 201);
  assert.equal((await req("GET", "/reports/mine", t.lim)).j[0].provider.id, provider.id);
  await req("POST", `/admin/reports/${r.j.id}/resolve`, adm, { status: "DESCARTADA", resolution: "Teste automatizado" });
});

test("14. administração analisa e libera o pedido", async () => {
  assert.equal((await req("GET", "/admin/reports", t.cli)).s, 403);
  const open = (await req("GET", "/admin/reports?status=ABERTA", adm)).j;
  const mine = open.find((r) => r.id === report.id);
  assert.ok(mine && mine.reporter.id && mine.parties.provider.name);
  assert.ok((await req("GET", "/admin/overview", adm)).j.openReports >= 1);
  assert.equal((await req("POST", `/admin/reports/${report.id}/resolve`, adm, { status: "RESOLVIDA", resolution: "" })).s, 400);
  const done = await req("POST", `/admin/reports/${report.id}/resolve`, adm, { status: "RESOLVIDA", resolution: "Prestador refez a instalação sem custo." });
  assert.equal(done.s, 200);
  assert.equal((await req("POST", `/admin/reports/${report.id}/resolve`, adm, { status: "DESCARTADA", resolution: "de novo" })).s, 400);
  assert.equal((await req("GET", `/hires/${hire.id}`, t.cli)).j.disputed, false);
  const mineList = (await req("GET", "/reports/mine", t.cli)).j;
  assert.equal(mineList.find((r) => r.id === report.id).status, "RESOLVIDA");
});

test("14. limpeza", async () => {
  await req("DELETE", `/services/${svc.id}`, t.ele);
});
