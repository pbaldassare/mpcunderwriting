/**
 * Mapping rami gestionale EXE (Roma EXE) → catalogo CBnet.
 * I codici numerici EXE non si importano: collidevano con `rami.codice` CBnet.
 *
 * Scelte chiuse con il broker:
 * - Globale esercizi → MULTIRISCHIO (LQ)
 * - Sanitaria → MALATTIA (MCA)
 * - Cauzioni → FIDEJUSSIONE (FID)
 */

export type ExeRamoMap = {
  exeCodice: string;
  exeDescrizione: string;
  gruppoCodice: string;
  gruppoDescrizione: string;
  ramoCodice: string;
  ramoDescrizione: string;
};

export const ROMA_EXE_RAMI: ExeRamoMap[] = [
  {
    exeCodice: "90",
    exeDescrizione: "RESPONSABILITA' CIVILE AUTO",
    gruppoCodice: "ZQ",
    gruppoDescrizione: "R.C.A.",
    ramoCodice: "QA",
    ramoDescrizione: "R. C. AUTO",
  },
  {
    exeCodice: "60",
    exeDescrizione: "RESP.CIVILE VERSO TERZI",
    gruppoCodice: "ZP",
    gruppoDescrizione: "R.C.T.",
    ramoCodice: "PB",
    ramoDescrizione: "RESP. CIVILE VERSO TERZI",
  },
  {
    exeCodice: "10",
    exeDescrizione: "INCENDIO",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "LS",
    ramoDescrizione: "INCENDIO",
  },
  {
    exeCodice: "15",
    exeDescrizione: "GLOBALE ESERCIZI",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "LQ",
    ramoDescrizione: "MULTIRISCHIO",
  },
  {
    exeCodice: "50",
    exeDescrizione: "INFORTUNI",
    gruppoCodice: "ZN",
    gruppoDescrizione: "INFORTUNI",
    ramoCodice: "NIA",
    ramoDescrizione: "INFORTUNI",
  },
  {
    exeCodice: "42",
    exeDescrizione: "CAUZIONI",
    gruppoCodice: "ZC",
    gruppoDescrizione: "CREDITO CAUZIONI",
    ramoCodice: "FID",
    ramoDescrizione: "FIDEJUSSIONE",
  },
  {
    exeCodice: "59",
    exeDescrizione: "SANITARIA",
    gruppoCodice: "ZM",
    gruppoDescrizione: "MALATTIA",
    ramoCodice: "MCA",
    ramoDescrizione: "MALATTIA",
  },
  {
    exeCodice: "1",
    exeDescrizione: "VITA",
    gruppoCodice: "ZV",
    gruppoDescrizione: "VITA",
    ramoCodice: "RI",
    ramoDescrizione: "VITA INDIVIDUALE",
  },
  {
    exeCodice: "44",
    exeDescrizione: "SPESE LEGALI E PERITALI",
    gruppoCodice: "ZS",
    gruppoDescrizione: "TUTELA GIUDIZIARIA",
    ramoCodice: "PG",
    ramoDescrizione: "SPESE LEGALI",
  },
  {
    exeCodice: "80",
    exeDescrizione: "TRASPORTI",
    gruppoCodice: "ZT",
    gruppoDescrizione: "TRASPORTI",
    ramoCodice: "TM",
    ramoDescrizione: "TRASPORTO MERCI",
  },
  {
    exeCodice: "20",
    exeDescrizione: "FURTO",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "IB",
    ramoDescrizione: "FURTO",
  },
  {
    exeCodice: "77",
    exeDescrizione: "RISCHI APPALTATORE",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "GC",
    ramoDescrizione: "C.A.R.",
  },
  {
    exeCodice: "30",
    exeDescrizione: "FURTO E INCENDIO",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "LU",
    ramoDescrizione: "INCENDIO - FURTO",
  },
  {
    exeCodice: "75",
    exeDescrizione: "ALL RISKS BESTIAME",
    gruppoCodice: "ZL",
    gruppoDescrizione: "INCENDIO FURTO RISCHI TECNOLOGICI",
    ramoCodice: "AR",
    ramoDescrizione: "ALL RISKS",
  },
  {
    exeCodice: "9",
    exeDescrizione: "POLIZZA PIU`",
    gruppoCodice: "ZY",
    gruppoDescrizione: "ALTRI RAMI DANNI",
    ramoCodice: "ZY",
    ramoDescrizione: "ALTRI RAMI DANNI",
  },
];

function norm(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[`'’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const BY_CODICE = new Map(ROMA_EXE_RAMI.map((r) => [norm(r.exeCodice), r]));
const BY_DESCRIZIONE = new Map(ROMA_EXE_RAMI.map((r) => [norm(r.exeDescrizione), r]));

/** Alias di descrizione visti nei file EXE (sospesi / rischi). */
const DESCRIZIONE_ALIAS: Record<string, string> = {
  RCA: "90",
  "RC AUTO": "90",
  "RESPONSABILITA CIVILE AUTO": "90",
  RCT: "60",
  "RC TERZI": "60",
  "RESP CIVILE VERSO TERZI": "60",
  "RESP. CIVILE VERSO TERZI": "60",
  CAUZIONE: "42",
  FIDEJUSSIONE: "42",
  "TUTELA LEGALE": "44",
  "SPESE LEGALI": "44",
  "GLOBALE ESERCIZIO": "15",
  "GLOB.ESER": "15",
  "GLOB.ESER.": "15",
  "GLOB ESER": "15",
  RCVT: "60",
  "RC VT": "60",
  "FUR\\INC": "30",
  "FUR/INC": "30",
  "FUR INC": "30",
  CAR: "77",
  "C.A.R.": "77",
  "POLIZZA PIU": "9",
  "POLIZZA PIU`": "9",
};

export function mapRomaExeRamo(
  codice: string | number | null | undefined,
  descrizione?: string | null,
): ExeRamoMap | null {
  const byCode = BY_CODICE.get(norm(String(codice ?? "")));
  if (byCode) return byCode;

  const desc = norm(descrizione);
  if (!desc) return null;
  const byDesc = BY_DESCRIZIONE.get(desc);
  if (byDesc) return byDesc;

  const aliasCodice = DESCRIZIONE_ALIAS[desc];
  if (aliasCodice) return BY_CODICE.get(aliasCodice) ?? null;
  return null;
}

export type CatalogoRamoCBnet = {
  id: string;
  codice: string;
  descrizione?: string | null;
  gruppo_ramo_id?: string | null;
  gruppo_codice?: string | null;
};

export type RomaExeRamoRisolto = ExeRamoMap & {
  ramoId: string;
  gruppoRamoId: string | null;
};

/** Collega il mapping EXE a un `ramo_id` reale del catalogo CBnet. */
export function resolveRomaExeRamo(
  codice: string | number | null | undefined,
  descrizione: string | null | undefined,
  catalogo: CatalogoRamoCBnet[],
): RomaExeRamoRisolto | null {
  const mapped = mapRomaExeRamo(codice, descrizione);
  if (!mapped) return null;
  const row = catalogo.find((r) => norm(r.codice) === norm(mapped.ramoCodice));
  if (!row) return null;
  return {
    ...mapped,
    ramoId: row.id,
    gruppoRamoId: row.gruppo_ramo_id ?? null,
  };
}

export function exeRamoOriginale(codice: unknown, descrizione: unknown): string {
  const c = String(codice ?? "").trim();
  const d = String(descrizione ?? "").trim();
  if (c && d) return `${c} | ${d}`;
  return d || c;
}
