import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { providerApi, type FavoriteProvider } from "../../api/ProviderAPI";
import { avatarFor } from "../../utils/avatar";

/** Prestadores favoritos (seção dentro do painel de favoritos). */
export default function FavoriteProviders() {
  const [items, setItems] = useState<FavoriteProvider[] | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return setItems([]);
    providerApi.favorites(token).then(setItems).catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section aria-labelledby="fav-providers" className="mb-5">
      <h3 id="fav-providers" className="text-sm font-semibold mb-2">Prestadores</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((p) => {
          const name = p.companyName || p.professionalName;
          return (
            <li key={p.id}>
              <Link
                to={p.available ? `/prestador/${p.slug ?? p.id}` : "#"}
                aria-disabled={!p.available}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg)] border border-[var(--border)] transition ${p.available ? "hover:border-[var(--primary)]" : "opacity-60 pointer-events-none"}`}
              >
                <img src={avatarFor(p.profileImageUrl, name)} alt="" className="w-11 h-11 rounded-full object-cover" />
                <span className="min-w-0">
                  <span className="block font-semibold truncate">{name}</span>
                  <span className="block text-xs text-[var(--text-muted)] truncate">
                    {!p.available ? "Indisponível" : [p.category?.name, p.baseCity].filter(Boolean).join(" · ") || "Prestador de serviços"}
                  </span>
                </span>
                {p.rating?.count > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-sm">
                    <Star size={14} className="text-yellow-400" fill="currentColor" aria-hidden /> {p.rating.average.toFixed(1)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
