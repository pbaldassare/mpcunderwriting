/**
 * Righe esplicite fattori di regolazione (fattore × anno).
 * Chiave: `${fattoreId}|${anno}` — unique DB (titolo_id, fattore_id, anno).
 */

import { FATTORI_REGOLAZIONE_STANDARD } from "@/lib/fattoriRegolazioneStandard";

export type FattoreRegolazioneRef = {
  id: string;
  codice: string;
  descrizione: string;
};

/** Etichetta UI: solo descrizione italiana, mai il codice snake_case. */
export function fattoreRegolazioneLabel(
  f: { descrizione?: string | null; codice?: string | null } | null | undefined,
): string {
  const desc = f?.descrizione?.trim();
  if (desc) return desc;
  const codice = f?.codice?.trim();
  if (!codice) return "Fattore";
  const std = FATTORI_REGOLAZIONE_STANDARD.find((s) => s.codice === codice);
  if (std) return std.descrizione;
  return codice.replace(/_/g, " ");
}

/** ISO `yyyy-mm-dd` → `dd/mm/yyyy`. */
export function formatIsoDateIt(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Etichetta slot anno: `2027` oppure `2027 — 30/06/2027`. */
export function formatAnnoSlotLabel(slot: Pick<AnnoSlot, "anno" | "data_presunta">): string {
  const it = formatIsoDateIt(slot.data_presunta);
  return it ? `${slot.anno} — ${it}` : String(slot.anno);
}

export type RegolazioneFattoreExisting = {
  fattore_id: string;
  anno: number;
  importo_esposto: number;
  data_presunta?: string | null;
  note?: string | null;
};

/** Riga UI / state — solo le righe presenti si salvano. */
export type RegolazioneFattoreRiga = {
  key: string;
  fattore_id: string;
  anno: number;
  data_presunta?: string | null;
  importo_esposto: number;
  fattore_codice?: string;
  fattore_descrizione?: string;
};

/** @deprecated alias — preferire RegolazioneFattoreRiga */
export type RegolazioneFattoreRow = RegolazioneFattoreRiga & {
  data_presunta: string | null;
  fattore_codice: string;
  fattore_descrizione: string;
};

export type AnnoSlot = {
  anno: number;
  data_presunta: string | null;
};

export function regolazioneFattoreKey(fattoreId: string, anno: number): string {
  return `${fattoreId}|${anno}`;
}

export function yearFromIsoDate(
  iso: string | null | undefined,
  fallback?: number,
): number | null {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return Number(iso.slice(0, 4));
  }
  if (fallback != null && Number.isFinite(fallback)) return Math.floor(fallback);
  return null;
}

/** Slot anno da date presunte; se assenti, un anno fallback. */
export function yearSlotsFromDatePresunte(
  datePresunte: string[],
  fallbackAnno?: number,
): AnnoSlot[] {
  const dates = (datePresunte ?? []).filter((d) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dates.length) {
    return dates.map((d) => ({
      anno: yearFromIsoDate(d)!,
      data_presunta: d,
    }));
  }
  const anno = fallbackAnno ?? new Date().getFullYear() + 1;
  return [{ anno, data_presunta: null }];
}

/**
 * Costruisce le righe solo da `existing` (DB / bozza).
 * Non esplode più date × tutti i fattori del catalogo.
 */
export function buildRegolazioneFattoriRows(opts: {
  existing?: RegolazioneFattoreExisting[];
  fattori?: FattoreRegolazioneRef[];
}): RegolazioneFattoreRiga[] {
  const fattoriById = new Map((opts.fattori ?? []).map((f) => [f.id, f]));
  const out: RegolazioneFattoreRiga[] = [];
  const seen = new Set<string>();

  for (const e of opts.existing ?? []) {
    if (!e?.fattore_id || !Number.isFinite(e.anno)) continue;
    const key = regolazioneFattoreKey(e.fattore_id, e.anno);
    if (seen.has(key)) continue;
    seen.add(key);
    const f = fattoriById.get(e.fattore_id);
    out.push({
      key,
      fattore_id: e.fattore_id,
      anno: e.anno,
      data_presunta: e.data_presunta ?? null,
      importo_esposto: Number(e.importo_esposto) || 0,
      fattore_codice: f?.codice,
      fattore_descrizione: f?.descrizione,
    });
  }
  return out;
}

