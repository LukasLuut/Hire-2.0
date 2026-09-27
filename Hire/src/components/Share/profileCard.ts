import { LOCAL_PORT } from "../../api/ApiClient";

/* --------------------------------------------------------------------------
 * Imagem de compartilhamento do perfil: um recorte do hero da página do prestador
 * (foto, nome com selo, nota, categoria, área, sobre) com três "botões" — Conheça,
 * Avalie, Contrate — e o QR Code ao lado. Desenhada em canvas, sem dependências:
 * o tema da imagem é escolhido na hora (não segue o tema da página).
 * -------------------------------------------------------------------------- */

export type CardTheme = "dark" | "light";

export interface ProfileCardData {
  name: string;
  verified: boolean;
  rating: { average: number; count: number };
  category?: string | null;
  /** "No Hire desde …" e serviços concluídos */
  experience?: string | null;
  /** cidade e raio de atendimento, ou "Atende online" */
  area?: string | null;
  description?: string | null;
  avatarUrl: string;
  /** id ou slug: QR Code gerado pelo servidor */
  qrFor: string | number;
  slug: string;
}

// cores do tema do Hire (theme.css), em sRGB para o canvas
const PALETTE: Record<CardTheme, { bg: string; text: string; muted: string; border: string; btnBg: string; primary: string; star: string }> = {
  dark: { bg: "#070707", text: "#f3f3f3", muted: "#b9b9b9", border: "#4f4f4f", btnBg: "#0d0d0d", primary: "#0073e6", star: "#facc15" },
  light: { bg: "#e4e4e4", text: "#151515", muted: "#4f4f4f", border: "#8f8f8f", btnBg: "#f4f4f4", primary: "#0073e6", star: "#d4a106" },
};

// ícones do lucide (viewBox 24), desenhados como traço
const ICONS: Record<string, { paths: string[]; circles?: [number, number, number][]; rects?: [number, number, number, number, number][] }> = {
  eye: { paths: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"], circles: [[12, 12, 3]] },
  star: { paths: ["M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"] },
  handshake: { paths: ["m11 17 2 2a1 1 0 1 0 3-3", "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4", "m21 3 1 11h-2", "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3", "M3 4h8"] },
  badge: { paths: ["M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"] },
  check: { paths: ["m9 12 2 2 4-4"] },
  pin: { paths: ["M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"], circles: [[12, 10, 3]] },
  briefcase: { paths: ["M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"], rects: [[2, 6, 20, 14, 2]] },
};

function icon(ctx: CanvasRenderingContext2D, name: keyof typeof ICONS, x: number, y: number, size: number, color: string, fill?: string) {
  const def = ICONS[name];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  for (const d of def.paths) {
    const p = new Path2D(d);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill(p);
    }
    ctx.stroke(p);
  }
  for (const [cx, cy, r] of def.circles ?? []) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [rx, ry, w, h, rr] of def.rects ?? []) {
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, rr);
    ctx.stroke();
  }
  ctx.restore();
}

/** Carrega uma imagem de outra origem sem "sujar" o canvas (baixa como blob) */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blobUrl = URL.createObjectURL(await res.blob());
    const img = new Image();
    img.decoding = "async";
    img.src = blobUrl;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const W = 1180;
const PAD = 52;
const AVATAR = 236;
const QR = 256;
const GAP = 40;

