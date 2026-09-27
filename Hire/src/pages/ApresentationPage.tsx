// src/pages/ApresentationPage.tsx
// Página inicial de quem não está logado (rota "/" e "/apresentacao").
// - Entrar/cadastrar logo no topo (o mesmo cartão da tela /auth)
// - Dois caminhos: quem precisa de um serviço e quem oferece — cada um abre o cadastro certo
// - Ilustrações feitas com as peças da própria aplicação (tópicos da negociação, selo, contrato)
// - Números, prestadores, categorias e depoimentos vêm da API (a página funciona sem eles)

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  FileSignature,
  Handshake,
  MapPin,
  MessagesSquare,
  PencilRuler,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Store,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AuthCard, type AuthCardRequest } from "./AuthPage";
import type { AccountType } from "../api/UserAPI";
import { serviceAPI } from "../api/ServiceAPI";
import { providerApi } from "../api/ProviderAPI";
import { reviewAPI } from "../api/ReviewAPI";
import type { ProviderEntity, ReviewEntity } from "../interfaces/Entities";
import { getFirstAndLastName } from "../utils/nameUtils";
import { avatarFor } from "../utils/avatar";
import { providerPath } from "../utils/providerPath";
import VerifiedSeal from "../components/ProviderHero/VerifiedSeal";
import { TONE_CLASS } from "../components/Chat/chatUi";

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTH_ID = "entrar";

/* ------------------------------------------------------------------ dados reais */

type Showcase = {
  services: number;
  providers: number;
  rating: number | null;
  categories: { name: string; count: number }[];
  featured: ProviderEntity[];
  reviews: (ReviewEntity & { providerName: string })[];
};

/** Comentário que parece dado de teste não vira depoimento */
const looksLikeTest = (text: string) => /\b(teste|test|lorem|asdf)\b/i.test(text);

