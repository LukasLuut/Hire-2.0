import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, PNG, API } from "./helpers.mjs";

const t = await tokens();
const img = (name = "trabalho") => [["image", PNG, `${name}.png`, "image/png"]];
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const created = [];

test("25. adicionar: foto obrigatória, só imagem, serviço precisa ser do prestador", async () => {
  assert.equal((await req("POST", "/providers/me/portfolio", t.ele, form({ title: "Sem foto" }))).s, 400);
  assert.equal((await req("POST", "/providers/me/portfolio", t.ele, form({ title: "SVG" }, [["image", svg, "x.svg", "image/svg+xml"]]))).s, 400, "SVG recusado");
  assert.equal((await req("POST", "/providers/me/portfolio", t.ele, form({ title: "" }, img()))).s, 400, "título obrigatório");
  const other = (await req("GET", "/services")).j.find((s) => s.provider?.id !== 1);
  assert.equal((await req("POST", "/providers/me/portfolio", t.ele, form({ title: "X", serviceId: other.id }, img()))).s, 400, "serviço de outro prestador");
});

test("25. criar, editar, ordenar, remover — e aparece no perfil público", async () => {
  const mine = (await req("GET", "/services")).j.find((s) => s.provider?.id === 1);
  for (const [title, extra] of [["Quadro de distribuição novo", { serviceId: mine.id, description: "Troca completa com DR" }], ["Iluminação de jardim", {}], ["Tomadas da cozinha", {}]]) {
    const r = await req("POST", "/providers/me/portfolio", t.ele, form({ title, ...extra }, img()));
    assert.equal(r.s, 201, JSON.stringify(r.j));
    created.push(r.j);
  }
  assert.equal(created[0].service.id, mine.id);
  assert.equal((await fetch(API + created[0].imageUrl)).status, 200, "foto pública servida");

  const upd = await req("PUT", `/providers/me/portfolio/${created[1].id}`, t.ele, form({ title: "Iluminação de jardim com LED", serviceId: "" }));
  assert.equal(upd.j.title, "Iluminação de jardim com LED");
  assert.equal((await req("PUT", `/providers/me/portfolio/${created[1].id}`, t.lim, form({ title: "hack" }))).s, 404, "outro prestador não edita");

  const ids = created.map((c) => c.id).reverse();
  assert.equal((await req("PUT", "/providers/me/portfolio/order", t.ele, { ids: ids.slice(1) })).s, 400, "ordem incompleta");
  const ordered = (await req("PUT", "/providers/me/portfolio/order", t.ele, { ids })).j;
  assert.deepEqual(ordered.filter((i) => ids.includes(i.id)).map((i) => i.id), ids);

  const pub = (await req("GET", "/providers/souza-eletrica/public")).j;
  assert.deepEqual(pub.portfolio.filter((i) => ids.includes(i.id)).map((i) => i.id), ids, "perfil público na ordem escolhida");

  assert.equal((await req("DELETE", `/providers/me/portfolio/${created[0].id}`, t.lim)).s, 404);
  const del = await req("DELETE", `/providers/me/portfolio/${created[2].id}`, t.ele);
  assert.equal(del.s, 200);
  assert.equal((await fetch(API + created[2].imageUrl)).status, 404, "arquivo apagado");
});

test("25. limpeza", async () => {
  for (const c of created.slice(0, 2)) await req("DELETE", `/providers/me/portfolio/${c.id}`, t.ele);
  assert.equal((await req("GET", "/providers/me/portfolio")).s, 401);
});
