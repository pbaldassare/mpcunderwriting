export const TIPI_DOCUMENTO_BANDO = [
  "bando",
  "disciplinare",
  "capitolato",
  "chiarimento",
  "esito",
  "altro",
] as const;
export type TipoDocumentoBando = (typeof TIPI_DOCUMENTO_BANDO)[number];

export const STATI_DOCUMENTO_BANDO = ["nuovo", "invariato", "aggiornato", "rimosso"] as const;
export type StatoDocumentoBando = (typeof STATI_DOCUMENTO_BANDO)[number];

export type BandoDocumentoRow = {
  id: string;
  bando_id: string;
  harvest_run_id?: string | null;
  tipo: string;
  nome: string | null;
  mime: string | null;
  url_origine: string | null;
  storage_path: string | null;
  hash_sha256: string | null;
  stato: string;
  visto_il: string | null;
  scaricato_il: string | null;
};

export type BandoHarvestRunRow = {
  id: string;
  bando_id: string;
  avviato_il: string;
  concluso_il: string | null;
  esito: "ok" | "parziale" | "errore";
  motore: string | null;
  documenti_nuovi: number;
  documenti_aggiornati: number;
  novita_json: Record<string, unknown>;
  errore: string | null;
};

export function inferTipoDocumentoBando(
  nome?: string | null,
  url?: string | null,
): TipoDocumentoBando {
  const blob = `${nome || ""} ${url || ""}`.toLowerCase();
  if (/esito|aggiudic|award|canv/.test(blob)) return "esito";
  if (/disciplinar/.test(blob)) return "disciplinare";
  if (/capitolat/.test(blob)) return "capitolato";
  if (/chiariment|faq|quesit/.test(blob)) return "chiarimento";
  if (/bando|avviso|notice|ted/.test(blob)) return "bando";
  return "altro";
}

export function labelTipoDocumentoBando(tipo: string | null | undefined): string {
  switch (tipo) {
    case "disciplinare":
      return "Disciplinare";
    case "capitolato":
      return "Capitolato";
    case "chiarimento":
      return "Chiarimento";
    case "esito":
      return "Esito";
    case "bando":
      return "Bando";
    default:
      return "Altro";
  }
}

export function labelStatoDocumentoBando(stato: string | null | undefined): string {
  switch (stato) {
    case "nuovo":
      return "Nuovo";
    case "aggiornato":
      return "Aggiornato";
    case "rimosso":
      return "Rimosso";
    default:
      return "Invariato";
  }
}

export function classifyDocumentoHash(
  existingHash: string | null | undefined,
  nextHash: string | null | undefined,
): StatoDocumentoBando {
  if (!existingHash) return "nuovo";
  if (!nextHash) return "invariato";
  return existingHash === nextHash ? "invariato" : "aggiornato";
}

export function countNovitaDocumenti(
  docs: Array<{ stato?: string | null }>,
): { nuovi: number; aggiornati: number } {
  return {
    nuovi: docs.filter((d) => d.stato === "nuovo").length,
    aggiornati: docs.filter((d) => d.stato === "aggiornato").length,
  };
}

export function buildHarvestNote(opts: {
  arricchito?: boolean;
  nuovi?: number;
  aggiornati?: number;
  errore?: string | null;
}): string {
  if (opts.errore) return `Harvest parziale: ${opts.errore}`;
  const parti: string[] = [];
  if (opts.arricchito) parti.push("scheda aggiornata");
  if ((opts.nuovi || 0) > 0) parti.push(`${opts.nuovi} doc nuov${opts.nuovi === 1 ? "o" : "i"}`);
  if ((opts.aggiornati || 0) > 0) {
    parti.push(`${opts.aggiornati} aggiornat${opts.aggiornati === 1 ? "o" : "i"}`);
  }
  if (parti.length === 0) return "Nessuna novità dal portale";
  return `Harvest: ${parti.join(", ")}`;
}

export function lastHarvestLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

const ORDINE_TIPI_DOCUMENTO: TipoDocumentoBando[] = [
  "bando",
  "disciplinare",
  "capitolato",
  "chiarimento",
  "esito",
  "altro",
];

export function documentiVisibili<T extends { stato?: string | null }>(docs: T[]): T[] {
  return docs.filter((d) => d.stato !== "rimosso");
}

export function groupDocumentiByTipo<T extends { tipo?: string | null }>(
  docs: T[],
): Array<{ tipo: string; label: string; docs: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const tipo of ORDINE_TIPI_DOCUMENTO) buckets.set(tipo, []);
  for (const doc of docs) {
    const tipo = ORDINE_TIPI_DOCUMENTO.includes(doc.tipo as TipoDocumentoBando)
      ? String(doc.tipo)
      : "altro";
    buckets.get(tipo)!.push(doc);
  }
  return ORDINE_TIPI_DOCUMENTO
    .map((tipo) => ({
      tipo,
      label: labelTipoDocumentoBando(tipo),
      docs: buckets.get(tipo) || [],
    }))
    .filter((g) => g.docs.length > 0);
}
