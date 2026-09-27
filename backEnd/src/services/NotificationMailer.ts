import { AppDataSource } from "../config/data-source";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { NotificationService } from "./NotificationService";
import { frontendUrl, mailService } from "./MailService";

/**
 * Avisos por e-mail: cada aviso novo também vai por e-mail para quem confirmou
 * o e-mail e mantém a preferência ligada. Avisos agrupados (várias mensagens
 * seguidas) atualizam o mesmo aviso e não geram e-mails repetidos.
 */
export function registerNotificationMailer() {
  NotificationService.onCreate(async (userId, notification) => {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user || !user.emailVerified || user.emailNotifications === false) return;
    await mailService.send({
      to: user.email,
      subject: notification.title,
      paragraphs: [notification.body || notification.title, "Para parar de receber estes e-mails, desligue a opção na Central de pendências."],
      action: notification.link ? { label: "Abrir no Hire", url: `${frontendUrl()}${notification.link}` } : undefined,
    });
    await AppDataSource.getRepository(Notification).update(notification.id, { emailed: true });
  });
}
