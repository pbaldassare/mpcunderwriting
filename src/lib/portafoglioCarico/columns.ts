/** Colonne export Carico / Incassi (allineate alla tabella UI). */
export const CARICO_EXPORT_COLUMNS = [
  { key: "polizza", header: "N° Polizza" },
  { key: "tipo", header: "Tipo" },
  { key: "cliente", header: "Cliente" },
  { key: "agenzia", header: "Agenzia" },
  { key: "sede", header: "Sede" },
  { key: "garanzia", header: "Garanzia" },
  { key: "inizioPolizza", header: "Inizio Polizza" },
  { key: "finePolizza", header: "Fine Polizza" },
  { key: "inizioGaranzia", header: "Inizio Garanzia" },
  { key: "fineGaranzia", header: "Fine Garanzia" },
  { key: "targa", header: "Targa" },
  { key: "frazionamento", header: "Fraz." },
  { key: "premio", header: "Premio (€)" },
  { key: "provvigione", header: "Provvigioni totali (€)" },
  { key: "provvigioneProduttore", header: "Provvigioni produttore (€)" },
  { key: "ae", header: "AE" },
  { key: "produttore", header: "Produttore" },
  { key: "stato", header: "Stato" },
  { key: "copertura", header: "Copertura" },
  { key: "messaACassa", header: "Messa a Cassa" },
] as const;

export type CaricoExportRow = Record<(typeof CARICO_EXPORT_COLUMNS)[number]["key"], string | number | null>;

export interface CaricoExportMeta {
  vista: "pendenti" | "incassati";
  scope: "selezione" | "pagina";
  filtri: Record<string, string>;
  nRighe: number;
  totalePremio: number;
  totaleProvvigioni: number;
  totaleFiltrate?: number;
}
