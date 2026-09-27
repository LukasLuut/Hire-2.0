/**
 * Dados de demonstração do Hire: ~100 prestadores (autônomos e pequenas empresas), ~500 serviços com fotos,
 * portfólios, clientes, contratações em todas as etapas, pagamentos, avaliações com fotos, saques e favoritos.
 *
 *   npm run demo:images   → baixa as fotos (uma vez)
 *   npm run demo:seed     → apaga os dados de demonstração anteriores e cria de novo
 *   npm run demo:reset    → só apaga (contas @demo.hire.dev e tudo ligado a elas)
 *
 * Todas as contas usam a senha Teste@123. Nada fora de @demo.hire.dev é apagado.
 */
import "reflect-metadata";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { pathToFileURL } from "url";
import { AppDataSource } from "../../src/config/data-source";
import { prepareSchema } from "../../src/config/prepareSchema";
import { User } from "../../src/models/User";
import { Address } from "../../src/models/Address";
import { Category } from "../../src/models/Category";
import { ServiceProvider } from "../../src/models/ServiceProvider";
import { Service } from "../../src/models/Service";
import { Availability } from "../../src/models/Availability";
import { Subcategory } from "../../src/models/Subcategory";
import { PortfolioItem } from "../../src/models/PortfolioItem";
import { Hire, StatusEnum } from "../../src/models/Hire";
import { Payment, PaymentMethod, PaymentStatus } from "../../src/models/Payment";
import { Review, ReviewDirection } from "../../src/models/Review";
import { ReviewPhoto } from "../../src/models/ReviewPhoto";
import { Withdrawal, WithdrawalStatus } from "../../src/models/Withdrawal";
import { ServiceLike } from "../../src/models/ServiceLike";
import { ProviderFavorite } from "../../src/models/ProviderFavorite";
import { CategoryService } from "../../src/services/CategoryService";

const ROOT = path.resolve(__dirname, "..", "..");
const DOMAIN = "demo.hire.dev";
const PASSWORD = "Teste@123";
const FEE = 10;

