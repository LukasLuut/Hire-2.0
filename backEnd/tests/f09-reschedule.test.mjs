import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, nextWeekday, db } from "./helpers.mjs";

const t = await tokens();
const p = (n) => String(n).padStart(2, "0");
const at = (day, hhmm) => `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}T${hhmm}`;

const svc = (await req("POST", "/services", t.ele, form({
  title: "Reagendamento (teste)", description_service: "Teste", price: 100, categoryId: 1, duration: "1 hora",
  negotiable: false, requiresScheduling: true, cancellationNotice: "até 24h antes",
  scheduleSlots: { monday: ["08:00", "10:00", "12:00", "14:00"] },
}))).j;

// segunda-feira sem atendimentos do prestador
const agenda = (await req("GET", `/hires/booked/${svc.id}`, t.cli)).j;
let monday = null;
for (let w = 0; w < 52 && !monday; w++) {
  const d = new Date(nextWeekday(1, "00:00"));
  d.setDate(d.getDate() + w * 7);
  const end = d.getTime() + 86400000;
  if (!agenda.busy.some((b) => new Date(b.start).getTime() < end && new Date(b.end).getTime() > d.getTime())) monday = d;
}
const hires = [];
const hire = async (hhmm) => {
  const r = await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: at(monday, hhmm) });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  hires.push(r.j.id);
  return r.j;
};

test("9. cliente pede novo horário, prestador aceita", async () => {
  const h = await hire("08:00");
  const other = await hire("12:00");
  assert.equal((await req("POST", `/hires/${h.id}/reschedule`, t.cli, { scheduledAt: at(monday, "12:00") })).s, 409, "conflita com outro pedido");
  assert.equal((await req("POST", `/hires/${h.id}/reschedule`, t.lim, { scheduledAt: at(monday, "10:00") })).s, 403, "quem não participa");
  const r = await req("POST", `/hires/${h.id}/reschedule`, t.cli, { scheduledAt: at(monday, "10:00") });
  assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.equal(r.j.rescheduleBy, "cliente");
  assert.equal((await req("POST", `/hires/${h.id}/reschedule/answer`, t.cli, { accept: true })).s, 403, "quem pediu não aceita");
  const pend = (await req("GET", "/notifications/pending", t.ele)).j;
  assert.ok(pend.some((i) => i.kind === "hire.reschedule"), "aparece nas pendências do prestador");
  const ok = await req("POST", `/hires/${h.id}/reschedule/answer`, t.ele, { accept: true });
  assert.equal(ok.s, 200);
  assert.equal(new Date(ok.j.scheduledAt).getTime(), new Date(at(monday, "10:00")).getTime());
  assert.equal(ok.j.rescheduleTo, null);
  // horário antigo ficou livre; ignorar a própria contratação na agenda
  const busy = (await req("GET", `/hires/booked/${svc.id}?exclude=${h.id}`, t.cli)).j.busy;
  assert.ok(!busy.some((b) => new Date(b.start).getTime() === new Date(at(monday, "10:00")).getTime()));
  await req("PUT", `/hires/${other.id}`, t.cli, { status: "CANCELADO" });
});

test("9. prestador propõe, cliente recusa: horário continua", async () => {
  const h = await hire("14:00");
  await req("POST", `/hires/${h.id}/reschedule`, t.ele, { scheduledAt: at(monday, "12:00") });
  const no = await req("POST", `/hires/${h.id}/reschedule/answer`, t.cli, { accept: false });
  assert.equal(no.s, 200);
  assert.equal(new Date(no.j.scheduledAt).getTime(), new Date(at(monday, "14:00")).getTime());
  assert.equal(no.j.rescheduleTo, null);
});

test("9. cancelar pedido aceito dentro do prazo fica registrado", async () => {
  const h = await hire("12:00");
  await req("PUT", `/hires/${h.id}`, t.ele, { status_provider: "ACEITO" });
  // simula o atendimento daqui a 3 horas (dentro do prazo de 24 h)
  await db("UPDATE hires SET scheduledAt = DATE_ADD(NOW(), INTERVAL 3 HOUR) WHERE id = ?", [h.id]);
  const c = await req("PUT", `/hires/${h.id}`, t.cli, { status: "CANCELADO", reason: "imprevisto" });
  assert.equal(c.s, 200);
  assert.equal(c.j.lateCancel, true);
  const list = (await req("GET", `/hires/provider/${svc.provider.id}`, t.ele)).j;
  assert.ok(list.find((x) => x.id === h.id).clientLateCancellations >= 1, "prestador vê o histórico do cliente");
  // recusar pedido não conta
  const r = await hire("08:00");
  await db("UPDATE hires SET scheduledAt = DATE_ADD(NOW(), INTERVAL 3 HOUR) WHERE id = ?", [r.id]);
  assert.equal((await req("PUT", `/hires/${r.id}`, t.ele, { status_provider: "CANCELADO" })).j.lateCancel, false);
});

test("9. limpeza", async () => {
  for (const id of hires) await req("PUT", `/hires/${id}`, t.cli, { status: "CANCELADO" });
  // o cancelamento tardio do teste não deve pesar na reputação da conta de demonstração
  await db(`UPDATE hires SET lateCancel = 0 WHERE id IN (${hires.join(",")})`);
  await req("DELETE", `/services/${svc.id}`, t.ele);
});
