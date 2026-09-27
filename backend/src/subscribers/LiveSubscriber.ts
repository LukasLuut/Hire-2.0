import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, TransactionCommitEvent, UpdateEvent } from "typeorm";
import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";
import { publish } from "../utils/events";

const PENDING = Symbol("liveConversations");

/**
 * Avisa em tempo real as duas partes de uma conversa quando entra mensagem
 * (inclusive de sistema) ou quando a conversa muda (tópicos, aceites, status).
 *
 * O aviso só sai DEPOIS do commit: o save do TypeORM roda em transação, e avisar
 * no afterInsert fazia a outra parte buscar a conversa antes de a mensagem existir
 * (sem "não lida", sem círculo no chat). As conversas ficam guardadas na transação
 * e são avisadas em afterTransactionCommit.
 */
@EventSubscriber()
export class LiveSubscriber implements EntitySubscriberInterface {
  private remember(event: InsertEvent<any> | UpdateEvent<any>, id: number | undefined) {
    if (!id) return;
    const data = event.queryRunner.data as Record<symbol, Set<number> | undefined>;
    (data[PENDING] ??= new Set()).add(id);
    // fora de transação (raro): não haverá commit para esperar
    if (!event.queryRunner.isTransactionActive) this.flush(event.connection, data);
  }

  private flush(connection: DataSource, data: Record<symbol, Set<number> | undefined>) {
    const ids = data[PENDING];
    if (!ids?.size) return;
    data[PENDING] = undefined;
    // conexão própria: a da transação é liberada logo depois do commit
    setImmediate(async () => {
      for (const id of ids) {
        try {
          const conv = await connection.getRepository(Conversation).findOne({
            where: { id },
            relations: { client: true, provider: { user: true } },
            select: { id: true, client: { id: true }, provider: { id: true, user: { id: true } } },
          });
          if (conv) publish([conv.client?.id, conv.provider?.user?.id], { type: "conversation", id: conv.id });
        } catch (err: any) {
          console.error("Falha ao avisar conversa em tempo real:", err?.message ?? err);
        }
      }
    });
  }

  afterInsert(event: InsertEvent<any>) {
    if (event.metadata.target === Message) this.remember(event, (event.entity as Message).conversation?.id);
  }

  afterUpdate(event: UpdateEvent<any>) {
    if (event.metadata.target !== Conversation) return;
    this.remember(event, (event.entity as Conversation | undefined)?.id ?? (event.databaseEntity as Conversation | undefined)?.id);
  }

  afterTransactionCommit(event: TransactionCommitEvent) {
    this.flush(event.connection, event.queryRunner.data as Record<symbol, Set<number> | undefined>);
  }

  afterTransactionRollback(event: TransactionCommitEvent) {
    (event.queryRunner.data as Record<symbol, Set<number> | undefined>)[PENDING] = undefined;
  }
}
