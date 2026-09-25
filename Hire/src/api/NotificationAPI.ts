import { apiRequest } from "./ApiClient";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  unread: number;
  items: NotificationItem[];
}

export interface PendingItem {
  kind: string;
  title: string;
  description: string;
  link: string;
  at: string;
}

const auth = () => ({ Authorization: "Bearer " + (localStorage.getItem("token") ?? "") });

export const notificationAPI = {
  list: () => apiRequest<NotificationList>("/notifications", { headers: auth() }),
  pending: async () => (await apiRequest<PendingItem[]>("/notifications/pending", { headers: auth() })) ?? [],
  readAll: () => apiRequest<NotificationList>("/notifications/read", { method: "POST", headers: auth() }),
  read: (id: number) => apiRequest<NotificationList>(`/notifications/${id}/read`, { method: "POST", headers: auth() }),
};

/** "há 5 min", "há 2 h", "ontem"... */
export function timeAgo(date: string) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ontem";
  return new Date(date).toLocaleDateString("pt-BR");
}
