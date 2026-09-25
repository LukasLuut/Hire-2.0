import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { userAPI } from "../api/UserAPI";
import { providerApi } from "../api/ProviderAPI";
import type { User } from "../interfaces/UserInterface";
import type { ProviderEntity } from "../interfaces/Entities";

/* --------------------------------------------------------------------------
 * SessionContext — quem está logado e se é prestador.
 * Centraliza token, usuário e prestador para a navegação e as páginas não
 * precisarem adivinhar (antes cada página buscava e guardava flags soltas).
 * -------------------------------------------------------------------------- */
interface SessionData {
  token: string | null;
  user: User | null;
  provider: ProviderEntity | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionData | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState<ProviderEntity | null>(null);
  const [loading, setLoading] = useState<boolean>(!!token);

  const refresh = useCallback(async () => {
    const current = localStorage.getItem("token");
    if (!current) {
      setUser(null);
      setProvider(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const u = await userAPI.getUser(current);
      setUser(u);
      try {
        setProvider((await providerApi.getByUser(current)) as unknown as ProviderEntity);
      } catch {
        // 404 = o usuário ainda não é prestador
        setProvider(null);
      }
    } catch {
      setUser(null);
      setProvider(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [token, refresh]);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("provider");
    setToken(null);
    setUser(null);
    setProvider(null);
  }, []);

  return (
    <SessionContext.Provider value={{ token, user, provider, loading, login, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
