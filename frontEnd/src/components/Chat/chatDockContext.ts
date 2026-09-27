import { createContext, useContext } from "react";

/** Pilha de conversas minimizadas: número de conversas com novidade e abrir a lista */
export type DockContext = { unreadCount: number; openInbox: () => void };
export const ChatDockContext = createContext<DockContext>({ unreadCount: 0, openInbox: () => {} });
export const useChatDock = () => useContext(ChatDockContext);
