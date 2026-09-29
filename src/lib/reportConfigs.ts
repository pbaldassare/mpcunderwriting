export interface ReportConfig {
  tipo: string;
  label: string;
  filtri: { key: string; label: string; type: "date" | "select" | "checkbox" }[];
  colonne: { key: string; label: string; align?: string; format?: string }[];
  rpcName: string;
}

export const REPORT_CONFIGS: ReportConfig[] = [
  {
    tipo: "titoli",
    label: "Titoli Incassati",
    rpcName: "report_titoli_incassati",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Sede", type: "select" },
      { key: "_compagnia_id", label: "Agenzia", type: "select" },
    ],
    colonne: [
      { key: "numero_titolo", label: "N. Titolo" },
      { key: "cliente", label: "Cliente" },
      { key: "prodotto", label: "Prodotto" },
      { key: "agenzia", label: "Agenzia" },
      { key: "ufficio", label: "Sede" },
      { key: "premio_lordo", label: "Premio Lordo", align: "right", format: "euro" },
      { key: "importo_incassato", label: "Incassato", align: "right", format: "euro" },
      { key: "data_incasso", label: "Data Incasso", format: "date" },
    ],
  },
  {
    tipo: "provvigioni",
    label: "Provvigioni per Produttore",
    rpcName: "report_provvigioni_produttore",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_user_id", label: "Produttore", type: "select" },
      { key: "_solo_non_pagate", label: "Solo non pagate", type: "checkbox" },
    ],
    colonne: [
      { key: "produttore", label: "Produttore" },
      { key: "numero_titolo", label: "Titolo" },
      { key: "prodotto", label: "Prodotto" },
      { key: "premio_lordo", label: "Premio", align: "right", format: "euro" },
      { key: "percentuale", label: "%", align: "right" },
      { key: "importo_provvigione", label: "Provvigione", align: "right", format: "euro" },
      { key: "pagata", label: "Pagata", format: "boolean" },
      { key: "calcolata_il", label: "Data", format: "date" },
    ],
  },
  {
    tipo: "contabilita",
    label: "Contabilità Entrate/Uscite",
    rpcName: "report_contabilita",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Sede", type: "select" },
      { key: "_categoria", label: "Categoria", type: "select" },
    ],
    colonne: [
      { key: "data_movimento", label: "Data", format: "date" },
      { key: "tipo", label: "Tipo" },
      { key: "categoria", label: "Categoria" },
      { key: "descrizione", label: "Descrizione" },
      { key: "importo", label: "Importo", align: "right", format: "euro" },
      { key: "ufficio", label: "Sede" },
      { key: "stato", label: "Stato" },
    ],
  },
  {
    tipo: "sinistri",
    label: "Sinistri",
    rpcName: "report_sinistri",
    filtri: [
      { key: "_data_da", label: "Data Da", type: "date" },
      { key: "_data_a", label: "Data A", type: "date" },
      { key: "_ufficio_id", label: "Sede", type: "select" },
      { key: "_stato", label: "Stato", type: "select" },
    ],
    colonne: [
      { key: "numero_sinistro", label: "N. Sinistro" },
      { key: "stato", label: "Stato" },
      { key: "cliente", label: "Cliente" },
      { key: "agenzia", label: "Agenzia" },
      { key: "responsabile", label: "Responsabile" },
      { key: "data_apertura", label: "Apertura", format: "date" },
      { key: "data_chiusura", label: "Chiusura", format: "date" },
      { key: "eventi_scaduti", label: "Ev. Scaduti", align: "right" },
      { key: "ufficio", label: "Sede" },
    ],
  },
  {
    tipo: "banca",
    label: "Banca KO Aperti",
    rpcName: "report_banca_ko",
    filtri: [{ key: "_ufficio_id", label: "Sede", type: "select" }],
    colonne: [
      { key: "created_at", label: "Data KO", format: "date" },
      { key: "desc_estratto", label: "Desc. Estratto" },
      { key: "importo_estratto", label: "Imp. Estratto", align: "right", format: "euro" },
      { key: "desc_movimento", label: "Desc. Movimento" },
      { key: "importo_movimento", label: "Imp. Movimento", align: "right", format: "euro" },
      { key: "differenza", label: "Differenza", align: "right", format: "euro" },
      { key: "giorni_apertura", label: "Giorni", align: "right", format: "int" },
      { key: "note", label: "Note" },
    ],
  },
];
