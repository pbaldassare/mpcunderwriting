/** Campi veicolo modificabili nell'editor inline operazioni polizza. */
export const VEICOLO_EDITABLE_FIELDS = [
  "targa",
  "telaio",
  "marca",
  "modello",
  "versione",
  "tipo_veicolo",
  "tipo_alimentazione",
  "cc",
  "kw",
  "cv",
  "posti",
  "data_immatricolazione",
  "classe_bm",
  "provincia_circolazione",
] as const;

export type VeicoloEditableField = (typeof VEICOLO_EDITABLE_FIELDS)[number];

export type GaranziaPremioParts = {
  firma?: number | null;
  rata?: number | null;
  imposta_provinciale?: number | null;
  ssn?: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lordo riga garanzia = firma + rata + imposta provinciale + SSN. */
export function calcLordoGaranzia(parts: GaranziaPremioParts): number {
  const sum =
    Number(parts.firma || 0) +
    Number(parts.rata || 0) +
    Number(parts.imposta_provinciale || 0) +
    Number(parts.ssn || 0);
  return round2(sum);
}

/** Conguaglio proposto in sostituzione: differenza tra nuovo e premio originale. */
export function calcConguaglioProposto(newLordo: number, originalLordo: number): number {
  return round2(newLordo - originalLordo);
}

export type VeicoloSnapshot = {
  tipo: "veicolo";
  targa: string | null;
  marca: string | null;
  modello: string | null;
  versione: string | null;
  telaio: string | null;
  tipo_veicolo: string | null;
  tipo_alimentazione: string | null;
  cilindrata: number | null;
  potenza_kw: number | null;
  potenza_cv: number | null;
  posti: number | null;
  data_immatricolazione: string | null;
  classe_bm: string | null;
  provincia_circolazione: string | null;
};

/** Snapshot parametri veicolo per storico sostituzione. */
export function buildVeicoloSnapshot(veicolo: Record<string, unknown> | null | undefined): VeicoloSnapshot {
  if (!veicolo) {
    return {
      tipo: "veicolo",
      targa: null,
      marca: null,
      modello: null,
      versione: null,
      telaio: null,
      tipo_veicolo: null,
      tipo_alimentazione: null,
      cilindrata: null,
      potenza_kw: null,
      potenza_cv: null,
      posti: null,
      data_immatricolazione: null,
      classe_bm: null,
      provincia_circolazione: null,
    };
  }
  const intOrNull = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  return {
    tipo: "veicolo",
    targa: (veicolo.targa as string) ?? null,
    marca: (veicolo.marca as string) ?? null,
    modello: (veicolo.modello as string) ?? null,
    versione: (veicolo.versione as string) ?? null,
    telaio: (veicolo.telaio as string) ?? null,
    tipo_veicolo: (veicolo.tipo_veicolo as string) ?? null,
    tipo_alimentazione: (veicolo.tipo_alimentazione as string) ?? null,
    cilindrata: intOrNull(veicolo.cc),
    potenza_kw: intOrNull(veicolo.kw),
    potenza_cv: intOrNull(veicolo.cv),
    posti: intOrNull(veicolo.posti),
    data_immatricolazione: (veicolo.data_immatricolazione as string) ?? null,
    classe_bm: (veicolo.classe_bm as string) ?? null,
    provincia_circolazione: (veicolo.provincia_circolazione as string) ?? null,
  };
}

export type OggettoExtraInput = {
  ubicazione_rischio?: string | null;
  valore_assicurato?: number | string | null;
  riferimento_oggetto?: string | null;
};

export type OggettoSnapshot = {
  tipo: "oggetto_generico";
  descrizione: string | null;
  ubicazione_rischio: string | null;
  valore_assicurato: number | null;
  riferimento_oggetto: string | null;
};

/** Snapshot parametri oggetto generico per storico sostituzione. */
export function buildOggettoSnapshot(
  titolo: { descrizione_polizza?: string | null } | null | undefined,
  extra?: OggettoExtraInput | null,
): OggettoSnapshot {
  const valoreRaw = extra?.valore_assicurato;
  let valore: number | null = null;
  if (valoreRaw != null && valoreRaw !== "") {
    const n = typeof valoreRaw === "string" ? Number(valoreRaw.replace(",", ".")) : Number(valoreRaw);
    valore = Number.isFinite(n) ? round2(n) : null;
  }
  return {
    tipo: "oggetto_generico",
    descrizione: titolo?.descrizione_polizza ?? null,
    ubicazione_rischio: extra?.ubicazione_rischio?.trim() || null,
    valore_assicurato: valore,
    riferimento_oggetto: extra?.riferimento_oggetto?.trim() || null,
  };
}
