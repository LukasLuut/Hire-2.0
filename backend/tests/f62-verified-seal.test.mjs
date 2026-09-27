import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, db } from "./helpers.mjs";

// Selo "Conta verificada": cadastro completo + e-mail confirmado + identidade (e CNPJ, se empresa) conferidos
const t = await tokens();
const [p] = await db(
  "SELECT sp.id, sp.userId, sp.profileImageUrl, sp.description, sp.professionalPhone, sp.professionalEmail, sp.baseCity, sp.categoryId, sp.businessType, sp.cnpj, sp.verificationStatus, sp.verifiedAt, sp.companyVerifiedAt, u.emailVerified FROM service_providers sp JOIN users u ON u.id = sp.userId WHERE u.email = 'eletricista@hire.dev'"
);

const publicVerified = async () => (await req("GET", `/providers/${p.id}/public`)).j.verified;
const set = (sql, args = []) => db(sql, [...args, p.id]);

test("62. selo só com cadastro completo e todas as validações", async () => {
  try {
    await set("UPDATE service_providers SET profileImageUrl = COALESCE(profileImageUrl, '/uploads/teste.png'), description = 'Eletricista de teste', professionalPhone = '51999990000', professionalEmail = 'eletricista@hire.dev', baseCity = COALESCE(baseCity, 'Porto Alegre'), categoryId = COALESCE(categoryId, 1), businessType = 'autonomo', verificationStatus = 'verified', verifiedAt = NOW() WHERE id = ?");
    await db("UPDATE users SET emailVerified = 1 WHERE id = ?", [p.userId]);
    assert.equal(await publicVerified(), true, "tudo em dia: selo");
    const mine = (await req("GET", "/providers", t.ele)).j;
    assert.equal(mine.verified, true, "o dono também vê o selo");

    await db("UPDATE users SET emailVerified = 0 WHERE id = ?", [p.userId]);
    assert.equal(await publicVerified(), false, "sem e-mail confirmado");
    await db("UPDATE users SET emailVerified = 1 WHERE id = ?", [p.userId]);

    await set("UPDATE service_providers SET verificationStatus = 'pending' WHERE id = ?");
    assert.equal(await publicVerified(), false, "identidade em análise");
    await set("UPDATE service_providers SET verificationStatus = 'verified' WHERE id = ?");

    await set("UPDATE service_providers SET description = '' WHERE id = ?");
    assert.equal(await publicVerified(), false, "cadastro incompleto");
    await set("UPDATE service_providers SET description = 'Eletricista de teste' WHERE id = ?");

    await set("UPDATE service_providers SET businessType = 'empresa', cnpj = '12345678000199', companyVerifiedAt = NULL WHERE id = ?");
    assert.equal(await publicVerified(), false, "empresa sem CNPJ conferido");
    await set("UPDATE service_providers SET companyVerifiedAt = NOW() WHERE id = ?");
    assert.equal(await publicVerified(), true, "empresa com CNPJ conferido");
  } finally {
    await set(
      "UPDATE service_providers SET profileImageUrl = ?, description = ?, professionalPhone = ?, professionalEmail = ?, baseCity = ?, categoryId = ?, businessType = ?, cnpj = ?, verificationStatus = ?, verifiedAt = ?, companyVerifiedAt = ? WHERE id = ?",
      [p.profileImageUrl, p.description, p.professionalPhone, p.professionalEmail, p.baseCity, p.categoryId, p.businessType, p.cnpj, p.verificationStatus, p.verifiedAt, p.companyVerifiedAt]
    );
    await db("UPDATE users SET emailVerified = ? WHERE id = ?", [p.emailVerified, p.userId]);
  }
});

test("62. selo não expõe os dados da verificação", async () => {
  const pub = (await req("GET", `/providers/${p.id}/public`)).j;
  assert.equal(typeof pub.verified, "boolean");
  assert.equal(pub.cnpj, undefined);
  assert.equal(pub.verificationFiles, undefined);
});
