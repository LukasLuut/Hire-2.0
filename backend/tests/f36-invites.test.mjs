import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, form, db, API, PASSWORD } from "./helpers.mjs";

const t = await tokens();
const created = [];
const signup = async (invite) => {
  const email = `convidado-${Date.now()}-${Math.round(Math.random() * 1e4)}@hire.dev`;
  const r = await fetch(API + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pessoa Convidada", email, password: PASSWORD, cpf_cnpj: "529.982.247-25", acceptedTerms: true, invite }),
  });
  assert.equal(r.status, 201);
  const [u] = await db("SELECT id, inviteId, inviteConvertedAt FROM users WHERE email = ?", [email]);
  created.push(u.id);
  return { ...u, email, token: await login(email) };
};

let providerInvite, clientInvite;

test("36/37. criar convite: tipo obrigatório, reaproveita o mesmo contexto, registra quem convidou", async () => {
  assert.equal((await req("POST", "/invites", null, { kind: "provider" })).s, 401);
  assert.equal((await req("POST", "/invites", t.cli, { kind: "x" })).s, 400);
  providerInvite = (await req("POST", "/invites", t.cli, { kind: "provider", context: "Eletricista em São Leopoldo" })).j;
  assert.match(providerInvite.url, /\/convite\/[\w-]{8}$/);
  const again = (await req("POST", "/invites", t.cli, { kind: "provider", context: "Eletricista em São Leopoldo" })).j;
  assert.equal(again.code, providerInvite.code, "mesmo contexto, mesmo link");
  clientInvite = (await req("POST", "/invites", t.ele, { kind: "client" })).j;
  const [a] = await db("SELECT inviterRole FROM invites WHERE code = ?", [providerInvite.code]);
  const [b] = await db("SELECT inviterRole FROM invites WHERE code = ?", [clientInvite.code]);
  assert.equal(b.inviterRole, "prestador");
  assert.ok(["cliente", "prestador"].includes(a.inviterRole));
});

test("36/37. página pública do convite mostra só o primeiro nome", async () => {
  const r = await req("GET", `/invites/${providerInvite.code}`);
  assert.equal(r.s, 200);
  assert.deepEqual(Object.keys(r.j).sort(), ["context", "inviterFirstName", "kind"]);
  assert.equal(r.j.inviterFirstName, "Marina");
  assert.equal((await req("GET", "/invites/xx")).s, 404);
});

test("36/37. cadastro por convite é atribuído; conversão só com a ação certa", async () => {
  const pro = await signup(providerInvite.code);
  assert.ok(pro.inviteId, "cadastro atribuído ao convite");
  // pedido feito por quem foi convidado como profissional não converte
  const svc = (await req("GET", "/services")).j.find((s) => s.requiresScheduling === false && s.priceUnit === "fixo" && !s.packages?.length);
  const h = await req("POST", "/hires", pro.token, { serviceId: svc.id });
  assert.equal(h.s, 201);
  await req("PUT", `/hires/${h.j.id}`, pro.token, { status: "CANCELADO" });
  assert.equal((await db("SELECT inviteConvertedAt c FROM users WHERE id = ?", [pro.id]))[0].c, null);
  // criar a empresa converte
  const c = await req("POST", "/providers", pro.token, form({ companyName: "Convidado Elétrica", professionalName: "Pessoa Convidada", professionalEmail: pro.email, professionalPhone: "51999990000", description: "x", categoryId: 1 }));
  assert.ok(c.s < 300, JSON.stringify(c.j));
  assert.ok((await db("SELECT inviteConvertedAt c FROM users WHERE id = ?", [pro.id]))[0].c, "convertido");

  const cli = await signup(clientInvite.code);
  const h2 = await req("POST", "/hires", cli.token, { serviceId: svc.id });
  assert.equal(h2.s, 201);
  await req("PUT", `/hires/${h2.j.id}`, cli.token, { status: "CANCELADO" });
  assert.ok((await db("SELECT inviteConvertedAt c FROM users WHERE id = ?", [cli.id]))[0].c, "primeiro pedido converte convite de cliente");

  const none = await signup("codigo-invalido");
  assert.equal(none.inviteId, null, "código inválido é ignorado");
});

test("36/37. quem convidou vê cadastros e conversões; métrica de cadastro por convite", async () => {
  const mine = (await req("GET", "/invites/me", t.cli)).j.find((i) => i.code === providerInvite.code);
  assert.equal(mine.signups, 1);
  assert.equal(mine.converted, 1);
  const [m] = await db("SELECT COALESCE(SUM(count),0) c FROM analytics_daily WHERE event = 'signup_from_invite'");
  assert.ok(Number(m.c) >= 2);
});

test("36/37. limpeza", async () => {
  for (const id of created) {
    await db("DELETE s FROM services s JOIN service_providers p ON p.id = s.providerId WHERE p.userId = ?", [id]);
    await db("DELETE FROM hires WHERE userId = ?", [id]);
    await db("DELETE FROM service_providers WHERE userId = ?", [id]);
    await db("DELETE FROM notifications WHERE userId = ?", [id]);
    await db("DELETE FROM users WHERE id = ?", [id]);
  }
  await db("DELETE FROM invites WHERE code IN (?, ?)", [providerInvite.code, clientInvite.code]);
  await db("DELETE FROM analytics_daily WHERE event = 'signup_from_invite'");
});
