/** Stati pratica sinistro (colonna `sinistri.stato`, check Postgres). */

export const SINISTRO_STATO_ARCHIVIATO = "archiviato" as const;

export type SinistroStatoDef = {
  /** Valore stabile persistito in `sinistri.stato`. */
  value: string;
  /** Label UI sempre in CAPS. */
  label: string;
  /** Chiusura / archivio / analoghi terminali: riapertura solo admin. */
  chiusura: boolean;
};

/**
 * Catalogo unico: valori DB snake + label CAPS.
 *
 * Mapping vecchio → (stesso slug, sola label CAPS):
 * - bozza → BOZZA
 * - in_valutazione → IN VALUTAZIONE
 * - aperto → APERTO
 * - in_lavorazione → IN LAVORAZIONE
 * - in_attesa_documenti → IN ATTESA DOCUMENTI
 * - in_liquidazione → IN LIQUIDAZIONE
 * - chiuso → CHIUSO
 * - respinto → RESPINTO
 * - archiviato → ARCHIVIATO
 *
 * APERTURA SINISTRO e IN ATTESA DOCUMENTAZIONE DA CLIENTE sono voci nuove
 * (non alias di `aperto` / `in_attesa_documenti`): significato operativo diverso.
 */
export const SINISTRO_STATI_CATALOGO: readonly SinistroStatoDef[] = [
  { value: "apertura_cautelativa", label: "APERTURA CAUTELATIVA", chiusura: false },
  { value: "apertura_sinistro", label: "APERTURA SINISTRO", chiusura: false },
  { value: "archiviato", label: "ARCHIVIATO", chiusura: true },
  { value: "atto_di_citazione", label: "ATTO DI CITAZIONE", chiusura: false },
  { value: "card_attivo", label: "CARD ATTIVO", chiusura: false },
  { value: "card_passivo", label: "CARD PASSIVO", chiusura: false },
  { value: "chiuso", label: "CHIUSO", chiusura: true },
  { value: "chiuso_card_passivo", label: "CHIUSO CARD PASSIVO", chiusura: true },
  { value: "chiuso_senza_responsabilita", label: "CHIUSO SENZA RESPONSABILITA'", chiusura: true },
  { value: "chiuso_senza_seguito", label: "CHIUSO SENZA SEGUITO", chiusura: true },
  { value: "chiuso_senza_seguito_fuori_garanzia", label: "CHIUSO SENZA SEGUITO – FUORI GARANZIA", chiusura: true },
  { value: "chiuso_senza_seguito_in_franchigia", label: "CHIUSO SENZA SEGUITO - IN FRANCHIGIA", chiusura: true },
  { value: "chiuso_senza_seguito_prescritto", label: "CHIUSO SENZA SEGUITO – PRESCRITTO", chiusura: true },
  { value: "contenzioso", label: "CONTENZIOSO", chiusura: false },
  { value: "i_sollecito_doc_cliente", label: "I SOLLECITO DOC CLIENTE", chiusura: false },
  { value: "ii_sollecito_doc_cliente", label: "II SOLLECITO DOC CLIENTE", chiusura: false },
  { value: "in_attesa_di_perizia", label: "IN ATTESA DI PERIZIA", chiusura: false },
  { value: "in_attesa_di_sviluppi", label: "IN ATTESA DI SVILUPPI", chiusura: false },
  { value: "in_attesa_documentazione_da_cliente", label: "IN ATTESA DOCUMENTAZIONE DA CLIENTE", chiusura: false },
  { value: "in_attesa_documentazione_da_ctp", label: "IN ATTESA DOCUMENTAZIONE DA CTP", chiusura: false },
  { value: "in_attesa_documentazione_fiscale_per_iva", label: "IN ATTESA DOCUMENTAZIONE FISCALE PER IVA", chiusura: false },
  { value: "in_attesa_liquidazione_franchigia_rct", label: "IN ATTESA LIQUIDAZIONE FRANCHIGIA RCT", chiusura: false },
  { value: "in_attesa_nomina_perito", label: "IN ATTESA NOMINA PERITO", chiusura: false },
  { value: "in_attesa_pagamento_da_compagnia", label: "IN ATTESA PAGAMENTO DA COMPAGNIA", chiusura: false },
  { value: "in_attesa_quietanza_da_cliente", label: "IN ATTESA QUIETANZA DA CLIENTE", chiusura: false },
  { value: "in_attesa_quietanza_da_compagnia", label: "IN ATTESA QUIETANZA DA COMPAGNIA", chiusura: false },
  { value: "inviata_relazione_tecnica_a_compagnia", label: "INVIATA RELAZIONE TECNICA A COMPAGNIA", chiusura: false },
  { value: "invio_atto_liquidazione_amichevole_cliente", label: "INVIO ATTO LIQUIDAZIONE AMICHEVOLE CLIENTE", chiusura: false },
  { value: "invio_atto_liquidazione_amichevole_compagnia", label: "INVIO ATTO LIQUIDAZIONE AMICHEVOLE COMPAGNIA", chiusura: false },
  { value: "invio_atto_liquidazione_amichevole_perito", label: "INVIO ATTO LIQUIDAZIONE AMICHEVOLE PERITO", chiusura: false },
  { value: "invio_citazione_in_compagnia_causa", label: "INVIO CITAZIONE IN COMPAGNIA – CAUSA –", chiusura: false },
  { value: "invio_documentazione_a_compagnia", label: "INVIO DOCUMENTAZIONE A COMPAGNIA", chiusura: false },
  { value: "invio_quietanza_a_compagnia", label: "INVIO QUIETANZA A COMPAGNIA", chiusura: false },
  { value: "invio_quietanza_al_cliente", label: "INVIO QUIETANZA AL CLIENTE", chiusura: false },
  { value: "liquidato", label: "LIQUIDATO", chiusura: true },
  { value: "liquidato_parziale", label: "LIQUIDATO PARZIALE", chiusura: false },
  { value: "liquidazione_transattiva", label: "LIQUIDAZIONE TRANSATTIVA", chiusura: false },
  { value: "mediazione", label: "MEDIAZIONE", chiusura: false },
  { value: "non_denunciato_a_compagnia", label: "NON DENUNCIATO A COMPAGNIA", chiusura: false },
  { value: "operazioni_peritali_in_corso", label: "OPERAZIONI PERITALI IN CORSO", chiusura: false },
  { value: "passaggio_ad_altro_broker", label: "PASSAGGIO AD ALTRO BROKER", chiusura: true },
  { value: "procedimento_giudizio_concluso", label: "PROCEDIMENTO /GIUDIZIO CONCLUSO", chiusura: true },
  // Legacy ancora in uso nel DB (non in lista operativa nuova, ma selezionabili).
  { value: "bozza", label: "BOZZA", chiusura: false },
  { value: "in_valutazione", label: "IN VALUTAZIONE", chiusura: false },
  { value: "aperto", label: "APERTO", chiusura: false },
  { value: "in_lavorazione", label: "IN LAVORAZIONE", chiusura: false },
  { value: "in_attesa_documenti", label: "IN ATTESA DOCUMENTI", chiusura: false },
  { value: "in_liquidazione", label: "IN LIQUIDAZIONE", chiusura: false },
  { value: "respinto", label: "RESPINTO", chiusura: true },
] as const;

