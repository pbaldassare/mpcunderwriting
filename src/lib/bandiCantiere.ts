import type { BandoEsito } from "@/lib/bandiInteresse";

export const CANTIERE_STATI = [
  "da_approfondire",
  "in_monitoraggio",
  "pronto_trattativa",
  "in_trattativa",
  "archiviato_storico",
  "abbandonato",
] as const;

export type CantiereStato = (typeof CANTIERE_STATI)[number];

export const FILTRI_CANTIERE = [
  { value: "da_approfondire", label: "Da approfondire" },
  { value: "in_monitoraggio", label: "In monitoraggio" },
  { value: "pronto_trattativa", label: "Pronto trattativa" },
  { value: "in_trattativa", label: "In trattativa" },
  { value: "archiviato_storico", label: "In storico" },
  { value: "tutti", label: "Tutti" },
] as const;

export type FiltroCantiere = (typeof FILTRI_CANTIERE)[number]["value"];

export const CANTIERE_AZIONI: Array<{ value: CantiereStato; label: string }> = [
  { value: "da_approfondire", label: "Da approfondire" },
  { value: "in_monitoraggio", label: "In monitoraggio" },
  { value: "pronto_trattativa", label: "Pronto per trattativa" },
];

export type StoricoGaraMatch = {
  id: string;
  ente_nome: string;
  anno_riferimento: number | null;
  esito: string | null;
  broker_incumbent: string | null;
  data_fine_mandato: string | null;
  bando_id?: string | null;
};

export function isCantiereStato(value: string | null | undefined): value is CantiereStato {
  return !!value && (CANTIERE_STATI as readonly string[]).includes(value);
}

export function labelCantiereStato(stato: string | null | undefined): string {
  switch (stato) {
    case "in_monitoraggio":
      return "In monitoraggio";
    case "pronto_trattativa":
      return "Pronto trattativa";
    case "in_trattativa":
      return "In trattativa";
    case "archiviato_storico":
      return "In storico";
    case "abbandonato":
      return "Abbandonato";
    default:
      return "Da approfondire";
  }
}

export function isBandoInCantiere(
  esito: BandoEsito | null | undefined,
  cantiere: string | null | undefined,
  trattativeCount?: number | null,
): boolean {
  if (cantiere === "archiviato_storico") return true;
  if ((trattativeCount || 0) > 0) return true;
  return esito === "voglio_partecipare" || esito === "in_trattativa";
}

export function effectiveCantiereStato(opts: {
  esito?: BandoEsito | null;
  cantiere?: string | null;
  storicoGaraId?: string | null;
  trattativeCount?: number | null;
}): CantiereStato | null {
  if (opts.storicoGaraId || opts.cantiere === "archiviato_storico") return "archiviato_storico";
  if (isCantiereStato(opts.cantiere) && opts.cantiere !== "in_trattativa") return opts.cantiere;
  if (opts.esito === "in_trattativa" || (opts.trattativeCount || 0) > 0) return "in_trattativa";
  if (opts.cantiere === "in_trattativa") return "in_trattativa";
  if (opts.esito === "voglio_partecipare") return "da_approfondire";
  return null;
}

export function matchesFiltroCantiere(
  cantiere: CantiereStato | null | undefined,
  filtro: FiltroCantiere,
): boolean {
  if (filtro === "tutti") return true;
  return cantiere === filtro;
}

export function normalizeEnteNome(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function enteSearchToken(ente: string | null | undefined): string {
  const norm = normalizeEnteNome(ente)
    .replace(/^(COMUNE DI|COMUNE|PROVINCIA DI|PROVINCIA|CITTA METROPOLITANA DI|REGIONE)\s+/i, "")
    .trim();
  const parts = norm.split(" ").filter((p) => p.length > 2);
  return parts[parts.length - 1] || norm;
}

export function entiCompatibili(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEnteNome(a);
  const right = normalizeEnteNome(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const token = enteSearchToken(left);
  return token.length >= 4 && (right.includes(token) || left.includes(normalizeEnteNome(enteSearchToken(right))));
}

export function matchStoricoPerEnte(
  ente: string | null | undefined,
  rows: StoricoGaraMatch[],
  limit = 3,
): StoricoGaraMatch[] {
  return rows.filter((row) => entiCompatibili(ente, row.ente_nome)).slice(0, limit);
}

export function annoDaBando(bando: {
  data_pubblicazione?: string | null;
  scadenza?: string | null;
  servizio_da?: string | null;
  garanzia_da?: string | null;
}): number {
  const raw = bando.data_pubblicazione || bando.scadenza || bando.servizio_da || bando.garanzia_da;
  const year = raw ? Number(String(raw).slice(0, 4)) : NaN;
  if (year >= 1990 && year <= 2100) return year;
  return new Date().getFullYear();
}

export function esitoStoricoDaBando(bando: {
  aggiudicato?: boolean | null;
  tipo_avviso?: string | null;
  stato?: string | null;
}): "in_corso" | "non_classificato" {
  if (bando.aggiudicato || bando.tipo_avviso === "esito") return "non_classificato";
  return "in_corso";
}

export function buildStoricoGaraFromBando(
  bando: {
    id?: string;
    ente?: string | null;
    titolo?: string | null;
    oggetto?: string | null;
    cig?: string | null;
    link?: string | null;
    regione?: string | null;
    localita?: string | null;
    servizio_da?: string | null;
    servizio_a?: string | null;
    data_pubblicazione?: string | null;
    scadenza?: string | null;
    aggiudicato?: boolean | null;
    tipo_avviso?: string | null;
    stato?: string | null;
    aggiudicatario?: string | null;
    trattativa_id?: string | null;
  },
  createdBy?: string | null,
): Record<string, unknown> {
  const ente = normalizeEnteNome(bando.ente) || "ENTE SCONOSCIUTO";
  const note = [
    bando.titolo || bando.oggetto || null,
    bando.cig ? `CIG: ${bando.cig}` : null,
    bando.link ? `Link: ${bando.link}` : null,
    bando.aggiudicatario ? `Aggiudicatario: ${bando.aggiudicatario}` : null,
    bando.regione || bando.localita
      ? `Luogo: ${[bando.localita, bando.regione].filter(Boolean).join(", ")}`
      : null,
    "Origine: Bandi partecipati CBnet",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    anno_riferimento: annoDaBando(bando),
    ente_nome: ente,
    tipologia: "gara",
    esito: esitoStoricoDaBando(bando),
    data_inizio_mandato: bando.servizio_da || null,
    data_fine_mandato: bando.servizio_a || null,
    data_consegna: bando.scadenza || bando.data_pubblicazione || null,
    note,
    bando_id: bando.id || null,
    trattativa_id: bando.trattativa_id || null,
    source_file: "cbnet-bandi-partecipati",
    created_by: createdBy || null,
  };
}
