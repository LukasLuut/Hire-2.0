// src/pages/ApresentationPage.tsx
// V4 — Landing Page FULL: Cinematic Showcase + Detailed Presentation
// - Designed for Hire. (commercial, cinematic, parallax scroll-telling)
// - TailwindCSS + Framer Motion + react-tsparticles
// - Página inicial para quem não está logado (rota "/" e "/apresentacao")
// - Imagens: capturas reais das telas em /public/apresentacao
// - Números e depoimentos vêm da API (serviços, prestadores e avaliações reais)
// - AuthPage is embedded at the end as CTA

import { useEffect, useState } from "react";
import { LazyMotion, domAnimation, motion, useScroll, useTransform } from "framer-motion";
import Particles from "react-tsparticles";
import { FiChevronDown } from "react-icons/fi";
import AuthPage from "./AuthPage";
import { serviceAPI } from "../api/ServiceAPI";
import { providerApi } from "../api/ProviderAPI";
import { reviewAPI } from "../api/ReviewAPI";
import type { ReviewEntity } from "../interfaces/Entities";
import { getFirstAndLastName } from "../utils/nameUtils";

const IMG = "/apresentacao";

type Showcase = {
  services: number;
  providers: number;
  categories: number;
  rating: number | null;
  reviews: (ReviewEntity & { providerName: string })[];
};

/** Números e avaliações reais da plataforma (a página funciona mesmo se a API falhar). */
function useShowcase() {
  const [data, setData] = useState<Showcase | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [services, providers] = await Promise.all([serviceAPI.getServices(), providerApi.getAll()]);
        const rated = providers.filter((p) => (p.rating?.count ?? 0) > 0);
        const totalCount = rated.reduce((n, p) => n + (p.rating!.count), 0);
        const rating = totalCount ? rated.reduce((n, p) => n + p.rating!.average * p.rating!.count, 0) / totalCount : null;
        const lists = await Promise.all(
          rated.slice(0, 6).map((p) =>
            reviewAPI
              .forProvider(p.id)
              .then((l) => l.reviews.map((r) => ({ ...r, providerName: p.companyName || p.professionalName })))
              .catch(() => [])
          )
        );
        const reviews = lists
          .flat()
          .filter((r) => r.comment && r.comment.trim().length > 8)
          .sort((a, b) => b.rating - a.rating || +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, 3);
        if (active) {
          setData({
            services: services.length,
            providers: providers.length,
            categories: new Set(services.map((s) => s.category?.name).filter(Boolean)).size,
            rating,
            reviews,
          });
        }
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

export default function LandingPageFull() {
  const showcase = useShowcase();
  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen w-full overflow-x-hidden bg-[var(--bg,#05060a)] text-[var(--text,#eef2ff)] antialiased">
        <ParticlesBackdrop />
        <HeroSection showcase={showcase} />
        <HowItWorks />
        <FeaturesAndBenefits />
        <DualPerspective />
        <PlatformShowcase />
        <SecurityTech />
        <DemoGallery />
        <Testimonials reviews={showcase?.reviews ?? []} />
        <FooterCTA />
      </div>
    </LazyMotion>
  );
}

// ---------------- Particles backdrop ----------------
function ParticlesBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-20">
      <Particles
        options={{
          fpsLimit: 60,
          background: { color: "transparent" },
          particles: {
            number: { value: 50, density: { enable: true, area: 900 } },
            color: { value: ["#00ffd1", "#7c3aed", "#60a5fa"] },
            opacity: { value: 0.08, random: true },
            size: { value: 2.2, random: true },
            move: { enable: true, speed: 0.6, direction: "none", outModes: "out" },
            links: { enable: false },
          },
          interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
        }}
      />
    </div>
  );
}

