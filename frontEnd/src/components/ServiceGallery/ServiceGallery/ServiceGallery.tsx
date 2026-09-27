/* --------------------------------------------------------------------------
 * ServiceGalleryZoom.tsx
 *
 * Componente React completo com:
 *  - Galeria interativa de serviços
 *  - Modal com zoom e navegação entre imagens
 *  - Barra de pesquisa com filtros inteligentes
 *  - Tags de sugestão (limitadas a 3 no mobile)
 *
 * Tecnologias usadas:
 *  - React + useState + useEffect
 *  - Framer Motion (animações suaves)
 *  - Lucide React (ícones vetoriais)
 *  - TailwindCSS (estilização responsiva)
 * -------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { matchesSearch } from "../../../utils/search";
import { motion,  LayoutGroup } from "framer-motion";
import SearchWithFilters, { FilterToggle, filterField } from "../../Search/SearchWithFilters";
import PostCard from "../Service/Service";
import { providerApi } from "../../../api/ProviderAPI";
import { serviceAPI, toServiceData, type ServiceData } from "../../../api/ServiceAPI";
import { ServicesGallerySkeleton } from "../../../skeletons/ServiceGallerySkeleton/ServicesGallerySkeleton";

/* ==========================================================================
 * COMPONENTE PRINCIPAL
 * - Sem "services": carrega os serviços do prestador logado (com edição)
 * - Com "services": mostra os serviços recebidos (perfil público, sem edição)
 * ========================================================================== */
