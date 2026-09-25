import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Search,
  Filter,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  HandCoins,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { serviceAPI, serviceImages, type ServiceData } from "../api/ServiceAPI";
import LocationBar from "../components/LocationBar";
import ServiceAreaLine from "../components/ServiceAreaLine";
import { loadLocation, saveLocation, type ClientLocation } from "../utils/location";
import { providerApi } from "../api/ProviderAPI";
import ServiceDetail from "../components/ServiceGallery/ServiceDetail/ServiceDetail";
import { ServicesPageSkeleton } from "../skeletons/ServiceSkeleton/ServicesPageSkeleton";
import { avatarFor } from "../utils/avatar";
import { formatCurrency } from "../utils/format";

/**
 * ServiceDashboardSophisticated.tsx
 *
 * Requisitos:
 *  - Tailwind CSS + suas variáveis de tema (--bg, --bg-light, --highlight, etc.)
 *  - Framer Motion
 *  - Lucide icons
 *
 * Dados reais da API: serviços (com nota e curtidas) e ranking de prestadores.
 */

type Service = {
  id: number;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  images: string[];
  rating: number;
  ratingCount: number;
  price: number;
  duration: string;
  location?: string;
  data: ServiceData; // serviço completo (para o modal de detalhes)
  provider?: {
    professionalName?: string;
    profileImageUrl?: string | null;
    description?: string;
    id: number;
    rating: number;
    ratingCount: number;
  };
};

type Provider = {
  id: number;
  name: string;
  avatar: string;
  rating: number;
  ratingCount: number;
  specialty: string;
};

/** Converte o serviço da API para o formato dos cards desta tela. */
function toCard(e: ServiceData): Service {
  return {
    id: e.id,
    title: e.title,
    shortDescription: e.description_service,
    description: e.description_service,
    category: e.category.name,
    images: serviceImages(e),
    rating: e.rating,
    ratingCount: e.ratingCount,
    price: e.price,
    duration: e.duration,
    data: e,
    provider: e.provider?.id
      ? {
          id: e.provider.id,
          professionalName: e.provider.companyName || e.provider.professionalName,
          profileImageUrl: e.provider.profileImageUrl,
          description: e.provider.description,
          rating: e.provider.rating?.average ?? 0,
          ratingCount: e.provider.rating?.count ?? 0,
        }
      : undefined,
  };
}

