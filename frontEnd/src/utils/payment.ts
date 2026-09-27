import type { PaymentMethod } from "../interfaces/Entities";

/** Forma de pagamento por extenso ("Pago via Pix") */
export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: "Pix", cartao: "cartão", boleto: "boleto" };
