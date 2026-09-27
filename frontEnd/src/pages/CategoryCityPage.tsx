import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MapPin, UserPlus } from "lucide-react";
import { apiRequest } from "../api/ApiClient";
import { toServiceData, type ServiceData } from "../api/ServiceAPI";
import type { ServiceEntity } from "../interfaces/Entities";
import ServiceGallery from "../components/ServiceGallery/ServiceGallery/ServiceGallery";
import { ProviderProfileSkeleton } from "../skeletons/ProviderProfileSkeleton/ProviderProfileSkeleton";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * /servicos/:categoria/:cidade — página pública de uma categoria numa cidade.
 * Só existe quando há oferta real (o servidor devolve 404 caso contrário).
 * Conteúdo: resumo, serviços (mesmos cards da vitrine) e links internos.
 * -------------------------------------------------------------------------- */
interface PageLink { categoryName: string; categorySlug: string; city: string; state: string; citySlug: string; providers: number }
interface CityPageData extends PageLink { services: ServiceEntity[]; sameCity: PageLink[]; sameCategory: PageLink[]; indexable: boolean }

export const cityPagePath = (p: { categorySlug: string; citySlug: string }) => `/servicos/${p.categorySlug}/${p.citySlug}`;

export default function CategoryCityPage() {
  const { categoria = "", cidade = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CityPageData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    apiRequest<CityPageData>(`/discover/${encodeURIComponent(categoria)}/${encodeURIComponent(cidade)}`)
      .then((d) => {
        setData(d);
        setServices(d.services.map((s) => toServiceData(s)));
        document.title = `${d.categoryName} em ${d.city}/${d.state} | Hire.`;
      })
      .catch((e) => setError(getErrorMessage(e, "Página não encontrada.")));
    return () => {
      document.title = "Hire.";
    };
  }, [categoria, cidade]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 px-6 text-center text-[var(--text)]">
        <h1 className="text-2xl font-semibold">{error}</h1>
        <p className="text-[var(--text-muted)] mt-2">Conhece alguém que faz esse serviço na sua cidade?</p>
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          <button onClick={() => navigate("/convidar")} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white inline-flex items-center gap-2">
            <UserPlus size={18} /> Convidar um profissional
          </button>
          <Link to="/" className="px-4 py-2 rounded-xl border border-[var(--border)]">Conhecer o Hire</Link>
        </div>
      </div>
    );
  }
  if (!data) return <ProviderProfileSkeleton />;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] pt-28 pb-16 text-[var(--text)] px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-[var(--text-muted)] flex items-center gap-1"><MapPin size={14} /> {data.city}/{data.state}</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">{data.categoryName} em {data.city}</h1>
        <p className="text-[var(--text-muted)] mt-2">
          {data.providers} profissional(is) e {services.length} serviço(s) ativo(s) no Hire. Veja avaliações, preços e peça orçamento sem compromisso.
        </p>

        <ServiceGallery services={services} noEdit title="Serviços" />

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {data.sameCity.length > 0 && (
            <nav aria-label={`Outras categorias em ${data.city}`}>
              <h2 className="font-semibold mb-2">Outros serviços em {data.city}</h2>
              <ul className="flex flex-wrap gap-2">
                {data.sameCity.map((p) => (
                  <li key={p.categorySlug}><Link to={cityPagePath(p)} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-sm hover:border-[var(--primary)]">{p.categoryName}</Link></li>
                ))}
              </ul>
            </nav>
          )}
          {data.sameCategory.length > 0 && (
            <nav aria-label={`${data.categoryName} em outras cidades`}>
              <h2 className="font-semibold mb-2">{data.categoryName} em outras cidades</h2>
              <ul className="flex flex-wrap gap-2">
                {data.sameCategory.map((p) => (
                  <li key={p.citySlug}><Link to={cityPagePath(p)} className="px-3 py-1.5 rounded-full border border-[var(--border)] text-sm hover:border-[var(--primary)]">{p.city}/{p.state}</Link></li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="mt-10 p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-light)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Não encontrou quem procura?</h2>
            <p className="text-sm text-[var(--text-muted)]">Convide um profissional de {data.city} para o Hire.</p>
          </div>
          <Link to={`/convidar?categoria=${encodeURIComponent(data.categoryName)}&cidade=${encodeURIComponent(data.city)}`} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white inline-flex items-center gap-2">
            <UserPlus size={18} /> Convidar profissional
          </Link>
        </div>
      </div>
    </div>
  );
}