export default function ServiceGalleryZoom({
  services: externalServices,
  noEdit = false,
  title = "Galeria de Serviços",
}: {
  services?: ServiceData[];
  noEdit?: boolean;
  title?: string;
} = {}) {

  const [loading, setLoading] = useState<boolean>(!externalServices);
  const [error, setError] = useState(false);
  const [services, setServices] = useState<ServiceData[]>(externalServices ?? []);
  const [likedIds, setLikedIds] = useState<number[]>([]);

  const getServices = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (externalServices) {
      setServices(externalServices);
    } else {
      setLoading(true);
      setError(false);
      try {
        const servicesList = await providerApi.getServices(token);
        setServices(servicesList.map(toServiceData));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    serviceAPI.likedIds(token).then(setLikedIds).catch(() => {});
  }, [externalServices]);

  useEffect(() => {
    getServices();
  }, [getServices]);


  /* ------------------------------------------------------------------------
   * ESTADOS PRINCIPAIS
   * ------------------------------------------------------------------------ */
  const [searchTerm, setSearchTerm] = useState(""); // texto digitado na barra de busca
  // filtros do painel (mesmos da busca da Home)
  const [subFilter, setSubFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<"relevance" | "price_asc" | "price_desc" | "rating">("relevance");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [onlyScheduling, setOnlyScheduling] = useState(false);
  const activeFilters = [!!subFilter, !!maxPrice, sortBy !== "relevance", onlyOnline, onlyScheduling].filter(Boolean).length;
  const clearFilters = () => { setSubFilter(""); setMaxPrice(""); setSortBy("relevance"); setOnlyOnline(false); setOnlyScheduling(false); };
  const [filtered, setFiltered] = useState<ServiceData[]>(services); // lista filtrada
  const [isMobile, setIsMobile] = useState(false); // controle de largura da tela


  /* ------------------------------------------------------------------------
   * TAGS DE SUGESTÃO
   * (exibidas abaixo da barra de pesquisa)
   * ------------------------------------------------------------------------ */
  const tags = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.subcategory) set.add(s.subcategory);
      if (s.category?.name) set.add(s.category.name);
    });
    return Array.from(set).slice(0, 8);
  }, [services]);

  // Detecta se a tela é pequena (para limitar o número de tags)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  /* ------------------------------------------------------------------------
   * FILTRO DINÂMICO
   * Aplica filtros e busca conforme o usuário digita ou seleciona opções.
   * ------------------------------------------------------------------------ */
  useEffect(() => {
    let results = [...services];

    // Busca por texto em título, descrição e categoria
    if (searchTerm.trim()) {
      results = results.filter((srv) => matchesSearch(searchTerm, srv.title, srv.description_service, srv.category?.name, srv.subcategory));
    }

    if (subFilter) results = results.filter((srv) => srv.subcategory === subFilter);
    const max = Number(maxPrice.replace(",", "."));
    if (maxPrice && max > 0) results = results.filter((srv) => srv.priceUnit !== "orcamento" && srv.price <= max);
    if (onlyOnline) results = results.filter((srv) => srv.online);
    if (onlyScheduling) results = results.filter((srv) => srv.requiresScheduling);

    if (sortBy === "price_asc") results.sort((a, b) => a.price - b.price);
    if (sortBy === "price_desc") results.sort((a, b) => b.price - a.price);
    if (sortBy === "rating") results.sort((a, b) => b.rating - a.rating);

    setFiltered(results);
  }, [searchTerm, subFilter, maxPrice, sortBy, onlyOnline, onlyScheduling, services]);

  // subcategorias dos serviços deste prestador
  const subcategories = useMemo(() => [...new Set(services.map((s) => s.subcategory).filter(Boolean))].sort(), [services]);

  /* ==========================================================================
   * RENDERIZAÇÃO
   * ========================================================================== */
  return (
    <LayoutGroup>
      
      <div className="min-h-screen bg-[var(--bg-dark)] overflow-x-hidden text-[var(--text)]/80  px-6 md:px-20 transition-colors duration-300">
        {/* ------------------------------------------------------------------
         * CABEÇALHO
         * ------------------------------------------------------------------ */}
        <h2 className="text-6xl font-bold text-center pt-15 mb-10 ">
          {title}
        </h2>

        {/* ------------------------------------------------------------------
         * BARRA DE PESQUISA + TAGS + FILTROS
         * ------------------------------------------------------------------ */}
        <div className="w-full max-w-[1000px] mx-auto mb-10">
          {/* no Business (serviços do próprio prestador) só a busca; para quem visita, busca + filtros */}
          <SearchWithFilters
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por título, categoria ou descrição..."
            activeCount={activeFilters}
            resultCount={filtered.length}
            onClear={clearFilters}
            showFilters={noEdit}
          >
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Subcategoria</span>
              <select value={subFilter} onChange={(e) => setSubFilter(e.target.value)} disabled={subcategories.length === 0} className={`${filterField} disabled:opacity-50`}>
                <option value="">Todas</option>
                {subcategories.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Preço máximo (R$)</span>
              <input type="number" inputMode="decimal" min={0} step={10} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Sem limite" className={filterField} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="text-[var(--text-muted)]">Ordenar por</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={filterField}>
                <option value="relevance">Relevância</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="rating">Avaliação</option>
              </select>
            </label>
            <div role="group" aria-label="Disponibilidade" className="sm:col-span-2 grid gap-1 text-sm">
              <span className="text-[var(--text-muted)]">Disponibilidade</span>
              <div className="flex flex-wrap gap-2">
                <FilterToggle label="Online" on={onlyOnline} onChange={setOnlyOnline} />
                <FilterToggle label="Agenda online" on={onlyScheduling} onChange={setOnlyScheduling} />
              </div>
            </div>
          </SearchWithFilters>

          {/* atalhos (subcategorias e categoria) */}
          {tags.length > 1 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {tags.slice(0, isMobile ? 3 : 8).map((tag) => (
                <motion.button
                  key={tag}
                  onClick={() => setSearchTerm(searchTerm === tag ? "" : tag)}
                  aria-pressed={searchTerm === tag}
                  className={`text-xs px-3 py-1 rounded-full border transition ${searchTerm === tag ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-[var(--bg-light)]/30 border-[var(--border-muted)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                  whileTap={{ scale: 0.95 }}
                >
                  #{tag}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------
         * GRADE DE CARDS
         * ------------------------------------------------------------------ */}
        {loading ? (
          <ServicesGallerySkeleton />
        ) : error ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            Não foi possível carregar os serviços.{" "}
            <button onClick={getServices} className="text-[var(--primary)] underline">Tentar novamente</button>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            {noEdit ? "Este prestador ainda não publicou serviços." : "Você ainda não publicou serviços. Use \"Novo serviço\" para criar o primeiro."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            Nenhum serviço encontrado.{" "}
            <button onClick={() => { setSearchTerm(""); clearFilters(); }} className="text-[var(--primary)] underline">Limpar filtros</button>
          </div>
        ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-8 pb-16">
          {filtered.map((srv) => (
              <PostCard key={srv.id} service={srv} noEdit={noEdit} liked={likedIds.includes(srv.id)} onChanged={getServices}/>
          ))}
        </div>
        )}

       
      </div>
      
    </LayoutGroup>
  );
}
