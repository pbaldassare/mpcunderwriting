export type GuidaArea = "portafoglio" | "contabilita" | "sinistri" | "provvigioni" | "altro";

export interface GuidaProcesso {
  id: string;
  titolo: string;
  area: GuidaArea;
  tags: string[];
  intro?: string;
  cosaFai: string[];
  cosaSuccede: string[];
  casiParticolari?: string[];
  riepilogo?: { situazione: string; risultato: string }[];
}

export const GUIDA_AREE: { id: GuidaArea; label: string }[] = [
  { id: "portafoglio", label: "Portafoglio e polizze" },
  { id: "contabilita", label: "Contabilità e incassi" },
  { id: "provvigioni", label: "Provvigioni" },
  { id: "sinistri", label: "Sinistri" },
  { id: "altro", label: "Altro" },
];

export const GUIDA_PROCESSI: GuidaProcesso[] = [
  {
    id: "polizza-quietanza",
    titolo: "Polizza madre e quietanza",
    area: "portafoglio",
    tags: ["polizza", "quietanza", "rata", "carico", "emissione"],
    intro: "Nel sistema la polizza e l'incasso sono due cose separate.",
    cosaFai: [
      "Emetti o consulti una polizza: quella è la polizza madre, il contratto.",
      "Per incassare non tocchi la madre: lavori sulle quietanze (rate) collegate.",
    ],
    cosaSuccede: [
      "All'emissione della polizza il sistema crea automaticamente le quietanze previste (es. annuale = 1 rata, trimestrale = 4 rate, mensile = 12 rate).",
      "La polizza madre resta attiva come contratto: non va messa a cassa.",
      "Le quietanze compaiono in Incassi finché non sono incassate.",
      "Polizze poliennali particolari possono avere solo la madre, senza rate automatiche.",
    ],
    casiParticolari: [
      "Ogni rata ha importi e date modificabili in autonomia.",
      "In Incassi vedi solo ciò che devi ancora incassare.",
    ],
  },
  {
    id: "messa-a-cassa",
    titolo: "Metti a cassa (incasso)",
    area: "portafoglio",
    tags: ["messa a cassa", "incasso", "carico", "contanti", "bonifico"],
    intro: "Registra che il premio (o parte del premio) è stato pagato dal cliente.",
    cosaFai: [
      "Vai in Incassi o apri il dettaglio della quietanza.",
      "Clicca Metti a cassa.",
      "Indichi come è stato pagato, l'importo, la data e — se serve — acconti o rettifiche.",
      "Confermi solo se il totale torna (quadratura).",
    ],
    cosaSuccede: [
      "La quietanza viene segnata come incassata se l'importo copre tutto il premio.",
      "Esce da Incassi e compare nello storico.",
      "Si calcolano le provvigioni sull'incasso.",
      "Parte l'email automatica di copertura all'agenzia/compagnia (se l'incasso è completo).",
      "Se la polizza è frazionata, può essere preparata la rata successiva da incassare più avanti.",
      "Se c'era un rinnovo in attesa, può essere attivato.",
      "La polizza madre non cambia stato di incasso: resta il contratto.",
    ],
    casiParticolari: [
      "Polizza sospesa: non puoi incassare finché non viene tolta la sospensione.",
      "Incasso parziale: resta in Incassi con l'importo già registrato.",
      "Se l'email all'agenzia non parte per un errore tecnico, l'incasso resta valido — puoi reinviarla dal dettaglio titolo.",
    ],
  },
  {
    id: "messa-a-cassa-bonifico",
    titolo: "Metti a cassa con bonifico",
    area: "portafoglio",
    tags: ["bonifico", "banca", "conto", "messa a cassa"],
    cosaFai: [
      "Selezioni la quietanza in Incassi.",
      "Apri Metti a cassa.",
      "Scegli Bonifico come tipo di pagamento.",
      "Indichi su quale conto bancario è arrivato il bonifico.",
      "Inserisci data e importo (deve quadrare con il premio, eventualmente con acconti o compensazioni).",
      "Confermi.",
    ],
    cosaSuccede: [
      "La quietanza risulta incassata con pagamento bonifico e banca registrata.",
      "Esce da Incassi se l'importo copre tutto.",
      "Si calcolano le provvigioni.",
      "Viene inviata l'email di copertura all'agenzia.",
      "Eventuale rata successiva o rinnovo come per ogni incasso completo.",
    ],
    casiParticolari: [
      "Senza conto bancario selezionato il sistema non fa proseguire.",
      "Bonifico parziale: la quietanza resta in Incassi; niente email agenzia finché non chiudi il saldo.",
      "Se sulla quietanza compare il badge Bonifico, puoi aprire direttamente la messa a cassa con il movimento già proposto (match su ordinante ↔ cliente, non sull'importo).",
    ],
    riepilogo: [
      { situazione: "Bonifico che copre tutto", risultato: "Quietanza incassata, esce dal carico, email agenzia" },
      { situazione: "Bonifico parziale", risultato: "Resta in carico con importo già incassato" },
      { situazione: "Bonifico + acconto cliente", risultato: "Premio coperto, acconto scalato dal saldo cliente" },
    ],
  },
  {
    id: "messa-a-cassa-contanti",
    titolo: "Metti a cassa con contanti o assegno",
    area: "portafoglio",
    tags: ["contanti", "assegno", "cassa"],
    cosaFai: [
      "Come per il bonifico, ma scegli Contanti o Assegno.",
      "Indichi importo e data; verifica che il totale quadri.",
    ],
    cosaSuccede: [
      "Stesso effetto dell'incasso completo: quietanza chiusa, provvigioni, email agenzia, uscita da Incassi.",
      "Non serve selezionare un conto bancario.",
    ],
  },
  {
    id: "incasso-parziale",
    titolo: "Incasso parziale",
    area: "portafoglio",
    tags: ["parziale", "saldo", "carico", "bonifico"],
    cosaFai: [
      "Registri un importo inferiore al premio dovuto (tipico con bonifici spezzati o pagamenti rateali informali).",
    ],
    cosaSuccede: [
      "Il sistema salva quanto hai già incassato sulla quietanza.",
      "La quietanza resta visibile in Incassi finché non copri l'intero premio.",
      "Non invia l'email all'agenzia e non considera l'incasso chiuso.",
      "Al secondo incasso somma gli importi: quando il totale copre il premio, chiude come incasso normale.",
    ],
  },
  {
    id: "acconto-cliente",
    titolo: "Acconto cliente",
    area: "contabilita",
    tags: ["acconto", "anticipo", "credito", "cliente"],
    intro: "Credito del cliente da usare su future quietanze.",
    cosaFai: [
      "Creazione manuale: da Riepilogo Acconti o dalla scheda cliente.",
      "Utilizzo: in Metti a cassa selezioni gli acconti disponibili del cliente.",
    ],
    cosaSuccede: [
      "Alla creazione: resta un saldo a favore del cliente.",
      "In messa a cassa: l'acconto scala dal saldo e copre parte (o tutto) il premio.",
      "Se bonifico + acconto insieme coprono il premio, l'incasso si chiude normalmente.",
      "Acconto da eccedenza bonifico: se un bonifico è più alto del dovuto, il resto diventa acconto sul cliente collegato.",
    ],
    casiParticolari: [
      "Puoi cancellare un acconto solo se non è ancora stato utilizzato.",
    ],
  },
  {
    id: "compensazioni",
    titolo: "Compensazioni in messa a cassa",
    area: "contabilita",
    tags: ["compensazione", "sconto", "abbuono", "quadratura"],
    cosaFai: [
      "In Metti a cassa aggiungi una causale di compensazione (sconto, abbuono, arrotondamento).",
      "Indichi importo e segno (+/−) finché il totale quadra.",
    ],
    cosaSuccede: [
      "La rettifica resta legata alla quietanza incassata.",
      "Viene registrata anche a livello contabile per tracciabilità.",
    ],
  },
  {
    id: "caricamento-mov-bancari",
    titolo: "Caricamento movimenti bancari",
    area: "contabilita",
    tags: ["import", "excel", "pdf", "bonifico", "banca"],
    cosaFai: [
      "Importi l'estratto conto (PDF, CSV o Excel) in Caricamento mov. bancari.",
      "Selezioni obbligatoriamente il conto bancario di riferimento.",
      "Opzionalmente indichi già il cliente; altrimenti lo assegni dopo.",
    ],
    cosaSuccede: [
      "I bonifici entrano in coda come movimenti da lavorare.",
      "Il sistema può suggerire il cliente (match automatico); puoi correggere a mano.",
      "I movimenti restano aperti finché non li colleghi da Incassi → Bonifici aperti.",
    ],
  },
  {
    id: "ricongiungimento-bancario",
    titolo: "Bonifici da Incassi",
    area: "portafoglio",
    tags: ["ricongiungimento", "bonifico", "match", "incasso", "ordinante"],
    intro: "Collega un bonifico importato alle quietanze da Incassi. Il match usa ordinante/cliente, non l'importo.",
    cosaFai: [
      "Apri Incassi (eventualmente con tab Bonifici aperti).",
      "Se sulla quietanza c'è un badge Bonifico, cliccalo: con un solo match si apre subito la messa a cassa; con più match scegli il movimento.",
      "Oppure apri Metti a cassa → Bonifico e seleziona conto + movimento dall'elenco ordinato per nome.",
      "Confermi l'incasso: il bonifico viene collegato e chiuso.",
    ],
    cosaSuccede: [
      "Le quietanze selezionate vengono incassate.",
      "Il movimento bancario risulta chiuso/incassato.",
      "Eccedenza → acconto sul cliente pagatore.",
      "Stessi effetti dell'incasso normale: provvigioni, email agenzia se incasso completo, uscita da Incassi.",
    ],
    casiParticolari: [
      "Lo storico dei bonifici già collegati resta in Contabilità → Storico bonifici (?tab=storico).",
      "La vecchia pagina «Da collegare» non è più il flusso primario.",
    ],
    riepilogo: [
      { situazione: "Un match nome", risultato: "Un click sul badge → messa a cassa con bonifico proposto" },
      { situazione: "Più match nome", risultato: "Scegli il bonifico dal popover, poi incassa" },
      { situazione: "Bonifico > premio", risultato: "Quietanze incassate + acconto residuo cliente" },
      { situazione: "Nessun match", risultato: "Scegli manualmente conto e movimento in Metti a cassa" },
    ],
  },
  {
    id: "rimesse-agenzie",
    titolo: "Rimesse alle agenzie",
    area: "contabilita",
    tags: ["rimessa", "agenzia", "compagnia", "pagamento", "sepa"],
    cosaFai: [
      "Da E/C Agenzie selezioni i titoli incassati da rimettere alla compagnia.",
      "Prepari la rimessa, eventualmente generi il file SEPA e confermi il pagamento.",
    ],
    cosaSuccede: [
      "I premi incassati vengono raggruppati per compagnia/periodo.",
      "La rimessa passa negli stati di lavorazione fino al pagamento effettivo.",
      "Lo storico resta consultabile in Storico Rimesse.",
    ],
  },
  {
    id: "ec-clienti",
    titolo: "Estratto conto clienti",
    area: "contabilita",
    tags: ["ec", "cliente", "estratto", "saldo"],
    cosaFai: [
      "Selezioni cliente e periodo in E/C Clienti.",
      "Generi o consulti l'estratto.",
    ],
    cosaSuccede: [
      "Vedi incassi, residui e movimenti del cliente nel periodo.",
      "Lo storico delle estrazioni precedenti è in Storico E/C Clienti.",
    ],
  },
  {
    id: "ec-agenzie",
    titolo: "Estratto conto agenzie",
    area: "contabilita",
    tags: ["ec", "agenzia", "compagnia", "premi"],
    cosaFai: [
      "In E/C Agenzie filtri per compagnia e periodo.",
      "Selezioni i titoli e prepari rimessa o comunicazione.",
    ],
    cosaSuccede: [
      "Elenco premi da rimettere o già gestiti.",
      "Da qui si collega al flusso rimesse e agenzie in pagamento.",
    ],
  },
  {
    id: "ec-produttori",
    titolo: "Estratto conto produttori",
    area: "provvigioni",
    tags: ["ec", "produttore", "provvigione", "pagamento"],
    cosaFai: [
      "In E/C Produttori selezioni produttore e periodo.",
      "Segni come pagato quando effettui il bonifico al produttore.",
    ],
    cosaSuccede: [
      "Mostra provvigioni maturate nel periodo.",
      "Puoi generare distinta PDF per il pagamento.",
      "Lo storico è in Storico E/C Produttori.",
    ],
  },
  {
    id: "provvigioni",
    titolo: "Provvigioni maturate",
    area: "provvigioni",
    tags: ["provvigione", "produttore", "commerciale", "incasso"],
    cosaFai: [
      "Consulti Provvigioni Maturate per vedere cosa è dovuto.",
      "Non devi calcolarle a mano: si generano all'incasso della quietanza.",
    ],
    cosaSuccede: [
      "Ogni incasso completo ricalcola le provvigioni del titolo.",
      "Le quote vanno a produttore, commerciale, account executive secondo le regole configurate.",
      "Se il produttore trattiene la provvigione sul bonifico, può risultare già pagata.",
    ],
  },
  {
    id: "annulla-incasso",
    titolo: "Annullamento incasso",
    area: "portafoglio",
    tags: ["annulla", "storno", "admin"],
    cosaFai: [
      "Solo amministratori, dal dettaglio titolo già incassato.",
      "Confermi con password.",
    ],
    cosaSuccede: [
      "La quietanza torna da incassare (esce dallo stato incassato).",
      "Si annullano gli effetti collegati (acconti usati, ecc.) dove previsto.",
      "La polizza madre non viene cancellata.",
    ],
    casiParticolari: [
      "Operazione sensibile: usare solo per errori di registrazione.",
    ],
  },
  {
    id: "sospensione",
    titolo: "Sospensione polizza",
    area: "portafoglio",
    tags: ["sospensione", "appendice", "blocco"],
    cosaFai: [
      "Apri Sospensione dalla scheda polizza: a sinistra data, oneri e allegato; a destra modifichi date, garanzie e premi nell'editor inline.",
      "L'anteprima mostra le quietanze che verranno congelate alla data scelta.",
    ],
    cosaSuccede: [
      "La polizza madre risulta sospesa.",
      "Le quietanze future e quella in corso passano a stato sospeso e non sono incassabili fino alla riattivazione.",
      "Viene creato un titolo oneri di sospensione (anche a €0) visibile in Incassi.",
    ],
  },
  {
    id: "sostituzione",
    titolo: "Sostituzione polizza",
    area: "portafoglio",
    tags: ["sostituzione", "veicolo", "conguaglio"],
    cosaFai: [
      "Registri la sostituzione dell'oggetto assicurato (veicolo RCA o bene generico) dall'editor inline a destra.",
      "Il conguaglio si propone automaticamente dalla differenza di premio lordo; puoi forzarlo con modifica manuale.",
    ],
    cosaSuccede: [
      "Viene salvato lo storico parametri precedenti/nuovi e creato un titolo di conguaglio (anche a €0).",
      "Le quietanze già emesse restano invariate.",
    ],
  },
  {
    id: "riattivazione",
    titolo: "Riattivazione polizza",
    area: "portafoglio",
    tags: ["riattivazione", "sospensione", "quietanze"],
    cosaFai: [
      "Dopo una sospensione, riattivi la polizza indicando data e eventuali oneri.",
      "Nell'editor puoi aggiornare date e premi prima della conferma.",
    ],
    cosaSuccede: [
      "Le quietanze congelate vengono ripristinate con shift delle date pari ai giorni di sospensione.",
      "Viene creato un titolo oneri di riattivazione (anche a €0).",
    ],
  },
  {
    id: "proroga",
    titolo: "Proroga polizza",
    area: "portafoglio",
    tags: ["proroga", "appendice", "scadenza"],
    cosaFai: [
      "Crei una proroga (appendice) con le nuove date.",
      "Incassi la quietanza della proroga.",
    ],
    cosaSuccede: [
      "All'incasso della proroga le date di garanzia della polizza vengono estese.",
    ],
  },
  {
    id: "apertura-sinistro",
    titolo: "Apertura sinistro",
    area: "sinistri",
    tags: ["sinistro", "denuncia", "wizard"],
    cosaFai: [
      "Da Sinistri → Apertura segui il wizard.",
      "Cerchi la polizza, inserisci dati sinistro, allegati e assegnazioni.",
    ],
    cosaSuccede: [
      "Si crea la scheda sinistro collegata a cliente e polizza.",
      "Parte la checklist operativa e la timeline eventi.",
      "La data di prescrizione viene calcolata automaticamente.",
    ],
  },
  {
    id: "immissione-polizza",
    titolo: "Immissione nuova polizza",
    area: "portafoglio",
    tags: ["emissione", "nuova", "polizza", "ai"],
    cosaFai: [
      "Da Portafoglio → Immissione (o Gestione polizze) compili i dati contratto.",
      "Puoi usare l'import AI da PDF polizza.",
    ],
    cosaSuccede: [
      "Si crea la polizza madre.",
      "Il sistema genera le quietanze (rate) previste dal frazionamento.",
      "La prima rata compare in Incassi pronta per l'incasso.",
    ],
  },
  {
    id: "cruscotto-incassi",
    titolo: "Riepilogo messe a cassa",
    area: "contabilita",
    tags: ["cruscotto", "giornaliero", "incassi"],
    cosaFai: [
      "Consulti Contabilità operativa → Riepilogo Messe a Cassa per la sede e il mese.",
    ],
    cosaSuccede: [
      "Vista riepilogativa degli incassi del giorno / periodo.",
      "Utile per quadratura di cassa e controllo coperture inviate.",
    ],
  },
];

export function searchGuidaProcessi(query: string): GuidaProcesso[] {
  const q = query.trim().toLowerCase();
  if (!q) return GUIDA_PROCESSI;
  return GUIDA_PROCESSI.filter((p) => {
    const hay = [
      p.titolo,
      p.intro ?? "",
      ...p.tags,
      ...p.cosaFai,
      ...p.cosaSuccede,
      ...(p.casiParticolari ?? []),
      ...(p.riepilogo?.map((r) => `${r.situazione} ${r.risultato}`) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
