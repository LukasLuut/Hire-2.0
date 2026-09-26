import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login } from "./helpers.mjs";

// Moderação de avaliações: oculta texto/fotos com motivo; a nota continua na média
const t = await tokens();
const adm = await login("admin@hire.dev");

test("54. administração oculta e volta a mostrar um comentário", async () => {
  assert.equal((await req("GET", "/admin/reviews", t.cli)).s, 403);
  const before = (await req("GET", "/reviews/provider/1")).j;
  const target = before.reviews.find((r) => r.comment);
  assert.ok(target, "há avaliação com comentário");
  const pub = target;

  assert.equal((await req("POST", `/admin/reviews/${target.id}/moderate`, adm, { hidden: true, reason: "x" })).s, 400, "motivo obrigatório");
  const hide = await req("POST", `/admin/reviews/${target.id}/moderate`, adm, { hidden: true, reason: "Contém dados pessoais" });
  assert.equal(hide.s, 200);
  try {
    if (pub) {
      const after = (await req("GET", "/reviews/provider/1")).j;
      const seen = after.reviews.find((r) => r.id === target.id);
      assert.equal(seen.comment, null);
      assert.equal(seen.moderated, true);
      assert.equal(seen.photos.length, 0);
      assert.equal(after.average, before.average, "nota continua na média");
      assert.equal(after.count, before.count);
    }
    const hiddenList = (await req("GET", "/admin/reviews?hidden=1", adm)).j;
    const h = hiddenList.find((r) => r.id === target.id);
    assert.equal(h.hiddenReason, "Contém dados pessoais");
    assert.ok(h.comment, "a administração ainda vê o texto original");
  } finally {
    const show = await req("POST", `/admin/reviews/${target.id}/moderate`, adm, { hidden: false });
    assert.equal(show.j.hiddenAt, null);
  }
});
