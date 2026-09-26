import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, PASSWORD, API } from "./helpers.mjs";

// admin@hire.dev tem papel "admin" no banco de desenvolvimento
const t = await tokens();
const adm = await login("admin@hire.dev");

test("15. só administrador acessa o painel", async () => {
  assert.equal((await req("GET", "/admin/overview", t.cli)).s, 403);
  assert.equal((await req("GET", "/admin/overview")).s, 401);
  const o = await req("GET", "/admin/overview", adm);
  assert.equal(o.s, 200);
  assert.ok(o.j.users >= 4 && typeof o.j.hires === "object");
  assert.equal((await req("GET", "/users/me", adm)).j.isAdmin, true);
  assert.equal((await req("GET", "/users/me", t.cli)).j.isAdmin, false);
  // categorias continuam restritas
  assert.equal((await req("POST", "/categories", t.cli, { name: "x", description: "x" })).s, 403);
});

test("15. suspender conta bloqueia login e token; reativar libera", async () => {
  const users = (await req("GET", "/admin/users?q=limpeza@hire.dev", adm)).j;
  const lim = users.find((u) => u.email === "limpeza@hire.dev");
  assert.ok(lim);
  const b = await req("POST", `/admin/users/${lim.id}/block`, adm, { blocked: true, reason: "teste" });
  assert.equal(b.s, 200, JSON.stringify(b.j));
  try {
    assert.equal((await req("GET", "/users/me", t.lim)).s, 403, "token antigo recusado");
    const r = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "limpeza@hire.dev", password: PASSWORD }) });
    assert.equal(r.status, 403);
  } finally {
    assert.equal((await req("POST", `/admin/users/${lim.id}/block`, adm, { blocked: false })).s, 200);
  }
  assert.equal((await req("GET", "/users/me", t.lim)).s, 200);
  const me = (await req("GET", "/users/me", adm)).j;
  assert.equal((await req("POST", `/admin/users/${me.id}/block`, adm, { blocked: true })).s, 400, "não suspende a si mesmo");
});

test("15. papel de administrador e moderação de serviço", async () => {
  const cli = (await req("GET", "/admin/users?q=cliente@hire.dev", adm)).j[0];
  assert.equal((await req("PUT", `/admin/users/${cli.id}/role`, adm, { role: "admin" })).s, 200);
  assert.equal((await req("GET", "/admin/overview", t.cli)).s, 200, "virou admin");
  assert.equal((await req("PUT", `/admin/users/${cli.id}/role`, adm, { role: "user" })).s, 200);
  assert.equal((await req("GET", "/admin/overview", t.cli)).s, 403);

  // serviço do eletricista de teste (a busca também traz serviços de outras contas)
  const svc = (await req("GET", "/admin/services?q=Instalação", adm)).j.find((s) => s.provider?.id === 1);
  assert.ok(svc);
  assert.equal((await req("POST", `/admin/services/${svc.id}/active`, adm, { active: false, reason: "teste" })).j.active, false);
  const notes = (await req("GET", "/notifications", t.ele)).j;
  const list = Array.isArray(notes) ? notes : notes.items ?? [];
  assert.ok(list.some((n) => n.type === "admin.service.paused"), "prestador avisado");
  assert.equal((await req("POST", `/admin/services/${svc.id}/active`, adm, { active: true })).j.active, true);
  assert.equal((await req("GET", "/admin/hires?status=CANCELADO", adm)).s, 200);
});

test("15. categorias: criar, renomear, não excluir em uso", async () => {
  const c = await req("POST", "/categories", adm, { name: `Categoria teste ${Date.now()}`, description: "tmp" });
  assert.equal(c.s, 201, JSON.stringify(c.j));
  const u = await req("PUT", `/categories/${c.j.id}`, adm, { name: c.j.name + " (editada)", id: 999 });
  assert.equal(u.j.id, c.j.id, "id não muda");
  assert.match(u.j.name, /editada/);
  assert.equal((await req("DELETE", "/categories/1", adm)).s >= 400, true, "categoria 1 tem serviços");
  assert.equal((await req("DELETE", `/categories/${c.j.id}`, adm)).s, 200);
});
