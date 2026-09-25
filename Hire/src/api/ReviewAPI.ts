import { apiRequest } from "./ApiClient";
import type { ReviewEntity, ReviewList } from "../interfaces/Entities";

export const reviewAPI = {
  /** Envia uma avaliação (nota 1–5, comentário e até 5 fotos). */
  create: async (data: { hireId: number; rating: number; comment: string; photos: File[] }, token: string) => {
    const form = new FormData();
    form.append("hireId", String(data.hireId));
    form.append("rating", String(data.rating));
    form.append("comment", data.comment);
    data.photos.forEach((p) => form.append("photos", p));
    return await apiRequest<ReviewEntity>("/reviews", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
  },

  /** Avaliações que o prestador recebeu dos clientes. */
  forProvider: async (providerId: number): Promise<ReviewList> => {
    return await apiRequest<ReviewList>(`/reviews/provider/${providerId}`);
  },

  /** Avaliações que o usuário recebeu como cliente. */
  forClient: async (userId: number): Promise<ReviewList> => {
    return await apiRequest<ReviewList>(`/reviews/user/${userId}`);
  },

  /** Avaliações de uma contratação (quem já avaliou). */
  forHire: async (hireId: number, token: string): Promise<ReviewEntity[]> => {
    return (await apiRequest<ReviewEntity[]>(`/reviews/hire/${hireId}`, { headers: { Authorization: "Bearer " + token } })) ?? [];
  },
};
