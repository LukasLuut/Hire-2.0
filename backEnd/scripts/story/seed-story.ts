/**
 * Dados da apresentação do Hire (landing "Encontre quem faz"): um elenco pequeno e coerente,
 * separado dos dados de demonstração em massa (scripts/demo).
 *
 *   npm run story:images   → baixa as fotos (uma vez)
 *   npm run story:seed     → apaga a apresentação anterior e cria de novo
 *   npm run story:reset    → só apaga (contas @apresentacao.hire.dev e tudo ligado a elas)
 *
 * A conversa, a negociação e o contrato entre Júlia e Tomás passam pelo ConversationService —
 * o mesmo código que a API usa —, então mensagens de sistema, tópicos e contrato são os reais.
 * Todas as contas usam a senha Teste@123. Nada fora de @apresentacao.hire.dev é apagado.
 */
import "reflect-metadata";
import bcrypt from "bcrypt";
import { AppDataSource } from "../../src/config/data-source";
import { prepareSchema } from "../../src/config/prepareSchema";
import { User } from "../../src/models/User";
import { Address } from "../../src/models/Address";
import { Category } from "../../src/models/Category";
import { ServiceProvider, VerificationStatus } from "../../src/models/ServiceProvider";
import { Service } from "../../src/models/Service";
import { Availability } from "../../src/models/Availability";
import { Subcategory } from "../../src/models/Subcategory";
import { PortfolioItem } from "../../src/models/PortfolioItem";
import { Hire, StatusEnum } from "../../src/models/Hire";
import { Payment, PaymentMethod, PaymentStatus } from "../../src/models/Payment";
import { Review, ReviewDirection } from "../../src/models/Review";
import { ProviderFavorite } from "../../src/models/ProviderFavorite";
import { CategoryService } from "../../src/services/CategoryService";
import { ConversationService } from "../../src/services/ConversationService";
import { resetDomain } from "../demo/reset";
import { BIA, CATEGORY, CHAT, CHAT_START_DAYS_AGO, CHAT_START_TIME, CLIENTS, DOMAIN, PASSWORD, PAST_HIRES, PENDING_REQUEST, PROVIDERS, type ClientKey, type ProviderSeed } from "./cast";

