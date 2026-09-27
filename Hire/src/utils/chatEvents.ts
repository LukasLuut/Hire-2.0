/* --------------------------------------------------------------------------
 * Avisos entre a sala de conversa e a pilha de conversas minimizadas (ChatDock).
 * A sala avisa quando abre e quando fecha (e se a pessoa escreveu algo);
 * qualquer tela pode pedir para abrir uma conversa na pilha.
 * -------------------------------------------------------------------------- */
export type ChatOpened = { conversationId: number };
export type ChatClosed = { conversationId: number; sent: boolean };
export type ChatOpenRequest = { conversationId: number | null; draft?: string };

export const emitChatOpened = (conversationId: number) =>
  window.dispatchEvent(new CustomEvent<ChatOpened>("hire:chat-opened", { detail: { conversationId } }));

export const emitChatClosed = (conversationId: number, sent: boolean) =>
  window.dispatchEvent(new CustomEvent<ChatClosed>("hire:chat-closed", { detail: { conversationId, sent } }));

/** Abre a caixa de conversas (null = lista) pela pilha global */
export const requestChat = (conversationId: number | null, draft?: string) =>
  window.dispatchEvent(new CustomEvent<ChatOpenRequest>("hire:chat-open", { detail: { conversationId, draft } }));
