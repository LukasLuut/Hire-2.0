import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form, db, API, pay } from "./helpers.mjs";

// Conta profissional desativada: some do público, pessoa segue como cliente, pode reativar
const t = await tokens();
const [lim] = await db("SELECT id, slug FROM service_providers WHERE id = 2");
const limServices = (await req("GET", "/services")).j.filter((s) => s.provider?.id === 2);

test("desativar exige não ter pedidos em andamento como prestador", async () => {
  const h = await req("POST", "/hires", t.cli, { serviceId: limServices.find((s) => !s.requiresScheduling && !s.packages?.length && s.priceUnit === "fixo").id });
  assert.equal(h.s, 201, JSON.stringify(h.j));
  const blocked = await req("POST", "/providers/me/deactivate", t.lim);
  assert.equal(blocked.s, 400);
  assert.match(blocked.j.message, /em andamento/);
  await req("PUT", `/hires/${h.j.id}`, t.cli, { status: "CANCELADO" });
});

test("desativar bloqueia em cada etapa do pedido: aceito, em andamento e entregue sem confirmação", async () => {
  const svc = limServices.find((s) => !s.requiresScheduling && !s.packages?.length && s.priceUnit === "fixo");
  const h = (await req("POST", "/hires", t.cli, { serviceId: svc.id })).j;
  try {
    for (const step of ["ACEITO", "EM ANDAMENTO", "CONCLUIDO"]) {
      await req("PUT", `/hires/${h.id}`, t.lim, { status_provider: step });
      if (step === "ACEITO") await pay(h.id, t.cli);
      const r = await req("POST", "/providers/me/deactivate", t.lim);
      assert.equal(r.s, 400, `etapa ${step} deveria bloquear`);
    }
    // cliente confirma: pedido encerrado não bloqueia mais
    await req("PUT", `/hires/${h.id}`, t.cli, { status: "CONCLUIDO" });
  } finally {
    await db("UPDATE hires SET status='CONCLUIDO' WHERE id = ?", [h.id]);
  }
});

test("desativar bloqueia com negociação em andamento (aguardando resposta ou respondida)", async () => {
  const svc = limServices[0];
  const q = await req("POST", "/conversations/request", t.cli, form({ serviceId: svc.id, description: "Limpeza pós-mudança", budget: "R$ 300" }));
  assert.equal(q.s, 201, JSON.stringify(q.j));
  try {
    let r = await req("POST", "/providers/me/deactivate", t.lim);
    assert.equal(r.s, 400, "pedido de orçamento aguardando resposta");
    assert.match(r.j.message, /negocia/);
    await req("POST", `/conversations/${q.j.id}/respond`, t.lim, form({ title: "Pós-mudança", description: "Apartamento", price: "R$ 350,00", deadline: "6 horas" }));
    r = await req("POST", "/providers/me/deactivate", t.lim);
    assert.equal(r.s, 400, "orçamento respondido, aguardando aceite");
    // recusada: deixa de bloquear
    await req("POST", `/conversations/${q.j.id}/reject`, t.lim, { reason: "teste" });
  } finally {
    await db("UPDATE conversations SET status='CLOSED' WHERE id = ?", [q.j.id]);
  }
  // conversa simples (sem pedido de orçamento) não bloqueia
  const chat = await req("POST", "/conversations", t.cli, { providerId: 2 });
  assert.ok(chat.s < 300);
  assert.equal((await req("POST", "/providers/me/deactivate", t.lim)).s, 200, "sem pendências, desativa");
  assert.equal((await req("POST", "/providers/me/reactivate", t.lim)).s, 200);
});

test("desativada: perfil 410, serviços somem da vitrine, detalhe, cidade e sitemap", async () => {
  assert.equal((await req("POST", "/providers/me/deactivate", t.lim)).s, 200);
  const pub = await req("GET", `/providers/${lim.slug}/public`);
  assert.equal(pub.s, 410);
  assert.equal(pub.j.reason, "deactivated");
  assert.equal((await req("GET", "/providers/nao-existe-xyz/public")).j.reason, "not_found");
  assert.ok(!(await req("GET", "/services")).j.some((s) => s.provider?.id === 2), "fora da vitrine");
  assert.equal((await req("GET", `/services/${limServices[0].id}`)).s, 404);
  assert.ok(!(await req("GET", "/providers/all")).j.some((p) => p.id === 2));
  assert.ok(!(await req("GET", "/discover")).j.some((p) => p.citySlug === "caxias-do-sul-rs"), "página da cidade some");
  assert.doesNotMatch(await (await fetch(API + "/sitemap.xml")).text(), new RegExp(`/prestador/${lim.slug}<`));
  assert.equal((await fetch(`${API}/providers/${lim.slug}/qr`)).status, 404);
});

test("desativada: não recebe pedidos nem conversas; não publica nem edita", async () => {
  assert.equal((await req("POST", "/hires", t.cli, { serviceId: limServices[0].id })).s, 400);
  assert.equal((await req("POST", "/conversations", t.cli, { providerId: 2 })).s, 400);
  assert.equal((await req("POST", "/services", t.lim, form({ title: "x", description_service: "x", price: 10, categoryId: 2, duration: "1 hora" }))).s, 403);
  assert.equal((await req("PUT", `/services/${limServices[0].id}`, t.lim, form({ title: "x" }))).s, 403);
  assert.equal((await req("GET", "/providers/me/portfolio", t.lim)).s, 403);
  // continua usando o Hire como cliente
  const asClient = await req("POST", "/hires", t.lim, { serviceId: (await req("GET", "/services")).j.find((s) => s.provider?.id === 1 && !s.requiresScheduling && !s.packages?.length && s.priceUnit === "fixo").id });
  assert.equal(asClient.s, 201, "contrata normalmente");
  await req("PUT", `/hires/${asClient.j.id}`, t.lim, { status: "CANCELADO" });
  const own = (await req("GET", "/providers", t.lim)).j;
  assert.ok(own.deactivatedAt, "o dono vê que está desativada");
});

test("reativar devolve perfil e serviços", async () => {
  assert.equal((await req("POST", "/providers/me/reactivate", t.lim)).s, 200);
  assert.equal((await req("GET", `/providers/${lim.slug}/public`)).s, 200);
  assert.ok((await req("GET", "/services")).j.some((s) => s.provider?.id === 2));
});