const FEE = 10;
const DAY = 86400000;
const cents = (n: number) => Math.round(n * 100) / 100;
const daysAgo = (d: number, hour = 15) => {
  const t = new Date(Date.now() - d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t;
};

async function seed() {
  await new CategoryService().ensureCatalog();
  const category = await AppDataSource.getRepository(Category).findOne({ where: { name: CATEGORY } });
  if (!category) throw new Error(`categoria "${CATEGORY}" não encontrada`);
  const hash = await bcrypt.hash(PASSWORD, Number(process.env.BCRYPT_SALT_ROUNDS) || 10);
  const repo = {
    user: AppDataSource.getRepository(User), provider: AppDataSource.getRepository(ServiceProvider), service: AppDataSource.getRepository(Service),
    avail: AppDataSource.getRepository(Availability), sub: AppDataSource.getRepository(Subcategory), portfolio: AppDataSource.getRepository(PortfolioItem),
    hire: AppDataSource.getRepository(Hire), payment: AppDataSource.getRepository(Payment), review: AppDataSource.getRepository(Review),
    fav: AppDataSource.getRepository(ProviderFavorite),
  };
  const cpf = (seq: number) => {
    const d = String(100000000 + seq * 7919).slice(0, 9).split("").map(Number);
    const dv = (len: number) => { const s = d.slice(0, len).reduce((a, n, i) => a + n * (len + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    d.push(dv(9)); d.push(dv(10));
    return d.join("");
  };
  const address = (a: { street: string; num: number; hood: string; postalCode: string }, city = "Porto Alegre", state = "RS") =>
    Object.assign(new Address(), { street: a.street, num: a.num, neighborhood: a.hood, city, state, country: "Brasil", postalCode: a.postalCode });

  // ---- clientes
  const clients = {} as Record<ClientKey, User>;
  let seq = 1;
  for (const [key, c] of Object.entries(CLIENTS) as [ClientKey, (typeof CLIENTS)[ClientKey]][]) {
    // Guilherme casou em Caxias do Sul e a Aline mora em Novo Hamburgo: endereço na cidade deles
    const city = key === "guilherme" ? "Caxias do Sul" : key === "aline" ? "Novo Hamburgo" : key === "marcos" ? "Bento Gonçalves" : "Porto Alegre";
    clients[key] = await repo.user.save(repo.user.create({
      name: c.name, email: c.email, password: hash, cpf_cnpj: cpf(seq++), acceptedTerms: true, acceptedAt: daysAgo(c.since),
      emailVerified: true, avatarUrl: c.avatar, accountType: "cliente", about: c.about || null, address: address(c, city),
    } as Partial<User>));
  }

  // ---- prestadores
  const built = {} as Record<ProviderSeed["key"], { provider: ServiceProvider; user: User; services: Record<string, Service> }>;
  for (const p of PROVIDERS) {
    const company = p.businessType === "empresa";
    const user = await repo.user.save(repo.user.create({
      name: p.user.name, email: p.user.email, password: hash, cpf_cnpj: company ? "31457982000164" : cpf(seq++), acceptedTerms: true, acceptedAt: daysAgo(p.since),
      emailVerified: true, avatarUrl: p.user.avatar, accountType: p.user.accountType, legalName: p.user.legalName ?? null, tradeName: p.user.tradeName ?? null,
      companySize: p.user.companySize ?? null, about: p.about, address: address(p),
    } as Partial<User>));
    const provider = await repo.provider.save(repo.provider.create({
      professionalName: p.professionalName, companyName: p.companyName, user, professionalEmail: p.user.email, professionalPhone: p.phone,
      attendsPresent: true, attendsOnline: p.attendsOnline, personalizedProposals: true, approximateLocation: true, publicReviews: true, pricesOnPage: true,
      whatsNotification: false, emailNotification: true, status: "available", slug: p.slug, baseCity: p.city, baseState: p.state,
      latitude: p.lat, longitude: p.lng, serviceRadiusKm: p.radiusKm, description: p.description, profileImageUrl: p.profileImageUrl,
      businessType: p.businessType, cnpj: company ? "31.457.982/0001-64" : undefined, legalName: p.user.legalName ?? null, companySize: p.user.companySize ?? null,
      verificationStatus: VerificationStatus.VERIFIED, verifiedAt: daysAgo(p.since - 10), companyVerifiedAt: company ? daysAgo(p.since - 10) : null,
      category, createdAt: daysAgo(p.since),
    } as Partial<ServiceProvider>));

    const { days, start, end, saturday } = p.availability;
    await repo.avail.save([
      ...days.map((day) => repo.avail.create({ day, start, end, provider } as Partial<Availability>)),
      ...(saturday ? [repo.avail.create({ day: "saturday", start: saturday.start, end: saturday.end, provider } as Partial<Availability>)] : []),
    ]);
    await repo.sub.save(p.specialties.map((name) => repo.sub.create({ name, provider } as Partial<Subcategory>)));

    const services: Record<string, Service> = {};
    for (const s of p.services) {
      services[s.key] = await repo.service.save(repo.service.create({
        title: s.title, description_service: s.description, negotiable: s.negotiable, requiresScheduling: false, online: false,
        price: s.price, priceUnit: s.priceUnit, packages: s.packages ?? null, duration: s.duration, subcategory: s.subcategory,
        imageUrl: s.images[0], images: s.images, active: true, provider, category,
      } as Partial<Service>));
    }
    await repo.portfolio.save(p.portfolio.map((item, position) => repo.portfolio.create({
      provider, service: item.service ? services[item.service] : null, imageUrl: item.image, title: item.title, description: item.description, position,
    } as Partial<PortfolioItem>)));
    built[p.key] = { provider, user, services };
  }
  console.log(`clientes: ${Object.keys(clients).length}, prestadores: ${PROVIDERS.length}`);

  // ---- serviços concluídos, pagos e avaliados
  const methods = [PaymentMethod.PIX, PaymentMethod.CARTAO];
  let reviews = 0;
  for (const [i, h] of PAST_HIRES.entries()) {
    const b = built[h.provider];
    const svc = b.services[h.service];
    const client = clients[h.client];
    const first = daysAgo(h.daysAgo + 18, 10);
    const accepted = new Date(first.getTime() + 5 * 3600000);
    const started = daysAgo(h.daysAgo, 14);
    const finished = new Date(started.getTime() + 6 * 3600000);
    const confirmed = new Date(finished.getTime() + 2 * DAY);
    const hire = await repo.hire.save(repo.hire.create({
      price: h.price, description_service: svc.title.slice(0, 100), firstContact: first, createdAt: first, user: client, provider: b.provider, service: svc,
      paymentRequired: true, status: StatusEnum.CONCLUIDO, status_provider: StatusEnum.CONCLUIDO, acceptedAt: accepted, startedAt: started, finishedAt: finished, confirmedAt: confirmed,
    } as Partial<Hire>));
    const fee = cents((h.price * FEE) / 100);
    const method = methods[i % methods.length];
    await repo.payment.save(repo.payment.create({
      amount: h.price, feePercent: FEE, fee, net: cents(h.price - fee), method, status: PaymentStatus.LIBERADO, hire, provider: b.provider, user: client,
      details: method === PaymentMethod.CARTAO ? { brand: "Visa", last4: String(4000 + i * 137).slice(-4), installments: h.price > 2000 ? 3 : 1 } : null,
      transactionCode: `SIM-AP${String(hire.id).padStart(5, "0")}`, paidAt: new Date(accepted.getTime() + 2 * 3600000), releasedAt: confirmed,
    } as Partial<Payment>));
    if (h.rating) {
      await repo.review.save(repo.review.create({
        rating: h.rating, comment: h.review ?? null, direction: ReviewDirection.CLIENT_TO_PROVIDER, author: client, target: b.user, provider: b.provider, service: svc, hire,
        createdAt: new Date(confirmed.getTime() + 20 * 3600000),
      } as Partial<Review>));
      reviews++;
    }
    if (h.back) {
      await repo.review.save(repo.review.create({
        rating: 5, comment: h.back, direction: ReviewDirection.PROVIDER_TO_CLIENT, author: b.user, target: client, provider: b.provider, service: svc, hire,
        createdAt: new Date(confirmed.getTime() + 26 * 3600000),
      } as Partial<Review>));
      reviews++;
    }
  }
  console.log(`serviços concluídos: ${PAST_HIRES.length}, avaliações: ${reviews}`);

  // ---- a conversa principal: Júlia encontra o Tomás, negocia e fecha (pelo serviço de conversas real)
  const chat = new ConversationService();
  const tomas = built.tomas;
  const julia = clients.julia;
  const wedding = tomas.services.casamento;
  const who = (from: "cliente" | "prestador") => (from === "cliente" ? julia.id : tomas.user.id);
  const opened = await chat.open(julia.id, { serviceId: wedding.id });
  const convId = opened.id;
  const negotiationId = opened.negotiation!.id;
  // hora de cada fala, para reescrever as datas depois (o serviço grava tudo "agora")
  const [h0, m0] = CHAT_START_TIME.split(":").map(Number);
  const t0 = new Date(Date.now() - CHAT_START_DAYS_AGO * DAY);
  t0.setHours(h0, m0, 0, 0);
  const stamps: { afterId: number; at: Date }[] = [];
  const lastId = async () => Number((await AppDataSource.query("SELECT COALESCE(MAX(id), 0) AS id FROM messages WHERE conversationId = ?", [convId]))[0].id);
  stamps.push({ afterId: 0, at: new Date(t0.getTime() - 60000) }); // abertura da negociação, um minuto antes da primeira mensagem

  for (const line of CHAT) {
    const before = await lastId();
    const at = new Date(t0.getTime() + line.at * 60000);
    if ("text" in line) {
      await chat.sendMessage(convId, who(line.from), line.text);
    } else if ("propose" in line) {
      const current = (await chat.get(convId, who("prestador"))).negotiation!.topics;
      const topics = current.map((t: any) => (t.key in line.propose ? { ...t, content: (line.propose as Record<string, string>)[t.key], state: "Pendente" } : t));
      await chat.updateTopics(convId, who("prestador"), topics, line.note, negotiationId);
    } else if ("agree" in line) {
      const current = (await chat.get(convId, who("cliente"))).negotiation!.topics;
      await chat.updateTopics(convId, who("cliente"), current.map((t: any) => ({ ...t, state: "Acordado" })), line.note, negotiationId);
    } else if ("accept" in line) {
      await chat.accept(convId, who(line.from), negotiationId);
    }
    stamps.push({ afterId: before, at });
  }
  // reescreve as datas: cada grupo de mensagens criado por uma fala recebe a hora dela
  const ids: { id: number }[] = await AppDataSource.query("SELECT id FROM messages WHERE conversationId = ? ORDER BY id", [convId]);
  for (const { id } of ids) {
    const stamp = [...stamps].reverse().find((s) => id > s.afterId)!;
    await AppDataSource.query("UPDATE messages SET createdAt = ? WHERE id = ?", [stamp.at, id]);
  }
  const lastAt = stamps[stamps.length - 1].at;
  await AppDataSource.query("UPDATE conversations SET createdAt = ?, lastMessageAt = ?, clientLastReadAt = ?, providerLastReadAt = ? WHERE id = ?", [stamps[0].at, lastAt, lastAt, lastAt, convId]);
  await AppDataSource.query("UPDATE negotiations SET createdAt = ?, updatedAt = ? WHERE id = ?", [stamps[0].at, lastAt, negotiationId]);
  const n = (await AppDataSource.query("SELECT hireId, contractId FROM negotiations WHERE id = ?", [negotiationId]))[0];
  const formalizedAt = stamps.find((s, i) => "accept" in (CHAT[i - 1] ?? {}) && (CHAT[i - 1] as any).from === "prestador")?.at ?? lastAt;
  if (n?.hireId) await AppDataSource.query("UPDATE hires SET createdAt = ?, firstContact = ?, acceptedAt = ? WHERE id = ?", [formalizedAt, stamps[0].at, formalizedAt, n.hireId]);
  console.log(`conversa Júlia ↔ Tomás: ${ids.length} mensagens, contrato ${n?.contractId ? "gerado" : "NÃO gerado"}`);

  // a Júlia guardou o Tomás nos favoritos quando achou o perfil
  await repo.fav.save(repo.fav.create({ user: julia, provider: tomas.provider } as Partial<ProviderFavorite>));

  // ---- pedido de orçamento ainda sem resposta (painel do Tomás)
  const r = PENDING_REQUEST;
  const reqClient = clients[r.client];
  const before = Date.now();
  await chat.request(reqClient.id, { serviceId: built[r.provider].services[r.service].id, description: r.description, budget: r.budget, date: r.date, notes: r.notes });
  const reqAt = new Date(before - r.hoursAgo * 3600000);
  const reqConv = (await AppDataSource.query("SELECT id FROM conversations WHERE clientId = ? AND providerId = ?", [reqClient.id, built[r.provider].provider.id]))[0].id;
  await AppDataSource.query("UPDATE messages SET createdAt = ? WHERE conversationId = ?", [reqAt, reqConv]);
  await AppDataSource.query("UPDATE negotiations SET createdAt = ?, updatedAt = ? WHERE conversationId = ?", [reqAt, reqAt, reqConv]);
  await AppDataSource.query("UPDATE conversations SET createdAt = ?, lastMessageAt = ?, clientLastReadAt = ? WHERE id = ?", [reqAt, reqAt, reqAt, reqConv]);
  console.log("pedido de orçamento pendente criado (Rodrigo → Tomás)");

  // notificações geradas pelo roteiro ficam como lidas, menos as do pedido novo
  await AppDataSource.query("UPDATE notifications SET `read` = 1 WHERE userId IN (?) AND type <> 'quote.requested'", [[julia.id, tomas.user.id, reqClient.id]]);
}

(async () => {
  const onlyReset = process.argv.includes("--reset");
  await prepareSchema();
  await AppDataSource.initialize();
  try {
    await resetDomain(DOMAIN);
    if (!onlyReset) await seed();
    console.log(`pronto. Contas @${DOMAIN}, senha ${PASSWORD}`);
    if (!onlyReset) {
      console.log(`  cliente:   ${CLIENTS.julia.email}`);
      console.log(`  prestador: ${PROVIDERS[0].user.email}  → /prestador/${PROVIDERS[0].slug}`);
      console.log(`  outros:    /prestador/${PROVIDERS[1].slug}, /prestador/${BIA.slug}`);
    }
  } finally {
    await AppDataSource.destroy();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
