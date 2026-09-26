import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Search, Star } from "lucide-react";
import { apiRequest } from "../../api/ApiClient";
import { useToast } from "../Toast/ToastContext";
import ConfirmModal from "../Common/ConfirmModal";
import { getErrorMessage } from "../../utils/errors";
import { formatDateTime } from "../../utils/format";
import { uploadUrl } from "../../utils/avatar";
import { adminBtn, adminInput } from "./adminStyles";

type AdminReview = {
  id: number;
  rating: number;
  comment: string | null;
  direction: "CLIENT_TO_PROVIDER" | "PROVIDER_TO_CLIENT";
  createdAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
  author: { id: number; name: string } | null;
  target: { name: string } | null;
  service: { id: number; title: string } | null;
  photos: { id: number; url: string }[];
};

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

/**
 * Administração: moderação de avaliações. Ocultar tira o comentário e as fotos do ar
 * (com motivo, avisando quem escreveu); a nota continua na média, para não virar
 * ferramenta de "limpar" reputação.
 */
export default function ReviewsTab() {
  const { showToast } = useToast();
  const [q, setQ] = useState("");
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [list, setList] = useState<AdminReview[] | null>(null);
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((query = "") => {
    setList(null);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (onlyHidden) params.set("hidden", "1");
    apiRequest<AdminReview[]>(`/admin/reviews?${params}`, { headers: auth() })
      .then((r) => setList(r ?? []))
      .catch((e) => showToast(getErrorMessage(e, "Erro ao carregar avaliações."), "error"));
  }, [onlyHidden, showToast]);
  useEffect(() => load(), [load]);

  const moderate = async (review: AdminReview, hidden: boolean) => {
    setBusy(true);
    try {
      await apiRequest(`/admin/reviews/${review.id}/moderate`, { method: "POST", headers: auth(), body: JSON.stringify({ hidden, reason }) });
      showToast(hidden ? "Comentário ocultado. Quem escreveu foi avisado." : "Comentário visível de novo.", "success");
      setTarget(null);
      load(q);
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível salvar."), "error");
    } finally {
      setBusy(false);
    }
  };

  const search = (e: FormEvent) => {
    e.preventDefault();
    load(q.trim());
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form onSubmit={search} className="flex gap-2">
          <input className={adminInput} placeholder="Texto, autor ou prestador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar avaliações" />
          <button className={adminBtn()} aria-label="Buscar"><Search size={16} /></button>
        </form>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyHidden} onChange={(e) => setOnlyHidden(e.target.checked)} /> Só ocultadas
        </label>
      </div>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? (
        <p className="text-[var(--text-muted)]">Nenhuma avaliação.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`p-4 rounded-xl border ${r.hiddenAt ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--border)] bg-[var(--bg-light)]"}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="flex items-center gap-1 font-semibold">
                  <Star size={14} className="text-yellow-400" fill="currentColor" aria-hidden /> {r.rating}
                </span>
                <span className="text-sm">
                  {r.author?.name ?? "—"} → {r.target?.name ?? "—"} {r.direction === "PROVIDER_TO_CLIENT" && <span className="text-xs text-[var(--text-muted)]">(prestador avaliou cliente)</span>}
                </span>
                <span className="text-xs text-[var(--text-muted)]">#{r.id} · {formatDateTime(r.createdAt)}{r.service ? ` · ${r.service.title}` : ""}</span>
              </div>
              {r.comment && <p className="text-sm mt-2 whitespace-pre-line">{r.comment}</p>}
              {r.photos.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {r.photos.map((p) => <img key={p.id} src={uploadUrl(p.url) ?? ""} alt="" className="w-16 h-16 rounded-lg object-cover" />)}
                </div>
              )}
              {r.hiddenAt && <p className="text-xs text-amber-500 mt-2">Oculta em {formatDateTime(r.hiddenAt)} · {r.hiddenReason}</p>}
              {(r.comment || r.photos.length > 0) && (
                <div className="mt-3">
                  {r.hiddenAt ? (
                    <button className={adminBtn()} disabled={busy} onClick={() => moderate(r, false)}>Mostrar de novo</button>
                  ) : (
                    <button className={adminBtn(false, true)} onClick={() => { setReason(""); setTarget(r); }}>Ocultar comentário</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ConfirmModal open danger title="Ocultar comentário?" confirmLabel="Ocultar" cancelLabel="Voltar" loading={busy} onConfirm={() => moderate(target, true)} onClose={() => setTarget(null)}
          description="O texto e as fotos saem do ar; a nota continua valendo. Quem escreveu recebe o motivo.">
          <label className="block text-sm mt-2">
            <span className="text-[var(--text-muted)]">Motivo</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className={`mt-1 w-full ${adminInput} resize-none`} />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}
