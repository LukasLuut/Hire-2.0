import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login } from "./helpers.mjs";

// Subcategorias sugeridas por categoria (administração): sem repetidas, visíveis a todos
const t = await tokens();
const adm = await login("admin@hire.dev");

test("55. administração define as subcategorias de uma categoria", async () => {
  const cat = (await req("GET", "/categories")).j.find((c) => c.id === 1);
  const previous = cat.subcategories ?? null;
  assert.equal((await req("PUT", "/categories/1", t.cli, { subcategories: "X" })).s, 403);
  try {
    const r = await req("PUT", "/categories/1", adm, { name: cat.name, description: cat.description, subcategories: "Elétrica, Hidráulica, elétrica, , Pintura" });
    assert.equal(r.s, 200, JSON.stringify(r.j));
    const seen = (await req("GET", "/categories")).j.find((c) => c.id === 1);
    assert.deepEqual(seen.subcategories, ["Elétrica", "Hidráulica", "Pintura"], "sem repetidas nem vazias");
  } finally {
    await req("PUT", "/categories/1", adm, { name: cat.name, description: cat.description, subcategories: previous ?? "" });
  }
});
