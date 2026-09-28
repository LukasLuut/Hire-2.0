/**
 * Apaga todas as contas de um domínio de demonstração (ex.: demo.hire.dev) e tudo o que está ligado a elas:
 * prestadores, serviços, contratações, pagamentos, contratos, conversas, negociações, avaliações, notificações.
 * Usado pelos seeds de demonstração (seed-demo.ts e ../story/seed-story.ts). Nada fora do domínio é tocado.
 */
import { AppDataSource } from "../../src/config/data-source";

export async function resetDomain(domain: string) {
  const q = (sql: string, p: unknown[] = []) => AppDataSource.query(sql, p);
  const users: { id: number; addressId: number | null }[] = await q("SELECT id, addressId FROM users WHERE email LIKE ?", [`%@${domain}`]);
  if (!users.length) return console.log(`nenhum dado de @${domain} para apagar`);
  const uid = users.map((u) => u.id);
  const provs: { id: number }[] = await q("SELECT id FROM service_providers WHERE userId IN (?)", [uid]);
  const pid = provs.length ? provs.map((p) => p.id) : [0];
  const hires: { id: number }[] = await q("SELECT id FROM hires WHERE userId IN (?) OR providerId IN (?)", [uid, pid]);
  const hid = hires.length ? hires.map((h) => h.id) : [0];
  const services: { id: number }[] = await q("SELECT id FROM services WHERE providerId IN (?)", [pid]);
  const sid = services.length ? services.map((s) => s.id) : [0];
  const convs: { id: number }[] = await q("SELECT id FROM conversations WHERE clientId IN (?) OR providerId IN (?)", [uid, pid]);
  const cid = convs.length ? convs.map((c) => c.id) : [0];
  await q("SET FOREIGN_KEY_CHECKS = 0");
  try {
    await q("DELETE FROM review_photos WHERE reviewId IN (SELECT id FROM reviews WHERE hireId IN (?) OR authorId IN (?) OR targetId IN (?))", [hid, uid, uid]);
    await q("DELETE FROM reviews WHERE hireId IN (?) OR authorId IN (?) OR targetId IN (?)", [hid, uid, uid]);
    await q("DELETE FROM payments WHERE hireId IN (?) OR providerId IN (?) OR userId IN (?)", [hid, pid, uid]);
    await q("DELETE FROM contracts WHERE hireId IN (?) OR providerId IN (?) OR userId IN (?)", [hid, pid, uid]);
    await q("DELETE FROM withdrawals WHERE providerId IN (?)", [pid]);
    await q("DELETE FROM provider_favorites WHERE userId IN (?) OR providerId IN (?)", [uid, pid]);
    await q("DELETE FROM service_likes WHERE userId IN (?) OR serviceId IN (?)", [uid, sid]);
    await q("DELETE FROM notifications WHERE userId IN (?)", [uid]);
    await q("DELETE FROM portfolio_items WHERE providerId IN (?)", [pid]);
    await q("DELETE FROM analytics_daily WHERE providerId IN (?) OR serviceId IN (?)", [pid, sid]);
    await q("DELETE FROM reports WHERE reporterId IN (?) OR hireId IN (?) OR providerId IN (?)", [uid, hid, pid]);
    await q("DELETE FROM messages WHERE conversationId IN (?)", [cid]);
    await q("DELETE FROM negotiations WHERE conversationId IN (?)", [cid]);
    await q("DELETE FROM conversations WHERE id IN (?)", [cid]);
    await q("DELETE FROM invites WHERE inviterId IN (?)", [uid]);
    await q("DELETE FROM hires WHERE id IN (?)", [hid]);
    await q("DELETE FROM services WHERE id IN (?)", [sid]);
    for (const t of ["availabilities", "subcategories", "links"]) await q(`DELETE FROM ${t} WHERE providerId IN (?)`, [pid]);
    await q("DELETE FROM service_providers WHERE id IN (?)", [pid]);
    await q("DELETE FROM support_tickets WHERE userId IN (?)", [uid]);
    await q("DELETE FROM auth_tokens WHERE userId IN (?)", [uid]);
    await q("DELETE FROM users WHERE id IN (?)", [uid]);
    const addr = users.map((u) => u.addressId).filter(Boolean);
    if (addr.length) await q("DELETE FROM address WHERE id IN (?)", [addr]);
  } finally {
    await q("SET FOREIGN_KEY_CHECKS = 1");
  }
  console.log(`apagados de @${domain}: ${users.length} contas, ${provs.length} prestadores, ${services.length} serviços, ${hires.length} contratações, ${convs.length} conversas`);
}
