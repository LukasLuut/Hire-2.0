// src/pages/ApresentationPage.tsx
// Página inicial de quem não está logado (rota "/" e "/apresentacao").
// - Entrar/cadastrar no topo (o mesmo cartão da tela /auth, na versão neutra)
// - Tour em vídeo com gravações reais do app (buscar, chat, negociar, divulgar, perfil),
//   com zoom no que importa em cada passo
// - Vantagens lado a lado para quem contrata e para quem presta
// - Números, profissionais, categorias e depoimentos vêm da API (a página funciona sem eles)
// Cores: as do app — superfícies neutras (bg-dark/bg/bg-light) e o azul só em ações e destaques.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  FileSignature,
  Handshake,
  LineChart,
  MapPin,
  MessagesSquare,
  Pause,
  Play,
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

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTH_ID = "entrar";
type GoAuth = (signup: boolean, tipo?: AccountType) => void;

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
          [...rated]
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
  const goAuth: GoAuth = (signup, tipo) => {
    setRequest({ signup, tipo, nonce: Date.now() });
    const card = document.getElementById(AUTH_ID);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => card?.querySelector<HTMLInputElement>("form input")?.focus({ preventScroll: true }), 450);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen w-full overflow-x-hidden bg-[var(--bg-dark)] text-[var(--text)]">
        <Hero showcase={showcase} request={request} goAuth={goAuth} />
        <VideoTour />
        <Benefits goAuth={goAuth} />
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

