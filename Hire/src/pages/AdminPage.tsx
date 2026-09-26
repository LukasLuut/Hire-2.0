import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Shield, Search, Loader2 } from "lucide-react";
import { adminAPI, type AdminVerification, type RegionData, type AdminCategory, type AdminHire, type AdminOverview, type AdminService, type AdminUser } from "../api/AdminAPI";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast/ToastContext";
import ConfirmModal from "../components/Common/ConfirmModal";
import { getErrorMessage } from "../utils/errors";
import { formatCurrency, formatDateTime } from "../utils/format";
import { reportAPI, reasonLabel, type ReportItem } from "../api/ReportAPI";

/* --------------------------------------------------------------------------
 * /admin — painel mínimo de administração.
 * Números da plataforma, suspensão de contas, papel de administrador,
 * moderação de serviços, pedidos recentes e categorias.
 * -------------------------------------------------------------------------- */
type Tab = "overview" | "regions" | "reports" | "verifications" | "users" | "services" | "hires" | "categories";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "regions", label: "Regiões" },
  { id: "reports", label: "Denúncias" },
  { id: "verifications", label: "Verificações" },
  { id: "users", label: "Usuários" },
  { id: "services", label: "Serviços" },
  { id: "hires", label: "Pedidos" },
  { id: "categories", label: "Categorias" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Aguardando resposta",
  ACEITO: "Aceitos",
  "EM ANDAMENTO": "Em andamento",
  CONCLUIDO: "Entregues",
  CANCELADO: "Cancelados",
};

const input = "p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]";
const btn = (primary = false, danger = false) =>
  `px-3 py-1.5 rounded-lg text-sm border transition disabled:opacity-60 ${
    danger ? "border-red-500/50 text-red-500 hover:bg-red-500/10" : primary ? "bg-[var(--primary)] text-white border-[var(--primary)] hover:brightness-110" : "border-[var(--border)] hover:border-[var(--primary)]"
  }`;

export default function AdminPage() {
  const { user, loading } = useSession();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) return <div className="min-h-screen pt-28 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user?.isAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-28 pb-16 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-6">
          <Shield className="text-[var(--primary)]" /> Administração
        </h1>
        <div role="tablist" aria-label="Seções da administração" className="flex gap-2 overflow-x-auto mb-6 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap border transition ${tab === t.id ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "border-[var(--border)] bg-[var(--bg-light)] hover:border-[var(--primary)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <section role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === "overview" && <OverviewTab />}
          {tab === "regions" && <RegionsTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "verifications" && <VerificationsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "services" && <ServicesTab />}
          {tab === "hires" && <HiresTab />}
          {tab === "categories" && <CategoriesTab />}
        </section>
      </div>
    </div>
  );
}

