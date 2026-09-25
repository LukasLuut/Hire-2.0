import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Map, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { ProviderForm } from "../helpers/types-and-helpers";

// O Vite não resolve os ícones padrão do Leaflet sozinho
const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_POSITION: [number, number] = [-23.5505, -46.6333];

export default function StepAddress({
  form,
  update,
}: {
  form: ProviderForm;
  update: <K extends keyof ProviderForm>(k: K, v: ProviderForm[K]) => void;
}) {
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [position, setPosition] = useState<[number, number]>(
    form.address?.lat && form.address?.lng ? [form.address.lat, form.address.lng] : DEFAULT_POSITION
  );
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Estados locais para inputs
  const [cep, setCep] = useState(form.address?.cep || "");
  const [street, setStreet] = useState(form.address?.street || "");
  const [number, setNumber] = useState(form.address?.number || "");
  const [neighborhood, setNeighborhood] = useState(form.address?.neighborhood || "");
  const [city, setCity] = useState(form.address?.city || "");
  const [state, setState] = useState(form.address?.state || "");

  const lastCepSearchedRef = useRef<string | null>(null);

  // Limpa CEP
  const cleanCep = (c: string) => c.replace(/\D/g, "");

  // Mantém o formulário principal sincronizado com os campos (sem depender do blur)
  useEffect(() => {
    update("address", {
      ...(form.address || {}),
      cep,
      street,
      number,
      neighborhood,
      city,
      state,
      lat: position[0],
      lng: position[1],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep, street, number, neighborhood, city, state, position]);

  // Mapa (Leaflet): cria uma vez; o marcador pode ser arrastado para ajustar o ponto
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView(position, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    const marker = L.marker(position, { draggable: true, icon: pinIcon }).addTo(map);
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      setPosition([lat, lng]);
    });
    mapRef.current = map;
    markerRef.current = marker;
    // o container aparece com animação; recalcula o tamanho depois
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move o mapa quando a posição muda (CEP encontrado ou marcador arrastado)
  useEffect(() => {
    markerRef.current?.setLatLng(position);
    mapRef.current?.setView(position, Math.max(mapRef.current.getZoom(), 15));
  }, [position]);

  // CEP automático
  useEffect(() => {
    const numericCep = cleanCep(cep);
    if (numericCep.length !== 8) return;
    if (numericCep === lastCepSearchedRef.current) return;

    lastCepSearchedRef.current = numericCep;
    setLoadingLocation(true);

    fetch(`https://viacep.com.br/ws/${numericCep}/json/`)
      .then((res) => res.json())
      .then((data) => {
        if (data.erro) return;

        // Atualiza estados locais (o número digitado é mantido)
        setStreet(data.logradouro || "");
        setNeighborhood(data.bairro || "");
        setCity(data.localidade || "");
        setState(data.uf || "");

        // Localiza o endereço no mapa
        const query = `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""}, ${data.uf || ""}, Brasil`;
        return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
          .then((res) => res.json())
          .then((loc) => {
            if (loc.length > 0) {
              const lat = parseFloat(loc[0].lat);
              const lon = parseFloat(loc[0].lon);
              setPosition([lat, lon]);
            }
          });
      })
      .catch(() => {})
      .finally(() => setLoadingLocation(false));
  }, [cep]);

  // "Cidade - UF" em um campo só, como no layout original
  const handleCityState = (value: string) => {
    const [c, uf] = value.split("-").map((p) => p.trim());
    setCity(c ?? "");
    setState((uf ?? "").toUpperCase().slice(0, 2));
  };

  function maskCEP(value: string) {
  return value
    .replace(/\D/g, '')          // remove tudo que não for número
    .replace(/^(\d{5})(\d)/, '$1-$2') // coloca o hífen
    .slice(0, 9);                // limita em 9 caracteres
}


  return (
    <motion.div
      key="step-address"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6 max-w-3xl"
    >
      <div>
        <h2 className="text-2xl font-semibold text-[var(--text)] flex items-center gap-2">
          <MapPin className="w-6 h-6 text-[var(--primary)]" />
          Endereço & Área de Atuação
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Defina se você atende em um local físico ou em um raio de alcance.
        </p>
      </div>

      <AnimatePresence mode="wait">
          <motion.div
            key="physical"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-2xl shadow-md overflow-hidden"
          >
            <div className="grid  grid-cols-1 md:grid-cols-2 gap-4 p-6">
              <Input label="CEP" value={cep} placeholder="00000-000" onChange={(value) => setCep(maskCEP(value))} />
              <Input label="Rua" value={street} placeholder="Rua" onChange={setStreet} />
              <Input label="Número" value={number} placeholder="Número" onChange={(v) => setNumber(v.replace(/\D/g, ""))} />
              <Input label="Bairro" value={neighborhood} placeholder="Bairro" onChange={setNeighborhood} />
              <Input
                label="Cidade / Estado"
                value={state ? `${city} - ${state}` : city}
                placeholder="Cidade - UF"
                onChange={handleCityState}
              />
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--bg-light)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Map className="w-5 h-5 text-[var(--primary)]" />
                <span className="text-sm font-medium text-[var(--text)]">Visualização do mapa</span>
                {loadingLocation && (
                  <span className="flex items-center text-xs text-[var(--text-muted)] ml-2">
                    <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin mr-1" />
                    Buscando localização...
                  </span>
                )}
              </div>

              <p className="text-xs text-[var(--text-muted)] mb-2">
                Digite o CEP para localizar o endereço. Você pode mover o marcador para ajustar.
              </p>
              <div ref={mapContainerRef} className="w-full h-56 rounded-xl border bg-[var(--bg)] border-[var(--border)] overflow-hidden relative isolate z-0"></div>
            </div>
          </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-[var(--text-muted)] font-medium">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="input bg-[var(--bg)]  border border-[var(--border)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:border-[var(--primary)] transition-all duration-200"
      />
    </div>
  );
}
