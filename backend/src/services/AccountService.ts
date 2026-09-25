import crypto from "crypto";
import { IsNull, MoreThan } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { AuthToken } from "../models/AuthToken";
import { User } from "../models/User";
import { HttpError } from "./HireService";
import { frontendUrl, mailService } from "./MailService";

const VERIFY_HOURS = 48;
const RESET_MINUTES = 30;
const RESEND_SECONDS = 60;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Mesmas regras de senha do cadastro */
export function passwordProblem(password: string): string | null {
  if (!password || password.length < 6) return "Senha deve ter no mínimo 6 caracteres";
  if (!/[a-z]/.test(password)) return "Senha deve conter pelo menos uma letra minúscula";
  if (!/[A-Z]/.test(password)) return "Senha deve conter pelo menos uma letra maiúscula";
  if (!/\d/.test(password)) return "Senha deve conter pelo menos um número";
  if (!/[@$!%*?&]/.test(password)) return "Senha deve conter pelo menos um caractere especial (@$!%*?&)";
  return null;
}

/** Confirmação de e-mail e recuperação de senha por link de uso único. */
export class AccountService {
  private users = AppDataSource.getRepository(User);
  private tokens = AppDataSource.getRepository(AuthToken);

  private async issue(user: User, type: "verify" | "reset", ttlMs: number) {
    // um link válido por vez: os anteriores do mesmo tipo deixam de valer
    await this.tokens.update({ user: { id: user.id }, type, usedAt: IsNull() }, { usedAt: new Date() });
    const token = crypto.randomBytes(32).toString("hex");
    await this.tokens.save(this.tokens.create({ user: { id: user.id }, type, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) }));
    return token;
  }

  private async consume(token: string, type: "verify" | "reset") {
    const found = await this.tokens.findOne({
      where: { tokenHash: hash(String(token ?? "")), type, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!found) throw new HttpError(400, type === "verify" ? "Link de confirmação inválido ou vencido. Peça um novo." : "Link inválido ou vencido. Peça uma nova redefinição de senha.");
    found.usedAt = new Date();
    await this.tokens.save(found);
    return found.user;
  }

  async sendVerification(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new HttpError(404, "Usuário não encontrado");
    if (user.emailVerified) return { alreadyVerified: true };
    const recent = await this.tokens.findOne({ where: { user: { id: userId }, type: "verify", createdAt: MoreThan(new Date(Date.now() - RESEND_SECONDS * 1000)) } });
    if (recent) throw new HttpError(429, "Aguarde um minuto para pedir outro e-mail");
    const token = await this.issue(user, "verify", VERIFY_HOURS * 3_600_000);
    await mailService.send({
      to: user.email,
      subject: "Confirme seu e-mail no Hire.",
      paragraphs: [`Olá, ${user.name.split(" ")[0]}!`, `Confirme que este e-mail é seu para receber avisos de pedidos, propostas e contratos. O link vale por ${VERIFY_HOURS} horas.`],
      action: { label: "Confirmar e-mail", url: `${frontendUrl()}/verificar-email?token=${token}` },
    });
    return { sent: true };
  }

  async verify(token: string) {
    const user = await this.consume(token, "verify");
    await this.users.update(user.id, { emailVerified: true });
    return { verified: true };
  }

  /** Sempre responde igual, exista ou não a conta (não revela e-mails cadastrados). */
  async forgot(email: string) {
    const user = await this.users.findOne({ where: { email: String(email ?? "").trim().toLowerCase() } });
    if (user) {
      const token = await this.issue(user, "reset", RESET_MINUTES * 60_000);
      await mailService.send({
        to: user.email,
        subject: "Redefinir sua senha no Hire.",
        paragraphs: [`Olá, ${user.name.split(" ")[0]}!`, `Recebemos um pedido para redefinir sua senha. O link vale por ${RESET_MINUTES} minutos e só pode ser usado uma vez.`, "Se não foi você, ignore este e-mail: sua senha continua a mesma."],
        action: { label: "Criar nova senha", url: `${frontendUrl()}/redefinir-senha?token=${token}` },
      });
    }
    return { message: "Se houver uma conta com este e-mail, enviamos um link para redefinir a senha." };
  }

  async reset(token: string, password: string) {
    const problem = passwordProblem(password);
    if (problem) throw new HttpError(400, problem);
    const user = await this.consume(token, "reset");
    const full = await this.users.findOne({ where: { id: user.id } });
    full!.password = password; // o hook do modelo gera o hash
    await this.users.save(full!);
    // a pessoa provou ter acesso ao e-mail
    if (!full!.emailVerified) await this.users.update(full!.id, { emailVerified: true });
    return { message: "Senha alterada. Entre com a nova senha." };
  }
}

export const accountService = new AccountService();
