import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ChatDockProvider } from "./components/Chat/ChatDock";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import Accessibility from "./components/Accessibility";
import EmailVerifyBanner from "./components/EmailVerifyBanner";

// Cada página vira um arquivo JS separado, baixado só quando a rota é aberta
// (o login não carrega mapa, gerador de PDF nem as partículas da apresentação)
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const DashboardPrestador = lazy(() => import("./pages/DashboardPrestador"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ApresentationPage = lazy(() => import("./pages/ApresentationPage"));
const NegotiationsPage = lazy(() => import("./pages/NegotiationsPage"));
const ServicePage = lazy(() => import("./pages/ServicePage"));
const PendingPage = lazy(() => import("./pages/PendingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const CategoryCityPage = lazy(() => import("./pages/CategoryCityPage"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const InviteLandingPage = lazy(() => import("./pages/InviteLandingPage"));
const ForgotPasswordPage = lazy(() => import("./pages/AccountPages").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/AccountPages").then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("./pages/AccountPages").then((m) => ({ default: m.VerifyEmailPage })));
const ProviderPublicPage = lazy(() => import("./pages/ProviderPublicPage"));
const ContractPreview = lazy(() => import("./components/ContractPreview").then((m) => ({ default: m.ContractPreview })));
const OpenChatRoute = lazy(() => import("./components/Chat/OpenChatRoute"));
const ServiceDashboardSophisticated = lazy(() => import("./pages/DashboardClient"));
const ServiceProgressContainer = lazy(() => import("./components/ServiceProgressContainer").then((m) => ({ default: m.ServiceProgressContainer })));

/** Enquanto o arquivo da página chega: um bloco discreto no lugar do conteúdo */
function PageLoading() {
  return (
    <div className="min-h-screen pt-28 px-6 bg-[var(--bg-dark)]" role="status" aria-label="Carregando página">
      <div className="max-w-5xl mx-auto h-40 rounded-2xl bg-[var(--bg-light)] animate-pulse" />
    </div>
  );
}
import { useSession } from "./context/SessionContext";

/** Rotas que exigem login: sem token, vai para a entrada e volta para cá depois de entrar. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useSession();
  const location = useLocation();
  if (!token) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

// "/" mostra a apresentação para visitantes; quem já entrou vai para a Home
/** Ao trocar de página, começa do topo (links com #âncora continuam indo para a seção) */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

function RootRedirect() {
  const { token } = useSession();
  return token ? <Navigate to="/home" replace /> : <ApresentationPage />;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  // sem login (apresentação, entrar/cadastrar) o tema é sempre o escuro;
  // depois de entrar vale a escolha da pessoa (guardada mesmo enquanto está deslogada)
  const { token } = useSession();
  const effectiveTheme = token ? theme : "dark";
  useEffect(() => {
    document.body.classList.toggle("light", effectiveTheme === "light");
  }, [effectiveTheme]);
  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Router>
      {/* conversas minimizadas acompanham todas as páginas */}
      <ChatDockProvider>
      <Accessibility/>
      <ScrollToTop />
      <Navbar theme={theme} setTheme={setTheme} />
      <EmailVerifyBanner />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Página inicial */}
          <Route path="/" element={<RootRedirect />} />

          {/* Rotas principais */}
          <Route path="/home" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/auth" element={<AuthPage />} />
          {/* Links enviados por e-mail */}
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/verificar-email" element={<VerifyEmailPage />} />
          <Route path="/apresentacao" element={<ApresentationPage />} />
          <Route path="/business" element={<RequireAuth><DashboardPrestador /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/ajuda" element={<RequireAuth><SupportPage /></RequireAuth>} />
          <Route path="/carteira" element={<RequireAuth><WalletPage /></RequireAuth>} />
          <Route path="/client" element={<RequireAuth><div className="pt-20"><ServiceDashboardSophisticated /></div></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><ServiceProgressContainer viewFor="provider" /></RequireAuth>} />
          <Route path="/hires" element={<RequireAuth><ServiceProgressContainer viewFor="client" /></RequireAuth>} />
          {/* Perfil público do prestador: aberto sem login; /provider/:id (links antigos) leva ao endereço canônico */}
          <Route path="/prestador/:slug" element={<ProviderPublicPage />} />
          <Route path="/provider/:id" element={<ProviderPublicPage />} />
          {/* páginas públicas por categoria + cidade (só com oferta real) */}
          <Route path="/servicos/:categoria/:cidade" element={<CategoryCityPage />} />
          {/* convites rastreáveis: criar (com login) e página pública do convite */}
          <Route path="/convidar" element={<RequireAuth><InvitePage /></RequireAuth>} />
          <Route path="/convite/:code" element={<InviteLandingPage />} />
          {/* Página pública do serviço: pode ser compartilhada e aberta sem login */}
          <Route path="/service/:id" element={<ServicePage />} />

          {/* Contratos */}
          <Route path="/contract/:id" element={<RequireAuth><ContractPreview /></RequireAuth>} />

          {/* Negociação e agendamento */}
          <Route path="/negotiations" element={<RequireAuth><NegotiationsPage /></RequireAuth>} />
          <Route path="/pendencias" element={<RequireAuth><PendingPage /></RequireAuth>} />
          {/* conversa: abre a sala única do chat por cima da página anterior */}
          <Route path="/negotiation/:id" element={<RequireAuth><OpenChatRoute /></RequireAuth>} />

          {/* Rota fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
      </ChatDockProvider>
    </Router>
  );
}
