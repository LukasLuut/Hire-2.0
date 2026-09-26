import path from "path";
import fs from "fs";
import { In } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { ServiceProvider, VerificationStatus, type VerificationFile } from "../models/ServiceProvider";
import { User } from "../models/User";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";
import { isAdmin } from "../utils/access";
import { PRIVATE_DIR } from "../middlewares/uploadMiddleware";

/*
 * Verificação de prestador: documento de identidade (e certificados) enviados
 * para armazenamento privado, revisão manual pela administração e selo no perfil.
 * Depois da decisão os arquivos são apagados — só o resultado fica guardado.
 */
export class VerificationService {
  private providers = AppDataSource.getRepository(ServiceProvider);

  /** Carrega o prestador com as colunas privadas da verificação */
  private async load(where: { id?: number; userId?: number }) {
    const qb = this.providers
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.user", "u")
      .addSelect(["p.verificationFiles", "p.verificationNote"]);
    if (where.id) qb.where("p.id = :id", { id: where.id });
    else qb.where("u.id = :uid", { uid: where.userId });
    return qb.getOne();
  }

  private removeFiles(files: VerificationFile[] | null | undefined) {
    for (const f of files ?? []) fs.promises.unlink(path.join(PRIVATE_DIR, path.basename(f.name))).catch(() => {});
  }

  private present(p: ServiceProvider) {
    return {
      status: p.verificationStatus,
      note: p.verificationNote ?? null,
      verifiedAt: p.verifiedAt ?? null,
      files: (p.verificationFiles ?? []).map((f) => ({ kind: f.kind, url: `/providers/verification/${p.id}/files/${f.name}` })),
    };
  }

  /** Situação da verificação do próprio prestador */
  async mine(userId: number) {
    const p = await this.load({ userId });
    if (!p) throw new HttpError(404, "Cadastre sua empresa primeiro");
    return this.present(p);
  }

  /** Envio dos documentos: substitui um envio anterior ainda não analisado */
  async submit(userId: number, idDocument: Express.Multer.File | undefined, certifications: Express.Multer.File[]) {
    const uploaded = [...(idDocument ? [idDocument] : []), ...certifications];
    try {
      const p = await this.load({ userId });
      if (!p) throw new HttpError(404, "Cadastre sua empresa primeiro");
      if (!idDocument) throw new HttpError(400, "Envie o documento de identificação (RG, CNH ou cartão CNPJ)");
      if (p.verificationStatus === VerificationStatus.VERIFIED) throw new HttpError(400, "Seu perfil já está verificado");

      this.removeFiles(p.verificationFiles);
      p.verificationFiles = [
        { kind: "id", name: idDocument.filename },
        ...certifications.map((f) => ({ kind: "cert" as const, name: f.filename })),
      ];
      p.verificationStatus = VerificationStatus.PENDING;
      p.verificationNote = null;
      await this.providers.save(p);

      // avisa a administração
      const admins = await AppDataSource.getRepository(User).find({ where: { role: "admin" }, select: { id: true } });
      for (const a of admins) {
        await notificationService.notify(a.id, {
          type: "verification.requested",
          title: `Verificação pendente: ${p.companyName || p.professionalName}`,
          body: "Um prestador enviou documentos para verificação.",
          link: "/admin",
        });
      }
      return this.present(p);
    } catch (e) {
      for (const f of uploaded) fs.promises.unlink(f.path).catch(() => {});
      throw e;
    }
  }

  /** Fila da administração */
  async list(status?: string) {
    const valid = Object.values(VerificationStatus) as string[];
    const qb = this.providers
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.user", "u")
      .addSelect(["p.verificationFiles", "p.verificationNote"])
      .orderBy("p.id", "DESC")
      .take(100);
    if (status && valid.includes(status)) qb.where("p.verificationStatus = :status", { status });
    else qb.where("p.verificationStatus != :none", { none: VerificationStatus.NONE });
    const rows = await qb.getMany();
    return rows.map((p) => ({
      provider: { id: p.id, name: p.companyName || p.professionalName, cnpj: p.cnpj ?? null, user: p.user ? { id: p.user.id, name: p.user.name, email: p.user.email, cpf_cnpj: p.user.cpf_cnpj } : null },
      ...this.present(p),
    }));
  }

  /** Decisão: aprova (selo) ou recusa com motivo; os arquivos são apagados */
  async decide(providerId: number, approve: boolean, note: unknown) {
    const text = String(note ?? "").trim().slice(0, 300);
    if (!approve && text.length < 5) throw new HttpError(400, "Explique ao prestador por que a verificação foi recusada");
    const p = await this.load({ id: providerId });
    if (!p) throw new HttpError(404, "Prestador não encontrado");
    if (p.verificationStatus !== VerificationStatus.PENDING) throw new HttpError(400, "Não há documentos aguardando análise");

    this.removeFiles(p.verificationFiles);
    p.verificationFiles = null;
    p.verificationStatus = approve ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;
    p.verificationNote = text || null;
    p.verifiedAt = approve ? new Date() : null;
    await this.providers.save(p);

    await notificationService.notify(p.user?.id, {
      type: approve ? "verification.approved" : "verification.rejected",
      title: approve ? "Perfil verificado" : "Verificação recusada",
      body: approve ? "Seu perfil agora mostra o selo de verificado." : `Motivo: ${text}. Você pode enviar os documentos de novo.`,
      link: "/business",
    });
    return this.present(p);
  }

  /** Arquivo de verificação: só o dono e a administração */
  async filePath(providerId: number, name: string, userId: number) {
    const p = await this.load({ id: providerId });
    if (!p || !(p.verificationFiles ?? []).some((f) => f.name === name)) throw new HttpError(404, "Arquivo não encontrado");
    if (p.user?.id !== userId && !(await isAdmin(userId))) throw new HttpError(403, "Sem acesso a este arquivo");
    return path.join(PRIVATE_DIR, path.basename(name));
  }

  async pendingCount() {
    return this.providers.count({ where: { verificationStatus: In([VerificationStatus.PENDING]) } });
  }
}

export const verificationService = new VerificationService();
