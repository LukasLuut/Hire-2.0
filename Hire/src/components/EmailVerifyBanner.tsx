import { useState } from "react";
import { MailWarning, X } from "lucide-react";
import { apiRequest } from "../api/ApiClient";
import { useSession } from "../context/SessionContext";
import { useToast } from "./Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";

/** Aviso fixo abaixo do menu enquanto o e-mail da conta não foi confirmado. */
export default function EmailVerifyBanner() {
  const { user, token } = useSession();
  const { showToast } = useToast();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token || !user || user.emailVerified !== false || hidden) return null;

  const resend = async () => {
    setBusy(true);
    try {
      await apiRequest("/auth/resend-verification", { method: "POST", headers: { Authorization: "Bearer " + token } });
      showToast(`Enviamos um novo link para ${user.email}.`, "success");
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível reenviar agora."), "warning");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" className="fixed top-[65px] inset-x-0 z-40 bg-amber-500/15 border-b border-amber-500/40 text-[var(--text)] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <MailWarning size={16} className="text-amber-500 shrink-0" aria-hidden />
        <span className="flex-1 min-w-[12rem]">Confirme seu e-mail: enviamos um link para <strong>{user.email}</strong>.</span>
        <button onClick={resend} disabled={busy} className="underline text-[var(--primary)] disabled:opacity-60">Reenviar link</button>
        <button onClick={() => setHidden(true)} aria-label="Fechar aviso" className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={16} /></button>
      </div>
    </div>
  );
}
