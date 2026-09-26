import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, form, PNG, db } from "./helpers.mjs";

// Verificações separadas: e-mail, identidade, empresa, certificados — só o que foi conferido aparece
const t = await tokens();
const adm = await login("admin@hire.dev");
const png = (name) => [name, PNG, `${name}.png`, "image/png"];
const [lim] = await db("SELECT id, cnpj, verificationStatus, verifiedAt, companyVerifiedAt, credentialsVerifiedAt FROM service_providers WHERE id = 2");
const reset = () => db("UPDATE service_providers SET verificationStatus='none', verificationFiles=NULL, verifiedAt=NULL, companyVerifiedAt=NULL, credentialsVerifiedAt=NULL WHERE id = 2");

test("26. preencher CNPJ não torna a empresa verificada", async () => {
  await reset();
  await req("PUT", "/providers", t.lim, { cnpj: "11.222.333/0001-81" });
  const pub = (await req("GET", "/providers/2/public")).j;
  assert.equal(pub.companyVerified, false);
  assert.equal(pub.credentialsVerified, false);
  assert.notEqual(pub.verificationStatus, "verified");
  assert.equal(pub.emailVerified, true, "e-mail confirmado vem da conta");
});

test("26. empresa e certificados só com o documento correspondente", async () => {
  await req("POST", "/providers/me/verification", t.lim, form({}, [png("idDocument")]));
  const bad = await req("POST", "/admin/verifications/2", adm, { approve: true, company: true });
  assert.equal(bad.s, 400, "sem comprovante de empresa");
  assert.equal((await req("POST", "/admin/verifications/2", adm, { approve: true, credentials: true })).s, 400, "sem certificado");

  await req("POST", "/providers/me/verification", t.lim, form({}, [png("idDocument"), png("companyDocument"), png("certifications")]));
  const ok = await req("POST", "/admin/verifications/2", adm, { approve: true, company: true, credentials: true });
  assert.equal(ok.s, 200, JSON.stringify(ok.j));
  const pub = (await req("GET", "/providers/2/public")).j;
  assert.equal(pub.verificationStatus, "verified");
  assert.equal(pub.companyVerified, true);
  assert.equal(pub.credentialsVerified, true);
  assert.equal(pub.companyVerifiedAt, undefined, "datas internas não saem");
});

test("26. trocar o CNPJ derruba a verificação da empresa", async () => {
  await req("PUT", "/providers", t.lim, { cnpj: "22.333.444/0001-90" });
  assert.equal((await req("GET", "/providers/2/public")).j.companyVerified, false);
  assert.equal((await req("GET", "/providers/2/public")).j.verificationStatus, "verified", "identidade continua");
});

test("26. restaura estado", async () => {
  await db("UPDATE service_providers SET cnpj=?, verificationStatus=?, verifiedAt=?, companyVerifiedAt=?, credentialsVerifiedAt=?, verificationFiles=NULL WHERE id = 2",
    [lim.cnpj, lim.verificationStatus, lim.verifiedAt, lim.companyVerifiedAt, lim.credentialsVerifiedAt]);
});
