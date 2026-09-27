import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Images, Pencil, Plus, Trash2 } from "lucide-react";
import ConfirmModal from "../Common/ConfirmModal";
import { useToast } from "../Toast/ToastContext";
import { providerApi } from "../../api/ProviderAPI";
import { getErrorMessage } from "../../utils/errors";
import { uploadUrl } from "../../utils/avatar";
import type { PortfolioItem, ServiceEntity } from "../../interfaces/Entities";

/* --------------------------------------------------------------------------
 * PortfolioManager — o prestador adiciona, edita, remove e ordena os
 * trabalhos que aparecem no perfil público. Ordem por botões (teclado ok).
 * -------------------------------------------------------------------------- */
const MAX_ITEMS = 30;
type Draft = { id?: number; title: string; description: string; serviceId: string; file: File | null; preview: string | null };
const empty: Draft = { title: "", description: "", serviceId: "", file: null, preview: null };

export default function PortfolioManager({
  items,
  services,
  onChange,
}: {
  items: PortfolioItem[] | null;
  services: ServiceEntity[];
  onChange: () => void;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<PortfolioItem | null>(null);
  const [busy, setBusy] = useState(false);
  const token = localStorage.getItem("token") ?? "";

  // libera a pré-visualização local ao trocar de foto ou fechar
  useEffect(() => () => { if (draft?.file && draft.preview) URL.revokeObjectURL(draft.preview); }, [draft?.preview, draft?.file]);

  const field = "mt-1 w-full p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]";

  const save = async () => {
    if (!draft) return;
    if (!draft.id && !draft.file) return showToast("Escolha uma foto do trabalho.", "warning");
    if (!draft.title.trim()) return showToast("Dê um título ao trabalho.", "warning");
    const body = new FormData();
    body.append("title", draft.title.trim());
    body.append("description", draft.description.trim());
    body.append("serviceId", draft.serviceId);
    if (draft.file) body.append("image", draft.file);
    setBusy(true);
    try {
      if (draft.id) await providerApi.updatePortfolio(draft.id, body, token);
      else await providerApi.addPortfolio(body, token);
      showToast(draft.id ? "Trabalho atualizado." : "Trabalho adicionado ao portfólio.", "success");
      setDraft(null);
      onChange();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível salvar."), "error");
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, delta: number) => {
    if (!items) return;
    const ids = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await providerApi.reorderPortfolio(ids, token);
      onChange();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível reordenar."), "error");
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await providerApi.removePortfolio(removing.id, token);
      showToast("Trabalho removido.", "success");
      setRemoving(null);
      onChange();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível remover."), "error");
    } finally {
      setBusy(false);
    }
  };

  const list = items ?? [];
  return (
    <section aria-labelledby="portfolio-manager-title" className="p-5 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 id="portfolio-manager-title" className="text-lg font-semibold flex items-center gap-2">
            <Images size={20} className="text-[var(--primary)]" /> Portfólio
          </h2>
          <p className="text-sm text-[var(--text-muted)]">Fotos de trabalhos que você já fez. Aparecem no seu perfil público, nesta ordem.</p>
        </div>
        {list.length < MAX_ITEMS && (
          <button onClick={() => setDraft({ ...empty })} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium flex items-center gap-2">
            <Plus size={18} /> Adicionar trabalho
          </button>
        )}
      </div>

      {items === null ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      ) : list.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-xl">
          <p className="text-sm text-[var(--text-muted)]">Nenhum trabalho no portfólio ainda.</p>
          <button onClick={() => setDraft({ ...empty })} className="mt-2 text-sm text-[var(--primary)] underline">Adicionar o primeiro</button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((item, i) => (
            <li key={item.id} className="flex gap-3 p-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <img src={uploadUrl(item.imageUrl) ?? item.imageUrl} alt="" loading="lazy" className="w-20 h-20 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm line-clamp-1">{item.title}</div>
                {item.service && <div className="text-xs text-[var(--text-muted)] line-clamp-1">{item.service.title}</div>}
                <div className="flex gap-1 mt-2">
                  <button aria-label={`Subir ${item.title}`} disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-40"><ArrowUp size={14} /></button>
                  <button aria-label={`Descer ${item.title}`} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-40"><ArrowDown size={14} /></button>
                  <button
                    aria-label={`Editar ${item.title}`}
                    onClick={() => setDraft({ id: item.id, title: item.title, description: item.description, serviceId: item.service ? String(item.service.id) : "", file: null, preview: uploadUrl(item.imageUrl) ?? item.imageUrl })}
                    className="p-1.5 rounded-lg border border-[var(--border)]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button aria-label={`Remover ${item.title}`} onClick={() => setRemoving(item)} className="p-1.5 rounded-lg border border-[var(--border)] hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <ConfirmModal
          open
          title={draft.id ? "Editar trabalho" : "Novo trabalho no portfólio"}
          confirmLabel="Salvar"
          cancelLabel="Voltar"
          loading={busy}
          onConfirm={save}
          onClose={() => setDraft(null)}
        >
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-[var(--text-muted)]">Foto {draft.id ? "(opcional: troque se quiser)" : ""}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setDraft((d) => d && { ...d, file, preview: file ? URL.createObjectURL(file) : d.preview });
                }}
                className="mt-1 block w-full text-[var(--text-muted)]"
              />
            </label>
            {draft.preview && <img src={draft.preview} alt="Pré-visualização" className="w-full max-h-48 object-cover rounded-lg" />}
            <label className="block">
              <span className="text-[var(--text-muted)]">Título</span>
              <input value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={field} placeholder="Ex.: Quadro de distribuição novo" />
            </label>
            <label className="block">
              <span className="text-[var(--text-muted)]">Descrição (opcional)</span>
              <textarea value={draft.description} maxLength={300} rows={3} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`${field} resize-none`} />
            </label>
            {services.length > 0 && (
              <label className="block">
                <span className="text-[var(--text-muted)]">Serviço relacionado (opcional)</span>
                <select value={draft.serviceId} onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })} className={field}>
                  <option value="">Nenhum</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </label>
            )}
          </div>
        </ConfirmModal>
      )}

      {removing && (
        <ConfirmModal
          open
          title={`Remover "${removing.title}"?`}
          description="A foto sai do seu perfil público."
          confirmLabel="Remover"
          cancelLabel="Voltar"
          danger
          loading={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
