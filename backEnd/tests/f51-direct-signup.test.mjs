import { test } from "node:test";
import assert from "node:assert/strict";
import { req, login, form, db, PASSWORD } from "./helpers.mjs";

// Cadastro direto: cliente, profissional (CPF) ou pequena empresa (CNPJ, razão social, nome fantasia, porte)
const stamp = Date.now();
const created = [];
const register = (body) => req("POST", "/auth/register", null, { name: "Ana Souza", password: PASSWORD, acceptedTerms: true, ...body });
const COMPANY = { accountType: "empresa", cpf_cnpj: "11.222.333/0001-81", legalName: "Souza Reparos Ltda", tradeName: "Souza Reparos", companySize: "ME" };

test("51. CPF e CNPJ conferidos pelos dígitos", async () => {
  assert.equal((await register({ email: `cpf-${stamp}@hire.dev`, cpf_cnpj: "111.111.111-11" })).s, 400, "CPF inválido");
  const bad = await register({ ...COMPANY, email: `cnpj-${stamp}@hire.dev`, cpf_cnpj: "11.222.333/0001-82" });
  assert.equal(bad.s, 400);
  assert.match(bad.j.message, /CNPJ/);
  assert.equal((await register({ email: `cpfcnpj-${stamp}@hire.dev`, cpf_cnpj: "11.222.333/0001-81" })).s, 400, "pessoa não entra com CNPJ");
});

test("51. empresa exige razão social, nome fantasia e porte pequeno", async () => {
  const email = `emp-bad-${stamp}@hire.dev`;
  assert.equal((await register({ ...COMPANY, email, legalName: "" })).s, 400);
  assert.equal((await register({ ...COMPANY, email, tradeName: "" })).s, 400);
  assert.equal((await register({ ...COMPANY, email, companySize: "GRANDE" })).s, 400);
});

test("51. profissional e empresa: tipo guardado; empresa leva os dados ao perfil profissional", async () => {
  const pro = `pro-${stamp}@hire.dev`;
  const emp = `emp-${stamp}@hire.dev`;
  assert.equal((await register({ email: pro, cpf_cnpj: "529.982.247-25", accountType: "profissional" })).s, 201);
  const r = await register({ ...COMPANY, email: emp });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  created.push(pro, emp);
  assert.equal(r.j.accountType, "empresa");
  assert.equal(r.j.tradeName, "Souza Reparos");
  const [u] = await db("SELECT cpf_cnpj, accountType, companySize FROM users WHERE email = ?", [pro]);
  assert.equal(u.accountType, "profissional");

  const tk = await login(emp);
  const c = await req("POST", "/providers", tk, form({ professionalName: "Ana Souza", professionalEmail: emp, professionalPhone: "51999990000", description: "Reparos residenciais", categoryId: 1 }));
  assert.ok(c.s < 300, JSON.stringify(c.j));
  const [p] = await db("SELECT id, businessType, legalName, companySize, cnpj, companyName FROM service_providers WHERE userId = (SELECT id FROM users WHERE email = ?)", [emp]);
  assert.equal(p.businessType, "empresa");
  assert.equal(p.legalName, "Souza Reparos Ltda");
  assert.equal(p.companySize, "ME");
  assert.equal(p.cnpj, "11.222.333/0001-81");
  assert.equal(p.companyName, "Souza Reparos", "nome fantasia vira o nome do perfil");
  assert.equal((await req("GET", `/providers/${p.id}/public`)).j.businessType, "empresa");
});

test("51. limpeza", async () => {
  for (const email of created) {
    await db("DELETE FROM service_providers WHERE userId = (SELECT id FROM users WHERE email = ?)", [email]);
    await db("DELETE FROM users WHERE email = ?", [email]);
  }
});
