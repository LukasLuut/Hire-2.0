import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens } from "./helpers.mjs";

// Prestadores favoritos: marcar, listar, desmarcar; não favorita o próprio perfil
const t = await tokens();

test("52. favoritar prestador", async () => {
  assert.equal((await req("POST", "/providers/1/favorite", null)).s, 401);
  assert.equal((await req("POST", "/providers/1/favorite", t.ele)).s, 400, "o próprio perfil");
  let state = (await req("GET", "/providers/1/favorite", t.cli)).j.favorite;
  if (state) await req("POST", "/providers/1/favorite", t.cli); // começa desmarcado
  const on = await req("POST", "/providers/1/favorite", t.cli);
  assert.equal(on.j.favorite, true);
  assert.equal((await req("GET", "/providers/1/favorite", t.cli)).j.favorite, true);
  const list = (await req("GET", "/providers/favorites/me", t.cli)).j;
  const souza = list.find((p) => p.id === 1);
  assert.ok(souza, "aparece na lista");
  assert.equal(souza.available, true);
  assert.ok(souza.slug && souza.rating, "dados públicos");
  assert.equal(souza.professionalEmail, undefined, "sem contato privado");
  const off = await req("POST", "/providers/1/favorite", t.cli);
  assert.equal(off.j.favorite, false);
  assert.ok(!(await req("GET", "/providers/favorites/me", t.cli)).j.some((p) => p.id === 1));
  assert.equal((await req("POST", "/providers/999999/favorite", t.cli)).s, 404);
});
