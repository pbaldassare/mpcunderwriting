/** Selettori UI italiani per la suite e2e canonica. */
export const SEL = {
  portafoglio: {
    caricoHeading: 'Carico del mese',
    incassiHeading: 'Incassi',
    totaleTitoli: 'Totale titoli',
    quietanze: 'Quietanze e appendici',
    inAttesaRinnovo: 'In attesa rinnovo',
    resetFiltri: /Reset Filtri/i,
  },
  contabilita: {
    incassiHeading: /Riepilogo Messe a Cassa/i,
    movBancariHeading: /Movimenti Bancari/i,
    ricongiungimentoHeading: /Bonifici \(legacy\)|Storico bonifici|Movimenti Bancari/i,
    anticipiHeading: /Riepilogo Acconti|Acconti|Anticipi/i,
    tabDaRicongiungere: /Da ricongiungere/i,
    tabDaCollegareLegacy: /Da collegare/i,
    tabRicongiunti: /Ricongiunti/i,
    tabStorico: /^Storico$/i,
    tabImportazione: /Importazioni/i,
    tabStoricoImportazioni: /Storico importazioni/i,
    tabMonitor: /Monitor Real-time/i,
    inserimentoManuale: /Inserimento manuale/i,
  },
  clienti: {
    searchPlaceholder: 'Cerca per nome, CF, P.IVA...',
    nuovoCliente: 'Nuovo Cliente',
  },
  sinistri: {
    nuovoSinistro: 'Nuovo Sinistro',
    searchPlaceholder: 'Cerca per numero, descrizione...',
  },
  documenti: {
    caricaDocumento: 'Carica Documento',
    libreriaCga: 'Libreria CGA',
    archivioDocumentale: /Archivio Documentale|documentale/i,
  },
} as const;
