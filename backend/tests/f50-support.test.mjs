import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, db } from "./helpers.mjs";

// Chamados de suporte: usuário abre e acompanha; administração responde e encerra
const t = await tokens();
const adm = await login("admin@hire.dev");
let id;

test("50. abrir chamado: validação e listagem própria", async () => {
  assert.equal((await req("POST", "/support", null, { category: "conta", subject: "x", message: "y" })).s, 401);
  assert.equal((await req("POST", "/support", t.cli, { category: "nada", subject: "Ajuda", message: "Não consigo mudar meu e-mail" })).s, 400);
  assert.equal((await req("POST", "/support", t.cli, { category: "conta", subject: "Ajuda", message: "curta" })).s, 400);
  const r = await req("POST", "/support", t.cli, { category: "conta", subject: "Trocar e-mail", message: "Não encontro onde mudar meu e-mail de acesso." });
  assert.equal(r.s, 201);
  assert.equal(r.j.status, "ABERTO");
  id = r.j.id;
  assert.ok((await req("GET", "/support/me", t.cli)).j.some((x) => x.id === id));
  assert.ok(!(await req("GET", "/support/me", t.ele)).j.some((x) => x.id === id), "outro usuário não vê");
});

test("50. administração responde e encerra; usuário é avisado", async () => {
  assert.equal((await req("GET", "/admin/support", t.cli)).s, 403);
  const list = (await req("GET", "/admin/support?status=ABERTO", adm)).j;
  const mine = list.find((x) => x.id === id);
  assert.equal(mine.user.email, "cliente@hire.dev");
  assert.ok((await req("GET", "/admin/overview", adm)).j.openTickets >= 1);
  assert.equal((await req("POST", `/admin/support/${id}`, adm, { status: "RESOLVIDO" })).s, 400, "encerrar exige resposta");
  const r = await req("POST", `/admin/support/${id}`, adm, { status: "RESOLVIDO", reply: "Vá em Perfil > Conta > E-mail." });
  assert.equal(r.s, 200);
  const seen = (await req("GET", "/support/me", t.cli)).j.find((x) => x.id === id);
  assert.equal(seen.status, "RESOLVIDO");
  assert.match(seen.reply, /Perfil/);
  const [n] = await db("SELECT link FROM notifications WHERE type = 'support.answered' ORDER BY id DESC LIMIT 1");
  assert.equal(n.link, "/ajuda");
});

test("50. limpeza", async () => {
  await db("DELETE FROM support_tickets WHERE id = ?", [id]);
});
