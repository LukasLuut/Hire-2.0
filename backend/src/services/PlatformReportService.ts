import { AppDataSource } from "../config/data-source";

const num = (v: unknown) => Number(v ?? 0) || 0;
const cents = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

/**
 * Relatórios da plataforma para a administração (período em dias).
 * Só números agregados: nenhum dado pessoal sai daqui.
 */
export class PlatformReportService {
  async summary(daysRaw: unknown) {
    const days = [7, 30, 90, 365].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
    const since = new Date(Date.now() - days * 86400000);
    const q = (sql: string, params: unknown[] = []) => AppDataSource.query(sql, params);

    const [hires] = await q(
      `SELECT COUNT(*) AS created,
              SUM(status = 'CONCLUIDO') AS completed,
              SUM(status_provider = 'CANCELADO') AS cancelled,
              SUM(status_provider = 'CANCELADO' AND cancelledBy = 'sistema') AS expired,
              SUM(lateCancel = 1) AS lateCancels
         FROM hires WHERE createdAt >= ?`,
      [since]
    );
    const [money] = await q(
      `SELECT COALESCE(SUM(CASE WHEN status <> 'ESTORNADO' THEN amount END), 0) AS gmv,
              COALESCE(SUM(CASE WHEN status = 'LIBERADO' THEN fee END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN status = 'ESTORNADO' THEN amount END), 0) AS refunded,
              SUM(status <> 'ESTORNADO') AS paidCount
         FROM payments WHERE paidAt >= ?`,
      [since]
    );
    const [quotes] = await q(
      `SELECT COUNT(*) AS requests, SUM(status = 'FORMALIZED') AS formalized
         FROM negotiations WHERE createdAt >= ? AND request IS NOT NULL`,
      [since]
    );
    const [rating] = await q(
      `SELECT AVG(rating) AS average, COUNT(*) AS count FROM reviews WHERE createdAt >= ? AND direction = 'CLIENT_TO_PROVIDER'`,
      [since]
    );
    const [people] = await q(
      `SELECT (SELECT COUNT(*) FROM users WHERE acceptedAt >= ?) AS newUsers,
              (SELECT COUNT(*) FROM service_providers WHERE createdAt >= ?) AS newProviders`,
      [since, since]
    );
    const categories = await q(
      `SELECT c.name AS name, COUNT(h.id) AS hires, SUM(h.status = 'CONCLUIDO') AS completed, COALESCE(SUM(CASE WHEN h.status = 'CONCLUIDO' THEN h.price END), 0) AS volume
         FROM hires h JOIN services s ON s.id = h.serviceId JOIN categories c ON c.id = s.category_id
        WHERE h.createdAt >= ?
        GROUP BY c.id, c.name ORDER BY hires DESC LIMIT 8`,
      [since]
    );
    // pedidos por dia (série para o gráfico simples)
    const daily = await q(
      `SELECT DATE(createdAt) AS day, COUNT(*) AS hires, SUM(status = 'CONCLUIDO') AS completed
         FROM hires WHERE createdAt >= ? GROUP BY DATE(createdAt) ORDER BY day`,
      [since]
    );

    const created = num(hires.created);
    const completed = num(hires.completed);
    const cancelled = num(hires.cancelled);
    const gmv = cents(num(money.gmv));
    const paidCount = num(money.paidCount);
    return {
      days,
      since,
      hires: { created, completed, cancelled, expired: num(hires.expired), lateCancels: num(hires.lateCancels), completionRate: pct(completed, created), cancelRate: pct(cancelled, created) },
      money: { gmv, revenue: cents(num(money.revenue)), refunded: cents(num(money.refunded)), averageTicket: paidCount ? cents(gmv / paidCount) : 0 },
      quotes: { requests: num(quotes.requests), formalized: num(quotes.formalized), conversionRate: pct(num(quotes.formalized), num(quotes.requests)) },
      rating: { average: rating.average ? Math.round(Number(rating.average) * 10) / 10 : 0, count: num(rating.count) },
      people: { newUsers: num(people.newUsers), newProviders: num(people.newProviders) },
      categories: categories.map((c: any) => ({ name: c.name, hires: num(c.hires), completed: num(c.completed), volume: cents(num(c.volume)) })),
      daily: daily.map((d: any) => ({ day: d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day).slice(0, 10), hires: num(d.hires), completed: num(d.completed) })),
    };
  }
}

export const platformReportService = new PlatformReportService();
