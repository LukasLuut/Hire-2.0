import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens } from "./helpers.mjs";

const t = await tokens();
const SERVICE = 2;

test("10. favoritos: curtir aparece na lista, descurtir remove; exige login", async () => {
  assert.equal((await req("GET", "/services/favorites")).s, 401);
  const before = (await req("GET", "/services/favorites", t.cli)).j.some((s) => s.id === SERVICE);
  const r1 = (await req("POST", `/services/${SERVICE}/like`, t.cli)).j;
  const afterToggle = (await req("GET", "/services/favorites", t.cli)).j;
  assert.equal(afterToggle.some((s) => s.id === SERVICE), r1.liked);
  assert.ok(afterToggle.every((s) => s.title && s.rating), "vem com nota e dados do serviço");
  // volta ao estado inicial
  const r2 = (await req("POST", `/services/${SERVICE}/like`, t.cli)).j;
  assert.equal(r2.liked, before);
  assert.equal((await req("GET", "/services/favorites", t.cli)).j.some((s) => s.id === SERVICE), before);
});
