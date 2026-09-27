import { DataSource } from "typeorm";
import { AppDataSource } from "./data-source";
import { ConversationNegotiations1790600000000 } from "../migrations/1790600000000-ConversationNegotiations";
import { log } from "../utils/logger";

/**
 * Antes do synchronize (desenvolvimento): converte dados que o synchronize sozinho perderia.
 * Hoje: chat v1 → v2 (colunas da negociação saem de `conversations` e vão para `negotiations`).
 * Sem isso, o synchronize apagaria as colunas antigas antes de os dados serem copiados.
 * Com DB_SYNC=false quem cuida disso são as migrations, que rodam no initialize.
 */
export async function prepareSchema() {
  if (process.env.DB_SYNC === "false") return;
  const ds = new DataSource({ ...(AppDataSource.options as any), synchronize: false, migrationsRun: false, entities: [], subscribers: [], migrations: [] });
  await ds.initialize();
  const q = ds.createQueryRunner();
  try {
    const [{ n }] = await q.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND COLUMN_NAME = 'status'"
    );
    if (Number(n) === 0) return;
    log.info("schema.migrate", { migration: "ConversationNegotiations" });
    const migration = new ConversationNegotiations1790600000000();
    await migration.up(q);
    // registra como aplicada, para quem passar a usar migrations depois
    await q.query("CREATE TABLE IF NOT EXISTS `migrations` (`id` int NOT NULL AUTO_INCREMENT, `timestamp` bigint NOT NULL, `name` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
    const done = await q.query("SELECT id FROM `migrations` WHERE name = ?", [migration.name]);
    if (!done.length) await q.query("INSERT INTO `migrations` (`timestamp`, `name`) VALUES (?, ?)", [1790600000000, migration.name]);
    log.info("schema.migrated", { migration: "ConversationNegotiations" });
  } finally {
    await q.release();
    await ds.destroy();
  }
}
