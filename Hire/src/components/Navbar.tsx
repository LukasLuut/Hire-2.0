import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X, Sun, Moon, LogOut, LifeBuoy, Home, ClipboardList, Handshake, ListTodo, Briefcase, Shield, Wallet, MessageCircle,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import NotificationBell from "./NotificationBell";
import { useChatDock } from "./Chat/chatDockContext";

type Item = { label: string; to: string; icon: ComponentType<{ size?: number }> };

/** Botão só com ícone; o nome aparece depois de 1 s com o mouse em cima (ou no foco pelo teclado) */
function IconTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded-md text-xs
                   bg-[var(--bg-light)] border border-[var(--border)] text-[var(--text)] shadow-lg
                   opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-1000 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

const iconBtn = "p-2 rounded-full border border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)] transition hover:border-[var(--highlight)] shadow-lg";

export default function Navbar({ theme, setTheme }: { theme: string; setTheme: (t: "dark" | "light") => void }) {
  const [open, setOpen] = useState(false);
  const { token, provider, user, logout } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const { unreadCount, openInbox } = useChatDock();

  // "Business" e "Carteira" só aparecem para quem já é prestador
  const links: Item[] = token
    ? [
        { label: "Home", to: "/home", icon: Home },
        { label: "Contratações", to: "/hires", icon: ClipboardList },
        { label: "Negociações", to: "/negotiations", icon: Handshake },
        { label: "Pendências", to: "/pendencias", icon: ListTodo },
        ...(provider ? [{ label: "Business", to: "/business", icon: Briefcase }, { label: "Carteira", to: "/carteira", icon: Wallet }] : []),
        ...(user?.isAdmin ? [{ label: "Admin", to: "/admin", icon: Shield }] : []),
        { label: "Ajuda", to: "/ajuda", icon: LifeBuoy },
      ]
    : [];

  // fecha ao navegar, com Esc ou clicando fora
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [open]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/auth");
  };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `transition hover:text-[var(--text-highlight)] ${isActive ? "text-[var(--primary)]" : "text-[var(--text)]"}`;

  // itens da cascata, do mais perto do botão de menu para o mais longe
  const cascade = [
    ...links.slice(0, 1).map((l) => ({ ...l, kind: "link" as const })),
    { label: unreadCount ? `Conversas (${unreadCount} novas)` : "Conversas", to: "", icon: MessageCircle, kind: "chat" as const },
    ...links.slice(1).map((l) => ({ ...l, kind: "link" as const })),
    { label: theme === "dark" ? "Modo claro" : "Modo escuro", to: "", icon: theme === "dark" ? Sun : Moon, kind: "theme" as const },
    { label: "Sair", to: "", icon: LogOut, kind: "logout" as const },
  ];

  return (
    <nav className="fixed w-full z-50 bg-[var(--bg-dark)]/70 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo: volta para a Home */}
        <Link to={token ? "/home" : "/"} className="text-xl font-bold text-[var(--text)] hover:text-[var(--primary)] transition" aria-label="Hire. — ir para a Home">
          Hire.
        </Link>

        {/* Direita: sino + menu (o menu abre para a esquerda só com ícones) */}
        <div className="flex items-center gap-2" ref={menuRef}>
          {token ? (
            <>
              <div className="relative hidden md:block">
                <AnimatePresence>
                  {open && (
                    <motion.ul
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-2"
                      initial="hidden"
                      animate="shown"
                      exit="hidden"
                      aria-label="Menu"
                    >
                      {cascade.map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <motion.li
                            // chave estável: o rótulo do tema muda ao clicar e recriaria o item invisível
                            key={item.kind === "link" ? item.to : item.kind}
                            variants={{ hidden: { opacity: 0, x: 16 }, shown: { opacity: 1, x: 0, transition: { delay: (cascade.length - 1 - i) * 0.03 } } }}
                          >
                            <IconTip label={item.label}>
                              {item.kind === "link" ? (
                                <NavLink
                                  to={item.to}
                                  aria-label={item.label}
                                  className={({ isActive }) => `${iconBtn} flex ${isActive ? "!bg-[var(--primary)] !border-[var(--primary)] !text-white" : ""}`}
                                >
                                  <Icon size={20} />
                                </NavLink>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={item.label}
                                  onClick={item.kind === "chat" ? () => { setOpen(false); openInbox(); } : item.kind === "theme" ? toggleTheme : handleLogout}
                                  className={`${iconBtn} flex relative`}
                                >
                                  <Icon size={20} />
                                  {item.kind === "chat" && unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">{unreadCount}</span>
                                  )}
                                </button>
                              )}
                            </IconTip>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              <NotificationBell onNavigate={() => setOpen(false)} />
              <button onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : unreadCount ? `Abrir menu (${unreadCount} conversas novas)` : "Abrir menu"} aria-expanded={open} className={`${iconBtn} relative`}>
                {open ? <X size={20} /> : <Menu size={20} />}
                {!open && unreadCount > 0 && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-600 ring-2 ring-[var(--bg-dark)]" aria-hidden />}
              </button>
            </>
          ) : null /* sem login o tema é fixo (escuro): a troca só aparece depois de entrar */}
        </div>
      </div>

      {/* Celular: lista com nomes */}
      <AnimatePresence>
        {token && open && (
          <motion.div
            className="md:hidden bg-[var(--bg-dark)]/95 backdrop-blur-md border-t border-[var(--border)] flex flex-col gap-4 px-6 py-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button onClick={() => { setOpen(false); openInbox(); }} className="flex items-center gap-3 text-[var(--text)]">
              <MessageCircle size={18} /> Conversas{unreadCount ? <span className="ml-1 px-1.5 rounded-full bg-red-600 text-white text-xs">{unreadCount}</span> : null}
            </button>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass}>
                <span className="flex items-center gap-3"><link.icon size={18} /> {link.label}</span>
              </NavLink>
            ))}
            <button onClick={toggleTheme} className="flex items-center gap-3 text-[var(--text)]">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />} {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-3 text-[var(--text)]">
              <LogOut size={18} /> Sair
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
