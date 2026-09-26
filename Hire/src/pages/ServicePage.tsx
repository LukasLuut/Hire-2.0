import { useCallback, useEffect, useState } from "react";
import { trackView } from "../utils/analytics";
import { providerPath } from "../utils/providerPath";
import { Link, useParams } from "react-router-dom";
import { Share2, Star, ChevronLeft, ChevronRight, Handshake, LogIn } from "lucide-react";
import { serviceAPI, serviceImages, type ServiceData } from "../api/ServiceAPI";
import { reviewAPI } from "../api/ReviewAPI";
import { useSession } from "../context/SessionContext";
import { useToast } from "../components/Toast/ToastContext";
import ServiceDetail from "../components/ServiceGallery/ServiceDetail/ServiceDetail";
import ReviewsSection from "../components/Reviews/ReviewsSection";
import ServiceAreaLine from "../components/ServiceAreaLine";
import { avatarFor } from "../utils/avatar";
import { displayServicePrice } from "../utils/price";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * /service/:id — página pública do serviço (abre sem login).
 * Serve para compartilhar: mostra fotos, preço, prestador e avaliações deste
 * serviço. Contratar e negociar abrem o mesmo detalhe da vitrine; sem login,
 * o botão leva à entrada e volta para cá depois.
 * -------------------------------------------------------------------------- */
export default function ServicePage() {
  const { id } = useParams();
  const serviceId = Number(id);
  const { token } = useSession();
  const { showToast } = useToast();
  const [service, setService] = useState<ServiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    setService(null);
    setError(null);
    serviceAPI
      .getServiceById(serviceId)
      .then((s) => {
        setService(s);
        if (s) {
          document.title = `${s.title} — Hire.`;
          trackView("service_view", { serviceId: s.id });
        }
      })
      .catch((err) => setError(getErrorMessage(err, "Serviço não encontrado.")));
    return () => {
      document.title = "Hire.";
    };
  }, [serviceId]);

  // avaliações deste serviço (entre as do prestador)
  const loadReviews = useCallback(async () => {
    if (!service?.provider?.id) return { average: 0, count: 0, reviews: [] };
    const all = await reviewAPI.forProvider(service.provider.id);
    const reviews = all.reviews.filter((r) => r.service?.id === service.id);
    const average = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
    return { average, count: reviews.length, reviews };
  }, [service?.id, service?.provider?.id]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: service?.title, text: `${service?.title} no Hire.`, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copiado. É só colar para compartilhar.", "success");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  };

  if (error) {
    return (
      <div className="min-h-screen pt-32 px-6 text-center bg-[var(--bg-dark)] text-[var(--text)]">
        <p className="text-xl font-semibold">{error}</p>
        <Link to="/" className="inline-block mt-4 text-[var(--primary)] underline">Ir para o início</Link>
      </div>
    );
  }
  if (!service) {
    return (
      <div className="min-h-screen pt-28 px-6 bg-[var(--bg-dark)]" role="status" aria-label="Carregando serviço">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          <div className="h-80 rounded-3xl bg-[var(--bg-light)] animate-pulse" />
          <div className="h-80 rounded-3xl bg-[var(--bg-light)] animate-pulse" />
        </div>
      </div>
    );
  }

  const images = serviceImages(service);
  const providerName = service.provider?.companyName || service.provider?.professionalName || "Prestador";
  const next = `/service/${service.id}`;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text)] pt-24 pb-16 px-4 sm:px-8">
      <article className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Fotos */}
          <div className="relative rounded-3xl overflow-hidden border border-[var(--border)] bg-[var(--bg-light)]">
            <img src={images[index]} alt={service.title} className="w-full h-80 md:h-[26rem] object-cover" />
            {images.length > 1 && (
              <>
                <button onClick={() => setIndex((i) => (i === 0 ? images.length - 1 : i - 1))} aria-label="Imagem anterior" className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"><ChevronLeft /></button>
                <button onClick={() => setIndex((i) => (i === images.length - 1 ? 0 : i + 1))} aria-label="Próxima imagem" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"><ChevronRight /></button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {images.map((_, i) => (
                    <span key={i} className={`w-2.5 h-2.5 rounded-full ${i === index ? "bg-[var(--primary)]" : "bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Informações */}
          <div className="rounded-3xl p-6 bg-[var(--bg-light)] border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">{service.category?.name}{service.subcategory ? ` · ${service.subcategory}` : ""}</p>
            <h1 className="text-3xl font-bold text-[var(--primary)] mt-1">{service.title}</h1>
            {service.ratingCount > 0 && (
              <div className="flex items-center gap-1 text-yellow-400 text-sm mt-1">
                <Star size={14} fill="currentColor" /> <span className="font-semibold">{service.rating.toFixed(1)}</span>
                <span className="text-[var(--text-muted)]">({service.ratingCount} {service.ratingCount === 1 ? "avaliação" : "avaliações"})</span>
              </div>
            )}
            <p className="mt-3 text-[var(--text-muted)] leading-relaxed">{service.description_service}</p>

            <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-5">
              <div><dt className="font-semibold inline">Preço: </dt><dd className="inline text-[var(--text-muted)]">{displayServicePrice(service)}</dd></div>
              <div><dt className="font-semibold inline">Duração: </dt><dd className="inline text-[var(--text-muted)]">{service.duration || "-"}</dd></div>
              <div><dt className="font-semibold inline">Negociável: </dt><dd className="inline text-[var(--text-muted)]">{service.negotiable ? "Sim" : "Não"}</dd></div>
              <div><dt className="font-semibold inline">Agendamento: </dt><dd className="inline text-[var(--text-muted)]">{service.requiresScheduling ? "Sim" : "Não"}</dd></div>
              {service.requiresScheduling && service.cancellationNotice && (
                <div className="col-span-2"><dt className="font-semibold inline">Cancelamento: </dt><dd className="inline text-[var(--text-muted)]">{service.cancellationNotice}</dd></div>
              )}
            </dl>

            <ServiceAreaLine full service={service} />

            {/* Prestador */}
            <div className="mt-5 flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border-muted)]">
              <img src={avatarFor(service.provider?.profileImageUrl, providerName)} alt="" className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{providerName}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{service.provider?.description}</div>
              </div>
              {service.provider?.id && (
                <Link to={providerPath(service.provider)} className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] hover:border-[var(--primary)] shrink-0">Ver perfil</Link>
              )}
            </div>

            {/* Ações */}
            {!service.active ? (
              <p className="mt-5 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text-muted)]">
                Este serviço está pausado pelo prestador e não recebe pedidos no momento.
              </p>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                {token ? (
                  <button onClick={() => setDetailOpen(true)} className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 px-4 rounded-xl hover:brightness-110">
                    <Handshake size={18} /> Contratar ou negociar
                  </button>
                ) : (
                  <Link to={`/auth?next=${encodeURIComponent(next)}`} className="flex-1 flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold py-3 px-4 rounded-xl hover:brightness-110">
                    <LogIn size={18} /> Entrar para contratar
                  </Link>
                )}
                <button onClick={share} className="flex items-center justify-center gap-2 border border-[var(--border)] py-3 px-4 rounded-xl hover:border-[var(--primary)]">
                  <Share2 size={18} /> Compartilhar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10">
          <ReviewsSection title="Avaliações deste serviço" load={loadReviews} reloadKey={service.id} emptyText="Este serviço ainda não tem avaliações." />
        </div>
      </article>

      {detailOpen && <ServiceDetail service={service} images={images} isOpen onClose={() => setDetailOpen(false)} />}
    </div>
  );
}
