import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, API } from "./helpers.mjs";

const t = await tokens();

/** Abre o stream SSE e junta os eventos recebidos */
async function listen(token) {
  const { ticket } = (await req("POST", "/events/ticket", token)).j;
  const ctrl = new AbortController();
  const res = await fetch(`${API}/events?ticket=${ticket}`, { signal: ctrl.signal });
  const events = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (line) events.push(JSON.parse(line.slice(6)));
        }
      }
    } catch {}
  })();
  return { res, events, ticket, close: () => ctrl.abort() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("16. ticket obrigatório e de uso único", async () => {
  assert.equal((await req("POST", "/events/ticket")).s, 401);
  assert.equal((await fetch(`${API}/events?ticket=xyz`)).status, 401);
  const l = await listen(t.cli);
  assert.equal(l.res.status, 200);
  assert.match(l.res.headers.get("content-type"), /text\/event-stream/);
  assert.equal((await fetch(`${API}/events?ticket=${l.ticket}`)).status, 401, "ticket já usado");
  l.close();
});

test("16. mensagem nova chega na hora para a outra parte", async () => {
  const conv = (await req("POST", "/conversations", t.cli, { serviceId: 1 })).j;
  const provider = await listen(t.ele);
  await wait(200);
  const sent = await req("POST", `/conversations/${conv.id}/messages`, t.cli, { text: "Oi, tudo bem? (teste tempo real)" });
  assert.ok(sent.s < 300, JSON.stringify(sent.j));
  await wait(800);
  provider.close();
  assert.ok(provider.events.some((e) => e.type === "conversation" && e.id === conv.id), JSON.stringify(provider.events));
  assert.ok(provider.events.some((e) => e.type === "notification"), "aviso de mensagem também chega: " + JSON.stringify(provider.events));
});
