import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form } from "./helpers.mjs";

const t = await tokens();
const SERVICE = 3; // do prestador 1

const setActive = (token, active) => req("PUT", `/services/${SERVICE}`, token, form({ active }));

test("6. pausar serviço: some da vitrine e do perfil, não recebe pedidos; reativar volta", async () => {
  assert.equal((await setActive(t.lim, false)).s, 403, "só o dono pausa");
  assert.equal((await setActive(t.ele, false)).s, 200);
  try {
    const list = (await req("GET", "/services")).j;
    assert.ok(!list.some((s) => s.id === SERVICE), "fora da vitrine");
    const pub = (await req("GET", "/providers/1/public")).j;
    assert.ok(!pub.services.some((s) => s.id === SERVICE), "fora do perfil público");
    const one = (await req("GET", `/services/${SERVICE}`)).j;
    assert.equal(one.active, false, "acessível pelo id, marcado como pausado");
    assert.equal((await req("POST", "/hires", t.cli, { serviceId: SERVICE })).s, 400, "não contrata");
    assert.equal((await req("POST", "/conversations/request", t.cli, form({ serviceId: SERVICE, description: "x", budget: "1" }))).s, 400, "não pede orçamento");
  } finally {
    assert.equal((await setActive(t.ele, true)).s, 200);
  }
  assert.ok((await req("GET", "/services")).j.some((s) => s.id === SERVICE), "voltou à vitrine");
});
