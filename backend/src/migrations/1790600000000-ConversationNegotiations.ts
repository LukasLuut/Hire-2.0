import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Chat v2: uma conversa por par cliente ↔ prestador, com as negociações dentro dela.
 *
 * 1. cria `negotiations` e copia para lá tópicos, pedido, aceites e status de cada conversa antiga
 *    (conversas sem serviço, sem pedido e ainda abertas eram só chat: não viram negociação);
 * 2. liga as mensagens de sistema à negociação de origem;
 * 3. junta as conversas do mesmo par na mais antiga (mensagens, negociações e links de notificação);
 * 4. tira de `conversations` as colunas que agora são da negociação e cria as de leitura.
 *
 * Não tem volta automática: antes de rodar em produção, faça `npm run backup`.
 */
export class ConversationNegotiations1790600000000 implements MigrationInterface {
  name = "ConversationNegotiations1790600000000";

  public async up(q: QueryRunner): Promise<void> {
    const hasColumn = async (table: string, column: string) =>
      Number((await q.query(`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]))[0].n) > 0;
    const hasTable = async (table: string) =>
      Number((await q.query(`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table]))[0].n) > 0;
    const dropForeignKeysOn = async (table: string, column: string) => {
      const fks = await q.query(`SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`, [table, column]);
      for (const fk of fks) await q.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fk.name}\``);
    };

    // esquema já convertido: nada a fazer
    if (!(await hasColumn("conversations", "status"))) return;

    // restos de uma sincronização parcial (tabela nova vazia, colunas novas): limpa antes de converter
    if (await hasTable("negotiations")) {
      if (Number((await q.query("SELECT COUNT(*) AS n FROM `negotiations`"))[0].n) > 0) throw new Error("negotiations já tem dados e conversations ainda está no formato antigo: verifique o banco antes de migrar");
      await dropForeignKeysOn("messages", "negotiationId");
      await q.query("DROP TABLE `negotiations`");
    }
    for (const col of ["negotiationId", "event"]) {
      if (await hasColumn("messages", col)) {
        await dropForeignKeysOn("messages", col);
        await q.query(`ALTER TABLE \`messages\` DROP COLUMN \`${col}\``);
      }
    }
    for (const idx of await q.query(`SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND INDEX_NAME IN ('IDX_conversations_pair', 'IDX_conversations_last_message')`)) {
      await q.query(`DROP INDEX \`${idx.name}\` ON \`conversations\``);
    }
    for (const col of ["lastMessageAt", "clientLastReadAt", "providerLastReadAt"]) {
      if (await hasColumn("conversations", col)) await q.query(`ALTER TABLE \`conversations\` DROP COLUMN \`${col}\``);
    }

    await q.query(`CREATE TABLE \`negotiations\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`status\` enum ('OPEN', 'FORMALIZED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
      \`origin\` varchar(20) NOT NULL DEFAULT 'servico',
      \`createdBy\` varchar(20) NOT NULL DEFAULT 'cliente',
      \`title\` varchar(120) NOT NULL DEFAULT '',
      \`topics\` json NULL,
      \`request\` json NULL,
      \`requestStatus\` enum ('PENDENTE', 'RESPONDIDA', 'RECUSADA') NULL,
      \`rejectReason\` varchar(500) NULL,
      \`closedBy\` varchar(20) NULL,
      \`closeReason\` varchar(500) NULL,
      \`clientAcceptedAt\` datetime NULL,
      \`providerAcceptedAt\` datetime NULL,
      \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      \`conversationId\` int NULL,
      \`serviceId\` int NULL,
      \`hireId\` int NULL,
      \`contractId\` int NULL,
      INDEX \`IDX_negotiations_conversation_status\` (\`conversationId\`, \`status\`),
      PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    await q.query(`ALTER TABLE \`negotiations\` ADD CONSTRAINT \`FK_negotiations_conversation\` FOREIGN KEY (\`conversationId\`) REFERENCES \`conversations\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await q.query(`ALTER TABLE \`negotiations\` ADD CONSTRAINT \`FK_negotiations_service\` FOREIGN KEY (\`serviceId\`) REFERENCES \`services\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await q.query(`ALTER TABLE \`negotiations\` ADD CONSTRAINT \`FK_negotiations_hire\` FOREIGN KEY (\`hireId\`) REFERENCES \`hires\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await q.query(`ALTER TABLE \`negotiations\` ADD CONSTRAINT \`FK_negotiations_contract\` FOREIGN KEY (\`contractId\`) REFERENCES \`contracts\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);

    // 1. cada negociação antiga vira uma linha em negotiations
    await q.query(`INSERT INTO \`negotiations\`
      (\`conversationId\`, \`serviceId\`, \`hireId\`, \`contractId\`, \`status\`, \`origin\`, \`createdBy\`, \`title\`, \`topics\`, \`request\`, \`requestStatus\`,
       \`rejectReason\`, \`closedBy\`, \`closeReason\`, \`clientAcceptedAt\`, \`providerAcceptedAt\`, \`createdAt\`, \`updatedAt\`)
      SELECT c.id, c.serviceId, c.hireId, c.contractId, c.status,
             IF(c.request IS NULL, 'servico', 'pedido'), 'cliente',
             LEFT(COALESCE(s.title, JSON_UNQUOTE(JSON_EXTRACT(c.request, '$.description')), 'Outro serviço'), 120),
             c.topics, c.request, c.requestStatus, c.rejectReason, c.closedBy, c.closeReason,
             c.clientAcceptedAt, c.providerAcceptedAt, c.createdAt, c.updatedAt
        FROM \`conversations\` c LEFT JOIN \`services\` s ON s.id = c.serviceId
       WHERE NOT (c.serviceId IS NULL AND c.request IS NULL AND c.status = 'OPEN' AND c.hireId IS NULL)`);

    // 2. mensagens ganham o vínculo com a negociação (cards na linha do tempo)
    await q.query(`ALTER TABLE \`messages\` ADD \`negotiationId\` int NULL, ADD \`event\` varchar(30) NULL`);
    await q.query(`ALTER TABLE \`messages\` ADD CONSTRAINT \`FK_messages_negotiation\` FOREIGN KEY (\`negotiationId\`) REFERENCES \`negotiations\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    await q.query(`UPDATE \`messages\` m JOIN \`negotiations\` n ON n.conversationId = m.conversationId SET m.negotiationId = n.id WHERE m.role = 'system'`);

    // 3. junta as conversas do mesmo par na mais antiga
    await q.query(`CREATE TEMPORARY TABLE \`conv_merge\` AS
      SELECT c.id AS oldId, k.keepId FROM \`conversations\` c
        JOIN (SELECT clientId, providerId, MIN(id) AS keepId FROM \`conversations\` GROUP BY clientId, providerId) k
          ON k.clientId <=> c.clientId AND k.providerId <=> c.providerId
       WHERE c.id <> k.keepId`);
    await q.query(`UPDATE \`messages\` m JOIN \`conv_merge\` x ON x.oldId = m.conversationId SET m.conversationId = x.keepId`);
    await q.query(`UPDATE \`negotiations\` n JOIN \`conv_merge\` x ON x.oldId = n.conversationId SET n.conversationId = x.keepId`);
    await q.query(`UPDATE \`notifications\` t JOIN \`conv_merge\` x ON t.link = CONCAT('/negotiation/', x.oldId) SET t.link = CONCAT('/negotiation/', x.keepId)`);
    await q.query(`DELETE c FROM \`conversations\` c JOIN \`conv_merge\` x ON x.oldId = c.id`);
    await q.query(`DROP TEMPORARY TABLE \`conv_merge\``);

    // 4. conversa só guarda o par e a leitura de cada parte
    for (const col of ["serviceId", "hireId", "contractId"]) await dropForeignKeysOn("conversations", col);
    await q.query(`ALTER TABLE \`conversations\`
      DROP COLUMN \`status\`, DROP COLUMN \`topics\`, DROP COLUMN \`request\`, DROP COLUMN \`requestStatus\`,
      DROP COLUMN \`rejectReason\`, DROP COLUMN \`closedBy\`, DROP COLUMN \`closeReason\`,
      DROP COLUMN \`clientAcceptedAt\`, DROP COLUMN \`providerAcceptedAt\`,
      DROP COLUMN \`serviceId\`, DROP COLUMN \`hireId\`, DROP COLUMN \`contractId\`,
      ADD \`lastMessageAt\` datetime(6) NULL, ADD \`clientLastReadAt\` datetime(6) NULL, ADD \`providerLastReadAt\` datetime(6) NULL`);
    await q.query(`UPDATE \`conversations\` c SET
      c.lastMessageAt = (SELECT MAX(m.createdAt) FROM \`messages\` m WHERE m.conversationId = c.id),
      c.clientLastReadAt = NOW(6), c.providerLastReadAt = NOW(6)`);
    await q.query(`CREATE UNIQUE INDEX \`IDX_conversations_pair\` ON \`conversations\` (\`clientId\`, \`providerId\`)`);
    await q.query(`CREATE INDEX \`IDX_conversations_last_message\` ON \`conversations\` (\`lastMessageAt\`)`);
  }

  public async down(): Promise<void> {
    throw new Error("ConversationNegotiations não é reversível: restaure o backup feito antes (npm run restore).");
  }
}
