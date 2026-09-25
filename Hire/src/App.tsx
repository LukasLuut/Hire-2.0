import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import Accessibility from "./components/Accessibility";

// Cada página vira um arquivo JS separado, baixado só quando a rota é aberta
// (o login não carrega mapa, gerador de PDF nem as partículas da apresentação)
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const DashboardPrestador = lazy(() => import("./pages/DashboardPrestador"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ApresentationPage = lazy(() => import("./pages/ApresentationPage"));
const NegotiationsPage = lazy(() => import("./pages/NegotiationsPage"));
const ServicePage = lazy(() => import("./pages/ServicePage"));
const ProviderPublicPage = lazy(() => import("./pages/ProviderPublicPage"));
const ContractPreview = lazy(() => import("./components/ContractPreview").then((m) => ({ default: m.ContractPreview })));
const NegotiationRoom = lazy(() => import("./components/Negotiation/NegotiationRoom"));
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

  useEffect(() => {
    const body = document.body;
    if (theme === "light") {
      body.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      body.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  }, [theme]);

  return (
    <Router>
      <Accessibility/>
      <Navbar theme={theme} setTheme={setTheme} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Página inicial */}
          <Route path="/" element={<RootRedirect />} />

          {/* Rotas principais */}
          <Route path="/home" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/apresentacao" element={<ApresentationPage />} />
          <Route path="/business" element={<RequireAuth><DashboardPrestador /></RequireAuth>} />
          <Route path="/client" element={<RequireAuth><div className="pt-20"><ServiceDashboardSophisticated /></div></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><ServiceProgressContainer viewFor="provider" /></RequireAuth>} />
          <Route path="/hires" element={<RequireAuth><ServiceProgressContainer viewFor="client" /></RequireAuth>} />
          <Route path="/provider/:id" element={<RequireAuth><ProviderPublicPage /></RequireAuth>} />
          {/* Página pública do serviço: pode ser compartilhada e aberta sem login */}
          <Route path="/service/:id" element={<ServicePage />} />

          {/* Contratos */}
          <Route path="/contract/:id" element={<RequireAuth><ContractPreview /></RequireAuth>} />

          {/* Negociação e agendamento */}
          <Route path="/negotiations" element={<RequireAuth><NegotiationsPage /></RequireAuth>} />
          <Route path="/negotiation/:id" element={<RequireAuth><NegotiationRoom /></RequireAuth>} />

          {/* Rota fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </Router>
  );
}