export const SINISTRO_STATI = SINISTRO_STATI_CATALOGO.map((s) => s.value);

export type SinistroStato = (typeof SINISTRO_STATI_CATALOGO)[number]["value"];

const CATALOGO_BY_VALUE = new Map<string, SinistroStatoDef>(
  SINISTRO_STATI_CATALOGO.map((s) => [s.value, s]),
);

const CHIUSURA_VALUES = new Set(
  SINISTRO_STATI_CATALOGO.filter((s) => s.chiusura).map((s) => s.value),
);

/** Stati visibili di default in elenco/ricerca staff e nelle estrazioni. */
export const SINISTRO_STATI_OPERATIVI = SINISTRO_STATI.filter(
  (s) => s !== SINISTRO_STATO_ARCHIVIATO,
);

export const SINISTRO_STATI_TERMINALI = SINISTRO_STATI_CATALOGO.filter((s) => s.chiusura).map(
  (s) => s.value,
);

export const SINISTRO_STATO_BADGE: Record<string, string> = {
  bozza: "bg-slate-100 text-slate-700 border border-slate-300",
  in_valutazione: "bg-amber-100 text-amber-800",
  aperto: "bg-blue-100 text-blue-800",
  apertura_sinistro: "bg-blue-100 text-blue-800",
  apertura_cautelativa: "bg-sky-100 text-sky-800",
  in_lavorazione: "bg-yellow-100 text-yellow-800",
  in_attesa_documenti: "bg-orange-100 text-orange-800",
  in_liquidazione: "bg-purple-100 text-purple-800",
  chiuso: "bg-green-100 text-green-800",
  respinto: "bg-red-100 text-red-800",
  archiviato: "bg-gray-200 text-gray-700 border border-gray-300",
  liquidato: "bg-emerald-100 text-emerald-800",
  liquidato_parziale: "bg-teal-100 text-teal-800",
  passaggio_ad_altro_broker: "bg-gray-200 text-gray-700 border border-gray-300",
  procedimento_giudizio_concluso: "bg-green-100 text-green-800",
};

