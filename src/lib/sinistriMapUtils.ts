/** Colori marker mappa sinistri per tipo (condiviso UI + report PDF). */
export function colorForTipo(t?: string | null): string {
  const v = (t || "").toLowerCase();
  if (v.includes("furto") || v.includes("vandal")) return "#dc2626";
  if (v.startsWith("rc_") || v.includes("patrimon") || v.includes("difesa")) return "#2563eb";
  if (v.startsWith("rca") || v.includes("cristall") || v.includes("urto") || v.includes("auto")) return "#f59e0b";
  if (v.includes("infortun") || v.includes("malatt")) return "#7c3aed";
  if (v.includes("incend") || v.includes("evento") || v.includes("grandine") || v.includes("acqua") || v.includes("elettr")) return "#0d9488";
  return "#64748b";
}

export const GEOCODE_CACHE_KEY = "cbnet_geocode_cache_v1";

export const REGGIO_CALABRIA_CENTER = { lat: 38.1113, lng: 15.6471 };

export type SinistroGeo = {
  id: string;
  tipo_sinistro?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  citta_sinistro?: string | null;
  cap_sinistro?: string | null;
  provincia_sinistro?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function resolveSinistroCoords(
  s: Pick<SinistroGeo, "lat" | "lng">,
): { lat: number; lng: number } | null {
  if (s.lat == null || s.lng == null) return null;
  const lat = Number(s.lat);
  const lng = Number(s.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function buildSinistroAddress(s: SinistroGeo): string {
  const parts = [
    s.indirizzo_sinistro,
    s.cap_sinistro,
    s.citta_sinistro,
    s.provincia_sinistro && `(${s.provincia_sinistro})`,
    "Italia",
  ]
    .filter(Boolean)
    .join(", ");
  return parts || s.luogo_sinistro || "";
}

export function readGeocodeCache(): Record<string, { lat: number; lng: number }> {
  try {
    return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeGeocodeCache(c: Record<string, { lat: number; lng: number }>) {
  try {
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* noop */
  }
}

/** Mappa hex custom → colori supportati da Google Static Maps. */
export function staticMapColor(hex: string): string {
  const map: Record<string, string> = {
    "#dc2626": "red",
    "#2563eb": "blue",
    "#f59e0b": "orange",
    "#7c3aed": "purple",
    "#0d9488": "green",
    "#64748b": "gray",
  };
  return map[hex.toLowerCase()] || "gray";
}
