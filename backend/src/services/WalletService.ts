import crypto from "crypto";
import { In, LessThan } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentStatus } from "../models/Payment";
import { ServiceProvider } from "../models/ServiceProvider";
import { PIX_KEY_TYPES, Withdrawal, WithdrawalStatus, type PixKeyType } from "../models/Withdrawal";
import { validCnpj, validCpf } from "../utils/documents";
import { HttpError } from "./HireService";
import { notificationService } from "./NotificationService";

const cents = (n: number) => Math.round(n * 100) / 100;
const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const MIN_WITHDRAWAL = 10;
// saques que ainda "seguram" saldo
const RESERVING = [WithdrawalStatus.SOLICITADO, WithdrawalStatus.EM_PROCESSAMENTO, WithdrawalStatus.PAGO];

/** Chave Pix mascarada para exibir (o dono vê o começo e o fim) */
function maskKey(type: PixKeyType, key: string) {
  if (type === "email") {
    const [user, domain] = key.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (key.length <= 6) return key;
  return `${key.slice(0, 3)}${"*".repeat(Math.max(3, key.length - 5))}${key.slice(-2)}`;
}

/** Valida e normaliza a chave Pix conforme o tipo */
function parsePixKey(type: unknown, raw: unknown): { type: PixKeyType; key: string } {
  const t = String(type ?? "") as PixKeyType;
  if (!PIX_KEY_TYPES.includes(t)) throw new HttpError(400, "Escolha o tipo da chave Pix");
  const value = String(raw ?? "").trim();
  const digits = value.replace(/\D/g, "");
  if (t === "cpf" && !validCpf(digits)) throw new HttpError(400, "CPF inválido");
  if (t === "cnpj" && !validCnpj(digits)) throw new HttpError(400, "CNPJ inválido");
  if (t === "telefone" && !/^\d{10,11}$/.test(digits)) throw new HttpError(400, "Telefone inválido: use DDD + número");
  if (t === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new HttpError(400, "E-mail inválido");
  if (t === "aleatoria" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, "Chave aleatória inválida");
  const key = t === "cpf" || t === "cnpj" || t === "telefone" ? digits : t === "email" ? value.toLowerCase() : value.toLowerCase();
  return { type: t, key };
}

/**
 * Carteira do prestador (valores simulados): saldo disponível (liberado − saques),
 * a receber (pagos aguardando conclusão), extrato e saques via Pix.
 */
export class WalletService {
  private payments = AppDataSource.getRepository(Payment);
  private withdrawals = AppDataSource.getRepository(Withdrawal);
  private providers = AppDataSource.getRepository(ServiceProvider);

  private async providerOf(userId: number) {
    const provider = await this.providers.findOne({ where: { user: { id: userId } }, relations: { user: true } });
    if (!provider) throw new HttpError(404, "Você não tem conta profissional");
    return provider;
  }

  private async balances(providerId: number) {
    const rows = await this.payments
      .createQueryBuilder("p")
      .select("p.status", "status")
      .addSelect("COALESCE(SUM(p.net), 0)", "net")
      .addSelect("COALESCE(SUM(p.fee), 0)", "fee")
      .addSelect("COALESCE(SUM(p.amount), 0)", "amount")
      .where("p.providerId = :providerId", { providerId })
      .groupBy("p.status")
      .getRawMany<{ status: PaymentStatus; net: string; fee: string; amount: string }>();
    const of = (s: PaymentStatus) => rows.find((r) => r.status === s);
    const [{ reserved }] = await this.withdrawals
      .createQueryBuilder("w")
      .select("COALESCE(SUM(w.amount), 0)", "reserved")
      .where("w.providerId = :providerId AND w.status IN (:...st)", { providerId, st: RESERVING })
      .getRawMany();
    const [{ withdrawn }] = await this.withdrawals
      .createQueryBuilder("w")
      .select("COALESCE(SUM(w.amount), 0)", "withdrawn")
      .where("w.providerId = :providerId AND w.status = :st", { providerId, st: WithdrawalStatus.PAGO })
      .getRawMany();
    const released = cents(Number(of(PaymentStatus.LIBERADO)?.net ?? 0));
    return {
      available: cents(released - Number(reserved)),
      pending: cents(Number(of(PaymentStatus.PAGO)?.net ?? 0)),
      released,
      withdrawn: cents(Number(withdrawn)),
      inTransit: cents(Number(reserved) - Number(withdrawn)),
      fees: cents(Number(of(PaymentStatus.LIBERADO)?.fee ?? 0)),
      gross: cents(Number(of(PaymentStatus.LIBERADO)?.amount ?? 0)),
    };
  }

  private presentWithdrawal(w: Withdrawal) {
    return {
      id: w.id,
      amount: w.amount,
      pixKeyType: w.pixKeyType,
      pixKey: maskKey(w.pixKeyType, w.pixKey),
      status: w.status,
      note: w.note,
      transactionCode: w.transactionCode,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
      paidAt: w.paidAt,
    };
  }

  /** Resumo, extrato (entradas e saídas em ordem) e saques */
  async overview(userId: number) {
    const provider = await this.providerOf(userId);
    const [balances, payments, withdrawals] = await Promise.all([
      this.balances(provider.id),
      this.payments.find({ where: { provider: { id: provider.id } }, relations: { hire: { service: true }, user: true }, order: { id: "DESC" }, take: 300 }),
      this.withdrawals.find({ where: { provider: { id: provider.id } }, order: { id: "DESC" }, take: 100 }),
    ]);
    type Entry = { id: string; date: Date; kind: "entrada" | "a_receber" | "estorno" | "saque"; title: string; detail: string; amount: number; status: string; hireId?: number | null };
    const statement: Entry[] = [];
    for (const p of payments) {
      const service = p.hire?.service?.title ?? p.hire?.description_service ?? "Serviço";
      const who = p.user?.name?.split(" ")[0] ?? "cliente";
      if (p.status === PaymentStatus.LIBERADO && p.releasedAt) {
        statement.push({ id: `p${p.id}`, date: p.releasedAt, kind: "entrada", title: service, detail: `Pago por ${who} · ${BRL(p.amount)} − taxa ${BRL(p.fee)}`, amount: p.net, status: "Liberado", hireId: p.hire?.id });
      } else if (p.status === PaymentStatus.PAGO) {
        statement.push({ id: `p${p.id}`, date: p.paidAt, kind: "a_receber", title: service, detail: `Pago por ${who} · liberado quando o cliente confirmar a conclusão`, amount: p.net, status: "A receber", hireId: p.hire?.id });
      } else if (p.status === PaymentStatus.ESTORNADO) {
        statement.push({ id: `p${p.id}`, date: p.refundedAt ?? p.paidAt, kind: "estorno", title: service, detail: `Pedido cancelado · ${BRL(p.amount)} devolvido a ${who}`, amount: 0, status: "Estornado", hireId: p.hire?.id });
      }
    }
    for (const w of withdrawals) {
      statement.push({
        id: `w${w.id}`,
        date: w.paidAt ?? w.processedAt ?? w.requestedAt,
        kind: "saque",
        title: "Saque via Pix",
        detail: `Chave ${maskKey(w.pixKeyType, w.pixKey)}${w.note ? ` · ${w.note}` : ""}`,
        amount: -w.amount,
        status: w.status,
      });
    }
    statement.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = withdrawals.find((w) => w.status !== WithdrawalStatus.RECUSADO);
    return {
      ...balances,
      minWithdrawal: MIN_WITHDRAWAL,
      // última chave usada (completa só para o dono, para pré-preencher o próximo saque)
      lastPixKey: last ? { type: last.pixKeyType, key: last.pixKey } : null,
      statement,
      withdrawals: withdrawals.map((w) => this.presentWithdrawal(w)),
    };
  }

  /** Pedido de saque: valor mínimo, até o saldo disponível; a chave é validada pelo tipo. */
  async requestWithdrawal(userId: number, data: { amount?: unknown; pixKeyType?: unknown; pixKey?: unknown }) {
    const provider = await this.providerOf(userId);
    const amount = cents(Number(String(data.amount ?? "").replace(",", ".")));
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) throw new HttpError(400, `O saque mínimo é ${BRL(MIN_WITHDRAWAL)}`);
    const pix = parsePixKey(data.pixKeyType, data.pixKey);
    return await AppDataSource.transaction(async (m) => {
      // trava o prestador: dois saques ao mesmo tempo não passam do saldo
      await m.getRepository(ServiceProvider).findOne({ where: { id: provider.id }, lock: { mode: "pessimistic_write" } });
      const { available } = await this.balances(provider.id);
      if (amount > available) throw new HttpError(400, `Saldo disponível: ${BRL(available)}`);
      const saved = await m.getRepository(Withdrawal).save(m.getRepository(Withdrawal).create({ provider: { id: provider.id }, amount, pixKeyType: pix.type, pixKey: pix.key }));
      return this.presentWithdrawal(saved);
    });
  }

  /** O prestador desiste de um saque que ainda não começou a ser processado */
  async cancelWithdrawal(userId: number, id: number) {
    const provider = await this.providerOf(userId);
    const w = await this.withdrawals.findOne({ where: { id, provider: { id: provider.id } } });
    if (!w) throw new HttpError(404, "Saque não encontrado");
    if (w.status !== WithdrawalStatus.SOLICITADO) throw new HttpError(400, "Este saque já está em processamento");
    w.status = WithdrawalStatus.CANCELADO;
    await this.withdrawals.save(w);
    return this.presentWithdrawal(w);
  }

  /** Administração: saques por situação */
  async adminList(status?: string) {
    const where = status && (Object.values(WithdrawalStatus) as string[]).includes(status) ? { status: status as WithdrawalStatus } : {};
    const list = await this.withdrawals.find({ where, relations: { provider: true }, order: { id: "DESC" }, take: 200 });
    return list.map((w) => ({ ...this.presentWithdrawal(w), provider: { id: w.provider?.id, name: w.provider?.companyName || w.provider?.professionalName } }));
  }

  /** Administração (ou processamento automático): processar, pagar ou recusar */
  async advance(id: number, action: unknown, note?: unknown) {
    const w = await this.withdrawals.findOne({ where: { id }, relations: { provider: { user: true } } });
    if (!w) throw new HttpError(404, "Saque não encontrado");
    const now = new Date();
    if (action === "process" && w.status === WithdrawalStatus.SOLICITADO) {
      w.status = WithdrawalStatus.EM_PROCESSAMENTO;
      w.processedAt = now;
    } else if (action === "pay" && [WithdrawalStatus.SOLICITADO, WithdrawalStatus.EM_PROCESSAMENTO].includes(w.status)) {
      w.status = WithdrawalStatus.PAGO;
      w.processedAt = w.processedAt ?? now;
      w.paidAt = now;
      w.transactionCode = `PIX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    } else if (action === "refuse" && [WithdrawalStatus.SOLICITADO, WithdrawalStatus.EM_PROCESSAMENTO].includes(w.status)) {
      const clean = String(note ?? "").trim().slice(0, 300);
      if (clean.length < 5) throw new HttpError(400, "Explique o motivo da recusa");
      w.status = WithdrawalStatus.RECUSADO;
      w.note = clean;
      w.processedAt = now;
    } else {
      throw new HttpError(400, "Ação não permitida para a situação atual do saque");
    }
    await this.withdrawals.save(w);
    if (w.status === WithdrawalStatus.PAGO || w.status === WithdrawalStatus.RECUSADO) {
      await notificationService.notify(w.provider?.user?.id, {
        type: w.status === WithdrawalStatus.PAGO ? "wallet.paid" : "wallet.refused",
        title: w.status === WithdrawalStatus.PAGO ? `Saque de ${BRL(w.amount)} enviado` : `Saque de ${BRL(w.amount)} recusado`,
        body: w.status === WithdrawalStatus.PAGO ? `Transferência Pix concluída (${w.transactionCode}).` : `O valor voltou para o seu saldo. Motivo: ${w.note}`,
        link: "/carteira",
      });
    }
    return { ...this.presentWithdrawal(w), provider: { id: w.provider?.id, name: w.provider?.companyName || w.provider?.professionalName } };
  }

  /**
   * Processamento simulado (WALLET_AUTO_PAYOUT, padrão ligado fora de produção):
   * saques pedidos há mais de 1 min entram em processamento; em processamento há mais de 2 min são pagos.
   */
  async autoPayout() {
    const auto = process.env.WALLET_AUTO_PAYOUT ? process.env.WALLET_AUTO_PAYOUT === "true" : process.env.NODE_ENV !== "production";
    if (!auto) return;
    const now = Date.now();
    const toProcess = await this.withdrawals.find({ where: { status: WithdrawalStatus.SOLICITADO, requestedAt: LessThan(new Date(now - 60_000)) }, select: { id: true } });
    for (const w of toProcess) await this.advance(w.id, "process").catch(() => null);
    const toPay = await this.withdrawals.find({ where: { status: WithdrawalStatus.EM_PROCESSAMENTO, processedAt: LessThan(new Date(now - 120_000)) }, select: { id: true } });
    for (const w of toPay) await this.advance(w.id, "pay").catch(() => null);
  }

  async pendingCount() {
    return this.withdrawals.count({ where: { status: In([WithdrawalStatus.SOLICITADO, WithdrawalStatus.EM_PROCESSAMENTO]) } });
  }
}

export const walletService = new WalletService();