function useShowcase() {
  const [data, setData] = useState<Showcase | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [services, providers] = await Promise.all([serviceAPI.getServices(), providerApi.getAll()]);
        const rated = providers.filter((p) => (p.rating?.count ?? 0) > 0);
        const totalCount = rated.reduce((n, p) => n + p.rating!.count, 0);
        const rating = totalCount ? rated.reduce((n, p) => n + p.rating!.average * p.rating!.count, 0) / totalCount : null;

        const byCategory = new Map<string, number>();
        for (const s of services) if (s.category?.name) byCategory.set(s.category.name, (byCategory.get(s.category.name) ?? 0) + 1);
        const categories = [...byCategory.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

        // destaque: verificados primeiro, depois nota com volume de avaliações
        const score = (p: ProviderEntity) => (p.verified ? 1000 : 0) + (p.rating?.average ?? 0) * Math.log10(1 + (p.rating?.count ?? 0));
        const featured = providers
          .filter((p) => p.profileImageUrl && (p.rating?.count ?? 0) > 0)
          .sort((a, b) => score(b) - score(a))
          .slice(0, 4);

        const lists = await Promise.all(
          rated
            .sort((a, b) => (b.rating?.count ?? 0) - (a.rating?.count ?? 0))
            .slice(0, 8)
            .map((p) =>
              reviewAPI
                .forProvider(p.id)
                .then((l) => l.reviews.map((r) => ({ ...r, providerName: p.companyName || p.professionalName })))
                .catch(() => [])
            )
        );
        const seen = new Set<string>();
        const reviews = lists
          .flat()
          .filter((r) => r.rating >= 4 && r.comment && r.comment.trim().length >= 25 && !looksLikeTest(r.comment))
          .filter((r) => {
            const key = r.comment!.trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, 3);

        if (active) setData({ services: services.length, providers: providers.length, rating, categories, featured, reviews });
      } catch {
        if (active) setData(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return data;
}

/* ------------------------------------------------------------------ página */

export default function LandingPage() {
  const showcase = useShowcase();
  const [request, setRequest] = useState<AuthCardRequest | null>(null);

  /** Leva ao cartão de entrar/cadastrar, já na aba e no tipo de conta certos */
  const goAuth = (signup: boolean, tipo?: AccountType) => {
    setRequest({ signup, tipo, nonce: Date.now() });
    const card = document.getElementById(AUTH_ID);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => card?.querySelector<HTMLInputElement>("form input")?.focus({ preventScroll: true }), 450);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen w-full overflow-x-hidden bg-[var(--bg-dark)] text-[var(--text)]">
        <Hero showcase={showcase} request={request} goAuth={goAuth} />
        <TwoSides goAuth={goAuth} />
        <ProtectedFlow />
        {showcase && showcase.featured.length > 0 && <Featured providers={showcase.featured} />}
        {showcase && showcase.categories.length > 0 && <Categories categories={showcase.categories} goAuth={goAuth} />}
        {showcase && showcase.reviews.length > 0 && <Testimonials reviews={showcase.reviews} />}
        <FinalCta goAuth={goAuth} />
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ peças comuns */

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: React.ReactNode; text?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-sm font-medium text-[var(--primary)]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl md:text-4xl font-bold leading-tight">{title}</h2>
      {text && <p className="mt-3 text-[var(--text-muted)]">{text}</p>}
    </Reveal>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[var(--primary)] text-white font-semibold transition hover:brightness-110 active:scale-[0.98]";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-[var(--border)] text-[var(--text)] font-medium transition hover:border-[var(--primary)] active:scale-[0.98]";

/* ------------------------------------------------------------------ 1. topo: proposta + entrar */

function Hero({ showcase, request, goAuth }: { showcase: Showcase | null; request: AuthCardRequest | null; goAuth: (signup: boolean, tipo?: AccountType) => void }) {
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };
  return (
    <header className="relative min-h-screen flex items-center pt-44 sm:pt-28 pb-16 bg-[linear-gradient(135deg,_#000_0%,_#000_45%,_#01060f_70%,_color-mix(in_oklch,var(--primary)_55%,#000)_100%)]">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
          <motion.p variants={item} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-muted)] text-xs sm:text-sm text-[var(--text-muted)]">
            <ShieldCheck size={15} className="text-[var(--primary)]" /> Serviços com acordo registrado e contrato assinado
          </motion.p>
          <motion.h1 variants={item} className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Quem precisa encontra <span className="text-[var(--primary)]">quem faz.</span>
          </motion.h1>
          <motion.p variants={item} className="mt-5 max-w-xl text-base sm:text-lg text-[var(--text-muted)]">
            Encontre profissionais avaliados perto de você, combine tudo por escrito no chat e feche com contrato assinado pelos dois lados. Ou ofereça seus serviços e receba pedidos.
          </motion.p>
          <motion.div variants={item} className="mt-8 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => goAuth(true, "cliente")} className={primaryBtn}>
              <Search size={18} /> Preciso de um serviço
            </button>
            <button type="button" onClick={() => goAuth(true, "profissional")} className={ghostBtn}>
              <Store size={18} className="text-[var(--primary)]" /> Quero oferecer serviços
            </button>
          </motion.div>

          {/* números reais da plataforma */}
          <motion.dl variants={item} className="mt-10 grid grid-cols-3 max-w-lg gap-4">
            {[
              [showcase?.services, "serviços publicados"],
              [showcase?.providers, "profissionais"],
              [showcase?.rating != null ? `${showcase.rating.toFixed(1)}` : null, "nota média"],
            ].map(([value, label]) => (
              <div key={label as string} className="border-l border-[var(--border-muted)] pl-4">
                <dd className="text-2xl sm:text-3xl font-bold tabular-nums flex items-center gap-1">
                  {value ?? <span className="inline-block w-12 h-7 rounded bg-[var(--bg-light)] animate-pulse" aria-hidden />}
                  {label === "nota média" && value && <Star size={20} className="text-yellow-400" fill="currentColor" aria-hidden />}
                </dd>
                <dt className="text-xs sm:text-sm text-[var(--text-muted)]">{label}</dt>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.15 }} className="flex justify-center lg:justify-end">
          <AuthCard embedded request={request} id={AUTH_ID} />
        </motion.div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ 2. os dois lados */

type Side = "cliente" | "profissional";
const SIDES: Record<Side, { steps: { icon: LucideIcon; title: string; text: string }[]; cta: string }> = {
  cliente: {
    steps: [
      { icon: Search, title: "Encontre quem faz", text: "Busque por serviço, filtre por categoria, preço e distância, e veja nota, perfil e selo de conta verificada." },
      { icon: MessagesSquare, title: "Combine no chat", text: "Converse, peça orçamento ou aceite uma proposta sob medida. Valor, data e duração ficam registrados item por item." },
      { icon: FileSignature, title: "Feche com contrato", text: "Com os dois aceites o contrato é gerado para assinatura. Pague pela plataforma e acompanhe cada etapa." },
    ],
    cta: "Criar conta para contratar",
  },
  profissional: {
    steps: [
      { icon: Store, title: "Monte sua página", text: "Perfil profissional com serviços, agenda, portfólio e link próprio para divulgar — com QR Code pronto." },
      { icon: PencilRuler, title: "Responda e proponha", text: "Receba pedidos de orçamento, responda com proposta ou crie um serviço sob medida durante a conversa." },
      { icon: Wallet, title: "Receba com segurança", text: "Contrato assinado, pagamento registrado e avaliações que constroem sua reputação a cada serviço." },
    ],
    cta: "Cadastrar como profissional",
  },
};

function TwoSides({ goAuth }: { goAuth: (signup: boolean, tipo?: AccountType) => void }) {
  const [side, setSide] = useState<Side>("cliente");
  const data = SIDES[side];
  return (
    <section className="py-20 md:py-28 border-t border-[var(--border-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <SectionTitle eyebrow="Para os dois lados" title="Um só lugar para quem contrata e para quem trabalha" />
          <div role="tablist" aria-label="Escolha o seu lado" className="flex self-start md:self-auto p-1 rounded-full border border-[var(--border-muted)] bg-[var(--bg)]">
            {([
              ["cliente", "Quero contratar", UserRound],
              ["profissional", "Sou profissional", Store],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={side === value}
                onClick={() => setSide(value)}
                className={`relative h-10 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${side === value ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {side === value && <motion.span layoutId="landing-side" className="absolute inset-0 rounded-full bg-[var(--primary)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <Icon size={16} className="relative" /> <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={side}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid gap-4"
            >
              {data.steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 p-5 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)]">
                  <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] text-[var(--primary)]">
                    <s.icon size={21} />
                  </span>
                  <div>
                    <p className="text-xs text-[var(--text-muted)]">Passo {i + 1}</p>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{s.text}</p>
                  </div>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => goAuth(true, side)} className={`${primaryBtn} mt-2`}>
                  {data.cta} <ArrowRight size={18} />
                </button>
              </li>
            </motion.ol>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={side} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
              {side === "cliente" ? <NegotiationPreview /> : <ProviderPreview />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/** Prévia com as peças reais do painel de negociação */
function NegotiationPreview() {
  const topics = [
    { label: "Serviço previsto", value: "Troca do disjuntor e circuito da cozinha", tone: "ok" as const, chip: "Acordado" },
    { label: "Valor & método", value: "R$ 380,00 · Pix", tone: "ok" as const, chip: "Acordado" },
    { label: "Data e hora de início", value: "Sábado, 10:00", tone: "wait" as const, chip: "Aguardando você" },
  ];
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-light)] p-5 sm:p-6" aria-label="Exemplo de negociação no chat do Hire" role="img">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[color-mix(in_oklch,var(--primary)_25%,var(--bg))] flex items-center justify-center font-semibold text-[var(--primary)]">SE</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold flex items-center gap-1.5">Souza Elétrica <BadgeCheck size={18} className="text-white" fill="var(--primary)" /></p>
          <p className="text-xs text-[var(--text-muted)]">Proposta sob medida · 2 de 3 acordados</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
        <motion.div className="h-full rounded-full bg-[var(--deal-ok)] origin-left" initial={{ scaleX: 0 }} whileInView={{ scaleX: 0.66 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} />
      </div>
      <ul className="mt-4 grid gap-2.5">
        {topics.map((t) => (
          <li key={t.label} className={`rounded-2xl border p-3 bg-[var(--bg)] ${t.tone === "wait" ? "border-[color-mix(in_oklch,var(--deal-wait)_45%,transparent)]" : "border-[var(--border-muted)]"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t.label}</span>
              <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASS[t.tone]}`}>{t.chip}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t.value}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white h-11 justify-center text-sm font-medium">
        <Handshake size={17} /> Aceitar e gerar contrato
      </div>
    </div>
  );
}

/** Prévia do perfil profissional com selo, agenda e pedido chegando */
function ProviderPreview() {
  return (
    <div className="grid gap-4" role="img" aria-label="Exemplo de perfil profissional e pedido de orçamento no Hire">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-light)] p-5 sm:p-6 flex items-center gap-4">
        <span className="w-16 h-16 rounded-full border-4 border-[var(--primary)] bg-[var(--bg)] flex items-center justify-center text-xl font-bold">LC</span>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold flex items-center gap-1.5">Luana Costa <BadgeCheck size={20} className="text-white" fill="var(--primary)" /></p>
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-1"><Star size={14} className="text-yellow-400" fill="currentColor" /> 4,9 · Assistência técnica</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1"><MapPin size={12} /> Curitiba · atende até 10 km</p>
        </div>
        <QrCode size={40} className="text-[var(--text-muted)] hidden sm:block" aria-hidden />
      </div>
      <div className="rounded-3xl border border-[color-mix(in_oklch,var(--primary)_40%,transparent)] bg-[color-mix(in_oklch,var(--primary)_8%,var(--bg-light))] p-5 sm:p-6">
        <p className="text-sm font-medium flex items-center gap-2"><MessagesSquare size={16} className="text-[var(--primary)]" /> Novo pedido de orçamento</p>
        <p className="mt-2 text-sm">“Notebook não liga depois de uma queda de energia. Consegue olhar essa semana?”</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full border border-[var(--border-muted)]">Orçamento R$ 200</span>
          <span className="px-2.5 py-1 rounded-full border border-[var(--border-muted)] flex items-center gap-1"><CalendarClock size={12} /> Até sexta</span>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="flex-1 h-10 rounded-xl bg-[var(--primary)] text-white text-sm font-medium flex items-center justify-center">Enviar proposta</span>
          <span className="h-10 px-4 rounded-xl border border-[var(--border-muted)] text-sm text-[var(--text-muted)] flex items-center">Recusar</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3. acordo protegido */

function ProtectedFlow() {
  const steps: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: MessagesSquare, title: "Conversa", text: "Uma conversa por pessoa, que continua depois do serviço." },
    { icon: Handshake, title: "Negociação por itens", text: "Quem propõe não aceita a própria proposta: cada item precisa dos dois." },
    { icon: FileSignature, title: "Contrato assinado", text: "Gerado do acordo, com assinatura eletrônica e registro do conteúdo." },
    { icon: Star, title: "Avaliação dos dois lados", text: "Cliente e profissional se avaliam, com fotos do serviço." },
  ];
  return (
    <section className="py-20 md:py-28 bg-[var(--bg)] border-y border-[var(--border-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <SectionTitle
          eyebrow="Confiança"
          title="Do primeiro “oi” ao contrato, tudo fica registrado"
          text="Nada é fechado sozinho e nada se perde em conversas soltas: o combinado vira contrato e o histórico fica com as duas partes."
        />
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <li className="h-full p-5 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg-light)] list-none">
                <div className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] text-[var(--primary)]">
                    <s.icon size={21} />
                  </span>
                  <span className="text-3xl font-bold text-[var(--border)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.2}>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
            {["Selo de conta verificada", "Pagamento registrado na plataforma", "Anexos privados só para as partes", "Contato pelo chat, sem expor telefone"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check size={16} className="text-[var(--deal-ok)]" /> {t}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 4. profissionais reais */

function Featured({ providers }: { providers: ProviderEntity[] }) {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <SectionTitle eyebrow="Na plataforma agora" title="Profissionais bem avaliados" text="Perfis públicos de quem já presta serviço pelo Hire. Clique para conhecer." />
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers.map((p, i) => {
            const name = p.companyName || p.professionalName;
            return (
              <Reveal key={p.id} delay={i * 0.06}>
                <Link
                  to={providerPath(p)}
                  className="group h-full flex flex-col items-center text-center p-6 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg)] transition hover:border-[var(--primary)] hover:-translate-y-1"
                >
                  <img src={avatarFor(p.profileImageUrl, name)} alt="" loading="lazy" className="w-20 h-20 rounded-full object-cover border-4 border-[var(--primary)]" />
                  <p className="mt-4 font-semibold flex items-center gap-1.5">
                    <span className="truncate max-w-[180px]">{name}</span>
                    {p.verified && <VerifiedSeal size={18} />}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{p.category?.name ?? "Serviços"}</p>
                  <p className="mt-2 text-sm flex items-center gap-1">
                    <Star size={14} className="text-yellow-400" fill="currentColor" />
                    <strong>{p.rating?.average.toFixed(1)}</strong>
                    <span className="text-[var(--text-muted)]">({p.rating?.count} avaliações)</span>
                  </p>
                  {p.baseCity && (
                    <p className="mt-1 text-xs text-[var(--text-muted)] flex items-center gap-1"><MapPin size={12} /> {p.baseCity}{p.baseState ? ` - ${p.baseState}` : ""}</p>
                  )}
                  <span className="mt-4 text-sm text-[var(--primary)] flex items-center gap-1 transition-transform group-hover:translate-x-0.5">
                    Ver perfil <ArrowRight size={15} />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 5. categorias */

function Categories({ categories, goAuth }: { categories: { name: string; count: number }[]; goAuth: (signup: boolean, tipo?: AccountType) => void }) {
  return (
    <section className="pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <Reveal>
          <div className="rounded-3xl border border-[var(--border-muted)] bg-[var(--bg)] p-6 sm:p-10">
            <h2 className="text-2xl md:text-3xl font-bold">O que você precisa hoje?</h2>
            <p className="mt-2 text-[var(--text-muted)]">Categorias com mais serviços publicados agora.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => goAuth(true, "cliente")}
                  className="px-4 py-2 rounded-full border border-[var(--border-muted)] text-sm transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {c.name} <span className="text-[var(--text-muted)]">· {c.count}</span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 6. depoimentos reais */

function Testimonials({ reviews }: { reviews: (ReviewEntity & { providerName: string })[] }) {
  const quotes = useMemo(
    () =>
      reviews.map((r) => ({
        id: r.id,
        name: getFirstAndLastName(r.author?.name ?? "Cliente"),
        about: r.providerName,
        rating: Math.round(r.rating),
        quote: r.comment!.trim(),
      })),
    [reviews]
  );
  return (
    <section className="py-20 md:py-28 bg-[var(--bg)] border-y border-[var(--border-muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <SectionTitle eyebrow="Avaliações publicadas" title="Quem contratou, recomenda" />
        <div className={`mt-10 grid gap-4 ${quotes.length >= 3 ? "md:grid-cols-3" : quotes.length === 2 ? "md:grid-cols-2" : "max-w-xl"}`}>
          {quotes.map((q, i) => (
            <Reveal key={q.id} delay={i * 0.08}>
              <figure className="h-full p-6 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg-light)] flex flex-col">
                <div className="flex gap-0.5 text-yellow-400" aria-label={`${q.rating} de 5 estrelas`}>
                  {Array.from({ length: q.rating }).map((_, k) => <Star key={k} size={16} fill="currentColor" aria-hidden />)}
                </div>
                <blockquote className="mt-3 flex-1 text-[var(--text)]">“{q.quote}”</blockquote>
                <figcaption className="mt-4 text-sm">
                  <strong>{q.name}</strong> <span className="text-[var(--text-muted)]">sobre {q.about}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 7. fechamento */

function FinalCta({ goAuth }: { goAuth: (signup: boolean, tipo?: AccountType) => void }) {
  return (
    <footer className="pt-20 md:pt-28 pb-10 bg-[linear-gradient(180deg,_var(--bg-dark)_0%,_color-mix(in_oklch,var(--primary)_22%,#000)_100%)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 text-center">
        <Reveal>
          <p className="text-5xl sm:text-6xl font-extrabold tracking-tight">Hire.</p>
          <p className="mt-3 text-xl sm:text-2xl font-bold">Quem precisa encontra quem faz.</p>
          <p className="mt-3 text-[var(--text-muted)]">Crie sua conta em menos de um minuto. Com a mesma conta você contrata e, se quiser, oferece seus serviços.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={() => goAuth(true, "cliente")} className={primaryBtn}>
              Criar minha conta <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => goAuth(false)} className={ghostBtn}>
              Já tenho conta
            </button>
          </div>
        </Reveal>
        <p className="mt-16 text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} Hire. — plataforma de contratação e prestação de serviços</p>
      </div>
    </footer>
  );
}
