import { MapPin, Globe } from "lucide-react";
import { formatDistance } from "../utils/location";

interface Area {
  distanceKm?: number | null;
  servesYou?: boolean;
  provider?: { baseCity?: string | null; baseState?: string | null; attendsOnline?: boolean; serviceRadiusKm?: number };
}

/** Linha curta "a 3 km · Porto Alegre - RS" / "Atende online" / "Fora da sua região" */
export default function ServiceAreaLine({ service, full = false }: { service: Area; full?: boolean }) {
  const p = service.provider;
  const place = p?.baseCity ? `${p.baseCity}${p.baseState ? ` - ${p.baseState}` : ""}` : null;
  const distance = formatDistance(service.distanceKm);
  if (!place && !p?.attendsOnline && !distance) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
      {(distance || place) && (
        <span className="flex items-center gap-1">
          <MapPin size={12} aria-hidden />
          {[distance, place].filter(Boolean).join(" · ")}
          {full && p?.serviceRadiusKm ? ` · atende até ${p.serviceRadiusKm} km` : ""}
        </span>
      )}
      {p?.attendsOnline && (
        <span className="flex items-center gap-1"><Globe size={12} aria-hidden /> Atende online</span>
      )}
      {service.servesYou === false && <span className="text-amber-500">Fora da sua região</span>}
    </div>
  );
}
