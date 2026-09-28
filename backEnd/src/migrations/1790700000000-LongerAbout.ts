import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * "Sobre" do usuário: de 400 para 1500 caracteres (o perfil público passa a mostrar o texto
 * completo do prestador — como começou, como trabalha, onde atende).
 *
 * Só aumenta o tamanho (MODIFY): nenhum texto existente é cortado. Roda antes do synchronize
 * no desenvolvimento, porque o synchronize recriaria a coluna ao ver o tamanho novo.
 */
export class LongerAbout1790700000000 implements MigrationInterface {
  name = "LongerAbout1790700000000";

  public async up(q: QueryRunner): Promise<void> {
    const [col] = await q.query(
      "SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'about'"
    );
    if (!col || Number(col.len) >= 1500) return;
    await q.query("ALTER TABLE `users` MODIFY `about` varchar(1500) NULL");
  }

  public async down(q: QueryRunner): Promise<void> {
    // volta ao tamanho antigo cortando o excedente (não há como guardar o resto)
    await q.query("UPDATE `users` SET `about` = LEFT(`about`, 400) WHERE CHAR_LENGTH(`about`) > 400");
    await q.query("ALTER TABLE `users` MODIFY `about` varchar(400) NULL");
  }
}
