import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, ChevronDown, DoorClosed, DoorOpen } from "lucide-react";
import { openInfo } from "../../utils/openStatus";
import { providerApi } from "../../api/ProviderAPI";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import type { ProviderEntity } from "../../interfaces/Entities";

/* --------------------------------------------------------------------------
 * OpenStatusChip — situação de atendimento no topo do perfil.
 * Visitante: só lê (Aberto / Fora do horário / Fechado / Fechado até).
 * Dono (Business): clicar abre o menu Aberto · Fechado · Fechado até <data>.
 * "Fora do horário" vem do expediente e não precisa ser escolhido.
 * -------------------------------------------------------------------------- */
const tone = {
  open: "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30",
  outsideHours: "bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]",
  closed: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  closedUntil: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
};

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function OpenStatusChip({ provider, editable, onChanged }: { provider: ProviderEntity; editable: boolean; onChanged?: () => void }) {
  const { showToast } = useToast();
  const info = openInfo(provider);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(provider.closedUntil ? String(provider.closedUntil).slice(0, 10) : tomorrow());
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // fecha o menu ao clicar fora ou com Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const save = async (status: "available" | "closed", closedUntil?: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setBusy(true);
    try {
      await providerApi.setStatus({ status, closedUntil }, token);
      showToast(
        status === "available" ? "Você está aberto para novos pedidos." : closedUntil ? `Fechado até ${new Date(closedUntil + "T00:00").toLocaleDateString("pt-BR")}. Reabre sozinho nesse dia.` : "Fechado. Clientes não conseguem fazer novos pedidos.",
        "success"
      );
      setOpen(false);
      onChanged?.();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível mudar a situação."), "error");
    } finally {
      setBusy(false);
    }
  };

  const chipClass = `px-3 py-1 rounded-full text-xs sm:text-sm border inline-flex items-center gap-1 whitespace-nowrap ${tone[info.kind]}`;
  if (!editable) return <span className={chipClass}>{info.label}</span>;

  const current = provider.status === "paused" ? (provider.closedUntil ? "closedUntil" : "closed") : "open";
  const item = "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-[var(--bg)] disabled:opacity-60";
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className={`${chipClass} hover:brightness-110`}>
        {info.label} <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 z-40 mt-2 w-64 p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-light)] shadow-xl text-[var(--text)]"
          >
            <button role="menuitemradio" aria-checked={current === "open"} disabled={busy} onClick={() => save("available")} className={item}>
              <DoorOpen size={16} className="text-[var(--primary)]" /> Aberto {current === "open" && <Check size={14} className="ml-auto" />}
            </button>
            <button role="menuitemradio" aria-checked={current === "closed"} disabled={busy} onClick={() => save("closed")} className={item}>
              <DoorClosed size={16} className="text-yellow-500" /> Fechado {current === "closed" && <Check size={14} className="ml-auto" />}
            </button>
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock size={16} className="text-yellow-500" /> Fechado até {current === "closedUntil" && <Check size={14} className="ml-auto" />}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  aria-label="Reabrir em"
                  value={date}
                  min={tomorrow()}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 min-w-0 p-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)]"
                />
                <button disabled={busy || !date} onClick={() => save("closed", date)} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm disabled:opacity-60">
                  Salvar
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">Férias ou recesso: reabre sozinho nessa data.</p>
            </div>
            <p className="px-3 pt-1 text-xs text-[var(--text-muted)] border-t border-[var(--border)] mt-1">
              "Fora do horário" aparece sozinho, pelo seu expediente.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
