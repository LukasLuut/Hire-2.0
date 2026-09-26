import type { User } from "../interfaces/UserInterface";
import { apiRequest } from "./ApiClient";

export const userAPI = {

  create: async (data: UserAPI) => {
    return await apiRequest("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        cpf_cnpj: data.cpf,
        password: data.password,
        acceptedTerms: data.acceptedTerms,
        accountType: data.accountType ?? "cliente",
        ...(data.accountType === "empresa" ? { legalName: data.legalName, tradeName: data.tradeName, companySize: data.companySize } : {}),
        // código de convite guardado pela página /convite/:code (atribui o cadastro)
        invite: data.invite || undefined,
      }),
    });
  },

  /** Troca a foto do perfil pessoal */
  setAvatar: async (file: File, token: string) => {
    const body = new FormData();
    body.append("image", file);
    return apiRequest<{ avatarUrl: string }>("/users/me/avatar", { method: "PUT", headers: { Authorization: "Bearer " + token }, body });
  },

  getUser: async (token: string): Promise<User | null> => {
    const response: User = await apiRequest("/users/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
    });

    if (!response) return null;
    return response;
  },

  login: (data: UserLoginAPI) =>
    apiRequest("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
      }),
    }),

  update: async (
    user: {
      name: string;
      about: string;
    },
    token: string
  ) => {
    const response = await apiRequest("/users/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token, // ← garante que token é válido
      },
      body: JSON.stringify({
        name: user.name,
        about: user.about,
      }),
    })
    return response;
  },

  updateUser: async (
    token: string,
    email: string
  ) => {
    const response = await apiRequest("/users/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token, // ← garante que token é válido
      },
      body: JSON.stringify({
        email: email
      }),
    })
    return response;
  },

  /** Atualiza nome, sobre e e-mail em uma única requisição. */
  updateProfile: async (token: string, data: { name: string; about: string; email: string }) => {
    return await apiRequest("/users/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify(data),
    });
  },

  deleteUser: async (token: string) => {
    const response = await apiRequest("/users/me", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token, // ← garante que token é válido
      }
    })
    return response;
  },
  }





export type AccountType = "cliente" | "profissional" | "empresa";

export interface UserAPI {
  name: string;
  /** CPF (cliente/profissional) ou CNPJ (empresa), com máscara */
  cpf: string;
  accountType?: AccountType;
  legalName?: string;
  tradeName?: string;
  companySize?: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  invite?: string | null;
}

export interface UserLoginAPI {
  email: string;
  password: string;
}
