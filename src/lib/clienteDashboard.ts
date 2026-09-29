import { importoAnnualitaDaRata } from "@/lib/frazionamento";
import { isPolizzaMadre } from "@/lib/quietanze";

export type ClienteDashPolizza = {
  id: string;
  source: "titoli" | "cga";
  numero: string | null;
  stato: string | null;
  premioRata: number;
  frazionamento: string | null;
  dataScadenza: string | null;
  dataInizio: string | null;
  ramo: string;
  compagnia: string;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  detailPath: string;
};

export type ClienteDashSinistro = {
  id: string;
  stato: string | null;
  ramo: string;
  importo: number;
  dataApertura: string | null;
};

export type SliceNomeValore = { name: string; value: number };

export function normalizeNumeroPolizza(n: string | null | undefined): string {
  return String(n || "").replace(/[\s./-]+/g, "").toUpperCase();
}

const STATI_NON_ATTIVI = new Set(["scaduto", "annullato", "sospeso", "estinto", "respinto"]);

/** Polizza madre (o CGA senza doppione) ancora in portafoglio. */
export function isPolizzaDashAttiva(p: ClienteDashPolizza): boolean {
  if (p.source === "titoli" && !isPolizzaMadre(p)) return false;
  const stato = String(p.stato || "").toLowerCase();
  if (STATI_NON_ATTIVI.has(stato)) return false;
  return stato === "attivo" || stato === "incassato" || p.source === "cga";
}

/** Premio annuo lordo: annualizza la rata; le CGA restano sul totale estratto. */
export function premioAnnuoDash(p: ClienteDashPolizza): number {
  const raw = Number(p.premioRata) || 0;
  if (p.source === "cga") return raw;
  return importoAnnualitaDaRata(raw, p.frazionamento);
}

export function dedupeCgaSuTitoli(
  titoli: ClienteDashPolizza[],
  cga: ClienteDashPolizza[],
): ClienteDashPolizza[] {
  const known = new Set(
    titoli.map((t) => normalizeNumeroPolizza(t.numero)).filter(Boolean),
  );
  const extra = cga.filter((c) => {
    const key = normalizeNumeroPolizza(c.numero);
    return !key || !known.has(key);
  });
  return [...titoli, ...extra];
}

export function aggregaSomma(
  rows: ClienteDashPolizza[],
  keyOf: (p: ClienteDashPolizza) => string,
): SliceNomeValore[] {
  const map = new Map<string, number>();
  for (const p of rows) {
    const name = keyOf(p).trim() || "Altro";
    map.set(name, (map.get(name) || 0) + premioAnnuoDash(p));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Tiene i primi `n` e raggruppa il resto in «Altri». */
export function topNConAltri(
  slices: SliceNomeValore[],
  n: number,
  altriLabel = "Altri",
): SliceNomeValore[] {
  const valid = slices.filter((s) => s.value > 0);
  if (valid.length <= n) return valid;
  const head = valid.slice(0, n);
  const rest = valid.slice(n).reduce((s, x) => s + x.value, 0);
  if (rest <= 0) return head;
  return [...head, { name: altriLabel, value: rest }];
}

export type SinistriRamoRow = { name: string; aperti: number; chiusi: number };

export function aggregaSinistriPerRamo(sinistri: ClienteDashSinistro[]): SinistriRamoRow[] {
  const map = new Map<string, { aperti: number; chiusi: number }>();
  for (const s of sinistri) {
    const name = (s.ramo || "Altro").trim() || "Altro";
    const cur = map.get(name) || { aperti: 0, chiusi: 0 };
    const chiuso = ["chiuso", "respinto", "archiviato"].includes(String(s.stato || "").toLowerCase());
    if (chiuso) cur.chiusi += 1;
    else cur.aperti += 1;
    map.set(name, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.aperti + b.chiusi - (a.aperti + a.chiusi));
}

export function topNSinistriPerRamo(sinistri: ClienteDashSinistro[], n = 6): SinistriRamoRow[] {
  const all = aggregaSinistriPerRamo(sinistri);
  if (all.length <= n) return all;
  const head = all.slice(0, n);
  const rest = all.slice(n);
  return [
    ...head,
    {
      name: "Altri",
      aperti: rest.reduce((s, r) => s + r.aperti, 0),
      chiusi: rest.reduce((s, r) => s + r.chiusi, 0),
    },
  ];
}

function annoIso(d: string | null | undefined): string | null {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return Number.isFinite(y) ? String(y) : null;
}

/** Premi delle attive per anno di decorrenza vs importi sinistri per anno di apertura. */
export function aggregaPremiSinistriPerAnno(
  attive: ClienteDashPolizza[],
  sinistri: ClienteDashSinistro[],
  maxAnni = 6,
): { anno: string; premi: number; sinistri: number }[] {
  const map: Record<string, { premi: number; sinistri: number }> = {};
  for (const p of attive) {
    const anno = annoIso(p.dataInizio);
    if (!anno) continue;
    if (!map[anno]) map[anno] = { premi: 0, sinistri: 0 };
    map[anno].premi += premioAnnuoDash(p);
  }
  for (const s of sinistri) {
    const anno = annoIso(s.dataApertura);
    if (!anno) continue;
    if (!map[anno]) map[anno] = { premi: 0, sinistri: 0 };
    map[anno].sinistri += s.importo;
  }
  return Object.entries(map)
    .map(([anno, v]) => ({ anno, premi: v.premi, sinistri: v.sinistri }))
    .sort((a, b) => a.anno.localeCompare(b.anno))
    .slice(-maxAnni);
}

export function ramoLabelFromJoin(ramo: {
  descrizione?: string | null;
  gruppo_ramo?: { descrizione?: string | null } | null;
} | null | undefined): string {
  return ramo?.gruppo_ramo?.descrizione || ramo?.descrizione || "Altro";
}
