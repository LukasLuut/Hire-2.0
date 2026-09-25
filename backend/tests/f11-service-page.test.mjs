import { test } from "node:test";
import assert from "node:assert/strict";
import { req } from "./helpers.mjs";

test("11. página pública do serviço: dados e avaliações abrem sem login", async () => {
  const s = await req("GET", "/services/1");
  assert.equal(s.s, 200);
  assert.ok(s.j.title && s.j.provider && typeof s.j.active === "boolean");
  const reviews = await req("GET", `/reviews/provider/${s.j.provider.id}`);
  assert.equal(reviews.s, 200);
  assert.ok(Array.isArray(reviews.j.reviews));
  assert.equal((await req("GET", "/services/999999")).s >= 400, true);
});
