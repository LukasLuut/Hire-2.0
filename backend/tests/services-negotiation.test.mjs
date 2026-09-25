import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { req, tokens, form, PNG, nextWeekday } from "./helpers.mjs";

const t = await tokens();
let svc; // serviço com agenda criado neste arquivo

test("serviços: login, dono, agenda e upload", async () => {
  assert.equal((await req("POST", "/services", null, form({ title: "x" }))).s, 401);
  assert.equal((await req("POST", "/services", t.lim, form({ title: "t", description_service: "d", price: 1, categoryId: 1 }, [["images", Buffer.from("x"), "a.exe", "application/x-msdownload"]]))).s, 400, "tipo de arquivo");
  assert.equal((await req("POST", "/services", t.ele, form({ title: "Visita", description_service: "Diag", price: 90, categoryId: 1, requiresScheduling: true }))).s, 400, "agenda obrigatória");
  const r = await req("POST", "/services", t.ele, form(
    { title: "Visita técnica (teste)", description_service: "Diagnóstico", price: "90", categoryId: 1, duration: "1 hora", requiresScheduling: true, negotiable: true, scheduleSlots: { monday: ["08:00", "10:00", "99:00"] }, cancellationNotice: "até 24h antes" },
    [["images", PNG, "capa.png", "image/png"], ["images", PNG, "../../x.png", "image/png"]]
  ));
  assert.equal(r.s, 201, JSON.stringify(r.j));
  svc = r.j;
  assert.deepEqual(svc.scheduleSlots, { monday: ["08:00", "10:00"] });
  assert.ok(svc.images.every((u) => /^\/uploads\/[\w.-]+$/.test(u)));
  assert.equal((await req("PUT", `/services/${svc.id}`, t.lim, form({ title: "hack" }))).s, 403);
  assert.equal((await req("DELETE", `/services/${svc.id}`, t.lim)).s, 403);
  const kept = await req("PUT", `/services/${svc.id}`, t.ele, form({ keepImages: [svc.images[1]] }));
  assert.equal(kept.j.imageUrl, svc.images[1]);
});

test("agendamento: horário obrigatório, dentro da agenda, sem duplicar", async () => {
  assert.equal((await req("POST", "/hires", t.cli, { serviceId: svc.id })).s, 400);
  assert.equal((await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: nextWeekday(3, "08:00") })).s, 400);
  // primeiro horário livre de segunda-feira nas próximas semanas (reservas de rodadas anteriores continuam no banco)
  const booked = new Set((await req("GET", `/hires/booked/${svc.id}`, t.cli)).j.map((d) => new Date(d).getTime()));
  let slot = null;
  for (let week = 0; week < 52 && !slot; week++) {
    for (const time of ["08:00", "10:00"]) {
      const base = new Date(nextWeekday(1, time));
      base.setDate(base.getDate() + week * 7);
      if (!booked.has(base.getTime())) {
        const p = (n) => String(n).padStart(2, "0");
        slot = `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}T${time}`;
        break;
      }
    }
  }
  assert.ok(slot, "nenhum horário livre encontrado");
  const h = await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: slot });
  assert.equal(h.s, 201, JSON.stringify(h.j));
  assert.equal((await req("POST", "/hires", t.cli, { serviceId: svc.id, scheduledAt: slot })).s, 409);
  assert.ok((await req("GET", `/hires/booked/${svc.id}`, t.cli)).j.length >= 1);
  await req("PUT", `/hires/${h.j.id}`, t.cli, { status: "CANCELADO" });
});

test("pedido de orçamento → resposta → consentimento mútuo → contrato assinado", async () => {
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "Trocar 3 tomadas", budget: "R$ 200" }, [["attachments", PNG, "foto.png", "image/png"]]));
  assert.equal(q.s, 201, JSON.stringify(q.j));
  const cid = q.j.id;
  assert.equal((await req("POST", `/conversations/${cid}/respond`, t.cli, form({ description: "x", price: "1" }))).s, 403);
  let c = (await req("POST", `/conversations/${cid}/respond`, t.ele, form({ title: "Tomadas", description: "3 tomadas", price: "R$ 240,00 • Pix", deadline: "3 horas" }))).j;
  const agree = (conv, key) => conv.topics.map((x) => (x.key === key ? { ...x, state: "Acordado" } : x));
  assert.equal((await req("PUT", `/conversations/${cid}/topics`, t.ele, { topics: agree(c, "payment") })).s, 403, "não aceita a própria proposta");
  for (const key of ["payment", "service", "duration"]) c = (await req("PUT", `/conversations/${cid}/topics`, t.cli, { topics: agree(c, key) })).j;
  // início ainda vazio: cliente propõe, prestador aceita
  c = (await req("PUT", `/conversations/${cid}/topics`, t.cli, { topics: c.topics.map((x) => (x.key === "start" ? { ...x, content: "Segunda, 08:00" } : x)) })).j;
  c = (await req("PUT", `/conversations/${cid}/topics`, t.ele, { topics: agree(c, "start") })).j;
  assert.ok(c.topics.every((x) => x.state === "Acordado"));
  const a1 = (await req("POST", `/conversations/${cid}/accept`, t.cli)).j;
  assert.equal(a1.formalized, false);
  assert.equal((await req("POST", `/conversations/${cid}/accept`, t.lim)).s, 403);
  const a2 = (await req("POST", `/conversations/${cid}/accept`, t.ele)).j;
  assert.equal(a2.formalized, true);
  const hire = (await req("GET", `/hires/${a2.hireId}`, t.cli)).j;
  assert.equal(hire.status_provider, "ACEITO", "acordo fechado gera pedido já aceito");

  const ctr = a2.contractId;
  assert.equal((await req("GET", `/contracts/${ctr}`, t.lim)).s, 404);
  const hash = crypto.createHash("sha256").update("conteudo").digest("hex");
  assert.equal((await req("POST", `/contracts/${ctr}/sign`, t.cli, { name: "Marina Costa", hash })).s, 400, "sem aceite");
  assert.equal((await req("POST", `/contracts/${ctr}/sign`, t.cli, { name: "Marina Costa", hash, accepted: true })).s, 200);
  assert.equal((await req("POST", `/contracts/${ctr}/sign`, t.cli, { name: "Marina Costa", hash, accepted: true })).s, 400, "duas vezes");
  const other = crypto.createHash("sha256").update("outro").digest("hex");
  assert.equal((await req("POST", `/contracts/${ctr}/sign`, t.ele, { name: "Rafael Souza", hash: other, accepted: true })).s, 409, "conteúdo diferente");
  assert.equal((await req("POST", `/contracts/${ctr}/sign`, t.ele, { name: "Rafael Souza", hash, accepted: true })).s, 200);
});

test("prestador recusa pedido com motivo", async () => {
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: 2, description: "Trocar quadro", budget: "R$ 100" }));
  const r = await req("POST", `/conversations/${q.j.id}/reject`, t.ele, { reason: "Valor abaixo do custo" });
  assert.equal(r.s, 200);
  assert.equal(r.j.status, "CLOSED");
  assert.equal(r.j.requestStatus, "RECUSADA");
});

test("limpeza: exclui o serviço de teste", async () => {
  // contratações canceladas não impedem a exclusão; a formalizada fica PENDENTE e impede — nesse caso tudo bem manter
  const r = await req("DELETE", `/services/${svc.id}`, t.ele);
  assert.ok([200, 400].includes(r.s));
});
