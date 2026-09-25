import { useEffect, useState, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProfilePage from "./pages/ProfilePage";
import DashboardPrestador from "./pages/DashboardPrestador";
import AuthPage from "./pages/AuthPage";
import ProviderPublicPage from "./pages/ProviderPublicPage";
// import ContractViewer from "./components/ContractViwer";
import { ContractPreview } from "./components/ContractPreview";
import NegotiationRoom from "./components/Negotiation/NegotiationRoom";
import ScheduleConfigurator from "./components/Schedule";
import ServiceDashboardSophisticated from "./pages/DashboardClient";
import Accessibility from "./components/Accessibility";
import { ServiceProgressContainer } from "./components/ServiceProgressContainer";
import { useSession } from "./context/SessionContext";

/** Rotas que exigem login: sem token, volta para a tela de entrada. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useSession();
  if (!token) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { token } = useSession();
  return <Navigate to={token ? "/home" : "/auth"} replace />;
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
        <Routes>
          {/* Página inicial */}
          <Route path="/" element={<RootRedirect />} />

          {/* Rotas principais */}
          <Route path="/home" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/business" element={<RequireAuth><DashboardPrestador /></RequireAuth>} />
          <Route path="/client" element={<RequireAuth><div className="pt-20"><ServiceDashboardSophisticated /></div></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><ServiceProgressContainer viewFor="provider" /></RequireAuth>} />
          <Route path="/hires" element={<RequireAuth><ServiceProgressContainer viewFor="client" /></RequireAuth>} />
          <Route path="/provider/:id" element={<RequireAuth><ProviderPublicPage /></RequireAuth>} />

          {/* Contratos */}
          {/* <Route path="/contract/viewer" element={<ContractViewer />} /> */}
          <Route path="/contract/:id" element={<RequireAuth><ContractPreview /></RequireAuth>} />

          {/* Negociação e agendamento */}
          <Route path="/negotiation" element={<NegotiationRoom />} />
          <Route path="/schedule" element={<ScheduleConfigurator />} />

          {/* Rota fallback */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </main>
    </Router>
  );
}
