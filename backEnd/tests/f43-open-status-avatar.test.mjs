import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, PNG, db, API, nextWeekday } from "./helpers.mjs";

const t = await tokens();
const tomorrow = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };
const inDays = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

test("status: fechado bloqueia pedidos e orçamentos; aberto libera", async () => {
  const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === 2 && !s.requiresScheduling && !s.packages?.length && s.priceUnit === "fixo");
  assert.equal((await req("PUT", "/providers/me/status", t.lim, { status: "x" })).s, 400);
  const c = await req("PUT", "/providers/me/status", t.lim, { status: "closed" });
  assert.equal(c.j.open, false);
  const pub = (await req("GET", "/providers/2/public")).j;
  assert.equal(pub.status, "paused");
  const h = await req("POST", "/hires", t.cli, { serviceId: svc.id });
  assert.equal(h.s, 400);
  assert.match(h.j.message, /fechado/);
  assert.equal((await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "x", budget: "R$ 1" }))).s, 400);
  assert.ok((await req("POST", "/conversations", t.cli, { providerId: 2 })).s < 300, "mensagem continua liberada");
  assert.equal((await req("PUT", "/providers/me/status", t.lim, { status: "available" })).j.open, true);
  const ok = await req("POST", "/hires", t.cli, { serviceId: svc.id });
  assert.equal(ok.s, 201);
  await req("PUT", `/hires/${ok.j.id}`, t.cli, { status: "CANCELADO" });
});

test("status: fechado até a data — valida data, agenda só depois, reabre sozinho", async () => {
  assert.equal((await req("PUT", "/providers/me/status", t.lim, { status: "closed", closedUntil: "2020-01-01" })).s, 400);
  assert.equal((await req("PUT", "/providers/me/status", t.lim, { status: "closed", closedUntil: "31/12/2030" })).s, 400);
  assert.equal((await req("PUT", "/providers/me/status", t.lim, { status: "closed", closedUntil: inDays(400) })).s, 400);
  const r = await req("PUT", "/providers/me/status", t.lim, { status: "closed", closedUntil: inDays(10) });
  assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.ok((await req("GET", "/providers/2/public")).j.closedUntil);
  // serviço com agenda do prestador 1 para testar agendamento depois da reabertura
  await req("PUT", "/providers/me/status", t.ele, { status: "closed", closedUntil: inDays(3) });
  const sched = (await req("GET", "/services")).j.find((s) => s.provider?.id === 1 && s.requiresScheduling && s.scheduleSlots?.monday?.length);
  const agenda = (await req("GET", `/hires/booked/${sched.id}`, t.cli)).j;
  assert.equal(agenda.closed, true);
  assert.ok(agenda.closedUntil);
  const early = new Date(Date.now() + 86400000); // amanhã: antes da reabertura
  const p = (n) => String(n).padStart(2, "0");
  const earlyKey = `${early.getFullYear()}-${p(early.getMonth() + 1)}-${p(early.getDate())}T08:00`;
  const bad = await req("POST", "/hires", t.cli, { serviceId: sched.id, scheduledAt: earlyKey });
  assert.equal(bad.s, 400, "antes da reabertura");
  // data passada = reabre sozinho
  await db("UPDATE service_providers SET closedUntil = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = 1");
  assert.equal((await req("GET", "/providers/1/public")).j.status, "available");
  await req("PUT", "/providers/me/status", t.ele, { status: "available" });
  await req("PUT", "/providers/me/status", t.lim, { status: "available" });
});

test("foto do perfil pessoal: só imagem, troca e aparece em /users/me", async () => {
  const before = (await req("GET", "/users/me", t.cli)).j.avatarUrl ?? null;
  assert.equal((await req("PUT", "/users/me/avatar", t.cli, form({}))).s, 400);
  assert.equal((await req("PUT", "/users/me/avatar", t.cli, form({}, [["image", Buffer.from("<svg/>"), "a.svg", "image/svg+xml"]]))).s, 400, "SVG recusado");
  const r = await req("PUT", "/users/me/avatar", t.cli, form({}, [["image", PNG, "eu.png", "image/png"]]));
  assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.equal((await req("GET", "/users/me", t.cli)).j.avatarUrl, r.j.avatarUrl);
  assert.equal((await fetch(API + r.j.avatarUrl)).status, 200);
  assert.equal((await req("PUT", "/users/me/avatar", null, form({}, [["image", PNG, "eu.png", "image/png"]]))).s, 401);
  await db("UPDATE users SET avatarUrl = ? WHERE email = 'cliente@hire.dev'", [before]);
});
