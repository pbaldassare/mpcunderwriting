export const BANDI_ESITI = ["non_partecipo", "voglio_partecipare", "in_trattativa"] as const;
export type BandoEsito = (typeof BANDI_ESITI)[number];

export const FILTRI_PIPELINE_BANDI = [
  { value: "nuovi", label: "Nuovi" },
  { value: "gia_visti", label: "Già visti" },
  { value: "voglio_partecipare", label: "Voglio partecipare" },
  { value: "non_partecipo", label: "Non partecipo" },
  { value: "in_trattativa", label: "In trattativa" },
  { value: "tutti", label: "Tutti" },
] as const;

/** Filtri sulla lista principale: «Voglio partecipare» vive in Bandi partecipati. */
export const FILTRI_PIPELINE_LISTA_PRINCIPALE = FILTRI_PIPELINE_BANDI.filter(
  (f) => f.value !== "voglio_partecipare",
);

export function isBandiPartecipatiPath(pathname: string): boolean {
  return pathname === "/bandi-pubblici/partecipati";
}

export type FiltroPipelineBando = (typeof FILTRI_PIPELINE_BANDI)[number]["value"];

export type BandoInteresseRow = {
  id: string;
  bando_id: string;
  esito: BandoEsito;
  motivo: string | null;
  snapshot_json: Record<string, unknown>;
  harvest_at: string | null;
  harvest_note: string | null;
  deciso_da: string | null;
  deciso_il: string;
  cantiere_stato?: string | null;
  cantiere_il?: string | null;
  storico_gara_id?: string | null;
};

export function isBandoEsito(value: string | null | undefined): value is BandoEsito {
  return !!value && (BANDI_ESITI as readonly string[]).includes(value);
}

export function labelEsitoBando(esito: string | null | undefined): string {
  switch (esito) {
    case "non_partecipo":
      return "Non partecipo";
    case "voglio_partecipare":
      return "Voglio partecipare";
    case "in_trattativa":
      return "In trattativa";
    default:
      return "Da valutare";
  }
}

/** Esito effettivo: trattativa già collegata vince se manca la riga interesse. */
export function effectiveEsitoBando(
  interesse: { esito?: string | null } | null | undefined,
  trattativeCount: number | null | undefined,
): BandoEsito | null {
  if (isBandoEsito(interesse?.esito)) return interesse.esito;
  if ((trattativeCount || 0) > 0) return "in_trattativa";
  return null;
}

export function matchesFiltroPipeline(
  esito: BandoEsito | null | undefined,
  filtro: FiltroPipelineBando,
): boolean {
  if (filtro === "tutti") return true;
  if (filtro === "nuovi" || filtro === "gia_visti") return !esito;
  return esito === filtro;
}

export function normalizeBandoInteresse(raw: unknown): BandoInteresseRow | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? (first as BandoInteresseRow) : null;
  }
  return typeof raw === "object" ? (raw as BandoInteresseRow) : null;
}

export function buildBandoSnapshot(bando: {
  id?: string;
  scheda_id?: string | null;
  titolo?: string | null;
  oggetto?: string | null;
  ente?: string | null;
  ente_tipo?: string | null;
  cig?: string | null;
  importo?: number | null;
  scadenza?: string | null;
  link?: string | null;
  fonte?: string | null;
  regione?: string | null;
  localita?: string | null;
  tipologia?: string | null;
  keyword?: string | null;
  pdf_url?: string | null;
  pdf_path?: string | null;
  stato?: string | null;
  tipo_avviso?: string | null;
  aggiudicato?: boolean | null;
  aggiudicatario?: string | null;
  data_decisione?: string | null;
  data_contratto?: string | null;
  servizio_da?: string | null;
  servizio_a?: string | null;
  tipo_procedura?: string | null;
  data_pubblicazione?: string | null;
}): Record<string, unknown> {
  return {
    id: bando.id ?? null,
    scheda_id: bando.scheda_id ?? null,
    titolo: bando.titolo ?? null,
    oggetto: bando.oggetto ?? null,
    ente: bando.ente ?? null,
    ente_tipo: bando.ente_tipo ?? null,
    cig: bando.cig ?? null,
    importo: bando.importo ?? null,
    scadenza: bando.scadenza ?? null,
    link: bando.link ?? null,
    fonte: bando.fonte ?? null,
    regione: bando.regione ?? null,
    localita: bando.localita ?? null,
    tipologia: bando.tipologia ?? null,
    keyword: bando.keyword ?? null,
    pdf_url: bando.pdf_url ?? null,
    pdf_path: bando.pdf_path ?? null,
    stato_gara: bando.stato ?? null,
    tipo_avviso: bando.tipo_avviso ?? null,
    aggiudicato: !!bando.aggiudicato,
    aggiudicatario: bando.aggiudicatario ?? null,
    data_decisione: bando.data_decisione ?? null,
    data_contratto: bando.data_contratto ?? null,
    servizio_da: bando.servizio_da ?? null,
    servizio_a: bando.servizio_a ?? null,
    tipo_procedura: bando.tipo_procedura ?? null,
    data_pubblicazione: bando.data_pubblicazione ?? null,
    salvato_il: new Date().toISOString(),
  };
}
