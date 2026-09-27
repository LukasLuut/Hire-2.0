import { test } from "node:test";
import assert from "node:assert/strict";
import { req, tokens, form } from "./helpers.mjs";

const t = await tokens();
// Porto Alegre (prestador 1) e Caxias do Sul (prestador 2), a ~95 km
const POA = { latitude: -30.0346, longitude: -51.2177, baseCity: "Porto Alegre", baseState: "RS" };
const CAXIAS = { latitude: -29.1678, longitude: -51.1794, baseCity: "Caxias do Sul", baseState: "RS" };

test("5. prestador define cidade, ponto e raio (validados)", async () => {
  const a = await req("PUT", "/providers", t.ele, form({ ...POA, serviceRadiusKm: 20, attendsPresent: true, attendsOnline: false }));
  assert.equal(a.s, 200, JSON.stringify(a.j));
  const b = await req("PUT", "/providers", t.lim, form({ ...CAXIAS, serviceRadiusKm: 999, attendsPresent: true, attendsOnline: false }));
  assert.equal(b.s, 200);
  const pub = (await req("GET", "/providers/2/public")).j;
  assert.equal(pub.baseCity, "Caxias do Sul");
  assert.equal(pub.serviceRadiusKm, 300, "raio limitado a 300 km");
  await req("PUT", "/providers", t.lim, form({ serviceRadiusKm: 15 }));
});

test("5. vitrine com a localização do cliente: distância, quem atende e filtro", async () => {
  const near = { lat: -30.03, lng: -51.2 }; // centro de Porto Alegre
  const all = (await req("GET", `/services?lat=${near.lat}&lng=${near.lng}`)).j;
  const p1 = all.find((s) => s.provider?.id === 1);
  const p2 = all.find((s) => s.provider?.id === 2);
  assert.ok(p1.distanceKm < 5, `distância do prestador 1: ${p1.distanceKm}`);
  assert.equal(p1.servesYou, true);
  assert.ok(p2.distanceKm > 80, `distância do prestador 2: ${p2.distanceKm}`);
  assert.equal(p2.servesYou, false);
  const nearby = (await req("GET", `/services?lat=${near.lat}&lng=${near.lng}&onlyNearby=true`)).j;
  assert.ok(nearby.every((s) => s.servesYou));
  assert.ok(!nearby.some((s) => s.provider?.id === 2), "fora do raio sai da lista");
  // sem localização: lista normal, sem distância
  const plain = (await req("GET", "/services")).j;
  assert.equal(plain[0].distanceKm, undefined);
});

test("5. quem atende online atende qualquer lugar", async () => {
  await req("PUT", "/providers", t.lim, form({ attendsOnline: true }));
  const list = (await req("GET", "/services?lat=-30.03&lng=-51.2&onlyNearby=true")).j;
  assert.ok(list.some((s) => s.provider?.id === 2));
  await req("PUT", "/providers", t.lim, form({ attendsOnline: false }));
});
