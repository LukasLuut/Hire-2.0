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
import { motion,  LayoutGroup } from "framer-motion";
import { Search, X, Filter } from "lucide-react";
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
  const [priceOrder, setPriceOrder] = useState<"asc" | "desc" | null>(null); // ordenação por preço
  const [minRating, setMinRating] = useState<number>(0); // nota mínima
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
      const term = searchTerm.toLowerCase();
      results = results.filter(
        (srv) =>
          srv.title.toLowerCase().includes(term) ||
          srv.description_service.toLowerCase().includes(term) ||
          (srv.category?.name ?? "").toLowerCase().includes(term) ||
          (srv.subcategory ?? "").toLowerCase().includes(term)
      );
    }

    // Ordenação por preço
    if (priceOrder) {
      results.sort((a, b) => (priceOrder === "asc" ? a.price - b.price : b.price - a.price));
    }

    // Filtro de nota mínima
    if (minRating > 0) {
      results = results.filter((srv) => srv.rating >= minRating);
    }

    setFiltered(results);
  }, [searchTerm, priceOrder, minRating, services]);

  /* ==========================================================================
   * RENDERIZAÇÃO
   * ========================================================================== */
  return (
    <LayoutGroup>
      
      <div className="min-h-screen bg-[var(--bg-dark)] overflow-x-hidden text-[var(--text)]/80  px-6 md:px-20 transition-colors duration-300">
        {/* ------------------------------------------------------------------
         * CABEÇALHO
         * ------------------------------------------------------------------ */}
        <h1 className="text-6xl font-bold text-center pt-15 mb-10 ">
          {title}
        </h1>

        {/* ------------------------------------------------------------------
         * BARRA DE PESQUISA + TAGS + FILTROS
         * ------------------------------------------------------------------ */}
        <div className="flex flex-col items-center gap-3 mb-5">
          {/* Campo de busca */}
          <div className="relative w-full max-w-2xl">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, categoria ou descrição..."
              className="w-full py-3 pl-12 pr-16 rounded-full bg-black/10 border border-[var(--text)]/30 text-[var(--text)] placeholder-[var(--text)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition"
            />
            <Search className="absolute left-4 top-3.5 text-[var(--text)]/60" size={20} />
            <button
              onClick={() => setSearchTerm("")}
              aria-label="Limpar busca"
              className="absolute right-4 top-4 text-[var(--text)]/60 hover:text-[var(--primary)]"
            >
              <X size={18} />
            </button>
            {/* Tags sugeridas */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {tags.slice(0, isMobile ? 3 : tags.length).map((tag) => (
              <motion.button
                key={tag}
                onClick={() => setSearchTerm(tag)}
                className={`px-3 py-1 rounded-full text-sm border border-[var(--text)]/30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition ${
                  searchTerm === tag ? "bg-[var(--primary)]/20 border-[var(--primary)]" : ""
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {tag}
              </motion.button>
            ))}
          </div>
          </div>          

          {/* Filtros adicionais */}
          <div className="flex flex-wrap bg-[var(--bg)] md:rounded-full rounded-2xl py-1 px-4 justify-center gap-4 mt-5 text-sm">
            {/* Filtro de preço */}
            <div className="flex items-center gap-2">
              <Filter size={16} />
              <span>Preço:</span>
              <button
                onClick={() => setPriceOrder("asc")}
                className={`px-2 py-1 rounded ${priceOrder === "asc" ? "bg-[var(--primary)]/30" : "hover:bg-black/20"}`}
              >
                ↑
              </button>
              <button
                onClick={() => setPriceOrder("desc")}
                className={`px-2 py-1 rounded ${priceOrder === "desc" ? "bg-[var(--primary)]/30" : "hover:bg-black/20"}`}
              >
                ↓
              </button>
              <button onClick={() => setPriceOrder(null)} className="px-2 py-1 rounded hover:bg-black/20">
                Reset
              </button>
            </div>

            {/* Filtro de avaliação */}
            <div className="flex items-center  gap-2">
              <span>Nota mínima:</span>
              {[0, 4, 4.5, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setMinRating(n)}
                  className={`px-2  py-1 rounded ${minRating === n ? "bg-[var(--primary)]/30" : "hover:bg-black/20"}`}
                >
                  {n === 0 ? "Todas" : `${n}★`}
                </button>
              ))}
            </div>
          </div>
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
            <button onClick={() => { setSearchTerm(""); setMinRating(0); setPriceOrder(null); }} className="text-[var(--primary)] underline">Limpar filtros</button>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-16">
          {filtered.map((srv) => (
              <PostCard key={srv.id} service={srv} noEdit={noEdit} liked={likedIds.includes(srv.id)} onChanged={getServices}/>
          ))}
        </div>
        )}

       
      </div>
      
    </LayoutGroup>
  );
}
