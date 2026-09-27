import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, PNG, API, PASSWORD, db } from "./helpers.mjs";

// Segurança: login sem revelar contas, trava por tentativas, CORS, SVG público e anexos privados
const t = await tokens();
const login = (email, password) => req("POST", "/auth/login", null, { email, password });

test("46. login: mesma resposta para e-mail inexistente e senha errada", async () => {
  const a = await login(`nao-existe-${Date.now()}@hire.dev`, "Qualquer@123");
  const b = await login("cliente@hire.dev", "Errada@123");
  assert.equal(a.s, 401);
  assert.equal(b.s, 401);
  assert.equal(a.j.message, b.j.message);
  assert.equal((await login("cliente@hire.dev", PASSWORD)).s, 200, "senha certa depois de um erro entra");
});

test("46. login: 5 erros no mesmo e-mail travam (429); outro e-mail segue normal", async () => {
  const email = `trava-${Date.now()}@hire.dev`;
  for (let i = 0; i < 5; i++) assert.equal((await login(email, "Errada@123")).s, 401);
  const locked = await login(email, "Errada@123");
  assert.equal(locked.s, 429);
  assert.match(locked.j.message, /tentativas/);
  assert.equal((await login("eletricista@hire.dev", PASSWORD)).s, 200);
});

test("46. CORS só libera o frontend configurado", async () => {
  const ok = await fetch(API + "/categories", { headers: { Origin: "http://localhost:5173" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const evil = await fetch(API + "/categories", { headers: { Origin: "https://evil.example" } });
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
  assert.equal((await fetch(API + "/categories")).status, 200, "sem Origin passa");
});

test("46. upload público recusa SVG", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r = await req("POST", "/services", t.ele, form(
    { title: "SVG (teste)", description_service: "x", price: 10, categoryId: 1, duration: "1 hora" },
    [["image", svg, "x.svg", "image/svg+xml"]],
  ));
  assert.equal(r.s, 400);
  if (r.j?.id) await req("DELETE", `/services/${r.j.id}`, t.ele);
});

test("46. anexo da negociação: link assinado, expira e fica fora de /uploads", async () => {
  const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === 1 && s.negotiable !== false);
  const q = await req("POST", "/conversations/request", t.cli, form(
    { serviceId: svc.id, description: "Com foto", budget: "R$ 100" },
    [["attachments", PNG, "foto.png", "image/png"]],
  ));
  assert.equal(q.s, 201, JSON.stringify(q.j));
  try {
    const conv = (await req("GET", `/conversations/${q.j.id}`, t.ele)).j;
    const url = conv.messages.find((m) => m.attachmentUrl)?.attachmentUrl;
    assert.match(url, /^\/files\/c\/[^/?]+\?exp=\d+&sig=/);
    const file = await fetch(API + url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "image/png");
    const name = url.split("?")[0].split("/").pop();
    assert.equal((await fetch(API + url.replace(/sig=.*/, "sig=adulterada"))).status, 403);
    assert.equal((await fetch(API + url.replace(/exp=\d+/, "exp=" + (Date.now() + 999999999)))).status, 403, "prazo alterado");
    assert.equal((await fetch(`${API}/files/c/${name}`)).status, 403, "sem assinatura");
    assert.notEqual((await fetch(`${API}/uploads/${name}`)).status, 200, "não está no diretório público");
    assert.equal((await req("GET", `/conversations/${q.j.id}`, t.lim)).s >= 400, true, "terceiro não recebe o link");
  } finally {
    await db("UPDATE negotiations SET status = 'CLOSED' WHERE conversationId = ?", [q.j.id]);
  }
});
