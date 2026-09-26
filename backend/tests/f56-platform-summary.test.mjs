import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login } from "./helpers.mjs";

// Relatórios da plataforma: só administração, só números agregados
const t = await tokens();

test("56. resumo por período", async () => {
  assert.equal((await req("GET", "/admin/summary", t.cli)).s, 403);
  const adm = await login("admin@hire.dev");
  const r = await req("GET", "/admin/summary?days=7", adm);
  assert.equal(r.s, 200);
  assert.equal(r.j.days, 7);
  for (const k of ["hires", "money", "quotes", "rating", "people", "categories", "daily"]) assert.ok(k in r.j, k);
  assert.ok(r.j.hires.completionRate >= 0 && r.j.hires.completionRate <= 100);
  assert.ok(r.j.money.revenue <= r.j.money.gmv);
  assert.equal((await req("GET", "/admin/summary?days=999", adm)).j.days, 30, "período fora da lista vira 30 dias");
  const text = JSON.stringify(r.j);
  assert.doesNotMatch(text, /@|cpf|email/i, "sem dados pessoais");
});
