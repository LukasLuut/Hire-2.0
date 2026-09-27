import type { ConversationSummary } from "../interfaces/Entities";

const STATUS_LABEL: Record<ConversationSummary["status"], string> = {
  OPEN: "Em negociação",
  FORMALIZED: "Formalizada",
  CLOSED: "Encerrada",
};

/** Situação mostrada nas listas de conversa: pedidos de orçamento têm rótulos próprios. */
export function conversationStatus(c: ConversationSummary) {
  if (c.requestStatus === "RECUSADA") return "Pedido recusado";
  if (c.status === "OPEN" && c.requestStatus === "PENDENTE") return c.myRole === "prestador" ? "Orçamento a responder" : "Aguardando orçamento";
  if (c.status === "OPEN" && c.requestStatus === "RESPONDIDA" && c.myRole === "cliente") return "Orçamento recebido";
  return STATUS_LABEL[c.status];
}
