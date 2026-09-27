import { test } from "node:test";
import assert from "node:assert/strict";
import { API } from "./helpers.mjs";

test("24. QR Code do perfil: PNG e SVG públicos, download, perfil inexistente", async () => {
  const png = await fetch(`${API}/providers/souza-eletrica/qr`);
  assert.equal(png.status, 200);
  assert.equal(png.headers.get("content-type"), "image/png");
  const buf = Buffer.from(await png.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], "assinatura PNG");

  const svg = await fetch(`${API}/providers/1/qr?format=svg`);
  assert.match(svg.headers.get("content-type"), /image\/svg\+xml/);
  const text = await svg.text();
  assert.match(text, /^<svg/);
  assert.doesNotMatch(text, /<script/i);

  const dl = await fetch(`${API}/providers/souza-eletrica/qr?download=1`);
  assert.match(dl.headers.get("content-disposition"), /attachment; filename="qr-souza-eletrica\.png"/);

  assert.equal((await fetch(`${API}/providers/nao-existe/qr`)).status, 404);
});
