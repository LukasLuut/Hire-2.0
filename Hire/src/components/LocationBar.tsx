import { useState, type FormEvent } from "react";
import { MapPin, LocateFixed, Loader2, X } from "lucide-react";
import { locateByCep, locateByDevice, type ClientLocation } from "../utils/location";

/* --------------------------------------------------------------------------
 * LocationBar — "onde você está" para a busca por proximidade.
 * Usa a localização do aparelho ou o CEP; a escolha fica salva no navegador.
 * -------------------------------------------------------------------------- */
export default function LocationBar({
  location,
  onChange,
  onlyNearby,
  onOnlyNearbyChange,
}: {
  location: ClientLocation | null;
  onChange: (loc: ClientLocation | null) => void;
  onlyNearby: boolean;
  onOnlyNearbyChange: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [cep, setCep] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<ClientLocation>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      setEditing(false);
      setCep("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível localizar.");
    } finally {
      setBusy(false);
    }
  };

  const submitCep = (e: FormEvent) => {
    e.preventDefault();
    run(() => locateByCep(cep));
  };

  if (location && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2 px-3 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)] text-sm">
        <span className="flex items-center gap-2">
          <MapPin size={16} className="text-[var(--primary)]" aria-hidden />
          Perto de <strong>{location.label}</strong>
        </span>
        <button onClick={() => setEditing(true)} className="text-[var(--primary)] hover:underline">Alterar</button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={onlyNearby} onChange={(e) => onOnlyNearbyChange(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
          Só quem atende minha região
        </label>
        <button onClick={() => onChange(null)} aria-label="Remover localização" className="ml-auto p-1 text-[var(--text-muted)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-[var(--bg-light)]/30 border border-[var(--border-muted)] text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-[var(--text-muted)]">
          <MapPin size={16} aria-hidden /> Veja quem atende perto de você:
        </span>
        <button
          onClick={() => run(locateByDevice)}
          disabled={busy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] hover:border-[var(--primary)] disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Usar minha localização
        </button>
        <form onSubmit={submitCep} className="flex items-center gap-2">
          <label htmlFor="location-cep" className="sr-only">CEP</label>
          <input
            id="location-cep"
            inputMode="numeric"
            placeholder="ou digite seu CEP"
            value={cep}
            onChange={(e) => setCep(e.target.value.replace(/[^\d-]/g, "").slice(0, 9))}
            className="w-36 px-3 py-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
          <button type="submit" disabled={busy || cep.replace(/\D/g, "").length !== 8} className="px-3 py-1.5 rounded-full bg-[var(--primary)] text-white disabled:opacity-50">
            Buscar
          </button>
        </form>
        {location && (
          <button onClick={() => setEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text)]">Cancelar</button>
        )}
      </div>
      {error && <p className="mt-2 text-red-500" role="alert">{error}</p>}
    </div>
  );
}
