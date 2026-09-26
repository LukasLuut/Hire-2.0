import path from "path";
import fs from "fs";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Report, ReportStatus, REPORT_REASONS, type ReportReason } from "../models/Report";
import { Hire } from "../models/Hire";
import { ServiceProvider } from "../models/ServiceProvider";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";
import { isAdmin } from "../utils/access";
import { PRIVATE_DIR } from "../middlewares/uploadMiddleware";

const MAX_FILES = 4;

/* Relatos de problema (disputas de pedido e denúncias de perfil) e a análise pela administração. */
export class ReportService {
  private reports = AppDataSource.getRepository(Report);
  private hires = AppDataSource.getRepository(Hire);
  private providers = AppDataSource.getRepository(ServiceProvider);

  private present(r: Report, forAdmin = false) {
    return {
      id: r.id,
      reason: r.reason,
      description: r.description,
      files: (r.files ?? []).map((f) => `/reports/${r.id}/files/${f}`),
      status: r.status,
      resolution: r.resolution,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      hire: r.hire ? { id: r.hire.id, title: r.hire.service?.title ?? r.hire.description_service } : null,
      provider: r.provider ? { id: r.provider.id, name: r.provider.companyName || r.provider.professionalName } : null,
      ...(forAdmin
        ? {
            reporter: r.reporter ? { id: r.reporter.id, name: r.reporter.name, email: r.reporter.email } : null,
            parties: r.hire
              ? {
                  client: r.hire.user ? { id: r.hire.user.id, name: r.hire.user.name } : null,
                  provider: r.hire.provider ? { id: r.hire.provider.id, name: r.hire.provider.companyName || r.hire.provider.professionalName, userId: r.hire.provider.user?.id } : null,
                }
              : null,
          }
        : {}),
    };
  }

  /** Remove os arquivos enviados quando o relato é rejeitado na validação */
  private discard(files: Express.Multer.File[]) {
    for (const f of files) fs.promises.unlink(f.path).catch(() => {});
  }

