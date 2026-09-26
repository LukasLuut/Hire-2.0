import fs from "fs";
import path from "path";
import express, { Router, type Request, type Response, type NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { ServiceProvider } from "../models/ServiceProvider";
import { Service } from "../models/Service";
import { frontendUrl } from "../services/MailService";
import { isSlug } from "../utils/slug";
import { cityPages, findCityPage } from "./cityPages";

/*
 * SEO e pré-visualização social para a SPA (Vite).
 * Robôs do WhatsApp/Facebook/LinkedIn/Google não executam JavaScript; por isso,
 * quando o backend serve o build do frontend (produção), as rotas públicas recebem
 * o index.html com title, description, canonical, Open Graph e Twitter já preenchidos.
 * Rotas privadas recebem noindex. robots.txt e sitemap.xml vêm daqui.
 */

const DIST = process.env.FRONTEND_DIST || path.join(__dirname, "..", "..", "..", "Hire", "dist");
const SITE = "Hire.";
const DEFAULT_DESCRIPTION = "Encontre profissionais de serviços perto de você, peça orçamento, converse e contrate com segurança no Hire.";

// páginas que dependem de login ou são pessoais: nunca indexar
const PRIVATE = [/^\/home/, /^\/business/, /^\/admin/, /^\/client/, /^\/progress/, /^\/hires/, /^\/pendencias/, /^\/negotiations?/, /^\/contract/, /^\/auth/, /^\/esqueci-senha/, /^\/redefinir-senha/, /^\/verificar-email/, /^\/convid/, /^\/convite\//];

type Meta = { title: string; description: string; url: string; image?: string | null; type?: string; noindex?: boolean; status?: number };

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: unknown, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
/** URL absoluta de imagem enviada (servida pelo backend) */
const imageUrl = (p?: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : `${publicApiUrl()}${p.startsWith("/") ? "" : "/"}${p}`);
/** Endereço público do backend (imagens das meta tags). Em produção, defina PUBLIC_API_URL
 *  (com um domínio só para site e API, é o mesmo valor de FRONTEND_URL). */
export const publicApiUrl = () => (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/$/, "");

let template: string | null = null;
function indexHtml() {
  if (template && process.env.NODE_ENV === "production") return template;
  const file = path.join(DIST, "index.html");
  template = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  return template;
}
export const hasFrontendBuild = () => fs.existsSync(path.join(DIST, "index.html"));

/** Troca o bloco de SEO padrão do index.html pelas meta tags da página */
export function renderHtml(html: string, m: Meta) {
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    m.noindex ? `<meta name="robots" content="noindex, nofollow" />` : `<meta name="robots" content="index, follow" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:type" content="${esc(m.type ?? "website")}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    m.image ? `<meta property="og:image" content="${esc(m.image)}" />` : "",
    `<meta name="twitter:card" content="${m.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    m.image ? `<meta name="twitter:image" content="${esc(m.image)}" />` : "",
  ].filter(Boolean).join("\n    ");
  const block = /<!-- seo:start[^>]*-->[\s\S]*?<!-- seo:end -->/;
  return block.test(html)
    ? html.replace(block, `<!-- seo:start -->\n    ${tags}\n    <!-- seo:end -->`)
    : html.replace(/<title>[\s\S]*?<\/title>/, tags);
}

/** Meta tags de uma rota do frontend (null = rota desconhecida → 404 amigável da SPA) */
export async function metaFor(pathname: string): Promise<Meta | { redirect: string }> {
  const site = frontendUrl();
  const base: Meta = { title: `${SITE} — Serviços perto de você`, description: DEFAULT_DESCRIPTION, url: `${site}${pathname === "/" ? "/" : pathname}` };
  if (PRIVATE.some((r) => r.test(pathname))) return { ...base, title: SITE, noindex: true };

  let m = pathname.match(/^\/provider\/(\d+)\/?$/);
  if (m) {
    const p = await AppDataSource.getRepository(ServiceProvider).findOne({ where: { id: Number(m[1]) }, select: { id: true, slug: true } });
    if (p?.slug) return { redirect: `/prestador/${p.slug}` };
    return { ...base, title: `Perfil não encontrado | ${SITE}`, noindex: true, status: 404 };
  }

  m = pathname.match(/^\/prestador\/([^/]+)\/?$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    const p = isSlug(slug)
      ? await AppDataSource.getRepository(ServiceProvider).findOne({ where: { slug }, relations: { category: true } })
      : null;
    if (!p) return { ...base, title: `Perfil não encontrado | ${SITE}`, noindex: true, status: 404 };
    const name = p.companyName || p.professionalName;
    const where = p.baseCity ? ` em ${p.baseCity}${p.baseState ? `/${p.baseState}` : ""}` : "";
    return {
      title: `${name}${p.category?.name ? ` — ${p.category.name}` : ""}${where} | ${SITE}`,
      description: clip(p.description || `${name}${p.category?.name ? `, ${p.category.name.toLowerCase()}` : ""}${where}. Veja serviços, avaliações e peça orçamento pelo Hire.`, 160),
      url: `${site}/prestador/${p.slug}`,
      image: imageUrl(p.profileImageUrl),
      type: "profile",
    };
  }

  m = pathname.match(/^\/service\/(\d+)\/?$/);
  if (m) {
    const s = await AppDataSource.getRepository(Service).findOne({ where: { id: Number(m[1]) }, relations: { provider: true, category: true } });
    if (!s) return { ...base, title: `Serviço não encontrado | ${SITE}`, noindex: true, status: 404 };
    const who = s.provider?.companyName || s.provider?.professionalName;
    return {
      title: `${s.title}${who ? ` — ${who}` : ""} | ${SITE}`,
      description: clip(s.description_service, 160),
      url: `${site}/service/${s.id}`,
      image: imageUrl(s.images?.[0] ?? s.imageUrl),
      // pausado: continua acessível pelo link, mas fora dos buscadores
      noindex: s.active === false,
    };
  }

  m = pathname.match(/^\/servicos\/([^/]+)\/([^/]+)\/?$/);
  if (m) {
    const page = await findCityPage(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    if (!page) return { ...base, title: `Página não encontrada | ${SITE}`, noindex: true, status: 404 };
    return {
      title: `${page.categoryName} em ${page.city}/${page.state} — ${page.providers} profissional(is) | ${SITE}`,
      description: clip(`Encontre ${page.categoryName.toLowerCase()} em ${page.city}: ${page.providers} profissional(is) e ${page.services} serviço(s) com avaliações. Peça orçamento pelo Hire.`, 160),
      url: `${site}/servicos/${page.categorySlug}/${page.citySlug}`,
      // conteúdo fino (menos do que o mínimo) fica acessível, mas sem indexação
      noindex: !page.indexable,
    };
  }

  if (pathname === "/" || pathname === "/apresentacao") return base;
  return { ...base, title: `Página não encontrada | ${SITE}`, noindex: true, status: 404 };
}

async function sitemap() {
  const site = frontendUrl();
  const providers = await AppDataSource.getRepository(ServiceProvider)
    .createQueryBuilder("p")
    .select(["p.slug"])
    .innerJoin("p.services", "s", "s.active = 1")
    .where("p.slug IS NOT NULL")
    .groupBy("p.id")
    .getMany();
  const services = await AppDataSource.getRepository(Service).find({ where: { active: true }, select: { id: true } });
  const pages = (await cityPages()).filter((p) => p.indexable);
  const urls = [
    `${site}/`,
    ...providers.map((p) => `${site}/prestador/${p.slug}`),
    ...services.map((s) => `${site}/service/${s.id}`),
    ...pages.map((p) => `${site}/servicos/${p.categorySlug}/${p.citySlug}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

function robots() {
  const site = frontendUrl();
  const disallow = ["/home", "/business", "/admin", "/client", "/progress", "/hires", "/pendencias", "/negotiations", "/negotiation/", "/contract/", "/auth", "/esqueci-senha", "/redefinir-senha", "/verificar-email", "/convidar", "/convite/"];
  return `User-agent: *\n${disallow.map((d) => `Disallow: ${d}`).join("\n")}\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;
}

/** robots.txt e sitemap.xml (sempre disponíveis) */
export const seoRouter = Router();
seoRouter.get("/robots.txt", (req, res) => res.type("text/plain").send(robots()));
seoRouter.get("/sitemap.xml", async (req, res, next) => {
  try {
    res.type("application/xml").send(await sitemap());
  } catch (e) {
    next(e);
  }
});

/**
 * Navegação de navegador/robô (GET que aceita HTML) recebe a SPA com as meta tags.
 * Chamadas da API (fetch/JSON) seguem para as rotas normais — por isso /admin e
 * /hires podem ser, ao mesmo tempo, página do frontend e rota da API.
 */
export function spaHandler() {
  const statics = express.static(DIST, { index: false, maxAge: "7d" });
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!hasFrontendBuild()) return next();
    // arquivos do build (JS, CSS, imagens)
    if (/\.[a-z0-9]+$/i.test(req.path)) return statics(req, res, next);
    const accept = String(req.headers.accept ?? "");
    if (!accept.includes("text/html")) return next();
    try {
      const meta = await metaFor(req.path);
      if ("redirect" in meta) return res.redirect(301, meta.redirect + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
      const html = indexHtml();
      if (!html) return next();
      res.status(meta.status ?? 200).type("html").setHeader("Cache-Control", "no-cache").send(renderHtml(html, meta));
    } catch (e) {
      next(e);
    }
  };
}
