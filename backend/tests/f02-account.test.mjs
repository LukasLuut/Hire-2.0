import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { req, login } from "./helpers.mjs";

// Sem SMTP configurado, os e-mails ficam em backend/outbox: o teste lê o link de lá
const OUTBOX = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "outbox");
function lastLink(to, kind) {
  const files = fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX).filter((f) => f.includes(to.replace(/[^\w.@-]/g, "_"))).sort() : [];
  for (const f of files.reverse()) {
    const m = fs.readFileSync(path.join(OUTBOX, f), "utf8").match(new RegExp(`/${kind}\\?token=([a-f0-9]{64})`));
    if (m) return m[1];
  }
  return null;
}

const email = `conta-${Date.now()}@hire.dev`;
const PASS = "Teste@123";

test("2. cadastro envia link de confirmação; link confirma o e-mail uma única vez", async () => {
  const r = await req("POST", "/auth/register", null, { name: "Conta Nova", email, password: PASS, cpf_cnpj: "529.982.247-25", acceptedTerms: true });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const token = lastLink(email, "verificar-email");
  assert.ok(token, "e-mail de confirmação gerado");
  const t = await login(email);
  assert.equal((await req("GET", "/users/me", t)).j.emailVerified, false);
  assert.equal((await req("POST", "/auth/resend-verification", t)).s, 429, "reenviar só depois de 1 minuto");
  assert.equal((await req("POST", "/auth/verify-email", null, { token })).s, 200);
  assert.equal((await req("GET", "/users/me", t)).j.emailVerified, true);
  assert.equal((await req("POST", "/auth/verify-email", null, { token })).s, 400, "link de uso único");
});

test("2. esqueci a senha: resposta igual para e-mail existente e inexistente", async () => {
  const a = await req("POST", "/auth/forgot-password", null, { email: "nao-existe@hire.dev" });
  const b = await req("POST", "/auth/forgot-password", null, { email });
  assert.equal(a.s, 200);
  assert.equal(a.j.message, b.j.message);
});

test("2. redefinir senha: regras da senha, uso único, senha antiga deixa de valer", async () => {
  const token = lastLink(email, "redefinir-senha");
  assert.ok(token);
  assert.equal((await req("POST", "/auth/reset-password", null, { token, password: "fraca" })).s, 400);
  assert.equal((await req("POST", "/auth/reset-password", null, { token, password: "Nova@4567" })).s, 200);
  assert.equal((await req("POST", "/auth/reset-password", null, { token, password: "Outra@4567" })).s, 400, "uso único");
  const old = await req("POST", "/auth/login", null, { email, password: PASS });
  assert.notEqual(old.s, 200, "senha antiga não entra");
  const neu = await req("POST", "/auth/login", null, { email, password: "Nova@4567" });
  assert.equal(neu.s, 200);
  assert.equal((await req("POST", "/auth/reset-password", null, { token: "0".repeat(64), password: "Nova@4567" })).s, 400, "token inventado");
});
