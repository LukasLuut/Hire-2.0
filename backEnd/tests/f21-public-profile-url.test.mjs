import { test } from "node:test";
import assert from "node:assert/strict";
import { req, db, login, form, PASSWORD } from "./helpers.mjs";

test("21/22. todo prestador tem slug único e legível", async () => {
  const rows = await db("SELECT id, slug FROM service_providers");
  assert.ok(rows.length > 0);
  const slugs = rows.map((r) => r.slug);
  assert.ok(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), JSON.stringify(slugs));
  assert.equal(new Set(slugs).size, slugs.length, "sem duplicados");
  assert.ok(slugs.includes("souza-eletrica"));
});

test("21/22. perfil público abre por slug e por id (links antigos), sem login", async () => {
  const bySlug = await req("GET", "/providers/souza-eletrica/public");
  assert.equal(bySlug.s, 200);
  assert.equal(bySlug.j.slug, "souza-eletrica");
  const byId = await req("GET", `/providers/${bySlug.j.id}/public`);
  assert.equal(byId.j.slug, "souza-eletrica");
  assert.equal((await req("GET", "/providers/nao-existe-xyz/public")).s, 404);
  assert.equal((await req("GET", "/providers/..%2Fadmin/public")).s, 404, "texto fora do formato de slug");
  assert.equal((await req("GET", "/providers/' OR 1=1 --/public")).s, 404);
});

test("21/22. slug é estável ao renomear e conflitos ganham sufixo", async () => {
  const [lim] = await db("SELECT id, slug, companyName FROM service_providers WHERE id = 2");
  // conflito real: outro prestador com o mesmo nome ganha sufixo
  const email = `slug-${Date.now()}@hire.dev`;
  await req("POST", "/auth/register", null, { name: "Teste Slug", email, password: PASSWORD, cpf_cnpj: "529.982.247-25", acceptedTerms: true });
  const tk = await login(email);
  const c = await req("POST", "/providers", tk, form({ companyName: lim.companyName, professionalName: "Teste Slug", professionalEmail: email, professionalPhone: "51999990000", description: "x", categoryId: 1 }));
  try {
    assert.ok(c.s < 300, JSON.stringify(c.j));
    const [twin] = await db("SELECT slug FROM service_providers WHERE userId = (SELECT id FROM users WHERE email = ?)", [email]);
    assert.match(twin.slug, new RegExp(`^${lim.slug}-[0-9]+$`));
  } finally {
    await req("DELETE", "/users/me", tk);
    await db("DELETE FROM users WHERE email = ?", [email]);
  }
  await db("UPDATE service_providers SET companyName = ? WHERE id = 2", ["Lima Limpeza Renomeada"]);
  const pub = (await req("GET", "/providers/2/public")).j;
  assert.equal(pub.slug, lim.slug, "renomear não quebra links já compartilhados");
  await db("UPDATE service_providers SET companyName = ? WHERE id = 2", [lim.companyName]);
});