// ---------------------------------------------------------------- aleatório reproduzível
let seed = 20260926;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const int = (a: number, b: number) => Math.floor(rand() * (b - a + 1)) + a;
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
const shuffle = <T>(list: T[]) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cents = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY - int(0, 10 * 3600) * 1000);
/** Próximo dia útil daqui a `days` dias, num horário cheio da agenda */
const upcoming = (days: number) => {
  const d = new Date(Date.now() + days * DAY);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(pick([8, 10, 14, 16]), 0, 0, 0);
  return d;
};
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- pessoas e lugares
const MEN = ["Carlos", "João", "Rafael", "Lucas", "Pedro", "Marcos", "Felipe", "Bruno", "Gustavo", "Thiago", "André", "Rodrigo", "Diego", "Eduardo", "Vinícius", "Leonardo", "Mateus", "Gabriel", "Fernando", "Ricardo", "Paulo", "Henrique", "Daniel", "Samuel", "Otávio", "Caio", "Renato", "Márcio", "Luiz", "Alexandre"];
const WOMEN = ["Ana", "Mariana", "Juliana", "Camila", "Fernanda", "Patrícia", "Aline", "Bruna", "Carolina", "Letícia", "Gabriela", "Larissa", "Beatriz", "Renata", "Vanessa", "Tatiane", "Priscila", "Luana", "Sabrina", "Débora", "Cláudia", "Raquel", "Simone", "Isabela", "Natália", "Jéssica", "Helena", "Laura", "Manuela", "Sofia"];
const SURNAMES = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Carvalho", "Ferreira", "Rodrigues", "Almeida", "Costa", "Gomes", "Martins", "Araújo", "Ribeiro", "Barbosa", "Rocha", "Dias", "Moreira", "Cardoso", "Teixeira", "Correia", "Mendes", "Nunes", "Machado", "Fagundes", "Schmidt", "Becker", "Weber", "Klein", "Fontana", "Rossi", "Vargas", "Pinheiro", "Farias", "Duarte"];
const CITIES = [
  { city: "Porto Alegre", state: "RS", lat: -30.0346, lng: -51.2177, cep: "900", hoods: ["Moinhos de Vento", "Cidade Baixa", "Petrópolis", "Menino Deus", "Bom Fim", "Tristeza", "Centro Histórico", "Auxiliadora"], weight: 30 },
  { city: "Canoas", state: "RS", lat: -29.9178, lng: -51.1839, cep: "924", hoods: ["Centro", "Marechal Rondon", "Niterói", "Igara"], weight: 8 },
  { city: "São Leopoldo", state: "RS", lat: -29.7545, lng: -51.1498, cep: "930", hoods: ["Centro", "Scharlau", "Rio Branco", "Morro do Espelho"], weight: 6 },
  { city: "Novo Hamburgo", state: "RS", lat: -29.6783, lng: -51.1309, cep: "933", hoods: ["Centro", "Hamburgo Velho", "Rio Branco", "Vila Rosa"], weight: 6 },
  { city: "Gravataí", state: "RS", lat: -29.9440, lng: -50.9919, cep: "940", hoods: ["Centro", "Parque dos Anjos", "Moradas do Sobrado"], weight: 4 },
  { city: "Caxias do Sul", state: "RS", lat: -29.1678, lng: -51.1794, cep: "950", hoods: ["Centro", "São Pelegrino", "Exposição", "Madureira"], weight: 7 },
  { city: "Pelotas", state: "RS", lat: -31.7654, lng: -52.3376, cep: "960", hoods: ["Centro", "Areal", "Três Vendas"], weight: 4 },
  { city: "Santa Maria", state: "RS", lat: -29.6868, lng: -53.8149, cep: "971", hoods: ["Centro", "Camobi", "Nossa Senhora de Fátima"], weight: 4 },
  { city: "Florianópolis", state: "SC", lat: -27.5954, lng: -48.5480, cep: "880", hoods: ["Centro", "Trindade", "Lagoa da Conceição", "Coqueiros"], weight: 5 },
  { city: "Curitiba", state: "PR", lat: -25.4284, lng: -49.2733, cep: "800", hoods: ["Batel", "Água Verde", "Centro", "Juvevê"], weight: 5 },
  { city: "São Paulo", state: "SP", lat: -23.5505, lng: -46.6333, cep: "010", hoods: ["Pinheiros", "Vila Mariana", "Moema", "Tatuapé", "Perdizes"], weight: 8 },
];
const STREETS = ["Rua dos Andradas", "Avenida Ipiranga", "Rua Padre Chagas", "Rua Olavo Bilac", "Avenida Brasil", "Rua Sete de Setembro", "Rua Tiradentes", "Rua Bento Gonçalves", "Rua Marechal Floriano", "Avenida Independência", "Rua São João", "Rua das Flores", "Rua Santos Dumont", "Rua Castro Alves"];
const cityPick = () => { const total = CITIES.reduce((a, c) => a + c.weight, 0); let r = rand() * total; for (const c of CITIES) { r -= c.weight; if (r <= 0) return c; } return CITIES[0]; };

