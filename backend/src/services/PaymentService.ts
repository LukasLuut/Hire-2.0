import crypto from "crypto";
import { AppDataSource } from "../config/data-source";
import { Payment, PaymentMethod, PaymentStatus } from "../models/Payment";

/** Taxa da plataforma em % (PLATFORM_FEE_PERCENT no .env; padrão 10%). */
export function platformFeePercent(): number {
  const n = Number(process.env.PLATFORM_FEE_PERCENT);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : 10;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Divide o valor entre taxa da plataforma e líquido do prestador */
export function splitAmount(amount: number, feePercent = platformFeePercent()) {
  const fee = cents((amount * feePercent) / 100);
  return { amount: cents(amount), feePercent, fee, net: cents(amount - fee) };
}

export const METHODS = Object.values(PaymentMethod) as string[];

export class PaymentService {
  private paymentRepository = AppDataSource.getRepository(Payment);

  /** Registra o pagamento (simulado) de uma contratação: o valor fica retido até a conclusão. */
  async pay(data: { hireId: number; providerId: number; userId: number; amount: number; method: PaymentMethod }) {
    const split = splitAmount(data.amount);
    return await this.paymentRepository.save(
      this.paymentRepository.create({
        ...split,
        method: data.method,
        status: PaymentStatus.PAGO,
        transactionCode: `SIM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        hire: { id: data.hireId },
        provider: { id: data.providerId },
        user: { id: data.userId },
      })
    );
  }

  /** Cliente confirmou a conclusão: o líquido fica disponível para o prestador. */
  async release(hireId: number) {
    await this.paymentRepository.update({ hire: { id: hireId }, status: PaymentStatus.PAGO }, { status: PaymentStatus.LIBERADO, releasedAt: new Date() });
  }

  /** Pedido cancelado depois de pago: devolve ao cliente. */
  async refund(hireId: number) {
    await this.paymentRepository.update({ hire: { id: hireId }, status: PaymentStatus.PAGO }, { status: PaymentStatus.ESTORNADO, refundedAt: new Date() });
  }

  /**
   * Resumo financeiro do prestador (base da carteira):
   * a receber = pagos aguardando conclusão; disponível = liberados.
   */
  async providerSummary(providerId: number) {
    const rows = await this.paymentRepository
      .createQueryBuilder("p")
      .select("p.status", "status")
      .addSelect("COALESCE(SUM(p.net), 0)", "net")
      .addSelect("COALESCE(SUM(p.fee), 0)", "fee")
      .addSelect("COUNT(*)", "count")
      .where("p.providerId = :providerId", { providerId })
      .groupBy("p.status")
      .getRawMany<{ status: PaymentStatus; net: string; fee: string; count: string }>();
    const of = (s: PaymentStatus) => rows.find((r) => r.status === s);
    return {
      pending: cents(Number(of(PaymentStatus.PAGO)?.net ?? 0)),
      available: cents(Number(of(PaymentStatus.LIBERADO)?.net ?? 0)),
      fees: cents(Number(of(PaymentStatus.LIBERADO)?.fee ?? 0)),
      feePercent: platformFeePercent(),
    };
  }

  /** Visão da administração: pagamentos recentes e totais por situação. */
  async adminOverview(limit = 100) {
    const list = await this.paymentRepository.find({
      relations: { hire: { service: true }, provider: true, user: true },
      order: { id: "DESC" },
      take: Math.min(Math.max(limit, 1), 500),
    });
    const totals = await this.paymentRepository
      .createQueryBuilder("p")
      .select("p.status", "status")
      .addSelect("COUNT(*)", "count")
      .addSelect("COALESCE(SUM(p.amount), 0)", "amount")
      .addSelect("COALESCE(SUM(p.fee), 0)", "fee")
      .groupBy("p.status")
      .getRawMany<{ status: PaymentStatus; count: string; amount: string; fee: string }>();
    return {
      feePercent: platformFeePercent(),
      totals: totals.map((t) => ({ status: t.status, count: Number(t.count), amount: cents(Number(t.amount)), fee: cents(Number(t.fee)) })),
      payments: list.map((p) => ({
        id: p.id,
        hireId: p.hire?.id ?? null,
        service: p.hire?.service?.title ?? p.hire?.description_service ?? null,
        client: p.user?.name ?? null,
        provider: p.provider?.companyName || p.provider?.professionalName || null,
        amount: p.amount,
        fee: p.fee,
        net: p.net,
        method: p.method,
        status: p.status,
        transactionCode: p.transactionCode,
        paidAt: p.paidAt,
        releasedAt: p.releasedAt,
        refundedAt: p.refundedAt,
      })),
    };
  }
}

export const paymentService = new PaymentService();
