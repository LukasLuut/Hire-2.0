import { test } from "node:test";
import assert from "node:assert/strict";
import { API } from "./helpers.mjs";

// Log estruturado: toda resposta traz X-Request-Id (reaproveita o id recebido quando válido)
test("58. id da requisição no cabeçalho", async () => {
  const a = await fetch(API + "/categories");
  assert.match(a.headers.get("x-request-id") ?? "", /^[\w-]{8,64}$/);
  const b = await fetch(API + "/categories", { headers: { "X-Request-Id": "teste-12345678" } });
  assert.equal(b.headers.get("x-request-id"), "teste-12345678");
  const c = await fetch(API + "/categories", { headers: { "X-Request-Id": "<script>" } });
  assert.notEqual(c.headers.get("x-request-id"), "<script>", "id inválido é trocado");
});
