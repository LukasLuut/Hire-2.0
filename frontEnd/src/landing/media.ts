// Tomadas reais do Hire usadas na landing (public/landing/story).
// Gravadas por scripts/landing-capture com o elenco da apresentação (backEnd: npm run story:seed).
import { MEDIA_SIZE } from "./media.gen";

export type ShotName = keyof typeof MEDIA_SIZE;
export type Shot = { name: ShotName; src: string; width: number; height: number };

export function shot(name: ShotName): Shot {
  const [width, height] = MEDIA_SIZE[name];
  return { name, src: `/landing/story/${name}.webp`, width, height };
}

/** Foto de fundo com versão de 960 px para o celular */
export function photoSrcSet(s: Shot) {
  return `${s.src.replace(/\.webp$/, "-960.webp")} 960w, ${s.src} ${s.width}w`;
}

/** Retângulo dentro de uma tomada, em px da própria imagem */
export type Box = { x: number; y: number; w: number; h: number };

/** Caixa → porcentagens da tomada (para posicionar recortes e destaques sem depender do tamanho na tela) */
export function pct(s: Shot, b: Box) {
  return { left: `${(b.x / s.width) * 100}%`, top: `${(b.y / s.height) * 100}%`, width: `${(b.w / s.width) * 100}%`, height: `${(b.h / s.height) * 100}%` };
}

/** Centro de uma caixa como transform-origin ("x% y%") */
export function originOf(s: Shot, b: Box) {
  return `${((b.x + b.w / 2) / s.width) * 100}% ${((b.y + b.h / 2) / s.height) * 100}%`;
}

/**
 * Pontos de interesse de cada tomada (px da imagem). Se as tomadas forem regravadas com outro
 * layout do app, é aqui que os enquadramentos da câmera são ajustados.
 */
export const SPOTS = {
  results: {
    bar: { x: 148, y: 30, w: 1610, h: 76 },
    location: { x: 1776, y: 30, w: 78, h: 76 },
    chips: { x: 500, y: 122, w: 1000, h: 44 },
    tomasCard: { x: 60, y: 404, w: 434, h: 830 },
    /** a foto de capa do card do Tomás (a mesma foto que vira o cenário) */
    tomasCover: { x: 62, y: 406, w: 430, h: 280 },
    tomasService: { x: 60, y: 940, w: 434, h: 294 },
    recommended: { x: 1472, y: 268, w: 468, h: 674 },
    grid: { x: 60, y: 404, w: 1375, h: 830 },
    /** o menu "Veja quem atende perto de você", aberto pelo botão ao lado da busca (tomada search-location) */
    locationMenu: { x: 1235, y: 110, w: 618, h: 214 },
  },
  filters: {
    panel: { x: 148, y: 100, w: 1610, h: 475 },
  },
  hero: {
    avatar: { x: 290, y: 183, w: 400, h: 400 },
    identity: { x: 280, y: 170, w: 1440, h: 530 },
    name: { x: 740, y: 180, w: 960, h: 72 },
    member: { x: 740, y: 290, w: 610, h: 40 },
    location: { x: 740, y: 336, w: 320, h: 34 },
    about: { x: 770, y: 385, w: 940, h: 120 },
    chips: { x: 775, y: 528, w: 385, h: 40 },
    actions: { x: 775, y: 606, w: 680, h: 86 },
    status: { x: 325, y: 645, w: 330, h: 44 },
    share: { x: 1138, y: 608, w: 216, h: 82 },
  },
  portfolio: {
    first: { x: 74, y: 117, w: 448, h: 334 },
    /** Camila & Rafael — a foto que a cena 04 abre no visualizador */
    second: { x: 541, y: 117, w: 448, h: 334 },
  },
  chatRoom: {
    header: { x: 0, y: 0, w: 1120, h: 130 },
    juliaAsk: { x: 262, y: 262, w: 830, h: 210 },
    deal: { x: 118, y: 990, w: 886, h: 165 },
  },
  negotiation: {
    topics: { x: 30, y: 210, w: 624, h: 840 },
    payment: { x: 30, y: 488, w: 624, h: 175 },
  },
  contract: {
    signatures: { x: 430, y: 780, w: 1140, h: 190 },
    confirmation: { x: 378, y: 1046, w: 1244, h: 160 },
    /** assinaturas + "as duas partes assinaram": o payoff da cena 07 */
    sealed: { x: 378, y: 780, w: 1244, h: 426 },
  },
  business: {
    complete: { x: 1405, y: 172, w: 446, h: 182 },
    share: { x: 1405, y: 518, w: 446, h: 216 },
  },
  share: {
    link: { x: 562, y: 268, w: 876, h: 50 },
    card: { x: 563, y: 612, w: 875, h: 377 },
    qr: { x: 1206, y: 703, w: 194, h: 194 },
    /** o QR Code dentro da imagem gerada (share-card) */
    cardQr: { x: 1182, y: 170, w: 348, h: 348 },
  },
} as const satisfies Record<string, Record<string, Box>>;
