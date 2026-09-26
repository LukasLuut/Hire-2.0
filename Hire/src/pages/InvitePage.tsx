import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, UserPlus, Users } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { inviteAPI, type InviteKind, type InviteLink, type MyInvite } from "../api/InviteAPI";
import { useToast } from "../components/Toast/ToastContext";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * /convidar — convites rastreáveis (diferente de só compartilhar uma página):
 * cada link tem código, e a pessoa vê quantos se cadastraram por ele e quantos
 * fizeram o que o convite propunha (criar empresa / fazer o primeiro pedido).
 * ?tipo=profissional|cliente&categoria=&cidade= preenche a partir de uma busca.
 * -------------------------------------------------------------------------- */
const KIND_TEXT: Record<InviteKind, { title: string; hint: string; message: (ctx: string) => string }> = {
  provider: {
    title: "Convidar um profissional",
    hint: "Conhece alguém que presta esse serviço? Com o Hire ele ganha página própria, avaliações e pedidos de orçamento.",
    message: (ctx) => `Oi! Estou usando o Hire para contratar serviços${ctx ? ` (${ctx})` : ""}. Cadastre seus serviços por lá, é gratuito:`,
  },
  client: {
    title: "Convidar um cliente ou amigo",
    hint: "Indique o Hire para quem precisa contratar serviços com avaliações e orçamento pelo app.",
    message: () => "Oi! Estou usando o Hire para encontrar e contratar serviços. Dá uma olhada:",
  },
};

export default function InvitePage() {
  const [params] = useSearchParams();
  const { showToast } = useToast();
  const initialKind: InviteKind = params.get("tipo") === "cliente" ? "client" : "provider";
  const initialContext = [params.get("categoria"), params.get("cidade") && `em ${params.get("cidade")}`].filter(Boolean).join(" ");
  const [kind, setKind] = useState<InviteKind>(initialKind);
  const [context, setContext] = useState(initialContext);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mine, setMine] = useState<MyInvite[] | null>(null);

  const loadMine = useCallback(() => {
    inviteAPI.mine().then(setMine).catch(() => setMine([]));
  }, []);
  useEffect(loadMine, [loadMine]);

  const generate = async () => {
    setBusy(true);
    try {
      setLink(await inviteAPI.create(kind, kind === "provider" ? context : ""));
      setCopied(false);
      loadMine();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível criar o convite."), "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      showToast("Link do convite copiado.", "success");
    } catch {
      showToast("Não foi possível copiar. Selecione o link e copie manualmente.", "warning");
    }
  };

  const text = KIND_TEXT[kind];
  const field = "mt-1 w-full p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]";

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <UserPlus className="text-[var(--primary)]" /> Convidar para o Hire
        </h1>
        <p className="text-[var(--text-muted)] mb-6">Gere um link de convite. Você acompanha quem se cadastrou por ele.</p>

        <div role="radiogroup" aria-label="Quem você quer convidar" className="grid grid-cols-2 gap-2 mb-4">
          {(["provider", "client"] as InviteKind[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => { setKind(k); setLink(null); }}
              className={`p-3 rounded-xl border text-sm font-medium transition ${kind === k ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-[var(--bg-light)] hover:border-[var(--primary)]"}`}
            >
              {k === "provider" ? "Um profissional" : "Um cliente ou amigo"}
            </button>
          ))}
        </div>

        <section className="p-5 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
          <h2 className="font-semibold">{text.title}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">{text.hint}</p>
          {kind === "provider" && (
            <label className="block mt-3 text-sm">
              <span className="text-[var(--text-muted)]">Que serviço essa pessoa faz? (opcional)</span>
              <input value={context} maxLength={120} onChange={(e) => { setContext(e.target.value); setLink(null); }} placeholder="Ex.: eletricista em São Leopoldo" className={field} />
            </label>
          )}
          {!link ? (
            <button onClick={generate} disabled={busy} className="mt-4 px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-medium disabled:opacity-60">
              {busy ? "Gerando…" : "Gerar link de convite"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm break-all" aria-label="Link do convite">{link.url}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] inline-flex items-center gap-2 text-sm">
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />} {copied ? "Copiado!" : "Copiar link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${text.message(link.context)}\n${link.url}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] inline-flex items-center gap-2 text-sm"
                >
                  <FaWhatsapp size={16} className="text-green-500" /> Enviar pelo WhatsApp
                </a>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="my-invites" className="mt-8">
          <h2 id="my-invites" className="font-semibold flex items-center gap-2 mb-3"><Users size={18} className="text-[var(--primary)]" /> Seus convites</h2>
          {mine === null ? (
            <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Você ainda não criou convites.</p>
          ) : (
            <ul className="space-y-2">
              {mine.map((i) => (
                <li key={i.id} className="p-3 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] text-sm flex flex-wrap justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{i.kind === "provider" ? "Profissional" : "Cliente"}{i.context ? ` — ${i.context}` : ""}</div>
                    <div className="text-xs text-[var(--text-muted)] break-all">{i.url}</div>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {i.signups} cadastro(s) · {i.converted} {i.kind === "provider" ? "com empresa criada" : "com pedido feito"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