/** Desenha o cartão e devolve o PNG (escala 2 para ficar nítido em impressão) */
export async function renderProfileCard(data: ProfileCardData, theme: CardTheme): Promise<Blob> {
  const c = PALETTE[theme];
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  if (document.fonts?.ready) await document.fonts.ready;
  const [avatar, qr] = await Promise.all([loadImage(data.avatarUrl), loadImage(`${LOCAL_PORT}/providers/${data.qrFor}/qr`)]);

  const scale = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const infoX = PAD + AVATAR + GAP;
  const infoW = W - infoX - GAP - QR - PAD;

  // mede o texto do "Sobre" antes para saber a altura
  ctx.font = `400 21px ${font}`;
  const about = data.description ? wrap(ctx, data.description, infoW, 3) : [];
  const infoH = 60 + 42 + 36 + (data.experience ? 32 : 0) + (data.area ? 34 : 0) + (about.length ? 18 + about.length * 30 : 0) + 30 + 62;
  const H = Math.max(PAD * 2 + AVATAR + 8, PAD * 2 + infoH, PAD * 2 + QR + 96);

  canvas.width = W * scale;
  canvas.height = H * scale;
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  // fundo do hero
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // foto com o anel azul do perfil
  const ay = PAD + (H - PAD * 2 - AVATAR) / 2;
  const acx = PAD + AVATAR / 2;
  const acy = ay + AVATAR / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(acx, acy, AVATAR / 2 - 6, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = theme === "dark" ? "#141414" : "#f4f4f4";
  ctx.fill();
  ctx.clip();
  if (avatar) {
    const s = Math.max(AVATAR / avatar.naturalWidth, AVATAR / avatar.naturalHeight);
    const w = avatar.naturalWidth * s;
    const h = avatar.naturalHeight * s;
    ctx.drawImage(avatar, acx - w / 2, acy - h / 2, w, h);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(acx, acy, AVATAR / 2 - 3, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = c.primary;
  ctx.stroke();

  // informações
  let y = PAD + (H - PAD * 2 - infoH) / 2 + 50;
  let nameSize = 50;
  ctx.font = `700 ${nameSize}px ${font}`;
  const sealW = data.verified ? 52 : 0;
  while (ctx.measureText(data.name).width > infoW - sealW && nameSize > 30) {
    nameSize -= 2;
    ctx.font = `700 ${nameSize}px ${font}`;
  }
  const name = fit(ctx, data.name, infoW - sealW);
  ctx.fillStyle = c.text;
  ctx.fillText(name, infoX, y);
  if (data.verified) {
    const sx = infoX + ctx.measureText(name).width + 10;
    icon(ctx, "badge", sx, y - nameSize * 0.8, 38, "#ffffff", c.primary);
    icon(ctx, "check", sx, y - nameSize * 0.8, 38, "#ffffff");
  }

  // nota
  y += 42;
  icon(ctx, "star", infoX, y - 21, 24, c.star, data.rating.count > 0 ? c.star : undefined);
  ctx.font = `700 22px ${font}`;
  ctx.fillStyle = c.star;
  const note = data.rating.count > 0 ? data.rating.average.toFixed(1) : "Novo";
  ctx.fillText(note, infoX + 28, y);
  ctx.font = `400 21px ${font}`;
  ctx.fillStyle = c.muted;
  ctx.fillText(`(${data.rating.count} ${data.rating.count === 1 ? "avaliação" : "avaliações"})`, infoX + 34 + ctx.measureText(note).width + 10, y);

  // categoria
  y += 36;
  icon(ctx, "briefcase", infoX, y - 19, 22, c.primary);
  ctx.font = `400 21px ${font}`;
  ctx.fillStyle = c.muted;
  ctx.fillText(fit(ctx, data.category || "Prestador de serviços", infoW - 34), infoX + 32, y);

  if (data.experience) {
    y += 32;
    ctx.font = `400 18px ${font}`;
    ctx.fillText(fit(ctx, data.experience, infoW), infoX, y);
  }
  if (data.area) {
    y += 34;
    icon(ctx, "pin", infoX, y - 17, 20, c.muted);
    ctx.font = `400 18px ${font}`;
    ctx.fillText(fit(ctx, data.area, infoW - 28), infoX + 28, y);
  }
  if (about.length) {
    y += 18;
    ctx.font = `400 21px ${font}`;
    ctx.fillStyle = c.muted;
    for (const line of about) {
      y += 30;
      ctx.fillText(line, infoX, y);
    }
  }

  // "botões": Conheça, Avalie, Contrate (o último em destaque, como o Compartilhar da página)
  y += 30;
  const labels: [keyof typeof ICONS, string][] = [["eye", "Conheça"], ["star", "Avalie"], ["handshake", "Contrate"]];
  // se os três não couberem na coluna, a fonte dos botões diminui (nunca invade o QR Code)
  let btnSize = 21;
  const rowWidth = () => labels.reduce((sum, [, l]) => sum + 20 + 24 + 10 + ctx.measureText(l).width + 22, 0) + 12 * (labels.length - 1);
  ctx.font = `600 ${btnSize}px ${font}`;
  while (rowWidth() > infoW && btnSize > 15) {
    btnSize -= 1;
    ctx.font = `600 ${btnSize}px ${font}`;
  }
  let bx = infoX;
  labels.forEach(([ico, label], i) => {
    const w = 20 + 24 + 10 + ctx.measureText(label).width + 22;
    const last = i === labels.length - 1;
    ctx.beginPath();
    ctx.roundRect(bx, y, w, 60, 12);
    ctx.fillStyle = last ? c.primary : c.btnBg;
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = last ? c.primary : c.border;
    ctx.stroke();
    icon(ctx, ico, bx + 20, y + 18, 24, last ? "#ffffff" : ico === "star" ? c.star : c.primary);
    ctx.fillStyle = last ? "#ffffff" : c.text;
    ctx.fillText(label, bx + 20 + 24 + 10, y + 38);
    bx += w + 12;
  });

  // QR Code ao lado das informações (fundo branco para qualquer câmera ler)
  const qx = W - PAD - QR;
  const qy = (H - QR - 90) / 2;
  ctx.beginPath();
  ctx.roundRect(qx, qy, QR, QR, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (theme === "light") {
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.border;
    ctx.stroke();
  }
  if (qr) ctx.drawImage(qr, qx + 12, qy + 12, QR - 24, QR - 24);
  // marca e slogan abaixo do QR Code
  ctx.textAlign = "center";
  ctx.font = `800 44px ${font}`;
  ctx.fillStyle = c.text;
  ctx.fillText("Hire.", qx + QR / 2, qy + QR + 56);
  ctx.font = `700 16px ${font}`;
  ctx.fillText(fit(ctx, "Quem precisa encontra quem faz.", QR + 40), qx + QR / 2, qy + QR + 82);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}

/** Monta os dados do cartão a partir do perfil do prestador (mesmas regras do hero) */
export function cardFromProvider(p: {
  id: number;
  slug?: string | null;
  companyName?: string;
  professionalName?: string;
  verified?: boolean;
  rating?: { average: number; count: number };
  category?: { name: string } | null;
  memberSince?: string | null;
  completedHires?: number;
  baseCity?: string | null;
  baseState?: string | null;
  serviceRadiusKm?: number | null;
  attendsOnline?: boolean;
  description?: string | null;
  profileImageUrl?: string | null;
}, avatarUrl: string): ProfileCardData {
  const name = p.companyName || p.professionalName || "Prestador";
  const since = p.memberSince ? `No Hire desde ${new Date(p.memberSince).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}` : "";
  const done = (p.completedHires ?? 0) > 0 ? `${p.completedHires} serviço(s) concluído(s) pelo Hire` : "";
  const place = p.baseCity ? `${p.baseCity}${p.baseState ? ` - ${p.baseState}` : ""}${p.serviceRadiusKm ? ` · atende até ${p.serviceRadiusKm} km` : ""}` : "";
  return {
    name,
    verified: !!p.verified,
    rating: p.rating ?? { average: 0, count: 0 },
    category: p.category?.name ?? null,
    experience: [since, done].filter(Boolean).join(" · ") || null,
    area: [place, p.attendsOnline ? "Atende online" : ""].filter(Boolean).join(" · ") || null,
    description: p.description ?? null,
    avatarUrl,
    qrFor: p.slug ?? p.id,
    slug: p.slug ?? String(p.id),
  };
}
