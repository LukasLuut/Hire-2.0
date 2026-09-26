import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supportAPI, SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, type SupportStatus, type SupportTicket } from "../../api/SupportAPI";
import { useToast } from "../Toast/ToastContext";
import ConfirmModal from "../Common/ConfirmModal";
import { getErrorMessage } from "../../utils/errors";
import { formatDateTime } from "../../utils/format";
import { adminBtn, adminInput } from "./adminStyles";

/** Administração: chamados de suporte — responder, marcar em atendimento, encerrar. */
export default function SupportTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<string>("ABERTO");
  const [list, setList] = useState<SupportTicket[] | null>(null);
  const [target, setTarget] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [next, setNext] = useState<SupportStatus>("RESOLVIDO");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setList(null);
    supportAPI.adminList(status).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar chamados."), "error"));
  }, [status, showToast]);
  useEffect(load, [load]);

  const save = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await supportAPI.answer(target.id, next, reply.trim());
      showToast("Chamado atualizado. A pessoa foi avisada.", "success");
      setTarget(null);
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível salvar."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-[var(--text-muted)]">Situação</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={adminInput}>
          {Object.entries(SUPPORT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="">Todos</option>
        </select>
      </label>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? (
        <p className="text-[var(--text-muted)]">{status === "ABERTO" ? "Nenhum chamado aguardando resposta." : "Nenhum chamado."}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((t) => (
            <li key={t.id} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{t.subject}</span>
                <span className="text-xs text-[var(--text-muted)]">#{t.id} · {SUPPORT_CATEGORY_LABEL[t.category]} · {formatDateTime(t.createdAt)}</span>
                {t.status !== "ABERTO" && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)]">{SUPPORT_STATUS_LABEL[t.status]}</span>}
              </div>
              <p className="text-sm mt-1">{t.user?.name} ({t.user?.email})</p>
              <p className="text-sm mt-2 whitespace-pre-line">{t.message}</p>
              {t.reply && <p className="text-sm mt-2 text-[var(--text-muted)] whitespace-pre-line">Resposta: {t.reply}</p>}
              {t.status !== "RESOLVIDO" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className={adminBtn(true)} onClick={() => { setReply(t.reply ?? ""); setNext("RESOLVIDO"); setTarget(t); }}>Responder</button>
                  {t.status === "ABERTO" && (
                    <button className={adminBtn()} onClick={async () => {
                      try { await supportAPI.answer(t.id, "EM_ATENDIMENTO", ""); load(); } catch (e) { showToast(getErrorMessage(e, "Erro."), "error"); }
                    }}>Em atendimento</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ConfirmModal open title={`Responder: ${target.subject}`} confirmLabel="Enviar resposta" cancelLabel="Voltar" loading={busy} onConfirm={save} onClose={() => setTarget(null)}>
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Resposta (a pessoa recebe por notificação)</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} maxLength={2000} className={`mt-1 w-full ${adminInput} resize-y`} />
          </label>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={next === "RESOLVIDO"} onChange={(e) => setNext(e.target.checked ? "RESOLVIDO" : "EM_ATENDIMENTO")} />
            Encerrar o chamado com esta resposta
          </label>
        </ConfirmModal>
      )}
    </>
  );
}
