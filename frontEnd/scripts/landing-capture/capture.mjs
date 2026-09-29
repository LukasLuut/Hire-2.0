/**
 * Tomadas reais do Hire para a landing (public/landing/story).
 *
 * Grava o app de verdade, rodando com o elenco da apresentação (backEnd: npm run story:seed).
 * Cada tomada segue o roteiro de SHOTS.md (cena, objetivo, estado inicial, ação, foco, final).
 *
 *   1. backEnd:   npm run story:images && npm run story:seed && npm run dev
 *   2. frontEnd:  npm run dev
 *   3. aqui:      npm install && npm run setup && npm run capture
 *
 * Variáveis: APP_URL (padrão http://localhost:5173), API_URL (padrão http://localhost:8080),
 * ONLY=nome1,nome2 para regravar só algumas tomadas.
 * Precisa de uma apresentação recém-criada: a tomada do contrato assina pelas duas partes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "public", "landing", "story");
const RAW = path.join(HERE, ".raw");
const APP = process.env.APP_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:8080";
const ONLY = new Set((process.env.ONLY ?? "").split(",").filter(Boolean));
const PASSWORD = "Teste@123";
const JULIA = "julia.martins@apresentacao.hire.dev";
const TOMAS = "tomas.albuquerque@apresentacao.hire.dev";
const QUERY = "Fotógrafo para eventos";
/** Próxima quarta-feira, 15h: dia e hora de expediente do elenco */
const CLOCK = (() => { const d = new Date(); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); d.setHours(15, 0, 0, 0); return d; })();

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

// ------------------------------------------------------------------ utilidades

async function login(email) {
  const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!res.ok) throw new Error(`login ${email}: ${res.status} — rode npm run story:seed no backEnd`);
  return (await res.json()).token;
}
const api = (token, p, init = {}) => fetch(`${API}${p}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } }).then((r) => r.json());

/** Endereço mostrado nas telas que exibem o link do perfil (em vez de localhost:5173) */
const PUBLIC_ORIGIN = "https://hire.dev";

/**
 * Página com sessão (token no localStorage, como o app faz no login) e tempo estável.
 * `publicDomain`: o app abre em https://hire.dev (as requisições são encaminhadas ao servidor local),
 * para o link do perfil aparecer como apareceria em produção.
 */
async function open(browser, { token = null, width = 1440, height = 900, scale = 2, mobile = false, publicDomain = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "dark", reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const base = publicDomain ? PUBLIC_ORIGIN : APP;
  if (publicDomain) {
    await ctx.route(`${PUBLIC_ORIGIN}/**`, async (route) => {
      const u = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${APP}${u.pathname}${u.search}` }) });
    });
    // a API só aceita a origem local: a requisição sai como se viesse dela e a resposta volta liberada para hire.dev
    await ctx.route(`${API}/**`, async (route) => {
      // avisos em tempo real (stream) não fazem parte da tomada
      if ((route.request().headers().accept ?? "").includes("text/event-stream") || route.request().url().includes("/events")) return route.abort();
      const res = await route.fetch({ headers: { ...route.request().headers(), origin: APP } });
      await route.fulfill({ response: res, headers: { ...res.headers(), "access-control-allow-origin": PUBLIC_ORIGIN } });
    });
  }
  const page = await ctx.newPage();
  // quarta-feira à tarde: o Tomás aparece "Aberto agora" (o chip de horário é calculado no navegador)
  await page.clock.setFixedTime(CLOCK);
  await page.goto(`${base}/auth`);
  await page.evaluate((t) => { localStorage.clear(); if (t) localStorage.setItem("token", t); localStorage.setItem("theme", "dark"); }, token);
  // sem cursor piscando, sem barra de rolagem, sem o botão de acessibilidade flutuante nas tomadas
  await page.addInitScript(() => {
    const css = "*{caret-color:transparent!important} ::-webkit-scrollbar{display:none} [aria-label*='cessibilidade' i]{visibility:hidden!important} :focus-visible,:focus{outline:none!important}";
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); });
  });
  return { ctx, page, base };
}

async function settle(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => null);
  // imagens com loading=lazy: força o carregamento de tudo que estiver na página
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(ms);
}

/**
 * Nada mais escuro que o fundo do app (3,3,3): as sombras do app e os artefatos de compressão ficavam 1–3 níveis
 * abaixo do fundo da landing e apareciam como manchas pretas em monitores de contraste alto.
 */
const BLACK = 3;
async function floorBlack(img) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const color = info.channels === 4 ? 3 : info.channels;
  for (let i = 0; i < data.length; i++) if (i % info.channels < color && data[i] < BLACK) data[i] = BLACK;
  return sharp(data, { raw: info });
}

