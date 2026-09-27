import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, db, API, PASSWORD } from "./helpers.mjs";

// Campos protegidos não podem vir do cliente (papel, verificação, dono de registro)
const t = await tokens();

test("cadastro não aceita papel de administrador nem e-mail já confirmado", async () => {
  const email = `mass-${Date.now()}@hire.dev`;
  const r = await fetch(API + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Mass Test", email, password: PASSWORD, cpf_cnpj: "529.982.247-25", acceptedTerms: true, role: "admin", emailVerified: true, blocked: false, id: 1 }),
  });
  assert.equal(r.status, 201);
  const [u] = await db("SELECT id, role, emailVerified FROM users WHERE email = ?", [email]);
  try {
    assert.notEqual(u.id, 1);
    assert.equal(u.role, "user");
    assert.equal(Number(u.emailVerified), 0);
    assert.equal((await req("GET", "/admin/overview", await login(email))).s, 403);
  } finally {
    await db("DELETE FROM users WHERE id = ?", [u.id]);
  }
});

test("endereço: não sobrescreve o endereço de outra pessoa", async () => {
  const [victim] = await db("SELECT a.id, a.street FROM users u JOIN address a ON a.id = u.addressId WHERE u.email = 'eletricista@hire.dev'");
  const [mine] = await db("SELECT addressId FROM users WHERE email = 'limpeza@hire.dev'");
  await req("POST", "/users/me/address", t.lim, { id: victim.id, street: "HACK", num: 1, neighborhood: "x", city: "Caxias do Sul", state: "RS", country: "Brasil", postalCode: "95000-000" });
  const [after] = await db("SELECT street FROM address WHERE id = ?", [victim.id]);
  assert.equal(after.street, victim.street, "endereço da vítima intacto");
  const [me] = await db("SELECT a.id, a.street FROM users u JOIN address a ON a.id = u.addressId WHERE u.email = 'limpeza@hire.dev'");
  assert.equal(me.street, "HACK", "gravou no próprio endereço");
  if (mine.addressId) assert.equal(me.id, mine.addressId, "reaproveita o registro existente");
  // desfaz: a conta de teste volta ao estado anterior (sem endereço, se não tinha)
  if (!mine.addressId) {
    await db("UPDATE users SET addressId = NULL WHERE email = 'limpeza@hire.dev'");
    await db("DELETE FROM address WHERE id = ?", [me.id]);
  }
});
