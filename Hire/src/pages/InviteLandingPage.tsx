import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { inviteAPI, savePendingInvite, type InviteInfo } from "../api/InviteAPI";
import { useSession } from "../context/SessionContext";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * /convite/:code — página pública de um convite. Guarda o código (30 dias)
 * para o cadastro ser atribuído a quem convidou, e leva ao cadastro certo:
 * profissional → cadastro da empresa; cliente → busca de serviços.
 * -------------------------------------------------------------------------- */
export default function InviteLandingPage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { token } = useSession();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inviteAPI
      .info(code)
      .then((i) => {
        setInfo(i);
        savePendingInvite(code);
        document.title = "Você foi convidado para o Hire.";
      })
      .catch((e) => setError(getErrorMessage(e, "Convite não encontrado.")));
  }, [code]);

  const next = info?.kind === "provider" ? "/home?prestador=1" : "/home";
  const go = () => navigate(token ? next : `/auth?cadastro=1&next=${encodeURIComponent(next)}`);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 px-6 text-center text-[var(--text)]">
        <h1 className="text-2xl font-semibold">{error}</h1>
        <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white">Conhecer o Hire</Link>
      </div>
    );
  }
  if (!info) return <div className="min-h-screen bg-[var(--bg-dark)] pt-32 text-center text-[var(--text-muted)]">Carregando convite…</div>;

  const provider = info.kind === "provider";
  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-xl mx-auto text-center p-8 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
        <UserPlus size={40} className="mx-auto text-[var(--primary)]" />
        <h1 className="text-2xl md:text-3xl font-bold mt-4">{info.inviterFirstName} convidou você para o Hire</h1>
        {provider ? (
          <p className="text-[var(--text-muted)] mt-3">
            {info.context ? <>Alguém procura <strong className="text-[var(--text)]">{info.context}</strong>. </> : null}
            Cadastre seus serviços e tenha uma página profissional com link próprio, QR Code, portfólio e avaliações de clientes.
          </p>
        ) : (
          <p className="text-[var(--text-muted)] mt-3">Encontre profissionais perto de você, veja avaliações, peça orçamento e contrate pelo app.</p>
        )}
        <button onClick={go} className="mt-6 px-6 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold">
          {token ? (provider ? "Cadastrar minha empresa" : "Ver serviços") : "Criar minha conta grátis"}
        </button>
        {!token && <p className="text-xs text-[var(--text-muted)] mt-3">Já tem conta? <Link to={`/auth?next=${encodeURIComponent(next)}`} className="text-[var(--primary)] underline">Entrar</Link></p>}
      </div>
    </div>
  );
}
