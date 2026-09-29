import { format } from "date-fns";
import {
  buildSinistroAddress,
  colorForTipo,
  readGeocodeCache,
  resolveSinistroCoords,
  staticMapColor,
  writeGeocodeCache,
  type SinistroGeo,
} from "./sinistriMapUtils";
import { resolveReparto } from "./sinistriReparto";
import { excludeArchiviati, isSinistroAperto, labelStatoSinistro } from "./sinistriStati";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY) as string | undefined;

export interface SinistriFilterState {
  search: string;
  stati: string[];
  rami: string[];
  compagnie: string[];
  polizze: string[];
  citta: string[];
  reparti?: string[];
  dataDa?: Date;
  dataA?: Date;
}

export interface EnteInfo {
  ragioneSociale: string;
  partitaIva?: string;
  codiceFiscale?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  email?: string;
  telefono?: string;
}

export interface SinPerRamoRow {
  ramo: string;
  aperti: number;
  chiusi: number;
  riserva: number;
  liquidato: number;
}

export interface SinistroPdfRow {
  numeroSinistro: string;
  garanzia: string;
  polizza: string;
  compagnia: string;
  stato: string;
  luogo: string;
  reparto?: string;
  riserva: string;
  liquidato: string;
  dataEvento: string;
  dataDenuncia: string;
}

export interface SinistriReportKpis {
  totale: number;
  aperti: number;
  chiusi: number;
  riserve: number;
  liquidato: number;
}

