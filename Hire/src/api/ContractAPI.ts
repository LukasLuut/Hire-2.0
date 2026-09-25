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
}

export const contractAPI = {
  getById: async (id: number, token: string) => {
    return await apiRequest<ContractEntity>(`/contracts/${id}`, { headers: { Authorization: "Bearer " + token } });
  },
};
