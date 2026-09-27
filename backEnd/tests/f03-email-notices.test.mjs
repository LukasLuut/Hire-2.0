import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { req, tokens } from "./helpers.mjs";

const t = await tokens();
const OUTBOX = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "outbox");
const PROVIDER_EMAIL = "eletricista@hire.dev";
const count = () => (fs.existsSync(OUTBOX) ? fs.readdirSync(OUTBOX).filter((f) => f.includes(PROVIDER_EMAIL)).length : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("3. aviso vai também por e-mail; desligar a preferência para o envio", async () => {
  assert.equal((await req("PUT", "/users/me/preferences", t.ele, { emailNotifications: true })).j.emailNotifications, true);
  const before = count();
  const h = (await req("POST", "/hires", t.cli, { serviceId: 3 })).j;
  await sleep(800); // o e-mail sai em segundo plano
  assert.equal(count(), before + 1, "prestador recebeu o e-mail do novo pedido");
  const newest = fs.readdirSync(OUTBOX).filter((f) => f.includes(PROVIDER_EMAIL)).sort().pop();
  const html = fs.readFileSync(path.join(OUTBOX, newest), "utf8");
  assert.match(html, /Novo pedido/);
  assert.match(html, /localhost:5173\/progress/);

  assert.equal((await req("PUT", "/users/me/preferences", t.ele, { emailNotifications: false })).j.emailNotifications, false);
  await req("PUT", `/hires/${h.id}`, t.cli, { status: "CANCELADO" });
  await sleep(800);
  assert.equal(count(), before + 1, "com a preferência desligada, nenhum e-mail novo");
  assert.ok((await req("GET", "/notifications", t.ele)).j.items.some((n) => n.type === "hire.cancelled"), "o aviso no app continua");

  await req("PUT", "/users/me/preferences", t.ele, { emailNotifications: true });
  assert.equal((await req("GET", "/users/me", t.ele)).j.emailNotifications, true);
});