function cpf() {
  const d = Array.from({ length: 9 }, () => int(0, 9));
  const dv = (len: number) => { const s = d.slice(0, len).reduce((a, n, i) => a + n * (len + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dv(9)); d.push(dv(10));
  return d.join("");
}
function cnpj() {
  const d = [...Array.from({ length: 8 }, () => int(0, 9)), 0, 0, 0, 1];
  const dv = (w: number[]) => { const s = w.reduce((a, x, i) => a + d[i] * x, 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  d.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])); d.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  const s = d.join("");
  return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`;
}

// ---------------------------------------------------------------- textos das avaliações
const REVIEWS: Record<number, string[]> = {
  5: ["Excelente! Pontual, caprichoso e muito educado. Recomendo de olhos fechados.", "Serviço impecável, superou minhas expectativas. Já marquei a próxima vez.", "Profissional nota 10, explicou tudo o que ia fazer e deixou tudo limpo.", "Rápido, preço justo e resultado lindo. Muito obrigada!", "Atendimento maravilhoso do início ao fim. Voltarei a contratar com certeza.", "Muito atencioso e cuidadoso. Resolveu o problema na primeira visita.", "Trabalho de primeira! Chegou no horário e cumpriu o combinado.", "Adorei o resultado, ficou exatamente como eu queria."],
  4: ["Muito bom, só atrasou uns minutinhos. O resultado ficou ótimo.", "Bom serviço e preço justo. Recomendo.", "Gostei bastante, profissional competente. Poderia ter avisado antes da chegada.", "Resultado muito bom, voltaria a contratar.", "Serviço bem feito, só demorou um pouco mais do que o previsto."],
  3: ["Serviço ok, mas precisei pedir alguns ajustes.", "Cumpriu o combinado, mas a comunicação poderia ser melhor.", "Razoável. O resultado ficou bom, porém atrasou bastante."],
  2: ["Não ficou como combinado e tive que chamar de novo para corrigir."],
  1: ["Não compareceu no primeiro horário marcado. Remarcou, mas a experiência não foi boa."],
};
const CLIENT_REVIEWS = ["Cliente super educada, casa organizada para o serviço. Recomendo!", "Ótimo cliente, pagamento rápido e comunicação clara.", "Muito atencioso, facilitou o acesso e explicou bem o que precisava.", "Cliente pontual e gentil. Foi um prazer atender.", "Tudo certo, cliente combinou direitinho e confirmou rápido."];
const CANCEL_REASONS = ["Precisei viajar e não vou estar em casa na data.", "Consegui resolver de outra forma, obrigada!", "Imprevisto na agenda, vou remarcar em breve.", "O orçamento ficou acima do que eu esperava."];
const ratingPick = () => { const r = rand(); return r < 0.62 ? 5 : r < 0.9 ? 4 : r < 0.97 ? 3 : r < 0.99 ? 2 : 1; };

// ---------------------------------------------------------------- limpeza
async function reset() {
  const q = (sql: string, p: unknown[] = []) => AppDataSource.query(sql, p);
  const users: { id: number; addressId: number | null }[] = await q("SELECT id, addressId FROM users WHERE email LIKE ?", [`%@${DOMAIN}`]);
  if (!users.length) return console.log("nenhum dado de demonstração para apagar");
  const uid = users.map((u) => u.id);
  const provs: { id: number }[] = await q("SELECT id FROM service_providers WHERE userId IN (?)", [uid]);
  const pid = provs.length ? provs.map((p) => p.id) : [0];
  const hires: { id: number }[] = await q("SELECT id FROM hires WHERE userId IN (?) OR providerId IN (?)", [uid, pid]);
  const hid = hires.length ? hires.map((h) => h.id) : [0];
  const services: { id: number }[] = await q("SELECT id FROM services WHERE providerId IN (?)", [pid]);
  const sid = services.length ? services.map((s) => s.id) : [0];
  await q("SET FOREIGN_KEY_CHECKS = 0");
  await q("DELETE FROM review_photos WHERE reviewId IN (SELECT id FROM reviews WHERE hireId IN (?) OR authorId IN (?) OR targetId IN (?))", [hid, uid, uid]);
  await q("DELETE FROM reviews WHERE hireId IN (?) OR authorId IN (?) OR targetId IN (?)", [hid, uid, uid]);
  await q("DELETE FROM payments WHERE hireId IN (?) OR providerId IN (?) OR userId IN (?)", [hid, pid, uid]);
  await q("DELETE FROM contracts WHERE hireId IN (?) OR providerId IN (?) OR userId IN (?)", [hid, pid, uid]);
  await q("DELETE FROM withdrawals WHERE providerId IN (?)", [pid]);
  await q("DELETE FROM provider_favorites WHERE userId IN (?) OR providerId IN (?)", [uid, pid]);
  await q("DELETE FROM service_likes WHERE userId IN (?) OR serviceId IN (?)", [uid, sid]);
  await q("DELETE FROM notifications WHERE userId IN (?)", [uid]);
  await q("DELETE FROM portfolio_items WHERE providerId IN (?)", [pid]);
  await q("DELETE FROM analytics_daily WHERE providerId IN (?) OR serviceId IN (?)", [pid, sid]);
  await q("DELETE FROM reports WHERE reporterId IN (?) OR hireId IN (?) OR providerId IN (?)", [uid, hid, pid]);
  await q("DELETE FROM messages WHERE conversationId IN (SELECT id FROM conversations WHERE clientId IN (?) OR providerId IN (?))", [uid, pid]);
  await q("DELETE FROM conversations WHERE clientId IN (?) OR providerId IN (?)", [uid, pid]);
  await q("DELETE FROM hires WHERE id IN (?)", [hid]);
  await q("DELETE FROM services WHERE id IN (?)", [sid]);
  for (const t of ["availabilities", "subcategories", "links"]) await q(`DELETE FROM ${t} WHERE providerId IN (?)`, [pid]);
  await q("DELETE FROM service_providers WHERE id IN (?)", [pid]);
  await q("DELETE FROM support_tickets WHERE userId IN (?)", [uid]);
  await q("DELETE FROM auth_tokens WHERE userId IN (?)", [uid]);
  await q("DELETE FROM users WHERE id IN (?)", [uid]);
  const addr = users.map((u) => u.addressId).filter(Boolean);
  if (addr.length) await q("DELETE FROM address WHERE id IN (?)", [addr]);
  await q("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`apagados: ${users.length} contas, ${provs.length} prestadores, ${services.length} serviços, ${hires.length} contratações`);
}

// ---------------------------------------------------------------- fotos baixadas
function pool(query: string) {
  const dir = path.join(ROOT, "uploads", "demo", slugify(query));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).map((f) => `/uploads/demo/${slugify(query)}/${f}`);
}
const AVATARS = { men: [] as string[], women: [] as string[] };
function loadAvatars() {
  const dir = path.join(ROOT, "uploads", "demo", "avatars");
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) (f.startsWith("women") ? AVATARS.women : AVATARS.men).push(`/uploads/demo/avatars/${f}`);
  AVATARS.men = shuffle(AVATARS.men);
  AVATARS.women = shuffle(AVATARS.women);
}

// ---------------------------------------------------------------- criação
async function seedAll() {
  const dynImport = new Function("p", "return import(p)") as (p: string) => Promise<any>;
  const { CATALOG } = await dynImport(pathToFileURL(path.join(__dirname, "catalog.mjs")).href);
  loadAvatars();
  await new CategoryService().ensureCatalog();
  const categories = await AppDataSource.getRepository(Category).find();
  const catByName = new Map(categories.map((c) => [c.name, c]));
  const hash = await bcrypt.hash(PASSWORD, Number(process.env.BCRYPT_SALT_ROUNDS) || 10);
  const usedEmails = new Set<string>();
  const usedSlugs = new Set<string>((await AppDataSource.query("SELECT slug FROM service_providers WHERE slug IS NOT NULL")).map((r: any) => r.slug));
  let manIdx = 0, womanIdx = 0;

  const repo = {
    user: AppDataSource.getRepository(User), provider: AppDataSource.getRepository(ServiceProvider), service: AppDataSource.getRepository(Service),
    avail: AppDataSource.getRepository(Availability), sub: AppDataSource.getRepository(Subcategory), portfolio: AppDataSource.getRepository(PortfolioItem),
    hire: AppDataSource.getRepository(Hire), payment: AppDataSource.getRepository(Payment), review: AppDataSource.getRepository(Review),
    photo: AppDataSource.getRepository(ReviewPhoto), withdrawal: AppDataSource.getRepository(Withdrawal), like: AppDataSource.getRepository(ServiceLike),
    fav: AppDataSource.getRepository(ProviderFavorite),
  };

  const person = () => {
    const woman = chance(0.5);
    const first = pick(woman ? WOMEN : MEN);
    const last = pick(SURNAMES);
    const avatar = woman ? AVATARS.women[womanIdx++ % Math.max(1, AVATARS.women.length)] : AVATARS.men[manIdx++ % Math.max(1, AVATARS.men.length)];
    return { woman, first, last, name: `${first} ${last}`, avatar: avatar ?? null };
  };
  const email = (first: string, last: string) => {
    let base = slugify(`${first}.${last}`).replace(/-/g, ".");
    let e = `${base}@${DOMAIN}`;
    for (let i = 2; usedEmails.has(e); i++) e = `${base}${i}@${DOMAIN}`;
    usedEmails.add(e);
    return e;
  };
  const addressFor = (c: typeof CITIES[number]) => Object.assign(new Address(), {
    num: int(10, 2500), street: pick(STREETS), neighborhood: pick(c.hoods), city: c.city, state: c.state, country: "Brasil", postalCode: `${c.cep}${int(10, 99)}-${int(100, 999)}`,
  });

  // ---- clientes
  const clients: User[] = [];
  for (let i = 0; i < 70; i++) {
    const p = person();
    const c = cityPick();
    const u = repo.user.create({
      name: p.name, email: email(p.first, p.last), password: hash, cpf_cnpj: cpf(), acceptedTerms: true, acceptedAt: daysAgo(int(60, 400)),
      emailVerified: true, avatarUrl: p.avatar, accountType: "cliente", address: addressFor(c),
      about: pick(["Moro com minha família e sempre busco bons profissionais por aqui.", "Gosto de tudo organizado e pontual.", "Cliente do Hire desde o começo.", ""]),
    } as Partial<User>);
    clients.push(await repo.user.save(u));
  }
  const marina = await repo.user.findOne({ where: { email: "cliente@hire.dev" }, relations: { address: true } });

  // ---- prestadores por categoria (peso) até 100
  const catNames = Object.keys(CATALOG);
  const totalWeight = catNames.reduce((a, n) => a + CATALOG[n].weight, 0);
  const plan: string[] = [];
  for (const n of catNames) for (let i = 0; i < Math.round((CATALOG[n].weight / totalWeight) * 100); i++) plan.push(n);
  while (plan.length < 100) plan.push(pick(catNames));
  plan.length = 100;

  type Built = { provider: ServiceProvider; services: Service[]; user: User; cat: string; createdAt: Date };
  const built: Built[] = [];
  let serviceCount = 0;
  for (const [idx, catName] of shuffle(plan).entries()) {
    const cat = CATALOG[catName];
    const category = catByName.get(catName)!;
    const p = person();
    const c = cityPick();
    const company = chance(0.28);
    const size = company ? pick(["MEI", "ME", "ME", "EPP"]) : null;
    const brand = pick(cat.names);
    const tradeName = company
      ? pick([`${p.last} ${brand}`, `${brand} ${p.last}`, `${brand} ${pick(["Premium", "Express", "Pro", "& Cia", "Center", "do Sul"])}`])
      : pick([`${p.name}`, `${p.first} ${brand}`, `${p.name} ${brand}`]);
    const createdAt = daysAgo(int(40, 420));
    const onlineHeavy = cat.templates.filter((t: any) => t.online).length >= cat.templates.length / 2;
    const user = await repo.user.save(repo.user.create({
      name: p.name, email: email(p.first, p.last), password: hash, cpf_cnpj: company ? cnpj().replace(/\D/g, "") : cpf(), acceptedTerms: true, acceptedAt: createdAt,
      emailVerified: chance(0.9), avatarUrl: p.avatar, accountType: company ? "empresa" : "profissional", legalName: company ? `${tradeName} ${size === "MEI" ? "" : "Ltda"}`.trim() : null,
      tradeName: company ? tradeName : null, companySize: size, address: addressFor(c), about: pick(cat.bios),
    } as Partial<User>));
    let slug = slugify(tradeName).slice(0, 50) || `prestador-${idx}`;
    for (let i = 2; usedSlugs.has(slug); i++) slug = `${slugify(tradeName).slice(0, 46)}-${i}`;
    usedSlugs.add(slug);
    const verified = chance(0.45);
    const closed = chance(0.07);
    const provider = await repo.provider.save(repo.provider.create({
      professionalName: p.name, companyName: tradeName, user, professionalEmail: user.email, professionalPhone: `(${pick(["51", "51", "54", "53", "48", "41", "11"])}) 9${int(8000, 9999)}-${int(1000, 9999)}`,
      attendsPresent: !onlineHeavy || chance(0.5), attendsOnline: onlineHeavy || chance(0.15), personalizedProposals: chance(0.6), approximateLocation: chance(0.5), publicReviews: true,
      pricesOnPage: chance(0.92), whatsNotification: false, emailNotification: true, status: closed ? "paused" : "available", closedUntil: closed && chance(0.6) ? new Date(Date.now() + int(3, 20) * DAY) : null,
      slug, baseCity: c.city, baseState: c.state, latitude: c.lat + (rand() - 0.5) * 0.08, longitude: c.lng + (rand() - 0.5) * 0.08, serviceRadiusKm: pick([10, 15, 20, 25, 30, 40]),
      description: `${pick(cat.bios)} ${pick(["Atendo " + c.city + " e região.", "Agende pelo Hire e pague com segurança.", "Garantia em todos os serviços.", "Orçamento sem compromisso."])}`.slice(0, 250),
      cnpj: company ? cnpj() : undefined, businessType: company ? "empresa" : "autonomo", legalName: company ? `${tradeName} Ltda` : null, companySize: size,
      profileImageUrl: company && chance(0.4) ? null : p.avatar, verificationStatus: verified ? "verified" : "none", verifiedAt: verified ? daysAgo(int(5, 30)) : null,
      companyVerifiedAt: company && verified && chance(0.6) ? daysAgo(int(5, 30)) : null, credentialsVerifiedAt: verified && chance(0.3) ? daysAgo(int(5, 30)) : null,
      category, createdAt,
    } as Partial<ServiceProvider>));
    // expediente
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", ...(chance(0.5) ? ["saturday"] : [])];
    const start = pick(["07:00", "08:00", "08:00", "09:00"]);
    const end = pick(["17:00", "18:00", "18:00", "19:00"]);
    await repo.avail.save(days.map((d) => repo.avail.create({ day: d, start, end: d === "saturday" ? "12:00" : end, provider } as any)));

    // serviços
    const templates = shuffle(cat.templates).slice(0, Math.min(cat.templates.length, int(4, 6)));
    await repo.sub.save([...new Set(templates.map((t: any) => t.sub as string))].slice(0, 3).map((name) => repo.sub.create({ name, provider } as any)));
    const services: Service[] = [];
    for (const t of templates) {
      const photos = shuffle(pool(t.query));
      const title = pick(t.titles as string[]);
      const price = t.unit === "orcamento" ? 0 : t.price[1] > 100 ? Math.round((t.price[0] + rand() * (t.price[1] - t.price[0])) / 10) * 10 : Math.round(t.price[0] + rand() * (t.price[1] - t.price[0]));
      const slotDays = days.filter((d) => d !== "saturday");
      const slots = t.scheduling ? Object.fromEntries(slotDays.map((d) => [d, ["08:00", "10:00", "14:00", "16:00"].filter((h) => h >= start && h < end)])) : null;
      const packages = t.unit === "fixo" && price > 0 && chance(0.12)
        ? [
            { name: "Básico", description: "O essencial do serviço", price },
            { name: "Completo", description: "Inclui acabamento e revisão", price: Math.round(price * 1.4) },
            { name: "Premium", description: "Prioridade na agenda e garantia estendida", price: Math.round(price * 1.9) },
          ]
        : null;
      const images = photos.slice(0, int(1, 3));
      services.push(await repo.service.save(repo.service.create({
        title: title.slice(0, 100), description_service: `${t.desc}${chance(0.4) ? ` ${pick(["Atendimento com hora marcada.", "Material incluso sob consulta.", "Garantia de 90 dias.", "Pagamento pelo Hire."])}` : ""}`.slice(0, 250),
        negotiable: t.negotiable || t.unit === "orcamento", requiresScheduling: t.scheduling && !!slots && Object.values(slots).some((v: any) => v.length), online: t.online,
        price, priceUnit: t.unit, packages, duration: t.duration, subcategory: t.sub, imageUrl: images[0] ?? null, images, scheduleSlots: slots,
        cancellationNotice: t.scheduling ? pick(["até 24h antes", "até 12h antes", "até 48h antes"]) : null, active: !chance(0.04), provider, category,
      } as Partial<Service>)));
      serviceCount++;
    }
    // portfólio
    if (chance(0.6)) {
      const items = shuffle(templates.flatMap((t: any) => pool(t.query).map((img) => ({ img, t })))).slice(0, int(3, 6));
      await repo.portfolio.save(items.map(({ img, t }, i) => repo.portfolio.create({
        provider, service: services.find((s) => s.subcategory === t.sub) ?? null, imageUrl: img, position: i,
        title: `${pick(t.titles as string[])}`.slice(0, 80), description: pick([`Projeto em ${pick(c.hoods)}, ${c.city}.`, "Trabalho entregue no prazo.", "Antes e depois de um dos nossos atendimentos.", "Cliente satisfeito com o resultado."]),
      } as any)));
    }
    built.push({ provider, services, user, cat: catName, createdAt });
  }
  console.log(`prestadores: ${built.length}, serviços: ${serviceCount}, clientes: ${clients.length}`);

  // ---- contratações, pagamentos e avaliações
  let hiresCount = 0, reviewsCount = 0;
  const clientPool = marina ? [...clients, marina, marina] : clients;
  const methods = [PaymentMethod.PIX, PaymentMethod.PIX, PaymentMethod.CARTAO, PaymentMethod.CARTAO, PaymentMethod.BOLETO];
  const makeHire = async (b: Built, client: User, state: "done" | "paid" | "progress" | "pending" | "cancelled", when: Date) => {
    const svc = pick(b.services.filter((s) => s.active !== false).length ? b.services.filter((s) => s.active !== false) : b.services);
    const qty = svc.priceUnit === "hora" ? int(2, 8) : svc.priceUnit === "m2" ? int(20, 90) : null;
    const price = svc.priceUnit === "orcamento" ? int(30, 250) * 10 : cents(Number(svc.price) * (qty ?? 1));
    const acceptedAt = new Date(when.getTime() + int(1, 20) * 3600000);
    const scheduledAt = svc.requiresScheduling ? new Date(acceptedAt.getTime() + int(1, 6) * DAY) : null;
    if (scheduledAt) scheduledAt.setHours(pick([8, 10, 14, 16]), 0, 0, 0);
    const startedAt = new Date((scheduledAt ?? acceptedAt).getTime() + (scheduledAt ? 0 : int(2, 48) * 3600000));
    const finishedAt = new Date(startedAt.getTime() + int(1, 6) * 3600000);
    const confirmedAt = new Date(finishedAt.getTime() + int(1, 30) * 3600000);
    const addr = svc.online ? null : client.address ? { street: client.address.street, num: String(client.address.num), complement: null, neighborhood: client.address.neighborhood, city: client.address.city, state: client.address.state, postalCode: client.address.postalCode } : null;
    const base: Partial<Hire> = {
      price, description_service: svc.title.slice(0, 100), firstContact: when, createdAt: when, user: client, provider: b.provider, service: svc, paymentRequired: true,
      quantity: qty, durationMinutes: svc.requiresScheduling ? 60 * int(1, 3) : null, serviceAddress: addr, scheduledAt,
    } as any;
    if (state === "pending") Object.assign(base, { status: StatusEnum.PENDENTE, status_provider: StatusEnum.PENDENTE, scheduledAt: scheduledAt ? upcoming(int(2, 10)) : null });
    if (state === "paid") Object.assign(base, { status: StatusEnum.PENDENTE, status_provider: StatusEnum.ACEITO, acceptedAt, scheduledAt: scheduledAt ? upcoming(int(1, 9)) : null });
    if (state === "progress") Object.assign(base, { status: StatusEnum.PENDENTE, status_provider: StatusEnum.EM_ANDAMENTO, acceptedAt, startedAt: new Date(Date.now() - int(1, 5) * 3600000) });
    if (state === "done") Object.assign(base, { status: StatusEnum.CONCLUIDO, status_provider: StatusEnum.CONCLUIDO, acceptedAt, startedAt, finishedAt, confirmedAt });
    if (state === "cancelled") Object.assign(base, { status: StatusEnum.CANCELADO, status_provider: StatusEnum.CANCELADO, acceptedAt: chance(0.5) ? acceptedAt : null, cancelledBy: pick(["cliente", "cliente", "prestador"]), cancelReason: pick(CANCEL_REASONS) });
    const hire = await repo.hire.save(repo.hire.create(base));
    hiresCount++;
    // pagamento
    if (state !== "pending" && !(state === "cancelled" && !hire.acceptedAt)) {
      const fee = cents((price * FEE) / 100);
      const method = pick(methods);
      const status = state === "done" ? PaymentStatus.LIBERADO : state === "cancelled" ? PaymentStatus.ESTORNADO : PaymentStatus.PAGO;
      await repo.payment.save(repo.payment.create({
        amount: price, feePercent: FEE, fee, net: cents(price - fee), method, status, hire, provider: b.provider, user: client,
        details: method === PaymentMethod.CARTAO ? { brand: pick(["Visa", "Mastercard", "Elo"]), last4: String(int(1000, 9999)), installments: pick([1, 1, 2, 3]) } : null,
        transactionCode: `SIM-${hire.id.toString(36).toUpperCase()}${int(100000, 999999).toString(36).toUpperCase()}`,
        paidAt: new Date(acceptedAt.getTime() + int(1, 5) * 3600000), releasedAt: state === "done" ? confirmedAt : null, refundedAt: state === "cancelled" ? new Date(acceptedAt.getTime() + DAY) : null,
      } as any));
    }
    // avaliações
    if (state === "done" && chance(0.82)) {
      const rating = ratingPick();
      const review = await repo.review.save(repo.review.create({
        rating, comment: chance(0.9) ? pick(REVIEWS[rating]) : null, direction: ReviewDirection.CLIENT_TO_PROVIDER, author: client, target: b.user, provider: b.provider, service: svc, hire,
        createdAt: new Date(confirmedAt.getTime() + int(1, 48) * 3600000),
      } as any));
      reviewsCount++;
      const imgs = (svc.images ?? []).filter(Boolean);
      if (rating >= 4 && imgs.length && chance(0.25)) await repo.photo.save(shuffle(imgs).slice(0, int(1, 2)).map((url) => repo.photo.create({ url, review } as any)));
      if (chance(0.5)) {
        await repo.review.save(repo.review.create({
          rating: pick([5, 5, 5, 4]), comment: pick(CLIENT_REVIEWS), direction: ReviewDirection.PROVIDER_TO_CLIENT, author: b.user, target: client, provider: b.provider, service: svc, hire,
          createdAt: new Date(confirmedAt.getTime() + int(2, 72) * 3600000),
        } as any));
        reviewsCount++;
      }
    }
    return hire;
  };

  for (const b of built) {
    const popularity = pick([1, 2, 2, 3, 3, 4, 6, 9, 14]);
    const since = Math.max(10, Math.floor((Date.now() - b.createdAt.getTime()) / DAY) - 5);
    for (let i = 0; i < popularity; i++) await makeHire(b, pick(clientPool), "done", daysAgo(int(8, since)));
    if (chance(0.5)) await makeHire(b, pick(clientPool), "pending", daysAgo(int(0, 1)));
    if (chance(0.45)) await makeHire(b, pick(clientPool), "paid", daysAgo(int(1, 3)));
    if (chance(0.2)) await makeHire(b, pick(clientPool), "progress", daysAgo(int(1, 2)));
    if (chance(0.3)) await makeHire(b, pick(clientPool), "cancelled", daysAgo(int(5, since)));
  }
  console.log(`contratações: ${hiresCount}, avaliações: ${reviewsCount}`);

  // ---- saques
  let wCount = 0;
  for (const b of built) {
    const [{ net }] = await AppDataSource.query("SELECT COALESCE(SUM(net),0) AS net FROM payments WHERE providerId = ? AND status = 'LIBERADO'", [b.provider.id]);
    let available = Number(net);
    if (available < 100 || !chance(0.55)) continue;
    const key = chance(0.5) ? { pixKeyType: "email", pixKey: b.user.email } : { pixKeyType: "cpf", pixKey: b.user.accountType === "empresa" ? cpf() : b.user.cpf_cnpj };
    for (let i = 0; i < int(1, 3) && available > 80; i++) {
      const amount = cents(Math.max(50, available * (0.3 + rand() * 0.3)));
      available -= amount;
      const req = daysAgo(int(3, 60));
      await repo.withdrawal.save(repo.withdrawal.create({ provider: b.provider, amount, ...key, status: WithdrawalStatus.PAGO, requestedAt: req, processedAt: new Date(req.getTime() + 3600000), paidAt: new Date(req.getTime() + 5 * 3600000), transactionCode: `PIX-${(b.provider.id * 1000 + i).toString(36).toUpperCase()}${int(1000, 9999)}` } as any));
      wCount++;
    }
    if (available > 60 && chance(0.25)) {
      await repo.withdrawal.save(repo.withdrawal.create({ provider: b.provider, amount: cents(available * 0.5), ...key, status: WithdrawalStatus.SOLICITADO, requestedAt: new Date(Date.now() - 30 * 1000) } as any));
      wCount++;
    }
  }
  console.log(`saques: ${wCount}`);

  // ---- favoritos
  const allServices = built.flatMap((b) => b.services);
  for (const c of [...clients, ...(marina ? [marina] : [])]) {
    for (const s of shuffle(allServices).slice(0, int(0, 6))) await repo.like.save(repo.like.create({ user: c, service: s } as any)).catch(() => null);
    for (const b of shuffle(built).slice(0, int(0, 3))) await repo.fav.save(repo.fav.create({ user: c, provider: b.provider } as any)).catch(() => null);
  }
  // contador de curtidas dos serviços
  await AppDataSource.query("UPDATE services s SET likesNumber = (SELECT COUNT(*) FROM service_likes l WHERE l.serviceId = s.id) WHERE s.providerId IN (?)", [built.map((b) => b.provider.id)]);
  console.log("favoritos e curtidas criados");
}

(async () => {
  const onlyReset = process.argv.includes("--reset");
  await prepareSchema();
  await AppDataSource.initialize();
  try {
    await reset();
    if (!onlyReset) await seedAll();
    console.log(`pronto. Contas @${DOMAIN}, senha ${PASSWORD}`);
  } finally {
    await AppDataSource.destroy();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
