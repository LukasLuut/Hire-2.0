import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent } from "typeorm";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";
import { publish } from "../utils/events";

/**
 * Avisa em tempo real as duas partes de uma conversa quando entra mensagem
 * (inclusive de sistema) ou quando a conversa muda (tópicos, aceites, status).
 */
@EventSubscriber()
export class LiveSubscriber implements EntitySubscriberInterface {
  private notifyConversation(event: InsertEvent<any> | UpdateEvent<any>, id: number | undefined) {
    if (!id) return;
    // roda depois do commit, com uma conexão própria (a da transação já foi liberada)
    setImmediate(async () => {
      try {
        const conv = await event.connection.getRepository(Conversation).findOne({
          where: { id },
          relations: { client: true, provider: { user: true } },
          select: { id: true, client: { id: true }, provider: { id: true, user: { id: true } } },
        });
        if (conv) publish([conv.client?.id, conv.provider?.user?.id], { type: "conversation", id: conv.id });
      } catch (err: any) {
        console.error("Falha ao avisar conversa em tempo real:", err?.message ?? err);
      }
    });
  }

  afterInsert(event: InsertEvent<any>) {
    if (event.metadata.target === Message) this.notifyConversation(event, (event.entity as Message).conversation?.id);
  }

  afterUpdate(event: UpdateEvent<any>) {
    if (event.metadata.target !== Conversation) return;
    this.notifyConversation(event, (event.entity as Conversation | undefined)?.id ?? (event.databaseEntity as Conversation | undefined)?.id);
  }
}