/** Salva PNG bruto e WebP otimizado; `width` = largura final em px (a tomada é 2x) */
async function save(name, buffer, { width, quality = 80 } = {}) {
  fs.writeFileSync(path.join(RAW, `${name}.png`), buffer);
  let img = sharp(buffer);
  if (width) img = img.resize({ width, withoutEnlargement: true });
  img = await floorBlack(img);
  const info = await img.webp({ quality, effort: 6, smartSubsample: true }).toFile(path.join(OUT, `${name}.webp`));
  console.log(`  ${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
  return info;
}

/** Dimensões de todas as tomadas, para a landing reservar o espaço certo (sem CLS) */
async function writeManifest() {
  const out = {};
  for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith(".webp")).sort()) {
    const m = await sharp(path.join(OUT, f)).metadata();
    out[f.replace(/\.webp$/, "")] = [m.width, m.height];
  }
  const file = path.resolve(HERE, "..", "..", "src", "landing", "media.gen.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rows = Object.entries(out).map(([k, [w, h]]) => `  "${k}": [${w}, ${h}],`).join("\n");
  fs.writeFileSync(file, `// Gerado por scripts/landing-capture (npm run capture). Não editar à mão.
// Largura e altura, em px, de cada tomada em public/landing/story.
export const MEDIA_SIZE = {
${rows}
} as const satisfies Record<string, readonly [number, number]>;
`);
  console.log(`manifesto: ${Object.keys(out).length} tomadas → src/landing/media.gen.ts`);

  // créditos das fotos de demonstração que aparecem nas tomadas (licenças CC pedem atribuição)
  const story = path.resolve(HERE, "..", "..", "..", "backEnd", "scripts", "story");
  const cast = fs.readFileSync(path.join(story, "cast.ts"), "utf8");
  const { photos } = JSON.parse(fs.readFileSync(path.join(story, "images.json"), "utf8"));
  const used = photos.filter((p) => cast.includes(`img("${p.file.replace(/\.jpg$/, "")}")`));
  const credits = used.map((p) => `  { author: ${JSON.stringify(p.author || "autor desconhecido")}, license: ${JSON.stringify(p.license)}, source: ${JSON.stringify(p.source)} },`).join("\n");
  fs.writeFileSync(path.resolve(HERE, "..", "..", "src", "landing", "credits.gen.ts"), `// Gerado por scripts/landing-capture (npm run capture) a partir de backEnd/scripts/story/images.json. Não editar à mão.
// Fotos dos portfólios de demonstração (Wikimedia Commons) que aparecem nas tomadas da landing.
export const PHOTO_CREDITS: { author: string; license: string; source: string }[] = [
${credits}
];
`);
  console.log(`créditos: ${used.length} fotos → src/landing/credits.gen.ts`);
}

const shots = [];
const shot = (name, fn) => shots.push({ name, fn });

// ------------------------------------------------------------------ tomadas

/** Caixa (em px CSS da página inteira) de um elemento, com folga */
async function boxOf(locator, pad = 0) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("elemento fora da tela");
  const scrollY = await locator.evaluate(() => window.scrollY);
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y + scrollY - pad), width: b.width + pad * 2, height: b.height + pad * 2 };
}
/** Barra de busca inteira (a caixa com borda em volta do campo) */
async function searchBar(page) {
  const input = page.getByPlaceholder(/Procure por serviços/);
  await input.scrollIntoViewIfNeeded();
  const handle = await input.evaluateHandle((el) => {
    let n = el;
    while (n.parentElement && n.getBoundingClientRect().width < 900) n = n.parentElement;
    return n;
  });
  return { input, bar: handle.asElement() };
}

// CENA 01/03 — BUSCA: o campo vazio, a digitação da busca letra por letra e os resultados
shot("search", async (browser, t) => {
  const { ctx, page } = await open(browser, { token: t.julia });
  await page.goto(`${APP}/home`);
  await settle(page);
  const { input, bar } = await searchBar(page);
  await page.evaluate(() => window.scrollBy(0, -140));
  const b = await bar.boundingBox();
  const sy = await page.evaluate(() => window.scrollY);
  const inBox = await input.boundingBox();
  const clip = { x: 110, y: inBox.y + sy + inBox.height / 2 - 46, width: 1220, height: 92 };
  await input.click();
  await page.waitForTimeout(300);
  for (let i = 0; i <= QUERY.length; i++) {
    if (i > 0) await input.pressSequentially(QUERY[i - 1]);
    await page.waitForTimeout(120);
    await save(`search-type-${String(i).padStart(2, "0")}`, await page.screenshot({ clip, fullPage: true }), { width: 1400, quality: 82 });
  }
  await settle(page, 1200);
  // resultados: da barra até o fim da primeira fileira de cards, com os recomendados ao lado
  const firstRowBottom = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, a")].filter((e) => /Ver detalhes/.test(e.textContent ?? ""));
    const first = btns[0]?.getBoundingClientRect();
    return (first ? first.bottom + 36 : 1200) + window.scrollY;
  });
  const top = clip.y;
  await save("search-results", await page.screenshot({ fullPage: true, clip: { x: 40, y: top, width: 1360, height: firstRowBottom - top } }), { width: 2000 });
  // localização aberta (o menu do botão ao lado da busca), no mesmo recorte: a cena "Descubra" troca uma pela outra
  const locate = page.getByRole("button", { name: /perto de você|^Localização/ });
  await locate.click();
  await page.waitForTimeout(600);
  await save("search-location", await page.screenshot({ fullPage: true, clip: { x: 40, y: top, width: 1360, height: firstRowBottom - top } }), { width: 2000 });
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: /Explorar serviços/ }).click();
  await page.waitForTimeout(400);
  // filtros abertos (categoria, preço, ordem) para a cena "Descubra"
  await page.getByRole("button", { name: /^Filtros/ }).click();
  await page.waitForTimeout(500);
  const panelBottom = await page.evaluate(() => {
    const sel = document.querySelector("select");
    const box = sel?.closest("div[class*='grid'], div[class*='flex']")?.getBoundingClientRect();
    return (box ? box.bottom + 40 : 900) + window.scrollY;
  });
  await save("search-filters", await page.screenshot({ fullPage: true, clip: { x: 40, y: top, width: 1360, height: Math.max(260, panelBottom - top) } }), { width: 2000 });
  await ctx.close();
});

// CENA 04/05 — PERFIL: o hero, o "Conheça", o portfólio e as avaliações (Júlia olhando o perfil)
shot("profile", async (browser, t) => {
  const { ctx, page } = await open(browser, { token: t.julia });
  await page.goto(`${APP}/prestador/tomas-albuquerque`);
  await settle(page, 1500);
  await save("profile-hero", await page.screenshot(), { width: 2000 });
  const section = async (heading, name, next) => {
    const h = page.getByRole("heading", { name: heading }).first();
    await h.scrollIntoViewIfNeeded();
    await settle(page, 400);
    const top = (await boxOf(h)).y - 32;
    const end = next ? (await boxOf(page.getByRole("heading", { name: next }).first())).y - 40 : top + 900;
    await save(name, await page.screenshot({ fullPage: true, clip: { x: 60, y: top, width: 1320, height: end - top } }), { width: 2000 });
  };
  await section(/Conheça Tomás/, "profile-about", /Portfólio/);
  await section(/Portfólio/, "profile-portfolio", /Avaliações/);
  // avaliações: cada cartão separado (a cena "Confie" monta com eles)
  await page.getByRole("heading", { name: /^Avaliações/ }).scrollIntoViewIfNeeded();
  await settle(page, 400);
  let k = 0;
  for (const text of [/Contratamos o Tomás/, /Nós dois travamos/, /Casamos num dia de chuva/]) {
    const card = page.locator("div").filter({ hasText: text }).filter({ hasText: /—/ }).last();
    await save(`review-${++k}`, await page.screenshot({ fullPage: true, clip: await boxOf(card, 2) }), { width: 900 });
  }
  // portfólio ampliado (o visualizador do próprio app)
  await page.getByRole("heading", { name: /Portfólio/ }).scrollIntoViewIfNeeded();
  await page.locator("section[aria-labelledby='portfolio-title'] button").first().click();
  await page.waitForTimeout(900);
  await save("portfolio-lightbox", await page.screenshot(), { width: 2000 });
  await ctx.close();
});

// CENA 04 — o visualizador abrindo outras fotos do portfólio (a da estrada já abre a história na cena 01)
shot("lightboxes", async (browser, t) => {
  const { ctx, page } = await open(browser, { token: t.julia });
  await page.goto(`${APP}/prestador/tomas-albuquerque`);
  await settle(page, 1500);
  for (const [index, name] of [[1, "portfolio-lightbox-embrace"], [8, "portfolio-lightbox-sparklers"]]) {
    await page.getByRole("heading", { name: /Portfólio/ }).scrollIntoViewIfNeeded();
    await page.locator("section[aria-labelledby='portfolio-title'] button").nth(index).click();
    await page.waitForTimeout(900);
    await save(name, await page.screenshot(), { width: 2000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  }
  await ctx.close();
});

// CENA 06 — CONVERSA: a conversa inteira (Júlia ↔ Tomás) e o painel de negociação
shot("chat", async (browser, t) => {
  const convs = await api(t.julia, "/conversations");
  const conv = (Array.isArray(convs) ? convs : convs.items ?? convs.data).find((c) => c.provider?.slug === "tomas-albuquerque");
  const { ctx, page } = await open(browser, { token: t.julia, height: 1000 });
  await page.goto(`${APP}/negotiation/${conv.id}`);
  await settle(page, 1500);
  const room = page.getByRole("dialog").or(page.locator("[aria-label='Conversa']")).first();
  await save("chat-room", await page.screenshot({ clip: await boxOf(room, 0) }), { width: 1200 });
  // a conversa inteira numa imagem alta: rola a lista de mensagens e costura as partes
  const list = (await page.evaluateHandle(() => {
    const root = document.querySelector("[aria-label='Conversa']") ?? document.body;
    const els = [...root.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    return els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  })).asElement();
  const { total, view } = await list.evaluate((el) => ({ total: el.scrollHeight, view: el.clientHeight }));
  const parts = [];
  for (let y = 0; ; y += view) {
    const top = Math.min(y, total - view);
    await list.evaluate((el, t) => { el.scrollTop = t; }, top);
    await page.waitForTimeout(250);
    parts.push({ top, buf: await list.screenshot() });
    if (top >= total - view) break;
  }
  const meta = await sharp(parts[0].buf).metadata();
  const k = meta.height / view;
  const tall = await sharp({ create: { width: meta.width, height: Math.round(total * k), channels: 4, background: "#000" } })
    .composite(parts.map((p) => ({ input: p.buf, top: Math.round(p.top * k), left: 0 })))
    .png()
    .toBuffer();
  await save("chat-thread", tall, { width: 1100 });
  // painel de negociação (acordo fechado, contrato gerado)
  await list.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const toggle = page.getByRole("button", { name: "Mostrar negociação" });
  if (await toggle.count()) await toggle.click();
  // o acordo já foi fechado: abre pelo histórico para mostrar os tópicos acordados
  const aside = page.locator("aside[aria-label='Negociação']");
  await aside.getByRole("button", { name: /Histórico/ }).click();
  await page.waitForTimeout(400);
  await aside.getByRole("button", { name: /Fotografia de Casamento/ }).first().click();
  await page.waitForTimeout(900);
  await save("negotiation-panel", await aside.screenshot(), { width: 700 });
  await ctx.close();
});

// CENA 07 — CONTRATO: as duas partes assinam no próprio app; a tomada é o contrato assinado
shot("contract", async (browser, t) => {
  const convs = await api(t.julia, "/conversations");
  const conv = (Array.isArray(convs) ? convs : convs.items ?? convs.data).find((c) => c.provider?.slug === "tomas-albuquerque");
  const detail = await api(t.julia, `/conversations/${conv.id}`);
  const contractId = detail.contractId ?? detail.conversation?.contractId ?? detail.negotiation?.contractId;
  for (const [token, name] of [[t.tomas, "Tomás Albuquerque"], [t.julia, "Júlia Martins"]]) {
    const { ctx, page } = await open(browser, { token, scale: 1 });
    await page.goto(`${APP}/contract/${contractId}`);
    await settle(page, 1200);
    if (await page.locator("#typedName").count()) {
      await page.fill("#typedName", name);
      await page.check("#agree");
      await page.getByRole("button", { name: "Assinar contrato" }).click();
      await page.getByText("Você assinou este contrato").waitFor({ timeout: 15000 });
    }
    await ctx.close();
  }
  const { ctx, page } = await open(browser, { token: t.julia });
  await page.goto(`${APP}/contract/${contractId}`);
  await settle(page, 1200);
  const sig = page.getByText(/Assinado eletronicamente por/).first();
  await sig.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(400);
  await save("contract-signed", await page.screenshot(), { width: 2000 });
  await ctx.close();
});

// CENA 08 — QUEM OFERECE: o painel do Tomás, com o pedido novo do Rodrigo
shot("business", async (browser, t) => {
  const { ctx, page, base } = await open(browser, { token: t.tomas, publicDomain: true });
  await page.goto(`${base}/business`);
  await settle(page, 1500);
  await save("business", await page.screenshot(), { width: 2000 });
  const req = page.locator("section, div").filter({ has: page.getByText(/Pedidos de orçamento/) }).filter({ hasText: /Rodrigo/ }).last();
  await req.scrollIntoViewIfNeeded();
  await save("business-request", await page.screenshot({ fullPage: true, clip: await boxOf(req, 8) }), { width: 900 });
  // o gerenciador de portfólio (a seção inteira, recortada)
  const manager = (await page.getByRole("button", { name: /Adicionar trabalho/ }).evaluateHandle((el) => {
    let n = el;
    while (n.parentElement && n.getBoundingClientRect().height < 400) n = n.parentElement;
    return n;
  })).asElement();
  await manager.scrollIntoViewIfNeeded();
  await settle(page, 600);
  await save("business-portfolio", await page.screenshot({ fullPage: true, clip: await boxOf(manager, 4) }), { width: 2000 });
  await ctx.close();
});

// CENA 09 — COMPARTILHE: o painel de compartilhar, a imagem com QR Code gerada pelo app
shot("share", async (browser, t) => {
  const { ctx, page, base } = await open(browser, { token: t.tomas, publicDomain: true });
  await page.goto(`${base}/prestador/tomas-albuquerque`);
  await settle(page, 1200);
  await page.getByRole("button", { name: /Compartilhar/ }).first().click();
  const card = page.locator("img[alt^='Imagem do perfil']");
  await card.waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(200);
  await save("share-panel", await page.screenshot(), { width: 2000 });
  // a própria imagem gerada (PNG do app), em resolução cheia
  const src = await card.getAttribute("src");
  const png = await page.evaluate(async (u) => { const b = await (await fetch(u)).blob(); const r = new FileReader(); return await new Promise((ok) => { r.onload = () => ok(r.result); r.readAsDataURL(b); }); }, src);
  await save("share-card", Buffer.from(png.split(",")[1], "base64"), { width: 1600, quality: 86 });
  await ctx.close();
});

// MOBILE — enquadramentos próprios (390 px, tela de celular)
shot("mobile", async (browser, t) => {
  let { ctx, page } = await open(browser, { token: t.julia, width: 390, height: 844, scale: 2, mobile: true });
  await page.goto(`${APP}/prestador/tomas-albuquerque`);
  await settle(page, 1500);
  // a barra fixa do rodapé (Ver serviços / Conversar) com o respiro de um celular de verdade (área do gesto de
  // início): os botões ficam um pouco acima da borda da tela
  await page.addStyleTag({ content: ".fixed.bottom-0.inset-x-0 { padding-bottom: 26px !important; }" });
  await page.waitForTimeout(300);
  await save("m-profile", await page.screenshot(), { width: 780 });
  await page.getByRole("heading", { name: /Portfólio/ }).scrollIntoViewIfNeeded();
  await settle(page, 600);
  await save("m-portfolio", await page.screenshot(), { width: 780 });
  await ctx.close();
  // uma página nova por tela: no celular emulado, navegar de novo deixa as animações de entrada paradas
  ({ ctx, page } = await open(browser, { token: t.julia, width: 390, height: 844, scale: 2, mobile: true }));
  await page.goto(`${APP}/home`);
  await settle(page, 1200);
  const { input } = await searchBar(page).catch(() => ({ input: page.getByPlaceholder(/Procure/) }));
  await input.click();
  await input.pressSequentially(QUERY, { delay: 40 });
  await settle(page, 1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("heading", { name: /Explorar serviços/ }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 150));
  await page.waitForTimeout(500);
  await save("m-search", await page.screenshot(), { width: 780 });
  const convs = await api(t.julia, "/conversations");
  const conv = (Array.isArray(convs) ? convs : convs.items ?? convs.data).find((c) => c.provider?.slug === "tomas-albuquerque");
  await ctx.close();
  ({ ctx, page } = await open(browser, { token: t.julia, width: 390, height: 844, scale: 2, mobile: true }));
  await page.goto(`${APP}/negotiation/${conv.id}`);
  await settle(page, 2500);
  await page.getByText(/Até o pré-wedding/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await save("m-chat", await page.screenshot(), { width: 780 });
  await ctx.close();
});

// FOTOS em tamanho de tela: a da estrada (cenário da abertura) e a saída dos noivos (a foto que a cena 04
// abre por último e que vira o cenário da cena "Confie")
shot("photos", async () => {
  for (const [file, name] of [["tomas-field-walk", "photo-field-walk"], ["tomas-sparklers", "photo-sparklers"]]) {
    const res = await fetch(`${API}/uploads/story/${file}.jpg`);
    if (!res.ok) throw new Error(`${file}: ${res.status} — rode npm run story:images no backEnd`);
    const buf = Buffer.from(await res.arrayBuffer());
    const info = await sharp(buf).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(path.join(OUT, `${name}.webp`));
    console.log(`  ${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
    // versão menor para celular (srcset)
    await sharp(buf).resize({ width: 960 }).webp({ quality: 72, effort: 6 }).toFile(path.join(OUT, `${name}-960.webp`));
  }
});

// ------------------------------------------------------------------ execução

const browser = await chromium.launch();
try {
  const t = { julia: await login(JULIA), tomas: await login(TOMAS) };
  for (const s of shots) {
    if (ONLY.size && !ONLY.has(s.name)) continue;
    console.log(`▸ ${s.name}`);
    await s.fn(browser, t);
  }
  await writeManifest();
} finally {
  await browser.close();
}