/** Normalizza lo stato pratica per confronti (case, spazi, trattini, accenti). */
export function normalizzaStatoSinistro(stato?: string | null): string {
  return String(stato || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´’]/g, "")
    .replace(/[\s\-–—/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isStatoSinistroNoto(stato?: string | null): boolean {
  const s = normalizzaStatoSinistro(stato);
  return CATALOGO_BY_VALUE.has(s);
}

export function isArchiviato(stato?: string | null): boolean {
  return normalizzaStatoSinistro(stato) === SINISTRO_STATO_ARCHIVIATO;
}

/**
 * Chiusura/archivio e analoghi terminali:
 * CHIUSO*, ARCHIVIATO, PROCEDIMENTO /GIUDIZIO CONCLUSO, PASSAGGIO AD ALTRO BROKER,
 * LIQUIDATO, RESPINTO.
 */
export function isStatoChiusuraArchivio(stato?: string | null): boolean {
  const s = normalizzaStatoSinistro(stato);
  if (!s) return false;
  if (CHIUSURA_VALUES.has(s)) return true;
  return s === "chiuso" || s.startsWith("chiuso_");
}

export function isSinistroTerminale(stato?: string | null): boolean {
  return isStatoChiusuraArchivio(stato);
}

/** Aperto = non in uno stato di chiusura/archivio. */
export function isSinistroAperto(stato?: string | null): boolean {
  return !isStatoChiusuraArchivio(stato);
}

export function isRuoloAdmin(ruolo?: string | null): boolean {
  return String(ruolo || "").toLowerCase() === "admin";
}

/**
 * Riapertura = da uno stato di chiusura/archivio verso uno stato non-chiuso.
 * Solo `admin` può farlo. I passaggi tra stati di chiusura restano liberi.
 */
export function puoRiaprireSinistro(
  ruolo: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isStatoChiusuraArchivio(from)) return true;
  if (isStatoChiusuraArchivio(to)) return true;
  return isRuoloAdmin(ruolo);
}

/**
 * Voci della tendina "Nuovo stato": se la pratica è chiusa e l'utente non è admin,
 * restano solo gli altri stati di chiusura (niente riapertura).
 */
export function statiSelezionabiliPerCambio(
  statoCorrente?: string | null,
  canRiaprire = true,
): readonly string[] {
  const current = normalizzaStatoSinistro(statoCorrente);
  const all = SINISTRO_STATI.filter((s) => s !== current);
  if (isStatoChiusuraArchivio(statoCorrente) && !canRiaprire) {
    return all.filter((s) => isStatoChiusuraArchivio(s));
  }
  return all;
}

export function optionsStatoSinistro(
  values: readonly string[] = SINISTRO_STATI,
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: labelStatoSinistro(value) }));
}

