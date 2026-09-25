import fs from "fs";
import path from "path";
import nodemailer, { type Transporter } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  /** Parágrafos do corpo (texto simples); viram HTML com o layout do Hire. */
  paragraphs: string[];
  /** Botão principal do e-mail */
  action?: { label: string; url: string };
}

const OUTBOX = path.join(__dirname, "..", "..", "outbox");

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}

function render(mail: Mail) {
  const body = mail.paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escape(p)}</p>`).join("");
  const button = mail.action
    ? `<p style="margin:24px 0"><a href="${escape(mail.action.url)}" style="background:#0062e6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${escape(mail.action.label)}</a></p>
       <p style="font-size:12px;color:#666">Se o botão não abrir, copie este endereço: ${escape(mail.action.url)}</p>`
    : "";
  const html = `<!doctype html><html lang="pt-br"><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:28px;color:#111">
      <h1 style="font-size:22px;margin:0 0 18px">Hire.</h1>${body}${button}
      <p style="font-size:12px;color:#888;margin-top:28px">Você recebeu este e-mail porque tem uma conta no Hire.</p>
    </div></body></html>`;
  const text = [...mail.paragraphs, mail.action ? `${mail.action.label}: ${mail.action.url}` : ""].filter(Boolean).join("\n\n");
  return { html, text };
}

/**
 * Envio de e-mail. Com SMTP_HOST no .env usa o servidor SMTP; sem ele (desenvolvimento),
 * grava cada e-mail em backend/outbox/*.html para abrir no navegador.
 */
export class MailService {
  private transporter: Transporter | null = null;

  private transport() {
    if (!process.env.SMTP_HOST) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      });
    }
    return this.transporter;
  }

  async send(mail: Mail) {
    const { html, text } = render(mail);
    const transport = this.transport();
    if (transport) {
      await transport.sendMail({
        from: process.env.MAIL_FROM || "Hire. <nao-responda@hire.dev>",
        to: mail.to,
        subject: mail.subject,
        html,
        text,
      });
      return { delivered: "smtp" as const };
    }
    fs.mkdirSync(OUTBOX, { recursive: true });
    const safeTo = mail.to.replace(/[^\w.@-]/g, "_");
    const file = path.join(OUTBOX, `${Date.now()}-${safeTo}.html`);
    fs.writeFileSync(file, html.replace("<body", `<!-- Para: ${escape(mail.to)} | Assunto: ${escape(mail.subject)} -->\n<body`));
    console.info(`[e-mail de desenvolvimento] ${mail.subject} → ${mail.to}: ${file}`);
    return { delivered: "outbox" as const, file };
  }
}

export const mailService = new MailService();

/** Endereço do frontend para montar links nos e-mails */
export const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
