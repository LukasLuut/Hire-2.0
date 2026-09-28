import { DataSource, type MigrationInterface, type QueryRunner } from "typeorm";
import { AppDataSource } from "./data-source";
import { ConversationNegotiations1790600000000 } from "../migrations/1790600000000-ConversationNegotiations";
import { LongerAbout1790700000000 } from "../migrations/1790700000000-LongerAbout";
import { log } from "../utils/logger";

/**
 * Antes do synchronize (desenvolvimento): converte dados que o synchronize sozinho perderia.
 * - chat v1 → v2 (colunas da negociação saem de `conversations` e vão para `negotiations`);
 * - "Sobre" do usuário maior (o synchronize recriaria a coluna e apagaria os textos).
 * Cada migration confere o próprio estado e não faz nada quando o banco já está convertido.
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
    if (Number(n) > 0) await apply(q, new ConversationNegotiations1790600000000(), 1790600000000);
    const [about] = await q.query(
      "SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'about'"
    );
    if (about && Number(about.len) < 1500) await apply(q, new LongerAbout1790700000000(), 1790700000000);
  } finally {
    await q.release();
    await ds.destroy();
  }
}

/** Roda a migration e registra como aplicada, para quem passar a usar migrations depois */
async function apply(q: QueryRunner, migration: MigrationInterface & { name: string }, timestamp: number) {
  log.info("schema.migrate", { migration: migration.name });
  await migration.up(q);
  await q.query("CREATE TABLE IF NOT EXISTS `migrations` (`id` int NOT NULL AUTO_INCREMENT, `timestamp` bigint NOT NULL, `name` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
  const done = await q.query("SELECT id FROM `migrations` WHERE name = ?", [migration.name]);
  if (!done.length) await q.query("INSERT INTO `migrations` (`timestamp`, `name`) VALUES (?, ?)", [timestamp, migration.name]);
  log.info("schema.migrated", { migration: migration.name });
}
