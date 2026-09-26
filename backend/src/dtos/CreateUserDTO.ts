// src/dtos/CreateUserDTO.ts
import { Equals, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDTO {
  @IsNotEmpty({ message: "O nome é obrigatório" })
  @Matches(/^[A-Za-zÀ-ÿ\s]+$/, { message: "Nome deve conter apenas letras e espaços" })
  @MaxLength(50, { message: "Nome deve ter no máximo 50 caracteres" })
  name: string;

  @IsEmail({}, { message: "E-mail inválido" })
  @MaxLength(100, { message: "E-mail deve ter no máximo 100 caracteres" })
  email: string;

  @MinLength(6, { message: "Senha deve ter no mínimo 6 caracteres" })
  @Matches(/(?=.*[a-z])/, { message: "Senha deve conter pelo menos uma letra minúscula" })
  @Matches(/(?=.*[A-Z])/, { message: "Senha deve conter pelo menos uma letra maiúscula" })
  @Matches(/(?=.*\d)/, { message: "Senha deve conter pelo menos um número" })
  @Matches(/(?=.*[@$!%*?&])/, { message: "Senha deve conter pelo menos um caractere especial (@$!%*?&)" })
  password: string;

  // CPF (pessoa) ou CNPJ (empresa); os dígitos verificadores são conferidos no UserService
  @IsNotEmpty({ message: "O CPF é obrigatório" })
  @Matches(/^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/, { message: "CPF Inválido" })
  cpf_cnpj: string;

  @IsOptional()
  @IsIn(["cliente", "profissional", "empresa"], { message: "Tipo de conta inválido" })
  accountType?: "cliente" | "profissional" | "empresa";

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: "Razão social deve ter no máximo 150 caracteres" })
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Nome fantasia deve ter no máximo 100 caracteres" })
  tradeName?: string;

  @IsOptional()
  @IsIn(["MEI", "ME", "EPP"], { message: "Por enquanto o Hire aceita MEI, ME e EPP" })
  companySize?: string;

  @IsBoolean()
  @Equals(true, { message: "Termos de contrato devem ser aceitos"})
  acceptedTerms: boolean;
}
