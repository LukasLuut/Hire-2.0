import { apiRequest, LOCAL_PORT } from "./ApiClient";

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "nao_compareceu", label: "A outra parte não compareceu" },
  { value: "servico_ruim", label: "Serviço mal feito ou incompleto" },
  { value: "cobranca", label: "Cobrança diferente do combinado" },
  { value: "comportamento", label: "Comportamento inadequado" },
  { value: "fraude", label: "Golpe ou informação falsa" },
  { value: "outro", label: "Outro problema" },
];

export const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

export interface ReportItem {
  id: number;
  reason: string;
  description: string;
  files: string[];
  status: "ABERTA" | "RESOLVIDA" | "DESCARTADA";
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  hire: { id: number; title: string } | null;
  provider: { id: number; name: string } | null;
  reporter?: { id: number; name: string; email: string } | null;
  parties?: { client: { id: number; name: string } | null; provider: { id: number; name: string; userId?: number } | null } | null;
}

export const reportAPI = {
  /** Relata problema num pedido (hireId) ou denuncia um perfil (providerId) */
  create: (data: { hireId?: number; providerId?: number; reason: string; description: string; files: File[] }) => {
    const body = new FormData();
    if (data.hireId) body.append("hireId", String(data.hireId));
    if (data.providerId) body.append("providerId", String(data.providerId));
    body.append("reason", data.reason);
    body.append("description", data.description);
    for (const f of data.files) body.append("files", f);
    return apiRequest<ReportItem>("/reports", { method: "POST", headers: auth(), body });
  },
  mine: () => apiRequest<ReportItem[]>("/reports/mine", { headers: auth() }),
  adminList: (status = "") => apiRequest<ReportItem[]>(`/admin/reports${status ? `?status=${status}` : ""}`, { headers: auth() }),
  resolve: (id: number, status: "RESOLVIDA" | "DESCARTADA", resolution: string) =>
    apiRequest<ReportItem>(`/admin/reports/${id}/resolve`, { method: "POST", headers: auth(), body: JSON.stringify({ status, resolution }) }),
  /** Anexos são privados: baixa com o token e abre numa aba */
  openFile: async (path: string) => {
    const win = window.open("", "_blank");
    const res = await fetch(LOCAL_PORT + path, { headers: auth() });
    if (!res.ok) {
      win?.close();
      throw new Error("Não foi possível abrir o anexo.");
    }
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
    else window.open(url, "_blank");
  },
};
