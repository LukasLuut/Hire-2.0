import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, MailCheck, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "../api/ApiClient";
import { useToast } from "../components/Toast/ToastContext";
import { useSession } from "../context/SessionContext";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * Telas de conta abertas pelos links enviados por e-mail:
 *   /esqueci-senha     — pede o link de redefinição
 *   /redefinir-senha   — cria a nova senha (token no link)
 *   /verificar-email   — confirma o e-mail (token no link)
 * -------------------------------------------------------------------------- */

const post = <T,>(path: string, body: unknown) =>
  apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[var(--bg-light)] border border-[var(--border)] shadow-2xl">
        <div className="text-[var(--primary)] mb-4">{icon}</div>
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        {children}
      </div>
    </div>
  );
}

const inputClass = "w-full p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const buttonClass = "w-full py-3 rounded-lg bg-[var(--primary)] text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post<{ message: string }>("/auth/forgot-password", { email: email.trim() });
      setSent(r.message);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível enviar agora."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<KeyRound size={36} />} title="Esqueci minha senha">
      {sent ? (
        <>
          <p className="text-[var(--text-muted)]">{sent}</p>
          <p className="text-sm text-[var(--text-muted)] mt-3">O link vale por 30 minutos. Confira também a caixa de spam.</p>
          <Link to="/auth" className="inline-block mt-6 text-[var(--primary)] underline">Voltar para a entrada</Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
          <label className="block">
            <span className="text-sm">E-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy && <Loader2 size={16} className="animate-spin" />} Enviar link
          </button>
          <Link to="/auth" className="block text-center text-sm text-[var(--text-muted)] hover:text-[var(--primary)]">Lembrei a senha</Link>
        </form>
      )}
    </Card>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const { showToast } = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      showToast("As senhas não são iguais.", "warning");
      return;
    }
    setBusy(true);
    try {
      await post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível alterar a senha."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Card icon={<XCircle size={36} />} title="Link incompleto">
        <p className="text-[var(--text-muted)]">Abra o link exatamente como veio no e-mail, ou peça um novo.</p>
        <Link to="/esqueci-senha" className="inline-block mt-6 text-[var(--primary)] underline">Pedir novo link</Link>
      </Card>
    );
  }

  return (
    <Card icon={done ? <CheckCircle2 size={36} /> : <KeyRound size={36} />} title={done ? "Senha alterada" : "Criar nova senha"}>
      {done ? (
        <>
          <p className="text-[var(--text-muted)]">Pronto. Entre com a nova senha.</p>
          <Link to="/auth" className={`${buttonClass} mt-6`}>Entrar</Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Mínimo de 6 caracteres, com letra maiúscula, minúscula, número e símbolo (@$!%*?&).</p>
          <label className="block">
            <span className="text-sm">Nova senha</span>
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="block">
            <span className="text-sm">Repita a nova senha</span>
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy && <Loader2 size={16} className="animate-spin" />} Salvar nova senha
          </button>
        </form>
      )}
    </Card>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { token: session, refresh } = useSession();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // o link é de uso único: não chama duas vezes
    started.current = true;
    post("/auth/verify-email", { token })
      .then(() => {
        setState("ok");
        refresh?.();
      })
      .catch((err) => {
        setState("error");
        setMessage(getErrorMessage(err, "Link inválido ou vencido."));
      });
  }, [token, refresh]);

  if (state === "loading") {
    return (
      <Card icon={<Loader2 size={36} className="animate-spin" />} title="Confirmando seu e-mail...">
        <p className="text-[var(--text-muted)]">Só um instante.</p>
      </Card>
    );
  }
  if (state === "error") {
    return (
      <Card icon={<XCircle size={36} />} title="Não foi possível confirmar">
        <p className="text-[var(--text-muted)]">{message}</p>
        <p className="text-sm text-[var(--text-muted)] mt-3">{session ? "Peça um novo link no aviso do topo da página." : "Entre na sua conta para pedir um novo link."}</p>
        <button onClick={() => navigate(session ? "/home" : "/auth")} className={`${buttonClass} mt-6`}>{session ? "Ir para o início" : "Entrar"}</button>
      </Card>
    );
  }
  return (
    <Card icon={<MailCheck size={36} />} title="E-mail confirmado">
      <p className="text-[var(--text-muted)]">Obrigado! Agora você recebe os avisos de pedidos, propostas e contratos.</p>
      <button onClick={() => navigate(session ? "/home" : "/auth")} className={`${buttonClass} mt-6`}>{session ? "Ir para o início" : "Entrar"}</button>
    </Card>
  );
}
