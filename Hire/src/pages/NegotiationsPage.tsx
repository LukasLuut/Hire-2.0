import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Handshake } from "lucide-react";
import { conversationAPI } from "../api/ConversationAPI";
import type { ConversationSummary } from "../interfaces/Entities";
import { avatarFor } from "../utils/avatar";
import { getFirstAndLastName } from "../utils/nameUtils";
import { formatDate } from "../utils/format";

/* --------------------------------------------------------------------------
 * Negociações — aba do navbar com todas as negociações do usuário
 * (como cliente ou prestador), separadas por situação. Cada item abre a
 * sala de negociação (/negotiation/:id).
 *
 * Versão inicial: lista simples, para evoluir depois (filtros, busca,
 * pedidos de orçamento em destaque etc.).
 * -------------------------------------------------------------------------- */

type Tab = "open" | "done" | "closed";

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "open", label: "Em andamento", empty: "Nenhuma negociação em andamento. Peça um orçamento em um serviço negociável." },
  { key: "done", label: "Finalizadas", empty: "Nenhuma negociação virou contrato ainda." },
  { key: "closed", label: "Recusadas e encerradas", empty: "Nenhuma negociação recusada ou encerrada." },
];

const tabOf = (c: ConversationSummary): Tab => (c.status === "OPEN" ? "open" : c.status === "FORMALIZED" ? "done" : "closed");

function situation(c: ConversationSummary) {
  if (c.status === "FORMALIZED") return "Contrato gerado";
  if (c.requestStatus === "RECUSADA") return "Pedido recusado";
  if (c.status === "CLOSED") return "Encerrada";
  if (c.requestStatus === "PENDENTE") return c.myRole === "prestador" ? "Orçamento a responder" : "Aguardando orçamento";
  if (c.requestStatus === "RESPONDIDA") return c.myRole === "cliente" ? "Orçamento recebido" : "Proposta enviada";
  const agreed = c.topics.filter((t) => t.state === "Acordado").length;
  return `${agreed}/${c.topics.length} itens acordados`;
}

export default function NegotiationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("open");

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setError(false);
    try {
      setItems(await conversationAPI.list(token));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { open: 0, done: 0, closed: 0 };
    (items ?? []).forEach((i) => c[tabOf(i)]++);
    return c;
  }, [items]);
  const visible = (items ?? []).filter((i) => tabOf(i) === tab);
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Handshake className="text-[var(--primary)]" /> Negociações
          </h1>
          <div role="tablist" aria-label="Situação" className="flex flex-wrap gap-1 p-1 rounded-full bg-[var(--bg-light)] border border-[var(--border)] self-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-full text-sm transition ${tab === t.key ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {t.label} {items && <span className="opacity-70">({counts[t.key]})</span>}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-[var(--text-muted)]">
            Não foi possível carregar suas negociações.{" "}
            <button onClick={load} className="text-[var(--primary)] underline">Tentar novamente</button>
          </p>
        ) : items === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-[var(--bg-light)] animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center rounded-2xl border border-[var(--border)] bg-[var(--bg-light)] text-[var(--text-muted)]">{current.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((c, i) => {
              const isClient = c.myRole === "cliente";
              const name = isClient ? c.provider?.companyName || c.provider?.professionalName : getFirstAndLastName(c.client?.name ?? "");
              const photo = isClient ? avatarFor(c.provider?.profileImageUrl, c.provider?.companyName) : avatarFor(null, c.client?.name);
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <button
                    onClick={() => navigate(`/negotiation/${c.id}`)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] hover:border-[var(--primary)] transition text-left"
                  >
                    <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold truncate">{c.service?.title ?? "Negociação direta"}</span>
                        <span className="text-xs text-[var(--text-muted)] shrink-0">{formatDate(c.updatedAt)}</span>
                      </div>
                      <div className="text-sm text-[var(--text-muted)] truncate">
                        {isClient ? "com" : "de"} {name ?? "Contato"} · você é {isClient ? "cliente" : "prestador"}
                      </div>
                      <div className="text-xs mt-1 text-[var(--primary)]">{situation(c)}</div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
