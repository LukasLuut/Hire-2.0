import { AppDataSource } from "../config/data-source";
import { toSlug } from "../utils/slug";

/**
 * Páginas públicas categoria + cidade (/servicos/<categoria>/<cidade>) e o retrato
 * regional de oferta. Só existem combinações com prestador ativo de verdade:
 * nada de página vazia gerada para todas as cidades do país.
 * Indexável só com conteúdo mínimo (MIN_PROVIDERS prestadores com serviço ativo).
 */
export const MIN_PROVIDERS_TO_INDEX = Number(process.env.SEO_MIN_PROVIDERS ?? 1);

export interface CityPage {
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  citySlug: string;
  providers: number;
  services: number;
  indexable: boolean;
}

/** Combinações categoria × cidade com oferta (prestador com cidade + serviço ativo na categoria) */
export async function cityPages(): Promise<CityPage[]> {
  const rows: { categoryId: number; categoryName: string; city: string; state: string | null; providers: string; services: string }[] =
    await AppDataSource.query(`
      SELECT c.id AS categoryId, c.name AS categoryName, p.baseCity AS city, p.baseState AS state,
             COUNT(DISTINCT p.id) AS providers, COUNT(DISTINCT s.id) AS services
      FROM services s
      JOIN service_providers p ON p.id = s.providerId
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = p.userId
      WHERE s.active = 1 AND p.deactivatedAt IS NULL AND p.baseCity IS NOT NULL AND p.baseCity <> '' AND u.blocked = 0
      GROUP BY c.id, c.name, p.baseCity, p.baseState
      ORDER BY providers DESC, services DESC`);
  return rows.map((r) => {
    const providers = Number(r.providers);
    const state = (r.state ?? "").toUpperCase();
    return {
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categorySlug: toSlug(r.categoryName),
      city: r.city,
      state,
      citySlug: toSlug(`${r.city}${state ? `-${state}` : ""}`),
      providers,
      services: Number(r.services),
      indexable: providers >= MIN_PROVIDERS_TO_INDEX,
    };
  });
}

export async function findCityPage(categorySlug: string, citySlug: string) {
  return (await cityPages()).find((p) => p.categorySlug === categorySlug && p.citySlug === citySlug) ?? null;
}

/**
 * Retrato regional para a administração: oferta (prestadores, serviços, categorias),
 * demanda aproximada (clientes com endereço na cidade — só contagem) e as páginas
 * categoria/cidade existentes. Cidades com clientes e pouca oferta aparecem marcadas.
 */
export async function regionalOverview(lowSupplyBelow = 3) {
  const supply = await regionalSupply();
  const clients: { city: string; state: string | null; clients: string }[] = await AppDataSource.query(`
    SELECT a.city AS city, a.state AS state, COUNT(DISTINCT u.id) AS clients
    FROM users u JOIN address a ON a.id = u.addressId
    WHERE u.blocked = 0 AND a.city IS NOT NULL AND a.city <> ''
    GROUP BY a.city, a.state`);
  const key = (city: string, state: string | null) => `${city.trim().toLowerCase()}|${(state ?? "").trim().toUpperCase()}`;
  const rows = new Map<string, { city: string; state: string; providers: number; services: number; categories: number; clients: number }>();
  for (const s of supply) rows.set(key(s.city, s.state), { ...s, clients: 0 });
  for (const c of clients) {
    const k = key(c.city, c.state);
    const row = rows.get(k) ?? { city: c.city, state: (c.state ?? "").toUpperCase(), providers: 0, services: 0, categories: 0, clients: 0 };
    row.clients = Number(c.clients);
    rows.set(k, row);
  }
  const regions = [...rows.values()]
    .map((r) => ({ ...r, lowSupply: r.providers < lowSupplyBelow }))
    .sort((a, b) => b.clients - a.clients || b.providers - a.providers);
  return { lowSupplyBelow, regions, pages: await cityPages() };
}

/** Oferta por cidade (todas as categorias): prestadores e serviços ativos — base da estratégia regional */
export async function regionalSupply() {
  const rows: { city: string; state: string | null; providers: string; services: string; categories: string }[] = await AppDataSource.query(`
    SELECT p.baseCity AS city, p.baseState AS state,
           COUNT(DISTINCT p.id) AS providers,
           COUNT(DISTINCT CASE WHEN s.active = 1 THEN s.id END) AS services,
           COUNT(DISTINCT CASE WHEN s.active = 1 THEN s.category_id END) AS categories
    FROM service_providers p
    JOIN users u ON u.id = p.userId
    LEFT JOIN services s ON s.providerId = p.id
    WHERE p.deactivatedAt IS NULL AND p.baseCity IS NOT NULL AND p.baseCity <> '' AND u.blocked = 0
    GROUP BY p.baseCity, p.baseState
    ORDER BY providers DESC`);
  return rows.map((r) => ({ city: r.city, state: (r.state ?? "").toUpperCase(), providers: Number(r.providers), services: Number(r.services), categories: Number(r.categories) }));
}
