import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, nextWeekday, db } from "./helpers.mjs";

// Agenda do prestador: atendimentos marcados da semana, sem cancelados, endereço conforme o aceite
const t = await tokens();
const p = (n) => String(n).padStart(2, "0");
const day = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

const svc = (await req("POST", "/services", t.ele, form({
  title: "Agenda semanal (teste)", description_service: "Teste", price: 100, categoryId: 1, duration: "1 hora",
  negotiable: false, requiresScheduling: true, scheduleSlots: { monday: ["14:00", "16:00"] },
}))).j;
const agenda = (await req("GET", `/hires/booked/${svc.id}`, t.cli)).j;
let monday = null;
for (let w = 0; w < 52 && !monday; w++) {
  const d = new Date(nextWeekday(1, "00:00"));
  d.setDate(d.getDate() + w * 7);
  if (!agenda.busy.some((b) => new Date(b.start).getTime() < d.getTime() + 86400000 && new Date(b.end).getTime() > d.getTime())) monday = d;
}
const hires = [];

test("53. agenda da semana com os atendimentos marcados", async () => {
  const a = (await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: `${day(monday)}T14:00` })).j;
  const b = (await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: `${day(monday)}T16:00` })).j;
  hires.push(a.id, b.id);
  await req("PUT", `/hires/${b.id}`, t.cli, { status: "CANCELADO" });
  const r = await req("GET", `/providers/me/agenda?start=${day(monday)}`, t.ele);
  assert.equal(r.s, 200);
  const item = r.j.items.find((x) => x.id === a.id);
  assert.ok(item, "atendimento marcado aparece");
  assert.equal(item.service, "Agenda semanal (teste)");
  assert.equal(item.durationMinutes, 60);
  assert.ok(item.place && !/Rua/.test(item.place), "antes do aceite: só bairro/cidade");
  assert.ok(!r.j.items.some((x) => x.id === b.id), "cancelado não ocupa a agenda");
  await req("PUT", `/hires/${a.id}`, t.ele, { status_provider: "ACEITO" });
  const after = (await req("GET", `/providers/me/agenda?start=${day(monday)}`, t.ele)).j.items.find((x) => x.id === a.id);
  assert.match(after.place, /,/, "depois do aceite: endereço completo");
  const nextWeek = new Date(monday.getTime() + 7 * 86400000);
  assert.ok(!(await req("GET", `/providers/me/agenda?start=${day(nextWeek)}`, t.ele)).j.items.some((x) => x.id === a.id));
});

test("53. limpeza", async () => {
  await db(`UPDATE hires SET status='CANCELADO', status_provider='CANCELADO' WHERE id IN (${hires.join(",")})`);
  await req("DELETE", `/services/${svc.id}`, t.ele);
});