// ---------------- Hero ----------------
function HeroSection({ showcase }: { showcase: Showcase | null }) {
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 700], [0, -140]);

  return (
    <header className="relative overflow-hidden min-h-screen flex items-center">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#00060b] via-[#021227] to-[#001726]" />

      <div className="max-w-7xl mx-auto w-full px-6 z-10">
        <motion.div style={{ y: titleY }} className="pt-28 lg:pt-36">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-[var(--brand,#00ffd1)] flex items-center justify-center font-bold text-black">Hire.</div>
            <div className="text-sm uppercase tracking-wide text-[var(--muted,#9fb0c8)]">Plataforma</div>
          </div>

          <motion.h1 initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }} className="mt-10 text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            Contrate. Preste. Confie. <br /> <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--brand,#00ffd1)] to-[var(--accent,#7c3aed)]">Tudo em um só lugar.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.18 }} className="mt-6 max-w-3xl text-lg text-[var(--muted,#9fb0c8)]">
            Hire. conecta clientes e prestadores com pedidos de orçamento, negociação registrada, agenda, contrato com assinatura eletrônica e avaliações dos dois lados.
          </motion.p>

          <div className="mt-8 flex gap-4 items-center">
            <a href="#how" className="inline-flex items-center gap-3 rounded-full px-6 py-3 bg-[var(--brand,#00ffd1)] text-black font-semibold shadow-lg transform-gpu hover:scale-[1.02]">Ver demonstração</a>
            <a href="#auth" className="inline-flex items-center gap-3 rounded-full px-6 py-3 border border-[rgba(255,255,255,0.06)] text-[var(--muted,#9fb0c8)]">Entrar</a>
          </div>

          {showcase && showcase.services > 0 && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--muted,#9fb0c8)]">
              <div><dt className="sr-only">Serviços</dt><dd><strong className="text-lg text-[var(--text,#eef2ff)]">{showcase.services}</strong> serviços publicados</dd></div>
              <div><dt className="sr-only">Prestadores</dt><dd><strong className="text-lg text-[var(--text,#eef2ff)]">{showcase.providers}</strong> prestadores</dd></div>
              <div><dt className="sr-only">Categorias</dt><dd><strong className="text-lg text-[var(--text,#eef2ff)]">{showcase.categories}</strong> categorias</dd></div>
              {showcase.rating !== null && (
                <div><dt className="sr-only">Nota média</dt><dd><strong className="text-lg text-[var(--text,#eef2ff)]">{showcase.rating.toFixed(1)}★</strong> nota média</dd></div>
              )}
            </dl>
          )}
        </motion.div>

        <div className="mt-12 hidden md:block">
          <HeroMockupSet />
        </div>
      </div>

      <a href="#how" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--muted,#9fb0c8)] flex flex-col items-center gap-2">
        <FiChevronDown size={24} />
        <span className="text-xs">Role para continuar</span>
      </a>
    </header>
  );
}

function HeroMockupSet() {
  return (
    <div className="relative mt-8 w-full h-[420px] pointer-events-none">
      <div className="absolute left-0 top-8 w-[420px] h-[300px] rounded-2xl shadow-2xl transform-gpu rotate-6 scale-[0.98] overflow-hidden bg-gradient-to-br from-[#081028] to-[#022036] border border-[rgba(255,255,255,0.03)]">
        <img src={`${IMG}/hero-1.jpg`} alt="Vitrine de serviços com filtros e melhores prestadores" className="w-full h-full object-cover object-top" />
      </div>

      <div className="absolute right-0 top-20 w-[520px] h-[340px] rounded-2xl shadow-2xl -rotate-3 overflow-hidden bg-gradient-to-br from-[#07122a] to-[#001625] border border-[rgba(255,255,255,0.03)]">
        <img src={`${IMG}/hero-2.jpg`} alt="Sala de negociação com resumo do acordo" className="w-full h-full object-cover object-top" />
      </div>

      <div className="absolute left-1/2 top-36 -translate-x-1/2 w-[480px] h-[320px] rounded-3xl shadow-2xl overflow-hidden bg-gradient-to-br from-[#061228] to-[#00232f] border border-[rgba(255,255,255,0.04)]">
        <img src={`${IMG}/hero-3.jpg`} alt="Contrato gerado a partir da negociação" className="w-full h-full object-cover object-top" />
      </div>
    </div>
  );
}

