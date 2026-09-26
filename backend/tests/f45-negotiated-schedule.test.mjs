import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, nextWeekday, db, pay } from "./helpers.mjs";
import { negotiateUntilAgreed } from "./helpers-negotiation.mjs";

// RN05: pedido negociado de serviço com agenda passa pela agenda antes de começar
const t = await tokens();
const p = (n) => String(n).padStart(2, "0");
const at = (day, hhmm) => `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}T${hhmm}`;

const svc = (await req("POST", "/services", t.ele, form({
  title: "Agenda negociada (teste)", description_service: "Teste", price: 100, categoryId: 1, duration: "1 hora",
  negotiable: true, requiresScheduling: true,
  scheduleSlots: { wednesday: ["08:00", "10:00", "14:00"] },
}))).j;

// quarta-feira livre na agenda do prestador
const agenda = (await req("GET", `/hires/booked/${svc.id}`, t.cli)).j;
let wednesday = null;
for (let w = 0; w < 52 && !wednesday; w++) {
  const d = new Date(nextWeekday(3, "00:00"));
  d.setDate(d.getDate() + w * 7);
  const end = d.getTime() + 86400000;
  if (!agenda.busy.some((b) => new Date(b.start).getTime() < end && new Date(b.end).getTime() > d.getTime())) wednesday = d;
}

let hireId = null;
let cid = null;

test("45. acordo fechado: pedido nasce aceito, sem horário, com a duração acordada", async () => {
  cid = await negotiateUntilAgreed({ client: t.cli, provider: t.ele, serviceId: svc.id });
  await req("POST", `/conversations/${cid}/accept`, t.cli);
  const a = await req("POST", `/conversations/${cid}/accept`, t.ele);
  assert.equal(a.s, 200, JSON.stringify(a.j));
  assert.equal(a.j.formalized, true);
  hireId = a.j.hireId;
  const [h] = await db("SELECT scheduledAt, durationMinutes, status_provider FROM hires WHERE id = ?", [hireId]);
  assert.equal(h.scheduledAt, null);
  assert.equal(h.durationMinutes, 120, "duração acordada (2 horas)");
  assert.equal(h.status_provider, "ACEITO");
});

test("45. prestador não inicia sem horário; só o cliente agenda", async () => {
  assert.equal((await pay(hireId, t.cli)).s, 200);
  const begin = await req("PUT", `/hires/${hireId}`, t.ele, { status_provider: "EM ANDAMENTO" });
  assert.equal(begin.s, 400);
  assert.match(begin.j.message, /horário/);
  assert.equal((await req("POST", `/hires/${hireId}/schedule`, t.ele, { scheduledAt: at(wednesday, "08:00") })).s, 403);
  assert.equal((await req("POST", `/hires/${hireId}/schedule`, t.cli, { scheduledAt: at(wednesday, "09:00") })).s, 400, "fora da agenda");
});

test("45. cliente marca o horário; prestador inicia", async () => {
  const r = await req("POST", `/hires/${hireId}/schedule`, t.cli, { scheduledAt: at(wednesday, "08:00") });
  assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.equal(new Date(r.j.scheduledAt).getTime(), new Date(at(wednesday, "08:00")).getTime());
  // a duração acordada (2 h) ocupa a agenda: 08:00–10:00
  const busy = (await req("GET", `/hires/booked/${svc.id}`, t.cli)).j.busy;
  assert.ok(busy.some((b) => new Date(b.end).getTime() === new Date(at(wednesday, "10:00")).getTime()));
  assert.equal((await req("POST", `/hires/${hireId}/schedule`, t.cli, { scheduledAt: at(wednesday, "10:00") })).s, 400, "já agendado");
  const [n] = await db("SELECT COUNT(*) AS n FROM notifications WHERE type = 'hire.scheduled' AND link = '/progress'");
  assert.ok(n.n >= 1);
  assert.equal((await req("PUT", `/hires/${hireId}`, t.ele, { status_provider: "EM ANDAMENTO" })).s, 200);
});

test("45. limpeza", async () => {
  await db("UPDATE hires SET status = 'CANCELADO', status_provider = 'CANCELADO' WHERE id = ?", [hireId]);
  await db("UPDATE payments SET status = 'ESTORNADO', refundedAt = NOW() WHERE hireId = ? AND status = 'PAGO'", [hireId]);
  // com contrato o serviço não pode ser excluído: fica pausado (fora da vitrine)
  if ((await req("DELETE", `/services/${svc.id}`, t.ele)).s >= 400) await req("PUT", `/services/${svc.id}`, t.ele, form({ active: false }));
});
