import { apiRequest } from "./ApiClient";
import type { NegotiationTopic } from "../interfaces/Entities";

export interface ContractEntity {
  id: number;
  code: string;
  price: number;
  description_service: string;
  firstContact: string;
  lastContact: string;
  hire?: { id: number; service?: { title: string; duration: string } | null } | null;
  user: {
    id: number;
    name: string;
    email: string;
    cpf_cnpj: string;
    address: { street: string; num: number; neighborhood: string; city: string; state: string } | null;
  } | null;
  provider: {
    id: number;
    companyName: string;
    professionalName: string;
    professionalEmail: string;
    professionalPhone: string;
    cnpj?: string | null;
  } | null;
  terms: NegotiationTopic[];
  myRole: "cliente" | "prestador";
  clientSignature: ContractSignature | null;
  providerSignature: ContractSignature | null;
}

export interface ContractSignature {
  name: string;
  signedAt: string;
  userAgent: string;
  geolocation?: { latitude: number; longitude: number } | null;
  hash: string;
}

export const contractAPI = {
  getById: async (id: number, token: string) => {
    return await apiRequest<ContractEntity>(`/contracts/${id}`, { headers: { Authorization: "Bearer " + token } });
  },

  sign: async (
    id: number,
    data: { name: string; hash: string; accepted: boolean; geolocation?: { latitude: number; longitude: number } | null },
    token: string
  ) => {
    return await apiRequest<ContractEntity>(`/contracts/${id}/sign`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify(data),
    });
  },
};
