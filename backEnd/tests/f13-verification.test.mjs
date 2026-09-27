import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, login, form, PNG, API, db } from "./helpers.mjs";

const t = await tokens();
const adm = await login("admin@hire.dev");
const ele = (await req("GET", "/providers", t.ele)).j;
// estado inicial conhecido
await db("UPDATE service_providers SET verificationStatus='none', verificationFiles=NULL, verificationNote=NULL, verifiedAt=NULL WHERE id = ?", [ele.id]);

const png = (name) => [name, PNG, `${name}.png`, "image/png"];
let sent;

test("13. envio de documentos vai para análise, arquivos privados", async () => {
  assert.equal((await req("POST", "/providers/me/verification", t.ele, form({}, [png("certifications")]))).s, 400, "sem identidade");
  assert.equal((await req("POST", "/providers/me/verification", adm, form({}, [png("idDocument")]))).s, 404, "conta sem empresa");
  const r = await req("POST", "/providers/me/verification", t.ele, form({}, [png("idDocument"), png("certifications")]));
  assert.equal(r.s, 201, JSON.stringify(r.j));
  sent = r.j;
  assert.equal(sent.status, "pending");
  assert.equal(sent.files.length, 2);
  const get = (tk) => fetch(API + sent.files[0].url, { headers: tk ? { Authorization: "Bearer " + tk } : {} }).then((x) => x.status);
  assert.equal(await get(t.ele), 200);
  assert.equal(await get(adm), 200);
  assert.equal(await get(t.cli), 403);
  assert.equal(await get(null), 401);
  // perfil público não expõe arquivos nem nota
  const pub = (await req("GET", `/providers/${ele.id}/public`)).j;
  assert.equal(pub.verificationStatus, "pending");
  assert.equal(pub.verificationFiles, undefined);
  const svc = (await req("GET", "/services")).j.find((s) => s.provider?.id === ele.id);
  assert.equal(svc.provider.verificationFiles, undefined);
});

test("13. administração recusa com motivo, prestador reenvia, administração aprova", async () => {
  assert.equal((await req("GET", "/admin/verifications", t.ele)).s, 403);
  const queue = (await req("GET", "/admin/verifications?status=pending", adm)).j;
  assert.ok(queue.some((v) => v.provider.id === ele.id));
  assert.ok((await req("GET", "/admin/overview", adm)).j.pendingVerifications >= 1);
  assert.equal((await req("POST", `/admin/verifications/${ele.id}`, adm, { approve: false, note: "" })).s, 400, "recusa precisa de motivo");
  const no = await req("POST", `/admin/verifications/${ele.id}`, adm, { approve: false, note: "Foto do documento ilegível" });
  assert.equal(no.j.status, "rejected");
  // arquivos apagados depois da decisão
  assert.equal((await fetch(API + sent.files[0].url, { headers: { Authorization: "Bearer " + adm } })).status, 404);
  const mine = (await req("GET", "/providers/me/verification", t.ele)).j;
  assert.equal(mine.note, "Foto do documento ilegível");

  await req("POST", "/providers/me/verification", t.ele, form({}, [png("idDocument")]));
  const ok = await req("POST", `/admin/verifications/${ele.id}`, adm, { approve: true });
  assert.equal(ok.j.status, "verified");
  assert.equal((await req("GET", `/providers/${ele.id}/public`)).j.verificationStatus, "verified");
  assert.equal((await req("POST", "/providers/me/verification", t.ele, form({}, [png("idDocument")]))).s, 400, "já verificado");
  const notes = (await req("GET", "/notifications", t.ele)).j;
  assert.ok((Array.isArray(notes) ? notes : notes.items ?? []).some((n) => n.type === "verification.approved"));
});