// ---------------- How it works (3-step interactive) ----------------
function HowItWorks() {
  return (
    <section id="how" className="py-20">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-3xl font-bold">Como funciona — em 3 passos</h2>
          <p className="mt-3 text-[var(--muted,#9fb0c8)] max-w-xl">Uma jornada simples e eficiente que transforma intenção em serviço concluído.</p>

          <div className="mt-8 space-y-6">
            <HowCard number={1} title="Encontrar ou pedir orçamento" body="Busque por categoria, nota e preço. Contrate direto — escolhendo o horário na agenda — ou peça um orçamento com fotos e observações." />
            <HowCard number={2} title="Negociar com registro" body="Valor, início, duração e garantia viram itens do acordo. Quem propõe não aceita a própria proposta: cada item precisa das duas partes." />
            <HowCard number={3} title="Fechar e acompanhar" body="Com os dois aceites, o contrato é gerado para assinatura eletrônica. Depois é só acompanhar as etapas e avaliar, com fotos." />
          </div>
        </div>

        <div>
          <div className="rounded-3xl overflow-hidden border border-[rgba(255,255,255,0.03)] shadow-lg">
            <img src={`${IMG}/how-flow.jpg`} alt="Acompanhamento da contratação por etapas" className="w-full h-96 object-cover object-top" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowCard({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[var(--accent,#7c3aed)] grid place-items-center font-bold">{number}</div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-[var(--muted,#9fb0c8)]">{body}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------- Features & Benefits (many cards + advantages) ----------------
function FeaturesAndBenefits() {
  const features = [
    { k: "chat", t: "Chat integrado", d: "Converse, envie anexos e negocie sem sair da plataforma.", v: "Redução de atrito" },
    { k: "schedule", t: "Agenda do serviço", d: "O prestador define os horários; o cliente escolhe um livre e não há reserva duplicada.", v: "Redução de atrito" },
    { k: "quote", t: "Pedido de orçamento", d: "O cliente descreve o que precisa, com orçamento e fotos; o prestador responde ou recusa com motivo.", v: "Redução de atrito" },
    { k: "contract", t: "Contrato digital", d: "Gerado a partir do acordo, com assinatura eletrônica das duas partes e impressão digital do conteúdo.", v: "Segurança jurídica" },
    { k: "consent", t: "Acordo com consentimento", d: "Cada item negociado precisa ser aceito pela outra parte — nada é fechado sozinho.", v: "Confiança" },
    { k: "reviews", t: "Avaliações dos dois lados", d: "Cliente avalia o prestador e o prestador avalia o cliente, com fotos do serviço.", v: "Confiança" },
    { k: "progress", t: "Acompanhamento por etapas", d: "Solicitado, em andamento, entregue e concluído — cada lado vê o que falta.", v: "Transparência" },
    { k: "profile", t: "Perfil público do prestador", d: "Serviços, disponibilidade, nível e avaliações em uma página só.", v: "Visibilidade" },
  ];

  return (
    <section className="py-20 bg-[linear-gradient(180deg,rgba(2,6,23,0.6),transparent)]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold">Recursos que geram valor</h2>
        <p className="mt-2 text-[var(--muted,#9fb0c8)] max-w-2xl">Cada funcionalidade foi desenhada para aumentar a confiança, reduzir atrito e acelerar a conversão.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <FeatureCard key={f.k} title={f.t} desc={f.d} value={f.v} />
          ))}
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-8">
          <BenefitPanel side="client" />
          <BenefitPanel side="provider" />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ title, desc, value }: { title: string; desc: string; value: string }) {
  return (
    <motion.div whileHover={{ y: -6 }} className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[var(--muted,#9fb0c8)]">{desc}</div>
      <div className="mt-4 text-xs text-[var(--muted,#8da6be)]">Vantagem: <span className="font-medium">{value}</span></div>
    </motion.div>
  );
}

function BenefitPanel({ side }: { side: "client" | "provider" }) {
  const clientBenefits = [
    { title: "Segurança", desc: "Contrato assinado pelas duas partes e acordo registrado item por item." },
    { title: "Rapidez", desc: "Contrate em poucos cliques, já escolhendo o horário." },
    { title: "Confiança", desc: "Avaliações reais, com fotos, de quem já contratou." },
  ];

  const providerBenefits = [
    { title: "Visibilidade", desc: "Perfil público e vitrine com filtros por categoria e nota." },
    { title: "Controle", desc: "Defina agenda, preço, se é negociável e o prazo de cancelamento." },
    { title: "Reputação", desc: "Avalie seus clientes e construa histórico a cada serviço." },
  ];

  const items = side === "client" ? clientBenefits : providerBenefits;
  const title = side === "client" ? "Vantagens para o cliente" : "Vantagens para o prestador";

  return (
    <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-[var(--muted,#9fb0c8)]">{side === "client" ? "O que o cliente ganha ao usar a Hire." : "O que o prestador ganha ao usar a Hire."}</p>

      <ul className="mt-6 space-y-4">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-[var(--brand,#00ffd1)] grid place-items-center font-bold">✓</div>
            <div>
              <div className="font-semibold">{it.title}</div>
              <div className="text-sm text-[var(--muted,#9fb0c8)]">{it.desc}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- Dual perspective (client vs provider narrative) ----------------
function DualPerspective() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-6 items-stretch">
        <div className="col-span-1">
          <h2 className="text-2xl font-bold">Duas perspectivas — mesmo objetivo</h2>
          <p className="mt-2 text-[var(--muted,#9fb0c8)]">A Hire. equilibra as necessidades de quem contrata e de quem presta — criando um ecossistema saudável.</p>
        </div>

        <PerspectiveCard title="Cliente" bullets={["Encontrar rápido","Pedir orçamento","Garantia via contrato"]} img={`${IMG}/perspective-client.jpg`} alt="Detalhe de um serviço visto pelo cliente" />
        <PerspectiveCard title="Prestador" bullets={["Responder pedidos","Controlar agenda","Acompanhar reservas"]} img={`${IMG}/perspective-provider.jpg`} alt="Painel Business do prestador" />
      </div>
    </section>
  );
}

function PerspectiveCard({ title, bullets, img, alt }: { title: string; bullets: string[]; img: string; alt: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.03)] bg-[rgba(255,255,255,0.02)]">
      <div className="p-6">
        <h3 className="font-semibold">{title}</h3>
        <ul className="mt-4 space-y-2 text-sm text-[var(--muted,#9fb0c8)]">
          {bullets.map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      </div>
      <div className="h-44 overflow-hidden">
        <img src={img} alt={alt} className="w-full h-full object-cover object-top" />
      </div>
    </div>
  );
}

// ---------------- Platform showcase (map/flow) ----------------
function PlatformShowcase() {
  return (
    <section className="py-20 bg-[linear-gradient(180deg,rgba(2,6,23,0.6),transparent)]">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-3xl font-bold">A plataforma por trás da conexão</h2>
          <p className="mt-3 text-[var(--muted,#9fb0c8)]">Reputação, disponibilidade e preço lado a lado para você escolher com segurança.</p>

          <ul className="mt-6 space-y-4">
            <li className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)]">Vitrine com filtros por categoria, nota mínima e preço</li>
            <li className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)]">Nota e nível do prestador calculados a partir de serviços concluídos</li>
            <li className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)]">Perfil público com serviços, disponibilidade semanal e avaliações</li>
          </ul>
        </div>

        <div>
          <div className="rounded-3xl overflow-hidden border border-[rgba(255,255,255,0.03)] shadow-lg">
            <img src={`${IMG}/platform-map.jpg`} alt="Perfil público de um prestador" className="w-full h-96 object-cover object-top" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Security & Tech ----------------
function SecurityTech() {
  const items = [
    { t: "Assinatura eletrônica", d: "Nome, aceite, data e a impressão digital (SHA-256) do contrato ficam registrados; as duas partes assinam o mesmo conteúdo." },
    { t: "Histórico da negociação", d: "Cada proposta, aceite e anexo fica no chat da negociação, com data e autor." },
    { t: "Acesso protegido", d: "Senhas com hash, sessão com token e cada contratação, conversa e contrato visível só para as partes." },
  ];

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-3xl font-bold">Segurança e tecnologia</h2>
          <p className="mt-2 text-[var(--muted,#9fb0c8)]">Tecnologia pensada para dar confiança a quem contrata e a quem presta.</p>

          <div className="mt-6 space-y-4">
            {items.map((it, i) => (
              <div key={i} className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
                <div className="font-semibold">{it.t}</div>
                <div className="text-sm text-[var(--muted,#9fb0c8)]">{it.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-3xl overflow-hidden border border-[rgba(255,255,255,0.03)] bg-[rgba(255,255,255,0.01)]">
            <img src={`${IMG}/security-diagram.jpg`} alt="Assinaturas registradas no contrato" className="w-full h-96 object-cover object-bottom" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------- Demo gallery / visual walkthrough ----------------
function DemoGallery() {
  const gallery = [
    { src: `${IMG}/demo-1.jpg`, alt: "Assistente de criação de serviço com agenda" },
    { src: `${IMG}/demo-2.jpg`, alt: "Pedido de orçamento do cliente" },
    { src: `${IMG}/demo-3.jpg`, alt: "Negociação com chat e itens do acordo" },
    { src: `${IMG}/demo-4.jpg`, alt: "Avaliações com fotos no perfil do prestador" },
  ];

  return (
    <section className="py-20 bg-[linear-gradient(180deg,transparent,rgba(2,6,23,0.6))]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold">Demonstração visual</h2>
        <p className="mt-2 text-[var(--muted,#9fb0c8)]">Telas reais do fluxo: criar serviço, pedir orçamento, negociar e avaliar.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gallery.map((g, i) => (
            <figure key={i} className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.03)]">
              <img src={g.src} alt={g.alt} loading="lazy" className="w-full h-48 object-cover object-top" />
              <figcaption className="px-3 py-2 text-xs text-[var(--muted,#9fb0c8)]">{g.alt}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- Testimonials ----------------
// Avaliações reais deixadas por clientes; sem avaliações com comentário, a seção não aparece
function Testimonials({ reviews }: { reviews: (ReviewEntity & { providerName: string })[] }) {
  const quotes = reviews.map((r) => ({
    name: getFirstAndLastName(r.author?.name ?? "Cliente"),
    role: `${"★".repeat(Math.round(r.rating))} · sobre ${r.providerName}`,
    quote: r.comment!.trim(),
  }));
  if (quotes.length === 0) return null;

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold">O que os usuários dizem</h2>
        <p className="mt-2 text-[var(--muted,#9fb0c8)]">Avaliações publicadas na plataforma.</p>
        <div className={`mt-8 grid gap-6 ${quotes.length >= 3 ? "md:grid-cols-3" : quotes.length === 2 ? "md:grid-cols-2" : "max-w-md mx-auto"}`}>
          {quotes.map((q, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)]">
              <div className="text-lg">“{q.quote}”</div>
              <div className="mt-4 font-semibold">{q.name}</div>
              <div className="text-sm text-[var(--muted,#9fb0c8)]">{q.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------- Footer CTA / AuthPage ----------------
function FooterCTA() {
  return (
    <footer id="auth" className="py-28 bg-gradient-to-t from-[rgba(2,6,23,1)] to-transparent">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl font-bold">Entre e descubra a experiência completa</h2>
        <p className="mt-3 text-[var(--muted,#9fb0c8)]">Entre ou crie sua conta para contratar serviços — ou cadastre sua empresa e comece a receber pedidos.</p>

        <div className="mt-8 w-full max-w-md mx-auto">
          <AuthPage embedded />
        </div>

        <div className="mt-6 text-sm text-[var(--muted,#9fb0c8)]">© {new Date().getFullYear()} Hire. — Plataforma de contratação e prestação de serviços</div>
      </div>
    </footer>
  );
}

// ---------------- End file ----------------