function SectionTitle({ eyebrow, title, text, center = false }: { eyebrow: string; title: React.ReactNode; text?: string; center?: boolean }) {
  return (
    <Reveal className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
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
const iconTile = "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-[var(--bg)] border border-[var(--border-muted)] text-[var(--primary)]";

/* ------------------------------------------------------------------ 1. topo: proposta + entrar */

function Hero({ showcase, request, goAuth }: { showcase: Showcase | null; request: AuthCardRequest | null; goAuth: GoAuth }) {
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };
  return (
    <header className="relative pt-44 sm:pt-32 pb-20 lg:min-h-[92vh] flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.08 }}>
          <motion.p variants={item} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-muted)] bg-[var(--bg)] text-xs sm:text-sm text-[var(--text-muted)]">
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
          <motion.a variants={item} href="#tour" className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <Play size={15} className="text-[var(--primary)]" /> Ver o Hire funcionando
          </motion.a>

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
          <AuthCard embedded plain request={request} id={AUTH_ID} />
        </motion.div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ 2. tour em vídeo */

type Chapter = { id: string; icon: LucideIcon; who: string; title: string; text: string };
const CHAPTERS: Chapter[] = [
  { id: "buscar", icon: Search, who: "Quem contrata", title: "Encontre quem faz", text: "Digite o que precisa e veja na hora profissionais, preços e notas. Um clique abre o serviço completo." },
  { id: "chat", icon: MessagesSquare, who: "Os dois lados", title: "Converse sem perder nada", text: "Mensagem nova aparece no canto da tela, em qualquer página. A conversa fica guardada, antes e depois do serviço." },
  { id: "negociar", icon: Handshake, who: "Os dois lados", title: "Combine item por item", text: "Valor, data e duração viram tópicos. Cada um aceita o que o outro propôs — e o contrato sai na hora." },
  { id: "divulgar", icon: QrCode, who: "Quem presta", title: "Divulgue seu trabalho", text: "Seu perfil vira uma imagem com QR Code, no tema claro ou escuro, pronta para redes sociais e cartões." },
  { id: "perfil", icon: BadgeCheck, who: "Quem contrata", title: "Confie antes de contratar", text: "Selo de conta verificada, avaliações reais e pedido de orçamento direto do perfil." },
];

function VideoTour() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const [progress, setProgress] = useState(0);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chapter = CHAPTERS[index];
  // o vídeo novo só monta depois da animação de saída: ele mesmo decide tocar quando fica pronto
  const shouldPlay = useRef(false);
  shouldPlay.current = playing && inView;

  // só toca com a seção na tela (economiza dados e bateria)
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing && inView) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, inView, index]);

  const go = useCallback((i: number) => {
    setIndex((i + CHAPTERS.length) % CHAPTERS.length);
    setProgress(0);
  }, []);

  return (
    <section id="tour" ref={sectionRef} className="py-20 md:py-28 bg-[var(--bg)] border-y border-[var(--border-muted)] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <SectionTitle eyebrow="Veja funcionando" title="O Hire na prática, em cinco momentos" text="Gravações reais da plataforma. Escolha um momento ou deixe passar sozinho." />

        <div className="mt-12 grid lg:grid-cols-[360px_1fr] gap-6 lg:gap-10 items-start">
          {/* capítulos */}
          <ol className="grid gap-2 order-2 lg:order-1" role="tablist" aria-label="Momentos do tour">
            {CHAPTERS.map((c, i) => {
              const active = i === index;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="tour-video"
                    onClick={() => {
                      go(i);
                      setPlaying(true);
                    }}
                    className={`relative w-full text-left rounded-2xl border p-4 overflow-hidden transition-colors duration-200 ${active ? "border-[var(--primary)] bg-[var(--bg-light)]" : "border-[var(--border-muted)] hover:border-[var(--border)]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border transition-colors ${active ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-[var(--bg-dark)] border-[var(--border-muted)] text-[var(--primary)]"}`}>
                        <c.icon size={19} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{c.who}</span>
                        <span className="block font-semibold">{c.title}</span>
                        <AnimatePresence initial={false}>
                          {active && (
                            <motion.span
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3, ease: EASE }}
                              className="block overflow-hidden text-sm text-[var(--text-muted)] mt-1"
                            >
                              {c.text}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </div>
                    {/* progresso do vídeo em andamento */}
                    {active && (
                      <span className="absolute left-0 bottom-0 h-0.5 bg-[var(--primary)] origin-left" style={{ width: "100%", transform: `scaleX(${progress})` }} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* vídeo */}
          <div className="order-1 lg:order-2">
            <div className="relative rounded-3xl border border-[var(--border)] bg-[var(--bg-dark)] overflow-hidden aspect-[16/10]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.video
                  key={chapter.id}
                  id="tour-video"
                  ref={videoRef}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="absolute inset-0 w-full h-full object-cover"
                  poster={`/landing/${chapter.id}.jpg`}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={`Vídeo: ${chapter.title}. ${chapter.text}`}
                  onCanPlay={(e) => {
                    if (shouldPlay.current) e.currentTarget.play().catch(() => setPlaying(false));
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setProgress(v.currentTime / v.duration);
                  }}
                  onEnded={() => go(index + 1)}
                >
                  <source src={`/landing/${chapter.id}.webm`} type="video/webm" />
                  <source src={`/landing/${chapter.id}.mp4`} type="video/mp4" />
                </motion.video>
              </AnimatePresence>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
                className="absolute right-3 bottom-3 w-10 h-10 rounded-full bg-[color-mix(in_oklch,var(--bg-dark)_75%,transparent)] border border-[var(--border)] text-[var(--text)] flex items-center justify-center backdrop-blur-sm hover:border-[var(--primary)] transition"
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 3. vantagens dos dois lados */

const CLIENT_BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Search, title: "Ache rápido e perto", text: "Busca por serviço, categoria, preço e distância, com nota e perfil de cada profissional." },
  { icon: BadgeCheck, title: "Saiba em quem confiar", text: "Selo de conta verificada, avaliações reais com fotos e histórico de serviços concluídos." },
  { icon: FileSignature, title: "Tudo por escrito", text: "O combinado no chat vira contrato assinado. Nada fica só na palavra." },
  { icon: Wallet, title: "Pague com segurança", text: "Pagamento registrado pela plataforma e acompanhamento de cada etapa do serviço." },
];
const PROVIDER_BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Store, title: "Sua vitrine profissional", text: "Perfil com serviços, portfólio, agenda e link próprio — mesmo antes do primeiro cliente." },
  { icon: QrCode, title: "Divulgação pronta", text: "Imagem com QR Code para redes, cartões e o seu local de trabalho." },
  { icon: CalendarClock, title: "Agenda e pedidos organizados", text: "Pedidos de orçamento, propostas sob medida e horários num só lugar." },
  { icon: LineChart, title: "Reputação que cresce", text: "Avaliações e contratos concluídos contam a seu favor a cada serviço." },
];

function Benefits({ goAuth }: { goAuth: GoAuth }) {
  const column = (who: "cliente" | "profissional", icon: LucideIcon, title: string, items: typeof CLIENT_BENEFITS, cta: string) => {
    const Icon = icon;
    return (
      <Reveal className="h-full">
        <div className="h-full rounded-3xl border border-[var(--border-muted)] bg-[var(--bg)] p-6 sm:p-8 flex flex-col">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--primary)] text-white">
              <Icon size={22} />
            </span>
            <h3 className="text-xl font-bold">{title}</h3>
          </div>
          <ul className="mt-6 grid gap-5 flex-1">
            {items.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className={iconTile}>
                  <b.icon size={20} />
                </span>
                <span>
                  <span className="block font-semibold">{b.title}</span>
                  <span className="block text-sm text-[var(--text-muted)] mt-0.5">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => goAuth(true, who)} className={`${who === "cliente" ? primaryBtn : ghostBtn} mt-8 self-start`}>
            {cta} <ArrowRight size={18} />
          </button>
        </div>
      </Reveal>
    );
  };
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <SectionTitle eyebrow="Para os dois lados" title="Vantagens para quem contrata e para quem trabalha" text="Com a mesma conta você contrata e, se quiser, também oferece seus serviços." />
        <div className="mt-12 grid lg:grid-cols-2 gap-6">
          {column("cliente", UserRound, "Para quem contrata", CLIENT_BENEFITS, "Criar conta para contratar")}
          {column("profissional", Store, "Para quem presta serviços", PROVIDER_BENEFITS, "Cadastrar como profissional")}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 4. acordo protegido */

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
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <li className="h-full p-5 rounded-2xl border border-[var(--border-muted)] bg-[var(--bg-light)] list-none">
                <div className="flex items-center justify-between">
                  <span className={iconTile}>
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
              <li key={t} className="flex items-center gap-2">
                <Check size={16} className="text-[var(--deal-ok)]" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 5. profissionais reais */

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
                    <p className="mt-1 text-xs text-[var(--text-muted)] flex items-center gap-1">
                      <MapPin size={12} /> {p.baseCity}
                      {p.baseState ? ` - ${p.baseState}` : ""}
                    </p>
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

/* ------------------------------------------------------------------ 6. categorias */

function Categories({ categories, goAuth }: { categories: { name: string; count: number }[]; goAuth: GoAuth }) {
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

/* ------------------------------------------------------------------ 7. depoimentos reais */

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
                  {Array.from({ length: q.rating }).map((_, k) => (
                    <Star key={k} size={16} fill="currentColor" aria-hidden />
                  ))}
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

/* ------------------------------------------------------------------ 8. fechamento */

function FinalCta({ goAuth }: { goAuth: GoAuth }) {
  return (
    <footer className="pt-20 md:pt-28 pb-10">
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
        <p className="mt-16 pt-6 border-t border-[var(--border-muted)] text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} Hire. — plataforma de contratação e prestação de serviços</p>
      </div>
    </footer>
  );
}
