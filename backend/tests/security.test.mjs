import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { req, tokens } from "./helpers.mjs";

const t = await tokens();

test("token assinado com o antigo segredo fixo é recusado", async () => {
  const forged = jwt.sign({ id: 1, name: "x", email: "cliente@hire.dev", about: "" }, "23412343");
  assert.equal((await req("GET", "/users/me", forged)).s, 401);
});

test("rotas protegidas exigem token", async () => {
  for (const path of ["/users/me", "/hires/me", "/conversations", "/contracts/1"]) {
    assert.equal((await req("GET", path)).s, 401, path);
  }
});

test("PUT /users/me só altera nome e sobre", async () => {
  const before = (await req("GET", "/users/me", t.cli)).j;
  const r = await req("PUT", "/users/me", t.cli, {
    id: 2,
    email: "invasor@hire.dev",
    cpf_cnpj: "00000000000",
    password: "Outra@123",
    acceptedTerms: false,
    about: before.about ?? "",
  });
  assert.equal(r.s, 200);
  const after = (await req("GET", "/users/me", t.cli)).j;
  assert.equal(after.id, before.id);
  assert.equal(after.email, before.email);
  assert.equal(after.cpf_cnpj, before.cpf_cnpj);
  // a senha continua a mesma: o login com a senha de teste ainda funciona
  assert.ok((await tokens()).cli);
});

test("PUT /users/me valida o nome", async () => {
  assert.equal((await req("PUT", "/users/me", t.cli, { name: "<script>" })).s, 400);
});

test("pagamentos e escrita de categorias só para administração", async () => {
  assert.equal((await req("GET", "/payments")).s, 401);
  assert.equal((await req("GET", "/payments", t.cli)).s, 403);
  assert.equal((await req("POST", "/categories", t.cli, { name: "Invasão" })).s, 403);
  assert.equal((await req("DELETE", "/categories/1", t.cli)).s, 403);
  assert.equal((await req("GET", "/categories")).s, 200);
});
