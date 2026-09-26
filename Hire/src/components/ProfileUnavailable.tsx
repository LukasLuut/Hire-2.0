import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Compass, Search, UserPlus, UserRoundX } from "lucide-react";
import { apiRequest } from "../api/ApiClient";

/* --------------------------------------------------------------------------
 * ProfileUnavailable — página para quem abre um perfil profissional que foi
 * desativado ou que não existe. Em vez de um erro seco, oferece caminhos:
 * buscar outros profissionais, explorar serviços por cidade e convidar alguém.
 * -------------------------------------------------------------------------- */
type Page = { categoryName: string; city: string; state: string; categorySlug: string; citySlug: string };

export default function ProfileUnavailable({ reason, loggedIn }: { reason: "deactivated" | "not_found"; loggedIn: boolean }) {
  const [explore, setExplore] = useState<Page[]>([]);

  useEffect(() => {
    document.title = "Perfil indisponível | Hire.";
    apiRequest<Page[]>("/discover").then((p) => setExplore(p.slice(0, 6))).catch(() => setExplore([]));
    return () => {
      document.title = "Hire.";
    };
  }, []);

  const deactivated = reason === "deactivated";
  return (
    <main className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8 flex items-start sm:items-center justify-center">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        aria-labelledby="unavailable-title"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-light)] p-8 sm:p-10 text-center shadow-xl"
      >
        {/* halo decorativo nas cores do tema */}
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-[var(--primary)]/20 blur-3xl" />

        <motion.div
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10"
        >
          <UserRoundX size={38} className="text-[var(--primary)]" aria-hidden />
        </motion.div>

        <h1 id="unavailable-title" className="relative mt-6 text-2xl sm:text-3xl font-bold">
          {deactivated ? "Este perfil profissional não está mais disponível" : "Não encontramos este perfil"}
        </h1>
        <p className="relative mt-3 text-[var(--text-muted)]">
          {deactivated
            ? "O profissional desativou o perfil no Hire e, por enquanto, não recebe novos pedidos. Há outros profissionais prontos para atender você."
            : "O endereço pode estar incompleto ou o perfil foi removido. Confira o link ou procure outros profissionais."}
        </p>

        <div className="relative mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={loggedIn ? "/home" : "/"}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold hover:brightness-110 transition"
          >
            <Search size={18} /> Buscar profissionais
          </Link>
          <Link
            to={loggedIn ? "/convidar?tipo=profissional" : `/auth?next=${encodeURIComponent("/convidar?tipo=profissional")}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition"
          >
            <UserPlus size={18} /> Convidar um profissional
          </Link>
        </div>

        {explore.length > 0 && (
          <nav aria-label="Explorar serviços por cidade" className="relative mt-8 pt-6 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)] flex items-center justify-center gap-2 mb-3">
              <Compass size={16} /> Explore serviços por cidade
            </p>
            <ul className="flex flex-wrap justify-center gap-2">
              {explore.map((p) => (
                <li key={`${p.categorySlug}-${p.citySlug}`}>
                  <Link
                    to={`/servicos/${p.categorySlug}/${p.citySlug}`}
                    className="inline-block px-3 py-1.5 rounded-full text-sm border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)] transition"
                  >
                    {p.categoryName} em {p.city}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </motion.section>
    </main>
  );
}
