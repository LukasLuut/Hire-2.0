import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, db } from "./helpers.mjs";

// Respostas públicas (sem login) não podem trazer dados privados do prestador
const PRIVATE = ["latitude", "longitude", "cnpj", "onlineLink", "whatsNotification", "emailNotification", "verificationFiles", "verificationNote"];
const t = await tokens();

const assertClean = (p, where) => {
  for (const k of PRIVATE) assert.equal(p[k], undefined, `${where}: ${k} exposto`);
  if (!p.showContact) {
    assert.equal(p.professionalEmail, undefined, `${where}: e-mail exposto`);
    assert.equal(p.professionalPhone, undefined, `${where}: telefone exposto`);
  }
  if (p.user) assert.deepEqual(Object.keys(p.user).sort(), ["id", "name"], `${where}: dados da conta`);
};

test("20. perfil, vitrine, serviço e lista não expõem dados privados", async () => {
  await db("UPDATE service_providers SET showContact = 0 WHERE id IN (1,2)");
  const pub = (await req("GET", "/providers/1/public")).j;
  assertClean(pub, "perfil");
  for (const s of pub.services) assertClean(s.provider, "serviço do perfil");
  const list = (await req("GET", "/services")).j;
  for (const s of list) assertClean(s.provider, "vitrine");
  const near = (await req("GET", "/services?lat=-30.03&lng=-51.21")).j;
  assert.ok(near.some((s) => typeof s.distanceKm === "number"), "distância continua calculada");
  for (const s of near) assertClean(s.provider, "vitrine por proximidade");
  assertClean((await req("GET", `/services/${list[0].id}`)).j.provider, "detalhe do serviço");
  for (const p of (await req("GET", "/providers/all")).j) assertClean(p, "lista de prestadores");
});

test("20. contato só aparece quando o prestador escolhe mostrar", async () => {
  assert.equal((await req("PUT", "/providers", t.ele, { showContact: true })).s, 200);
  const pub = (await req("GET", "/providers/1/public")).j;
  assert.equal(pub.showContact, true);
  assert.ok(pub.professionalPhone, "telefone visível com a opção ligada");
  assert.equal(pub.latitude, undefined);
  await req("PUT", "/providers", t.ele, { showContact: false });
  assert.equal((await req("GET", "/providers/1/public")).j.professionalPhone, undefined);
  // o dono continua vendo tudo no próprio painel
  assert.ok((await req("GET", "/providers", t.ele)).j.professionalPhone);
});

test("20. prestador não altera campos protegidos pelo PUT", async () => {
  const before = (await db("SELECT verificationStatus v, userId u FROM service_providers WHERE id = 2"))[0];
  const r = await req("PUT", "/providers", t.lim, { verificationStatus: "verified", verifiedAt: "2020-01-01", user: { id: 1 }, id: 99 });
  assert.equal(r.s, 200);
  const after = (await db("SELECT id, verificationStatus v, userId u FROM service_providers WHERE userId = ?", [before.u]))[0];
  assert.equal(after.id, 2);
  assert.equal(after.v, before.v, "status de verificação não muda pelo cliente");
});
