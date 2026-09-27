import { useState } from "react";
import ConfirmModal from "../Common/ConfirmModal";
import { reportAPI, REPORT_REASONS } from "../../api/ReportAPI";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";

/* --------------------------------------------------------------------------
 * ReportModal — "Relatar problema" num pedido ou "Denunciar perfil".
 * O relato vai para a administração; num pedido, as avaliações ficam
 * bloqueadas até a análise. Anexos (fotos/PDF) ficam privados.
 * -------------------------------------------------------------------------- */
export default function ReportModal({
  open,
  onClose,
  onSent,
  hireId,
  providerId,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  hireId?: number;
  providerId?: number;
  subject: string;
}) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return showToast("Escolha o tipo de problema.", "warning");
    if (description.trim().length < 10) return showToast("Descreva o problema com pelo menos 10 caracteres.", "warning");
    setBusy(true);
    try {
      await reportAPI.create({ hireId, providerId, reason, description: description.trim(), files });
      showToast("Relato enviado. A administração vai analisar e você será avisado.", "success");
      setReason("");
      setDescription("");
      setFiles([]);
      onSent?.();
      onClose();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível enviar o relato."), "error");
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]";
  return (
    <ConfirmModal
      open={open}
      title={hireId ? "Relatar problema" : "Denunciar perfil"}
      description={
        hireId
          ? `${subject}. A administração analisa o caso; enquanto isso, as avaliações deste pedido ficam bloqueadas e a outra parte é avisada.`
          : `${subject}. A denúncia é analisada pela administração e o perfil não é avisado.`
      }
      confirmLabel="Enviar relato"
      cancelLabel="Voltar"
      danger
      loading={busy}
      onConfirm={send}
      onClose={onClose}
    >
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-[var(--text-muted)]">O que aconteceu?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
            <option value="">Escolha…</option>
            {REPORT_REASONS.filter((r) => hireId || r.value !== "nao_compareceu").map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[var(--text-muted)]">Detalhes (datas, o que foi combinado, o que deu errado)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={4} className={`${field} resize-none`} />
        </label>
        <label className="block">
          <span className="text-[var(--text-muted)]">Provas (opcional, até 4 fotos ou PDF — só a administração vê)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
            className="mt-1 block w-full text-[var(--text-muted)]"
          />
        </label>
      </div>
    </ConfirmModal>
  );
}