export function createRegolazioneFattoreRiga(opts: {
  fattore: FattoreRegolazioneRef;
  anno: number;
  data_presunta?: string | null;
  importo_esposto?: number;
}): RegolazioneFattoreRiga {
  const key = regolazioneFattoreKey(opts.fattore.id, opts.anno);
  return {
    key,
    fattore_id: opts.fattore.id,
    anno: opts.anno,
    data_presunta: opts.data_presunta ?? null,
    importo_esposto: Number(opts.importo_esposto) || 0,
    fattore_codice: opts.fattore.codice,
    fattore_descrizione: opts.fattore.descrizione,
  };
}

/** Aggiunge una riga; no-op se già presente stesso fattore+anno. */
export function addRegolazioneFattoreRiga(
  righe: RegolazioneFattoreRiga[],
  riga: RegolazioneFattoreRiga,
): RegolazioneFattoreRiga[] {
  if (righe.some((r) => r.key === riga.key || (r.fattore_id === riga.fattore_id && r.anno === riga.anno))) {
    return righe;
  }
  return [...righe, riga];
}

/** Aggiunge più fattori per uno o più anni; ignora duplicati fattore+anno. */
export function addRegolazioneFattoriRighe(
  righe: RegolazioneFattoreRiga[],
  nuove: RegolazioneFattoreRiga[],
): RegolazioneFattoreRiga[] {
  return (nuove ?? []).reduce((acc, riga) => addRegolazioneFattoreRiga(acc, riga), righe);
}

/**
 * Prodotto cartesiano fattori × slot anno (ogni fattore per ogni data).
 * Dedup interno sulla chiave fattore+anno.
 */
export function createRegolazioneFattoriCartesian(
  selectedFattori: FattoreRegolazioneRef[],
  selectedSlots: AnnoSlot[],
  importo_esposto = 0,
): RegolazioneFattoreRiga[] {
  const out: RegolazioneFattoreRiga[] = [];
  const seen = new Set<string>();
  for (const slot of selectedSlots ?? []) {
    if (!Number.isFinite(slot?.anno)) continue;
    for (const fattore of selectedFattori ?? []) {
      if (!fattore?.id) continue;
      const key = regolazioneFattoreKey(fattore.id, slot.anno);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        createRegolazioneFattoreRiga({
          fattore,
          anno: slot.anno,
          data_presunta: slot.data_presunta,
          importo_esposto,
        }),
      );
    }
  }
  return out;
}

export function removeRegolazioneFattoreRiga(
  righe: RegolazioneFattoreRiga[],
  key: string,
): RegolazioneFattoreRiga[] {
  return righe.filter((r) => r.key !== key);
}

export function updateRegolazioneFattoreImporto(
  righe: RegolazioneFattoreRiga[],
  key: string,
  importo: number,
): RegolazioneFattoreRiga[] {
  return righe.map((r) =>
    r.key === key ? { ...r, importo_esposto: Number.isFinite(importo) ? importo : 0 } : r,
  );
}

/**
 * Fattori del catalogo ancora disponibili per almeno uno degli anni.
 * Se `anni` è vuoto, restituisce tutti i fattori validi.
 */
export function fattoriDisponibiliPerAnni(
  fattori: FattoreRegolazioneRef[],
  righe: RegolazioneFattoreRiga[],
  anni: number[],
): FattoreRegolazioneRef[] {
  const list = (fattori ?? []).filter((f) => f?.id);
  const years = (anni ?? []).filter((y) => Number.isFinite(y));
  if (years.length === 0) return list;
  return list.filter((f) =>
    years.some((anno) => !righe.some((r) => r.fattore_id === f.id && r.anno === anno)),
  );
}

/** Fattori del catalogo non ancora usati per lo stesso anno. */
export function fattoriDisponibiliPerAnno(
  fattori: FattoreRegolazioneRef[],
  righe: RegolazioneFattoreRiga[],
  anno: number,
): FattoreRegolazioneRef[] {
  return fattoriDisponibiliPerAnni(fattori, righe, [anno]);
}

/** Payload insert per titoli_regolazione_fattori. */
export function rowsToInsertPayload(
  titoloId: string,
  ramoId: string,
  rows: RegolazioneFattoreRiga[],
): Array<{
  titolo_id: string;
  ramo_id: string;
  fattore_id: string;
  importo_esposto: number;
  anno: number;
  data_presunta: string | null;
}> {
  return rows.map((r) => ({
    titolo_id: titoloId,
    ramo_id: ramoId,
    fattore_id: r.fattore_id,
    importo_esposto: Number(r.importo_esposto) || 0,
    anno: r.anno,
    data_presunta: r.data_presunta ?? null,
  }));
}