  async create(userId: number, data: { hireId?: unknown; providerId?: unknown; reason?: unknown; description?: unknown }, files: Express.Multer.File[] = []) {
    try {
      const reason = String(data.reason ?? "") as ReportReason;
      if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, "Escolha o tipo de problema");
      const description = String(data.description ?? "").trim();
      if (description.length < 10) throw new HttpError(400, "Descreva o problema com pelo menos 10 caracteres");
      if (files.length > MAX_FILES) throw new HttpError(400, `Envie no máximo ${MAX_FILES} arquivos`);

      let hire: Hire | null = null;
      let provider: ServiceProvider | null = null;
      if (data.hireId) {
        hire = await this.hires.findOne({ where: { id: Number(data.hireId) }, relations: { user: true, provider: { user: true }, service: true } });
        if (!hire) throw new HttpError(404, "Contratação não encontrada");
        const isParty = hire.user?.id === userId || hire.provider?.user?.id === userId;
        if (!isParty) throw new HttpError(403, "Você não participa desta contratação");
        const open = await this.reports.findOne({ where: { hire: { id: hire.id }, reporter: { id: userId }, status: ReportStatus.ABERTA } });
        if (open) throw new HttpError(409, "Você já relatou um problema neste pedido; aguarde a análise");
      } else if (data.providerId) {
        provider = await this.providers.findOne({ where: { id: Number(data.providerId) }, relations: { user: true } });
        if (!provider) throw new HttpError(404, "Prestador não encontrado");
        if (provider.user?.id === userId) throw new HttpError(400, "Você não pode denunciar o próprio perfil");
      } else {
        throw new HttpError(400, "Informe o pedido ou o perfil");
      }

      const report = await this.reports.save(
        this.reports.create({
          reporter: { id: userId },
          hire,
          provider,
          reason,
          description: description.slice(0, 1000),
          files: files.map((f) => f.filename),
        })
      );

      // pedido em disputa: avaliações ficam bloqueadas até a análise; a outra parte é avisada
      if (hire) {
        await this.hires.update(hire.id, { disputed: true });
        const other = hire.user?.id === userId ? hire.provider?.user?.id : hire.user?.id;
        await notificationService.notify(other, {
          type: "report.opened",
          title: `Problema relatado: ${hire.service?.title ?? hire.description_service}`,
          body: "A outra parte relatou um problema neste pedido. A administração vai analisar; as avaliações ficam bloqueadas até lá.",
          link: other === hire.user?.id ? "/hires" : "/progress",
        });
      }
      return this.present(report);
    } catch (e) {
      this.discard(files);
      throw e;
    }
  }

  /** Relatos feitos pelo usuário */
  async mine(userId: number) {
    const rows = await this.reports.find({ where: { reporter: { id: userId } }, relations: { hire: { service: true }, provider: true }, order: { id: "DESC" } });
    return rows.map((r) => this.present(r));
  }

  /** Lista da administração, com as partes envolvidas */
  async list(status?: string) {
    const valid = Object.values(ReportStatus) as string[];
    const rows = await this.reports.find({
      where: status && valid.includes(status) ? { status: status as ReportStatus } : {},
      relations: { reporter: true, hire: { service: true, user: true, provider: { user: true } }, provider: true },
      order: { id: "DESC" },
      take: 100,
    });
    return rows.map((r) => this.present(r, true));
  }

  async openCount() {
    return this.reports.count({ where: { status: ReportStatus.ABERTA } });
  }

  /** Decisão da administração: resolve ou descarta, avisa quem relatou e libera o pedido */
  async resolve(id: number, status: unknown, resolution: unknown, adminId: number) {
    if (status !== ReportStatus.RESOLVIDA && status !== ReportStatus.DESCARTADA) throw new HttpError(400, "Escolha resolver ou descartar");
    const text = String(resolution ?? "").trim();
    if (text.length < 5) throw new HttpError(400, "Explique a decisão para quem relatou");
    const report = await this.reports.findOne({ where: { id }, relations: { reporter: true, hire: { service: true, user: true, provider: { user: true } }, provider: true } });
    if (!report) throw new HttpError(404, "Relato não encontrado");
    if (report.status !== ReportStatus.ABERTA) throw new HttpError(400, "Este relato já foi analisado");

    report.status = status;
    report.resolution = text.slice(0, 500);
    report.resolvedAt = new Date();
    report.resolvedBy = { id: adminId } as any;
    await this.reports.save(report);

    const subject = report.hire ? report.hire.service?.title ?? report.hire.description_service : report.provider?.companyName || report.provider?.professionalName || "perfil";
    await notificationService.notify(report.reporter?.id, {
      type: "report.resolved",
      title: `Relato analisado: ${subject}`,
      body: `${status === ReportStatus.RESOLVIDA ? "Resolvido" : "Descartado"}. ${report.resolution}`,
      link: report.hire ? (report.hire.user?.id === report.reporter?.id ? "/hires" : "/progress") : "/pendencias",
    });

    if (report.hire) {
      const stillOpen = await this.reports.count({ where: { hire: { id: report.hire.id }, status: ReportStatus.ABERTA } });
      if (!stillOpen) {
        await this.hires.update(report.hire.id, { disputed: false });
        const other = report.hire.user?.id === report.reporter?.id ? report.hire.provider?.user?.id : report.hire.user?.id;
        await notificationService.notify(other, {
          type: "report.closed",
          title: `Análise concluída: ${subject}`,
          body: "A administração concluiu a análise do problema relatado neste pedido.",
          link: other === report.hire.user?.id ? "/hires" : "/progress",
        });
      }
    }
    return this.present(report, true);
  }

  /** Caminho de um anexo, só para quem relatou ou para a administração */
  async filePath(id: number, name: string, userId: number) {
    const report = await this.reports.findOne({ where: { id }, relations: { reporter: true } });
    if (!report || !(report.files ?? []).includes(name)) throw new HttpError(404, "Arquivo não encontrado");
    if (report.reporter?.id !== userId && !(await isAdmin(userId))) throw new HttpError(403, "Sem acesso a este arquivo");
    return path.join(PRIVATE_DIR, path.basename(name));
  }

  /** Pedidos com relato aberto feito pelo usuário (para esconder o botão de relatar) */
  async openHireIds(userId: number, hireIds: number[]) {
    if (!hireIds.length) return new Set<number>();
    const rows = await this.reports.find({ where: { reporter: { id: userId }, hire: { id: In(hireIds) }, status: ReportStatus.ABERTA }, relations: { hire: true } });
    return new Set(rows.map((r) => r.hire!.id));
  }
}

export const reportService = new ReportService();
