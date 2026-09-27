/* Localização do cliente para a busca por proximidade.
 * Fica só no navegador (localStorage) e é enviada à API apenas como lat/lng da busca. */

export interface ClientLocation {
  lat: number;
  lng: number;
  label: string;
}

const KEY = "hire.location";

export function loadLocation(): ClientLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? v : null;
  } catch {
    return null;
  }
}

export function saveLocation(loc: ClientLocation | null) {
  try {
    if (loc) localStorage.setItem(KEY, JSON.stringify(loc));
    else localStorage.removeItem(KEY);
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
}

/** Cidade aproximada de um ponto (para o rótulo "Perto de ...") */
async function reverseCity(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`, { headers: { "Accept-Language": "pt-BR" } });
    const j = await r.json();
    const a = j.address ?? {};
    return a.city || a.town || a.village || a.municipality || "sua localização";
  } catch {
    return "sua localização";
  }
}

/** Localização do aparelho (pede permissão ao navegador). */
export function locateByDevice(): Promise<ClientLocation> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Seu navegador não informa a localização. Use o CEP."));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        resolve({ lat, lng, label: await reverseCity(lat, lng) });
      },
      () => reject(new Error("Não foi possível obter a localização. Verifique a permissão ou use o CEP.")),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

/** Localização a partir do CEP (ViaCEP para a cidade, OpenStreetMap para o ponto). */
export async function locateByCep(cep: string): Promise<ClientLocation> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("Informe um CEP com 8 números.");
  const via = await fetch(`https://viacep.com.br/ws/${digits}/json/`).then((r) => r.json()).catch(() => null);
  if (!via || via.erro) throw new Error("CEP não encontrado.");
  const q = new URLSearchParams({ format: "json", limit: "1", country: "Brazil", city: via.localidade, state: via.uf });
  if (via.logradouro) q.set("street", via.logradouro);
  let found = await fetch(`https://nominatim.openstreetmap.org/search?${q}`).then((r) => r.json()).catch(() => []);
  if (!found?.length) {
    q.delete("street");
    found = await fetch(`https://nominatim.openstreetmap.org/search?${q}`).then((r) => r.json()).catch(() => []);
  }
  if (!found?.length) throw new Error("Não foi possível localizar este CEP no mapa.");
  return { lat: Number(found[0].lat), lng: Number(found[0].lon), label: `${via.localidade} - ${via.uf}` };
}

export function formatDistance(km: number | null | undefined) {
  if (km === null || km === undefined) return "";
  return km < 1 ? "a menos de 1 km" : `a ${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}