export default function ServiceDashboardSophisticated() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);

  // search + filters
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "price" | "distance">(
    "relevance"
  );

  // localização do cliente (busca por proximidade), lembrada no navegador
  const [location, setLocationState] = useState<ClientLocation | null>(() => loadLocation());
  const [onlyNearby, setOnlyNearby] = useState(false);
  const setLocation = (loc: ClientLocation | null) => {
    saveLocation(loc);
    setLocationState(loc);
    if (!loc) {
      setOnlyNearby(false);
      if (sortBy === "distance") setSortBy("relevance");
    }
  };

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [page, setPage] = useState(1);

  // small debounce for search
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // busca serviços e prestadores reais
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(false);

    const load = async () => {
      try {
        const [data, provs] = await Promise.all([
          serviceAPI.getServices(location ? { lat: location.lat, lng: location.lng, onlyNearby } : null),
          providerApi.getAll().catch(() => []),
        ]);
        if (!mounted) return;
        setServices(data.map(toCard));
        setProviders(
          provs.map((p) => ({
            id: p.id,
            name: p.companyName || p.professionalName,
            avatar: avatarFor(p.profileImageUrl, p.companyName || p.professionalName),
            rating: p.rating?.average ?? 0,
            ratingCount: p.rating?.count ?? 0,
            specialty: p.category?.name ?? "Prestador de serviços",
          }))
        );
      } catch {
        if (mounted) setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [reloadKey, location, onlyNearby]);

  // derived categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    (services || []).forEach((s) => cats.add(s.category));
    return ["Todos", ...Array.from(cats)];
  }, [services]);

  // filtering + sorting
  const filtered = useMemo(() => {
    const list = (services || []).filter((s) => {
      const matchesQuery =
        debouncedQuery.trim() === "" ||
        s.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        s.shortDescription.toLowerCase().includes(debouncedQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "Todos" || s.category === categoryFilter;
      const matchesRating = s.rating >= minRating;
      return matchesQuery && matchesCategory && matchesRating;
    });

    if (sortBy === "rating") return list.sort((a, b) => b.rating - a.rating);
    if (sortBy === "price") return list.sort((a, b) => a.price - b.price);
    if (sortBy === "distance") return list.sort((a, b) => (a.data.distanceKm ?? Infinity) - (b.data.distanceKm ?? Infinity));
    // relevance fallback
    return list;
  }, [services, debouncedQuery, categoryFilter, minRating, sortBy]);

  // pagination (simple)
  const pageSize = 8;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // motion variants
  const cardVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.995 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  const skeletons = Array.from({ length: 8 }).map((_, i) => i);

  const [open, setOpen] = useState(false);

  const handleDetail = () => {
    setOpen(true);
  };

  if(loading) {
    return <ServicesPageSkeleton/>
  }

  if (loadError) {
    return (
      <div className="w-full py-20 text-center text-[var(--text-muted)]">
        <p className="text-lg text-[var(--text)] font-semibold">Não foi possível carregar os serviços.</p>
        <p className="mt-1">Verifique sua conexão e tente novamente.</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="mt-4 px-4 py-2 rounded-lg bg-[var(--primary)] text-white">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <LayoutGroup>
      <h1 className="mt-10 mb-5 text-4xl px-12 font-bold leading-tight">
        Busque e pesquise pelos melhores serviços.
      </h1>
      <h3 className=" md:flex hidden px-12 leading-tight">
        Escolha o tipo de serviço e encontre profissionais disponíveis. Filtre
        por categoria, avaliação e preço.
      </h3>
      <div className="min-h-screen w-full bg-[var(--bg-dark)] text-[var(--text)] p-6 md:p-10 ">
        {/* Floating Search + Filters (sophisticated) */}
        <motion.div
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="max-w-7xl mx-auto grid gap-4"
        >
          <div className="relative ">
            <div
              className="absolute top-6 left-1/2 -translate-x-1/2 w-full md:w-[90%] lg:w-full"
              aria-hidden
            />
            <div className="flex flex-col mb-10 md:flex-row items-stretch gap-4">
              {/* search box */}
              <div className="flex-1 relative">
                <div
                  className="flex items-center gap-3 p-3 rounded-2xl bg-[linear-gradient(90deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] border border-[var(--border-muted)] shadow-lg"
                  role="search"
                >
                  <Search className=" text-[var(--text-muted)]" />
                  <input
                    aria-label="Buscar serviços"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Procure por serviços, habilidades ou palavras-chave..."
                    className="bg-transparent outline-none text-[var(--text)] placeholder:[var(--text-muted)] flex-1"
                  />
                </div>
                {/* subtle suggestion chips */}
                <div className="lg:absolute  mt-2 flex gap-2 flex-wrap">
                  {categories.filter((c) => c !== "Todos").slice(0, 4).map((chip) => (
                    <motion.button
                      key={chip}
                      whileHover={{ scale: 1.04 }}
                      onClick={() => { setQuery(""); setCategoryFilter(chip); }}
                      className="text-xs px-3 py-1 rounded-full bg-[var(--bg-light)]/30 border border-[var(--border-muted)] text-[var(--text-muted)]"
                    >
                      #{chip}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* filters */}
              <div className="flex flex-wrap items-center  gap-3">
                <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)]">
                  <Filter className="text-[var(--text-muted)]" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-[var(--bg)] outline-none text-[var(--text)]"
                    aria-label="Filtrar por categoria"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)]" title={`Avaliação mínima: ${minRating}`}>
                  <Star fill="currentColor" className="text-yellow-400" />
                  <input
                    aria-label="Avaliação mínima"
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="accent-[var(--highlight)]"
                  />
                  <span className="text-xs text-[var(--text-muted)] w-6">{minRating > 0 ? minRating : "—"}</span>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "relevance" | "rating" | "price" | "distance")}
                    className="bg-[var(--bg)] outline-none text-[var(--text)]"
                    aria-label="Ordenar por"
                  >
                    <option value="relevance">Relevância</option>
                    <option value="rating">Avaliação</option>
                    <option value="price">Preço</option>
                    {location && <option value="distance">Mais perto</option>}
                  </select>
                </div>
              </div>

              {/* onde o cliente está: distância e "atende minha região" */}
              <div className="mt-3">
                <LocationBar location={location} onChange={setLocation} onlyNearby={onlyNearby} onOnlyNearbyChange={setOnlyNearby} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* main content area */}
        <div className="  max-w-full sm:max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 md:mt-8">
          {/* SERVICES GRID */}
          <section className="relative ">
            <div className="flex items-baseline  justify-between mb-4">
              <div className="">
                <h2 className="text-2xl font-semibold">Explorar serviços</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Resultado:{" "}
                  <strong className="text-[var(--text-muted)]">
                    {filteredLengthLabel(filtered)}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPage(1);
                    setSortBy(sortBy === "rating" ? "relevance" : "rating");
                  }}
                  className="px-3 py-1 text-sm rounded-full bg-[var(--bg-light)]/30 border border-[var(--border-muted)]"
                >
                  Alternar ordenação
                </button>
                {totalPages > 1 && (<>
                <div className="text-xs text-[var(--text-muted)]">
                  Página {page}/{totalPages}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-lg bg-[var(--bg-light)]/20 border border-[var(--border-muted)]"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-lg bg-[var(--bg-light)]/20 border border-[var(--border-muted)]"
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                </>)}
              </div>
            </div>

            {/* grid */}
            <motion.div
              className="grid grid-cols-1 mt-10 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              initial="hidden"
              animate="visible"
            >
              {loading &&
                skeletons.map((i) => (
                  <motion.div
                    key={i}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    className="rounded-2xl overflow-hidden bg-gradient-to-b from-[rgba(255,255,255,0.01)] to-[rgba(255,255,255,0.02)] border border-[var(--border)] p-0"
                  >
                    <div className="w-full h-40 bg-[linear-gradient(90deg,#0000,#0000)] animate-pulse" />
                    <div className="p-4">
                      <div className="h-4 bg-[rgba(255,255,255,0.03)] rounded w-2/3 mb-2 animate-pulse" />
                      <div className="h-3 bg-[rgba(255,255,255,0.02)] rounded w-1/2 mb-4 animate-pulse" />
                      <div className="h-3 bg-[rgba(255,255,255,0.02)] rounded w-1/4 animate-pulse" />
                    </div>
                  </motion.div>
                ))}

              {!loading &&
                paged.map((srv) => (
                  <motion.article
                    key={srv.id}
                    layout
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover={{
                      y: -6,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    }}
                    className="relative rounded-2xl overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.01), rgba(255,255,255,0.015))] border border-[var(--border)] shadow-[0_6px_18px_rgba(0,0,0,0.3)]"
                  >
                    <div className="relative">
                      <img
                        src={srv.images[0]}
                        alt={srv.title}
                        className="w-full h-48 object-cover transition-transform duration-400"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                      <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-[var(--bg)]/50 backdrop-blur-md border border-[var(--border-muted)] text-xs">
                        {srv.category}
                      </div>
                    </div>

                    <div className="p-3">
                      {srv.provider && (
                        <motion.div
                          key={srv.provider.id}
                          role="link"
                          tabIndex={0}
                          aria-label={`Ver perfil de ${srv.provider.professionalName}`}
                          onClick={() => navigate(`/provider/${srv.provider!.id}`)}
                          onKeyDown={(e) => e.key === "Enter" && navigate(`/provider/${srv.provider!.id}`)}
                          className="flex items-center cursor-pointer gap-3 py-4 px-2 mb-2 border-b-1 border-t-1 rounded-lg bg-[var(--bg-dark)] border-[var(--highlight)]/50 transition"
                          whileHover={{ scale: 1.02 }}
                        >
                          <img
                            src={avatarFor(srv.provider.profileImageUrl, srv.provider.professionalName)}
                            alt={srv.provider.professionalName}
                            className="w-12 h-12 rounded-full object-cover border border-[var(--border)]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">
                                {srv.provider.professionalName}
                              </div>
                              <div className="flex items-center gap-1 text-yellow-400 text-sm">
                                <Star fill={srv.provider.ratingCount > 0 ? "currentColor" : "none"} size={14} />
                                {srv.provider.ratingCount > 0 ? srv.provider.rating.toFixed(1) : "Novo"}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--text-muted)] mt-1">
                              {srv.provider.description}
                            </div>
                            {/* <button className="mt-2 text-xs px-3 py-1 rounded-full bg-[var(--bg)]/60 border border-[var(--border)]">
                              Ver perfil
                            </button> */}
                          </div>
                        </motion.div>
                      )}

                      <h3 className="text-lg font-semibold leading-tight">
                        {srv.title}
                      </h3>
                      <ServiceAreaLine service={srv.data} />

                      <p className="text-sm text-[var(--text-muted)] mt-2 line-clamp-2">
                        {srv.shortDescription}
                      </p>
                      <div className=" mt-4 flex items-center mb-2 text-[var(--text-highlight)] font-semibold">
                         <HandCoins size={20} className="text-[var(--text)]/70 mr-2" />
                        {formatCurrency(srv.price)}
                      </div>
                      <div className=" flex items-center  justify-between">
                        <div className="flex items-center  gap-3">

                          <div className="flex items-center mb-2 text-[var(--text-highlight)] font-semibold">
                            <Clock className="text-[var(--text)]/70 mr-2"  size={20} /> <span>{srv.duration}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <button
                            onClick={() => {
                              setSelectedService(srv);
                              handleDetail();
                            }}
                            className="mt-2 mb-2 mr-2 text-xs px-3 py-1 rounded-full bg-[var(--primary)] text-white font-medium hover:brightness-95 transition"
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}

              {/* empty state */}
              {!loading && filtered.length === 0 && (
                <div className="col-span-full text-center py-20 text-[var(--text-muted)]">
                  {(services ?? []).length === 0
                    ? "Ainda não há serviços publicados."
                    : "Nenhum serviço encontrado para sua busca."}
                  {(query || categoryFilter !== "Todos" || minRating > 0) && (
                    <button
                      onClick={() => { setQuery(""); setCategoryFilter("Todos"); setMinRating(0); }}
                      className="block mx-auto mt-3 text-[var(--primary)] underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </section>

          {/* RIGHT SIDEBAR (Top Providers) */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-80 bg-[var(--bg-light)]/40 backdrop-blur-xl rounded-2xl p-4 border border-[var(--border)] shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Top Prestadores</h4>
                <div className="text-xs text-[var(--text-muted)]">Mais bem avaliados</div>
              </div>

              <div className="flex flex-col gap-3">
                {(providers ?? []).length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">Nenhum prestador cadastrado ainda.</p>
                )}
                {(providers ?? []).slice(0, 5).map((p) => (
                  <motion.div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border-muted)] hover:border-[var(--highlight)] transition"
                    whileHover={{ scale: 1.02 }}
                  >
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-12 h-12 rounded-full object-cover border border-[var(--border)]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{p.name}</div>
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">
                          <Star fill={p.ratingCount > 0 ? "currentColor" : "none"} size={14} /> {p.ratingCount > 0 ? p.rating.toFixed(1) : "Novo"}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1">
                        {p.specialty}
                      </div>
                      <button onClick={() => navigate(`/provider/${p.id}`)} className="mt-2 text-xs px-3 py-1 rounded-full bg-[var(--bg)]/60 border border-[var(--border)]">
                        Ver perfil
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </aside>

          {/* mobile providers carousel */}
          <div className="lg:hidden mt-6">
            <h4 className="text-sm font-semibold mb-3">Top Prestadores</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {(providers ?? []).slice(0, 5).map((p) => (
                <motion.div
                  key={p.id}
                  className="min-w-[200px] flex-shrink-0 rounded-2xl p-3 bg-[var(--bg-light)]/30 border border-[var(--border)]"
                >
                  <div className="flex gap-3 items-center">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="w-12 h-12 rounded-full object-cover border border-[var(--border)]"
                    />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {p.specialty}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star fill={p.ratingCount > 0 ? "currentColor" : "none"} size={14} /> {p.ratingCount > 0 ? p.rating.toFixed(1) : "Novo"}
                    </div>
                    <button onClick={() => navigate(`/provider/${p.id}`)} className="text-xs px-3 py-1 rounded-full bg-[var(--primary)] text-white">
                      Ver perfil
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DETAILS MODAL */}
      <AnimatePresence>
        {selectedService && (
          <ServiceDetail
            service={selectedService.data}
            images={selectedService.images}
            isOpen={open}
            onClose={() => {
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

/* small helper for filtered count label */
function filteredLengthLabel(filtered: Service[] | null) {
  if (!filtered) return "—";
  return `${filtered.length} resultados`;
}