const fmtDate = (v: unknown) => (v ? format(new Date(v as string), "dd/MM/yyyy") : "—");
const fmtEur = (n: number) =>
  (n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatStatoLabel(stato?: string | null): string {
  return labelStatoSinistro(stato);
}

export function buildFilterSummary(
  filters: SinistriFilterState,
  filteredCount: number,
  totalCount: number,
): string[] {
  const lines: string[] = [];

  if (filters.search.trim()) lines.push(`Ricerca: "${filters.search.trim()}"`);
  if (filters.stati.length) lines.push(`Stato: ${filters.stati.map(formatStatoLabel).join(", ")}`);
  else lines.push("Stato: tutti");
  if (filters.rami.length) lines.push(`Garanzia: ${filters.rami.join(", ")}`);
  if (filters.compagnie.length) lines.push(`Compagnia: ${filters.compagnie.join(", ")}`);
  if (filters.polizze.length) lines.push(`Polizza: ${filters.polizze.join(", ")}`);
  if (filters.citta.length) lines.push(`Città: ${filters.citta.join(", ")}`);
  if (filters.reparti?.length) lines.push(`Reparto: ${filters.reparti.join(", ")}`);
  if (filters.dataDa || filters.dataA) {
    const da = filters.dataDa ? format(filters.dataDa, "dd/MM/yyyy") : "—";
    const a = filters.dataA ? format(filters.dataA, "dd/MM/yyyy") : "—";
    lines.push(`Data evento: dal ${da} al ${a}`);
  }
  lines.push(`Risultato: ${filteredCount} di ${totalCount} sinistri`);
  return lines;
}

export function computeKpis(sinistri: any[]): SinistriReportKpis {
  const visibili = excludeArchiviati(sinistri);
  const aperti = visibili.filter((s) => isSinistroAperto(s.stato)).length;
  const chiusi = visibili.length - aperti;
  const riserve = visibili.reduce((sum, s) => sum + (s.importo_riserva || 0), 0);
  const liquidato = visibili.reduce((sum, s) => sum + (s.importo_liquidato || 0), 0);
  return { totale: visibili.length, aperti, chiusi, riserve, liquidato };
}

export function aggregateSinPerRamo(sinistri: any[]): SinPerRamoRow[] {
  const map = new Map<string, SinPerRamoRow>();
  excludeArchiviati(sinistri).forEach((s) => {
    const ramo = s.ramo_sinistro || "Altro";
    const isOpen = isSinistroAperto(s.stato);
    const cur = map.get(ramo) || { ramo, aperti: 0, chiusi: 0, riserva: 0, liquidato: 0 };
    if (isOpen) cur.aperti++;
    else cur.chiusi++;
    cur.riserva += s.importo_riserva || 0;
    cur.liquidato += s.importo_liquidato || 0;
    map.set(ramo, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.ramo.localeCompare(b.ramo, "it"));
}

/** Righe tabella PDF — stessi campi essenziali di exportSinistriXlsx. */
export function mapSinistriToPdfRows(sinistri: any[], opts?: { includeReparto?: boolean }): SinistroPdfRow[] {
  return excludeArchiviati(sinistri).map((s) => ({
    numeroSinistro: s.numero_sinistro || "—",
    garanzia: s.ramo_sinistro || "—",
    polizza: s.titoli?.numero_titolo || "—",
    compagnia: s.compagnie?.nome || "—",
    stato: formatStatoLabel(s.stato),
    luogo: s.citta_sinistro || s.luogo_sinistro || s.indirizzo_sinistro || "—",
    reparto: opts?.includeReparto ? resolveReparto(s) : undefined,
    riserva: s.importo_riserva ? fmtEur(s.importo_riserva) : "—",
    liquidato: s.importo_liquidato ? fmtEur(s.importo_liquidato) : "—",
    dataEvento: fmtDate(s.data_evento),
    dataDenuncia: fmtDate(s.data_denuncia),
  }));
}

export function buildEnteInfoFromCliente(cliente: any): EnteInfo {
  const indirizzo = cliente.indirizzo_sede || cliente.indirizzo_residenza || "";
  const cap = cliente.cap_sede || cliente.cap_residenza || "";
  const citta = cliente.citta_sede || cliente.citta_residenza || "";
  const provincia = cliente.provincia_sede || cliente.provincia_residenza || "";
  return {
    ragioneSociale: cliente.ragione_sociale || `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || "Ente",
    partitaIva: cliente.partita_iva || undefined,
    codiceFiscale: cliente.codice_fiscale_azienda || cliente.codice_fiscale || undefined,
    indirizzo: indirizzo || undefined,
    cap: cap || undefined,
    citta: citta || undefined,
    provincia: provincia || undefined,
    email: cliente.email || cliente.pec || undefined,
    telefono: cliente.telefono || undefined,
  };
}

async function geocodeAddress(addr: string): Promise<{ lat: number; lng: number } | null> {
  if (!addr || !GOOGLE_MAPS_API_KEY) return null;
  const cache = readGeocodeCache();
  if (cache[addr]) return cache[addr];

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&language=it`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const loc = json?.results?.[0]?.geometry?.location;
  if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
  cache[addr] = { lat: loc.lat, lng: loc.lng };
  writeGeocodeCache(cache);
  return cache[addr];
}

type MarkerPoint = { lat: number; lng: number; color: string };

async function resolveMarkers(sinistri: SinistroGeo[]): Promise<MarkerPoint[]> {
  const markers: MarkerPoint[] = [];
  for (const s of sinistri) {
    const stored = resolveSinistroCoords(s);
    const coords = stored || (buildSinistroAddress(s) ? await geocodeAddress(buildSinistroAddress(s)) : null);
    if (!coords) continue;
    markers.push({ ...coords, color: staticMapColor(colorForTipo(s.tipo_sinistro)) });
  }
  return markers;
}

/** Scarica immagine Google Static Maps con marker colorati per tipo sinistro. */
export async function fetchStaticMapImage(sinistri: SinistroGeo[]): Promise<Uint8Array | null> {
  if (!GOOGLE_MAPS_API_KEY || !sinistri.length) return null;

  const markers = await resolveMarkers(sinistri);
  if (!markers.length) return null;

  const limited = markers.slice(0, 80);
  const center = {
    lat: limited.reduce((s, m) => s + m.lat, 0) / limited.length,
    lng: limited.reduce((s, m) => s + m.lng, 0) / limited.length,
  };

  const byColor = new Map<string, string[]>();
  for (const m of limited) {
    const list = byColor.get(m.color) || [];
    list.push(`${m.lat},${m.lng}`);
    byColor.set(m.color, list);
  }

  const params = new URLSearchParams({
    size: "640x400",
    scale: "2",
    maptype: "roadmap",
    center: `${center.lat},${center.lng}`,
    zoom: limited.length === 1 ? "14" : "11",
    key: GOOGLE_MAPS_API_KEY,
    language: "it",
  });

  for (const [color, pts] of byColor) {
    params.append("markers", `color:${color}|${pts.join("|")}`);
  }

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  const res = await fetch(mapUrl);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function captureElementAsPng(el: HTMLElement | null): Promise<Uint8Array | null> {
  if (!el) return null;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
  const dataUrl = canvas.toDataURL("image/png");
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export function buildReportFilename(ragioneSociale: string): string {
  const safe = (ragioneSociale || "ente")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  return `Report_Sinistri_${safe}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
}