/* ----------------------------- Visão geral ----------------------------- */
function OverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    adminAPI.overview().then(setData).catch((e) => setError(getErrorMessage(e, "Não foi possível carregar.")));
  }, []);
  if (error) return <p className="text-red-500">{error}</p>;
  if (!data) return <Loader2 className="animate-spin" />;
  const cards: [string, number, string?][] = [
    ["Usuários", data.users, data.blocked ? `${data.blocked} suspenso(s)` : undefined],
    ["Prestadores", data.providers],
    ["Serviços", data.services, data.pausedServices ? `${data.pausedServices} pausado(s)` : undefined],
    ["Verificações pendentes", data.pendingVerifications, data.pendingVerifications ? "aguardando análise" : undefined],
    ["Denúncias abertas", data.openReports, data.openReports ? "aguardando análise" : undefined],
    ["Cancelamentos em cima da hora", data.lateCancels],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([label, value, note]) => (
          <div key={label} className="p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
            <div className="text-sm text-[var(--text-muted)]">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {note && <div className="text-xs text-amber-500 mt-1">{note}</div>}
          </div>
        ))}
      </div>
      <div className="p-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)]">
        <h2 className="font-semibold mb-3">Pedidos por etapa</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          {Object.keys(STATUS_LABEL).map((s) => (
            <div key={s}>
              <dt className="text-[var(--text-muted)]">{STATUS_LABEL[s]}</dt>
              <dd className="text-lg font-semibold">{data.hires[s] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ----------------------------- Busca comum ----------------------------- */
function SearchBar({ placeholder, onSearch }: { placeholder: string; onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(q);
  };
  return (
    <form onSubmit={submit} role="search" className="flex gap-2 mb-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${input} flex-1`} />
      <button className={`${btn(true)} flex items-center gap-1`}><Search size={16} /> Buscar</button>
    </form>
  );
}

/* ----------------------------- Usuários ----------------------------- */
function UsersTab() {
  const { user: me } = useSession();
  const { showToast } = useToast();
  const [list, setList] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((q: string) => {
    setQuery(q);
    adminAPI.users(q).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao buscar usuários."), "error"));
  }, [showToast]);
  useEffect(() => load(""), [load]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(done, "success");
      setTarget(null);
      load(query);
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível concluir."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SearchBar placeholder="Nome ou e-mail" onSearch={load} />
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? <p className="text-[var(--text-muted)]">Nenhum usuário encontrado.</p> : (
        <ul className="space-y-2">
          {list.map((u) => (
            <li key={u.id} className="p-3 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48">
                <div className="font-medium">
                  {u.name}
                  {u.role === "admin" && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)]">admin</span>}
                  {u.blocked && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">suspenso</span>}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {u.email}{u.provider ? ` · prestador: ${u.provider.name}` : ""}{u.emailVerified ? "" : " · e-mail não confirmado"}
                </div>
                {u.blocked && u.blockedReason && <div className="text-xs text-red-500 mt-1">Motivo: {u.blockedReason}</div>}
              </div>
              {u.id !== me?.id && (
                <div className="flex gap-2">
                  {u.blocked ? (
                    <button className={btn()} disabled={busy} onClick={() => act(() => adminAPI.setBlocked(u.id, false), "Conta reativada.")}>Reativar</button>
                  ) : u.role !== "admin" && (
                    <button className={btn(false, true)} onClick={() => { setReason(""); setTarget(u); }}>Suspender</button>
                  )}
                  {!u.blocked && (
                    <button className={btn()} disabled={busy} onClick={() => act(() => adminAPI.setRole(u.id, u.role === "admin" ? "user" : "admin"), u.role === "admin" ? "Acesso de administrador removido." : "Agora é administrador.")}>
                      {u.role === "admin" ? "Remover admin" : "Tornar admin"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ConfirmModal
          open
          title={`Suspender ${target.name}?`}
          description="A pessoa sai da conta e não consegue entrar até ser reativada."
          confirmLabel="Suspender conta"
          cancelLabel="Voltar"
          danger
          loading={busy}
          onConfirm={() => act(() => adminAPI.setBlocked(target.id, true, reason), "Conta suspensa.")}
          onClose={() => setTarget(null)}
        >
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Motivo (a pessoa verá ao tentar entrar)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className={`${input} mt-1 w-full resize-none`} />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}

/* ----------------------------- Serviços ----------------------------- */
function ServicesTab() {
  const { showToast } = useToast();
  const [list, setList] = useState<AdminService[] | null>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminService | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((q: string) => {
    setQuery(q);
    adminAPI.services(q).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao buscar serviços."), "error"));
  }, [showToast]);
  useEffect(() => load(""), [load]);

  const setActive = async (s: AdminService, active: boolean, why = "") => {
    setBusy(true);
    try {
      await adminAPI.setServiceActive(s.id, active, why);
      showToast(active ? "Serviço de volta à vitrine." : "Serviço pausado. O prestador foi avisado.", "success");
      setTarget(null);
      load(query);
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível concluir."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SearchBar placeholder="Título do serviço" onSearch={load} />
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? <p className="text-[var(--text-muted)]">Nenhum serviço encontrado.</p> : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="p-3 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48">
                <a href={`/service/${s.id}`} target="_blank" rel="noreferrer" className="font-medium hover:text-[var(--primary)]">{s.title}</a>
                {!s.active && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">pausado</span>}
                <div className="text-xs text-[var(--text-muted)]">{s.provider?.name ?? "—"} · {s.category ?? "sem categoria"} · {formatCurrency(s.price)}</div>
              </div>
              {s.active ? (
                <button className={btn(false, true)} onClick={() => { setReason(""); setTarget(s); }}>Pausar</button>
              ) : (
                <button className={btn()} disabled={busy} onClick={() => setActive(s, true)}>Reativar</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ConfirmModal
          open
          title={`Pausar "${target.title}"?`}
          description="O serviço sai da vitrine e deixa de receber pedidos. O prestador recebe um aviso."
          confirmLabel="Pausar serviço"
          cancelLabel="Voltar"
          danger
          loading={busy}
          onConfirm={() => setActive(target, false, reason)}
          onClose={() => setTarget(null)}
        >
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Motivo (enviado ao prestador)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className={`${input} mt-1 w-full resize-none`} />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}

/* ----------------------------- Pedidos ----------------------------- */
function HiresTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("");
  const [list, setList] = useState<AdminHire[] | null>(null);
  useEffect(() => {
    setList(null);
    adminAPI.hires(status).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar pedidos."), "error"));
  }, [status, showToast]);
  return (
    <>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-[var(--text-muted)]">Etapa</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="">Todas</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? <p className="text-[var(--text-muted)]">Nenhum pedido.</p> : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-light)] text-left text-[var(--text-muted)]">
              <tr><th className="p-2">Nº</th><th className="p-2">Serviço</th><th className="p-2">Cliente</th><th className="p-2">Prestador</th><th className="p-2">Valor</th><th className="p-2">Etapa</th><th className="p-2">Agendado</th></tr>
            </thead>
            <tbody>
              {list.map((h) => (
                <tr key={h.id} className="border-t border-[var(--border)]">
                  <td className="p-2">{String(h.id).padStart(4, "0")}</td>
                  <td className="p-2">{h.title}</td>
                  <td className="p-2">{h.client?.name ?? "—"}</td>
                  <td className="p-2">{h.provider?.name ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">{formatCurrency(h.price)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {STATUS_LABEL[h.status_provider] ?? h.status_provider}
                    {h.cancelledBy && <span className="block text-xs text-[var(--text-muted)]">por {h.cancelledBy}{h.lateCancel ? " (em cima da hora)" : ""}</span>}
                  </td>
                  <td className="p-2 whitespace-nowrap">{h.scheduledAt ? formatDateTime(h.scheduledAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ----------------------------- Categorias ----------------------------- */
function CategoriesTab() {
  const { showToast } = useToast();
  const [list, setList] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [removing, setRemoving] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminAPI.categories().then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(done, "success");
      setName("");
      setDescription("");
      setEditing(null);
      setRemoving(null);
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível salvar."), "error");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return showToast("Informe o nome da categoria.", "warning");
    run(
      () => (editing ? adminAPI.updateCategory(editing.id, name.trim(), description.trim()) : adminAPI.createCategory(name.trim(), description.trim())),
      editing ? "Categoria atualizada." : "Categoria criada."
    );
  };

  return (
    <>
      <form onSubmit={submit} className="p-4 mb-4 rounded-2xl bg-[var(--bg-light)] border border-[var(--border)] grid sm:grid-cols-[1fr_2fr_auto] gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" aria-label="Nome da categoria" maxLength={100} className={input} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" aria-label="Descrição da categoria" maxLength={250} className={input} />
        <div className="flex gap-2">
          <button className={btn(true)} disabled={busy}>{editing ? "Salvar" : "Adicionar"}</button>
          {editing && <button type="button" className={btn()} onClick={() => { setEditing(null); setName(""); setDescription(""); }}>Cancelar</button>}
        </div>
      </form>
      {!list ? <Loader2 className="animate-spin" /> : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.id} className="p-3 rounded-xl bg-[var(--bg-light)] border border-[var(--border)] flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-48">
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-[var(--text-muted)]">{c.description}</div>}
              </div>
              <button className={btn()} onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? ""); }}>Editar</button>
              <button className={btn(false, true)} onClick={() => setRemoving(c)}>Excluir</button>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmModal
          open
          title={`Excluir "${removing.name}"?`}
          description="Só é possível excluir categorias sem serviços ou prestadores vinculados."
          confirmLabel="Excluir"
          cancelLabel="Voltar"
          danger
          loading={busy}
          onConfirm={() => run(() => adminAPI.deleteCategory(removing.id), "Categoria excluída.")}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/* ----------------------------- Denúncias ----------------------------- */
const REPORT_STATUS: Record<string, string> = { ABERTA: "Abertas", RESOLVIDA: "Resolvidas", DESCARTADA: "Descartadas" };

function ReportsTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("ABERTA");
  const [list, setList] = useState<ReportItem[] | null>(null);
  const [target, setTarget] = useState<{ report: ReportItem; decision: "RESOLVIDA" | "DESCARTADA" } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setList(null);
    reportAPI.adminList(status).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar denúncias."), "error"));
  }, [status, showToast]);
  useEffect(load, [load]);

  const decide = async () => {
    if (!target) return;
    if (text.trim().length < 5) return showToast("Explique a decisão para quem relatou.", "warning");
    setBusy(true);
    try {
      await reportAPI.resolve(target.report.id, target.decision, text.trim());
      showToast("Decisão registrada. As partes foram avisadas.", "success");
      setTarget(null);
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível registrar."), "error");
    } finally {
      setBusy(false);
    }
  };

  const openFile = (path: string) => reportAPI.openFile(path).catch((e) => showToast(getErrorMessage(e, "Erro ao abrir anexo."), "error"));

  return (
    <>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-[var(--text-muted)]">Situação</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          {Object.entries(REPORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="">Todas</option>
        </select>
      </label>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? (
        <p className="text-[var(--text-muted)]">{status === "ABERTA" ? "Nenhuma denúncia aguardando análise." : "Nenhuma denúncia."}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{reasonLabel(r.reason)}</span>
                <span className="text-xs text-[var(--text-muted)]">#{r.id} · {formatDateTime(r.createdAt)}</span>
                {r.status !== "ABERTA" && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)]">{REPORT_STATUS[r.status]}</span>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {r.hire ? <>Pedido {String(r.hire.id).padStart(4, "0")} — {r.hire.title} · cliente {r.parties?.client?.name ?? "—"} × prestador {r.parties?.provider?.name ?? "—"}</> : <>Perfil: {r.provider?.name ?? "—"}</>}
              </p>
              <p className="text-sm mt-1">Relatado por {r.reporter?.name} ({r.reporter?.email})</p>
              <p className="text-sm mt-2 whitespace-pre-line">{r.description}</p>
              {r.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {r.files.map((f, i) => <button key={f} className={btn()} onClick={() => openFile(f)}>Anexo {i + 1}</button>)}
                </div>
              )}
              {r.resolution && <p className="text-sm mt-2 text-[var(--text-muted)]">Decisão: {r.resolution}</p>}
              {r.status === "ABERTA" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className={btn(true)} onClick={() => { setText(""); setTarget({ report: r, decision: "RESOLVIDA" }); }}>Resolver</button>
                  <button className={btn()} onClick={() => { setText(""); setTarget({ report: r, decision: "DESCARTADA" }); }}>Descartar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <ConfirmModal
          open
          title={target.decision === "RESOLVIDA" ? "Resolver denúncia" : "Descartar denúncia"}
          description="Quem relatou recebe a decisão. Num pedido, as avaliações são liberadas. Para suspender uma conta, use a aba Usuários."
          confirmLabel={target.decision === "RESOLVIDA" ? "Resolver" : "Descartar"}
          cancelLabel="Voltar"
          loading={busy}
          onConfirm={decide}
          onClose={() => setTarget(null)}
        >
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Decisão (enviada a quem relatou)</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} className={`${input} mt-1 w-full resize-none`} />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}

/* ----------------------------- Verificações ----------------------------- */
const VERIFICATION_STATUS: Record<string, string> = { pending: "Pendentes", verified: "Verificados", rejected: "Recusados" };

function VerificationsTab() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState<AdminVerification[] | null>(null);
  const [refusing, setRefusing] = useState<AdminVerification | null>(null);
  // confirmações extras por prestador (empresa / certificados), marcadas na análise
  const [extras, setExtras] = useState<Record<number, { company?: boolean; credentials?: boolean }>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setList(null);
    adminAPI.verifications(status).then(setList).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar verificações."), "error"));
  }, [status, showToast]);
  useEffect(load, [load]);

  const decide = async (v: AdminVerification, approve: boolean) => {
    if (!approve && note.trim().length < 5) return showToast("Explique o motivo da recusa.", "warning");
    setBusy(true);
    try {
      const ex = extras[v.provider.id] ?? {};
      await adminAPI.decideVerification(v.provider.id, approve, approve ? "" : note.trim(), approve ? ex : {});
      showToast(approve ? "Prestador verificado. Os documentos foram apagados." : "Verificação recusada. O prestador foi avisado.", "success");
      setRefusing(null);
      load();
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível registrar."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-[var(--text-muted)]">Situação</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          {Object.entries(VERIFICATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <p className="text-xs text-[var(--text-muted)] mb-4">Confira se o nome e o CPF/CNPJ do documento batem com o cadastro. Depois da decisão os arquivos são apagados.</p>
      {!list ? <Loader2 className="animate-spin" /> : list.length === 0 ? (
        <p className="text-[var(--text-muted)]">{status === "pending" ? "Nenhuma verificação aguardando análise." : "Nada por aqui."}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => (
            <li key={v.provider.id} className="p-4 rounded-xl bg-[var(--bg-light)] border border-[var(--border)]">
              <div className="font-semibold">{v.provider.name}</div>
              <div className="text-sm text-[var(--text-muted)]">
                {v.provider.user?.name} · {v.provider.user?.email} · CPF/CNPJ {v.provider.user?.cpf_cnpj ?? "—"}{v.provider.cnpj ? ` · CNPJ da empresa ${v.provider.cnpj}` : ""}
              </div>
              {v.note && <div className="text-sm text-amber-500 mt-1">Motivo da recusa: {v.note}</div>}
              {v.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {v.files.map((f, i) => (
                    <button key={f.url} className={btn()} onClick={() => reportAPI.openFile(f.url).catch((e) => showToast(getErrorMessage(e, "Erro ao abrir."), "error"))}>
                      {f.kind === "id" ? "Documento de identidade" : f.kind === "company" ? "Comprovante da empresa" : `Certificado ${i}`}
                    </button>
                  ))}
                </div>
              )}
              {v.status === "pending" && (v.files.some((f) => f.kind === "company") || v.files.some((f) => f.kind === "cert")) && (
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  {v.files.some((f) => f.kind === "company") && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!extras[v.provider.id]?.company} disabled={!v.provider.cnpj}
                        onChange={(e) => setExtras((x) => ({ ...x, [v.provider.id]: { ...x[v.provider.id], company: e.target.checked } }))} />
                      Confirmar empresa {v.provider.cnpj ? "(CNPJ confere com o comprovante)" : "(sem CNPJ cadastrado)"}
                    </label>
                  )}
                  {v.files.some((f) => f.kind === "cert") && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!extras[v.provider.id]?.credentials}
                        onChange={(e) => setExtras((x) => ({ ...x, [v.provider.id]: { ...x[v.provider.id], credentials: e.target.checked } }))} />
                      Confirmar certificados
                    </label>
                  )}
                </div>
              )}
              {v.status === "pending" && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className={btn(true)} disabled={busy} onClick={() => decide(v, true)}>Aprovar</button>
                  <button className={btn(false, true)} onClick={() => { setNote(""); setRefusing(v); }}>Recusar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {refusing && (
        <ConfirmModal
          open
          title={`Recusar verificação de ${refusing.provider.name}?`}
          description="O prestador recebe o motivo e pode enviar os documentos de novo."
          confirmLabel="Recusar"
          cancelLabel="Voltar"
          danger
          loading={busy}
          onConfirm={() => decide(refusing, false)}
          onClose={() => setRefusing(null)}
        >
          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Motivo</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className={`${input} mt-1 w-full resize-none`} />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}

/* ----------------------------- Regiões ----------------------------- */
function RegionsTab() {
  const { showToast } = useToast();
  const [data, setData] = useState<RegionData | null>(null);
  useEffect(() => {
    adminAPI.regions().then(setData).catch((e) => showToast(getErrorMessage(e, "Erro ao carregar regiões."), "error"));
  }, [showToast]);
  if (!data) return <Loader2 className="animate-spin" />;
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        Oferta por cidade (prestadores com cidade informada) e pessoas cadastradas com endereço na cidade (só contagem).
        Cidades com menos de {data.lowSupplyBelow} prestadores aparecem como pouca oferta.
      </p>
      {data.regions.length === 0 ? (
        <p className="text-[var(--text-muted)]">Ainda não há prestadores ou clientes com cidade informada.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-light)] text-left text-[var(--text-muted)]">
              <tr><th className="p-2">Cidade</th><th className="p-2">Prestadores</th><th className="p-2">Serviços ativos</th><th className="p-2">Categorias</th><th className="p-2">Pessoas com endereço</th><th className="p-2">Situação</th></tr>
            </thead>
            <tbody>
              {data.regions.map((r) => (
                <tr key={`${r.city}-${r.state}`} className="border-t border-[var(--border)]">
                  <td className="p-2 whitespace-nowrap">{r.city}{r.state ? `/${r.state}` : ""}</td>
                  <td className="p-2">{r.providers}</td>
                  <td className="p-2">{r.services}</td>
                  <td className="p-2">{r.categories}</td>
                  <td className="p-2">{r.clients}</td>
                  <td className="p-2 whitespace-nowrap">{r.lowSupply ? <span className="text-amber-500">Pouca oferta</span> : "Ok"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <h2 className="font-semibold mb-2">Páginas públicas por categoria e cidade</h2>
        {data.pages.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma ainda: aparecem quando há prestador com cidade e serviço ativo.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.pages.map((p) => (
              <li key={`${p.categorySlug}-${p.citySlug}`}>
                <a href={`/servicos/${p.categorySlug}/${p.citySlug}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-full border border-[var(--border)] text-sm hover:border-[var(--primary)] inline-block">
                  {p.categoryName} em {p.city} ({p.providers}){p.indexable ? "" : " · não indexada"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
