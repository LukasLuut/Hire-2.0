import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, nextWeekday } from "./helpers.mjs";

// Prestador "eletricista": expediente seg/qua 08–18, sex 08–12 (seed)
const t = await tokens();
const created = [];
const hires = [];
const newService = async (fields) => {
  const r = await req("POST", "/services", t.ele, form({ description_service: "Teste de agenda", price: 100, categoryId: 1, negotiable: false, requiresScheduling: true, ...fields }));
  assert.equal(r.s, 201, JSON.stringify(r.j));
  created.push(r.j.id);
  return r.j;
};
const hire = async (serviceId, scheduledAt) => {
  const r = await req("POST", "/hires", t.cli, { serviceId, scheduledAt });
  if (r.s === 201) hires.push(r.j.id);
  return r;
};
const p = (n) => String(n).padStart(2, "0");
const at = (day, hhmm) => `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}T${hhmm}`;

const long = await newService({ title: "Instalação longa (teste)", duration: "4 horas", scheduleSlots: { monday: ["08:00", "10:00", "12:00", "16:00"], saturday: ["08:00"] } });
const short = await newService({ title: "Visita curta (teste)", duration: "1 hora", scheduleSlots: { monday: ["10:00"] } });

// segunda-feira sem nenhum atendimento do prestador
const agenda = (await req("GET", `/hires/booked/${long.id}`, t.cli)).j;
let monday = null;
for (let w = 0; w < 52 && !monday; w++) {
  const d = new Date(nextWeekday(1, "00:00"));
  d.setDate(d.getDate() + w * 7);
  const end = d.getTime() + 86400000;
  if (!agenda.busy.some((b) => new Date(b.start).getTime() < end && new Date(b.end).getTime() > d.getTime())) monday = d;
}

test("8. agenda expõe expediente, duração e períodos ocupados", () => {
  assert.equal(agenda.durationMinutes, 240);
  assert.deepEqual(agenda.hours.monday, { start: "08:00", end: "18:00" });
  assert.ok(Array.isArray(agenda.busy));
  assert.ok(monday, "nenhuma segunda livre");
});

test("8. serviço de 4 h bloqueia os horários que se sobrepõem", async () => {
  const first = await hire(long.id, at(monday, "08:00"));
  assert.equal(first.s, 201, JSON.stringify(first.j));
  assert.equal(first.j.durationMinutes, 240);
  assert.equal((await hire(long.id, at(monday, "10:00"))).s, 409, "10h cai dentro de 8h–12h");
  assert.equal((await hire(short.id, at(monday, "10:00"))).s, 409, "outro serviço do mesmo prestador também conflita");
  const next = await hire(long.id, at(monday, "12:00"));
  assert.equal(next.s, 201, "12h começa quando o anterior termina");
  const busy = (await req("GET", `/hires/booked/${long.id}`, t.cli)).j.busy;
  const mine = busy.find((b) => new Date(b.start).getTime() === new Date(at(monday, "08:00")).getTime());
  assert.equal(new Date(mine.end).getTime() - new Date(mine.start).getTime(), 4 * 3600000);
});

test("8. atendimento precisa caber no expediente", async () => {
  const late = await hire(long.id, at(monday, "16:00"));
  assert.equal(late.s, 400, "16h + 4h passa das 18h");
  assert.match(late.j.message, /expediente/);
  const sat = new Date(monday);
  sat.setDate(sat.getDate() + 5);
  assert.equal((await hire(long.id, at(sat, "08:00"))).s, 400, "sábado fora do expediente");
});

test("8. limpeza", async () => {
  for (const id of hires) await req("PUT", `/hires/${id}`, t.cli, { status: "CANCELADO" });
  for (const id of created) await req("DELETE", `/services/${id}`, t.ele);
});