/**
 * Compagnia assicurativa modificabile in testata: sì per tutti gli stati
 * tranne `chiuso` e `archiviato` (e varianti di casing/spaziatura).
 */
export function puoModificareCompagniaSinistro(stato?: string | null): boolean {
  const s = normalizzaStatoSinistro(stato);
  return s !== "chiuso" && s !== "archiviato";
}

export function labelStatoSinistro(stato?: string | null): string {
  const s = normalizzaStatoSinistro(stato);
  if (!s) return "—";
  const def = CATALOGO_BY_VALUE.get(s);
  if (def) return def.label;
  return s.replace(/_/g, " ").toUpperCase();
}

export function badgeClassStatoSinistro(stato?: string | null): string {
  const s = normalizzaStatoSinistro(stato);
  if (SINISTRO_STATO_BADGE[s]) return SINISTRO_STATO_BADGE[s];
  if (isStatoChiusuraArchivio(s)) {
    if (s === "respinto") return "bg-red-100 text-red-800";
    if (s === "archiviato" || s === "passaggio_ad_altro_broker") {
      return "bg-gray-200 text-gray-700 border border-gray-300";
    }
    return "bg-green-100 text-green-800";
  }
  if (s.includes("attesa") || s.includes("sollecito")) return "bg-orange-100 text-orange-800";
  if (s.includes("liquidaz") || s.includes("liquidato")) return "bg-purple-100 text-purple-800";
  if (s.includes("card")) return "bg-sky-100 text-sky-800";
  if (s.includes("contenzioso") || s.includes("citazione") || s.includes("mediazione")) {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-muted text-muted-foreground";
}

export function statiVisibiliDefault(): readonly string[] {
  return SINISTRO_STATI_OPERATIVI;
}

export function excludeArchiviati<T extends { stato?: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !isArchiviato(r.stato));
}

export type StatoListaFiltro = { kind: "eq" | "neq"; value: string };

/**
 * Elenco/Ricerca: "tutti" = tutti tranne archiviato.
 * Tab Archiviati: solo archiviato.
 * Filtro esplicito (anche archiviato) = eq su quello stato.
 */
export function resolveStatoFiltroLista(opts: {
  tab?: string;
  stato?: string;
}): StatoListaFiltro {
  if (opts.tab === "archiviati") {
    return { kind: "eq", value: SINISTRO_STATO_ARCHIVIATO };
  }
  if (opts.stato && opts.stato !== "tutti") {
    return { kind: "eq", value: opts.stato };
  }
  return { kind: "neq", value: SINISTRO_STATO_ARCHIVIATO };
}

export function applyStatoFiltroLista<
  Q extends { eq: (column: string, value: string) => Q; neq: (column: string, value: string) => Q },
>(q: Q, opts: { tab?: string; stato?: string }): Q {
  const filtro = resolveStatoFiltroLista(opts);
  return filtro.kind === "eq" ? q.eq("stato", filtro.value) : q.neq("stato", filtro.value);
}

/** Portale cliente e report: mai gli archiviati. */
export function applyFiltroPortaleCliente<Q extends { neq: (column: string, value: string) => Q }>(
  q: Q,
): Q {
  return q.neq("stato", SINISTRO_STATO_ARCHIVIATO);
}

/** Pagine operative (prescrizioni/reminder/SIR): default nascosti, visibili solo con filtro esplicito. */
export function applyStatoFiltroOperativo<
  Q extends { in: (column: string, values: string[]) => Q; neq: (column: string, value: string) => Q },
>(q: Q, statiSelezionati: string[], column = "stato"): Q {
  if (statiSelezionati.length > 0) return q.in(column, statiSelezionati);
  return q.neq(column, SINISTRO_STATO_ARCHIVIATO);
}
