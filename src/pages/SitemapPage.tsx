import { useState } from "react";
import {
  Shield, Users, Building2, Calculator, Briefcase, Headphones, UserCircle,
  ChevronDown, ChevronRight, LayoutDashboard, FileText, AlertTriangle,
  BarChart3, Settings, Send, FolderOpen, Landmark, Bell, Package,
  ClipboardList, Clock, Lock, Map, Car
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/* ─── RUOLI ─── */
const ruoli = [
  {
    nome: "Admin",
    livello: 1,
    icon: Shield,
    color: "border-red-500 bg-red-50 dark:bg-red-950/30",
    badgeColor: "bg-red-500 text-white",
    descrizione: "Accesso totale al sistema. Gestisce utenti, sedi, agenzie, tabelle base, backup, manutenzione, template e impostazioni. Tutti i permessi sono implicitamente attivi.",
    mansioni: [
      "Creazione e gestione utenti interni",
      "Configurazione sedi e agenzie",
      "Gestione tabelle di base e parametri",
      "Backup, export dati e manutenzione",
      "Template email e comunicazioni",
      "Visibilità totale su tutti i dati di tutte le sedi",
      "Accesso a tutte le aree senza restrizioni",
    ],
  },
  {
    nome: "CFO",
    livello: 2,
    icon: BarChart3,
    color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    badgeColor: "bg-amber-500 text-white",
    descrizione: "Area finanziaria e contabilità generale. Supervisione economico-finanziaria dell'agenzia.",
    mansioni: [
      "Piano dei conti e primanota generale",
      "Scadenziario e gestione fornitori",
      "Elaborazioni periodiche e annuali",
      "Dichiarativi e certificazioni CU",
      "Import bancario e riconciliazione",
      "Anomalie sistema",
      "Report e analisi finanziarie",
    ],
  },
  {
    nome: "Ufficio",
    livello: 2,
    icon: Building2,
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    badgeColor: "bg-blue-500 text-white",
    descrizione: "Gestione operativa della sede assegnata. Visibilità completa su clienti, portafoglio, sinistri e contabilità della propria sede.",
    mansioni: [
      "Gestione completa clienti e prospect",
      "Portafoglio polizze (immissione, rinnovi, storni, appendici)",
      "Gestione sinistri",
      "Contabilità di ufficio e distinta giornaliera",
      "Impostazioni sede e template email",
      "Comunicazioni e spedizioni",
      "Trattative e preventivi",
    ],
  },
  {
    nome: "Contabilità",
    livello: 3,
    icon: Calculator,
    color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    badgeColor: "bg-green-500 text-white",
    descrizione: "Operatività contabile dell'ufficio. Gestione incassi, quadrature e rendicontazione.",
    mansioni: [
      "Distinta giornaliera e cruscotto",
      "Quadratura premi e chiusura contabile",
      "E/C clienti, agenzie e produttori",
      "Contabilità ufficio completa",
      
    ],
  },
  {
    nome: "Produttore",
    livello: 3,
    icon: Briefcase,
    color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30",
    badgeColor: "bg-purple-500 text-white",
    descrizione: "Visibilità limitata alla propria produzione. Accede solo ai dati relativi ai clienti e polizze a lui assegnati.",
    mansioni: [
      "Dashboard con KPI personali",
      "Prospect e trattative proprie",
      "Portafoglio polizze assegnate",
      "Provvigioni personali",
      "Comunicazioni relative ai propri clienti",
    ],
  },
  {
    nome: "Specialist",
    livello: 3,
    icon: Headphones,
    color: "border-teal-500 bg-teal-50 dark:bg-teal-950/30",
    badgeColor: "bg-teal-500 text-white",
    descrizione: "Supporto operativo quotidiano. Opera come Specialist sui clienti assegnati alla sede.",
    mansioni: [
      "Gestione clienti e anagrafiche",
      "Lavorazione polizze e sinistri",
      "Comunicazioni e spedizioni",
      "Caricamento documenti",
      "Supporto alla rete commerciale",
    ],
  },
  {
    nome: "Produttore",
    livello: 3,
    icon: Briefcase,
    color: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
    badgeColor: "bg-indigo-500 text-white",
    descrizione: "Produttore esterno con accesso equivalente al produttore interno. Visibilità limitata alla propria produzione.",
    mansioni: [
      "Dashboard con KPI personali",
      "Prospect e trattative proprie",
      "Portafoglio polizze assegnate",
      "Provvigioni personali",
      "Comunicazioni relative ai propri clienti",
    ],
  },
  {
    nome: "Cliente",
    livello: 4,
    icon: UserCircle,
    color: "border-gray-400 bg-gray-50 dark:bg-gray-900/30",
    badgeColor: "bg-gray-500 text-white",
    descrizione: "Portale dedicato separato dal gestionale interno. Accesso limitato ai propri dati personali.",
    mansioni: [
      "Visualizzazione polizze attive e scadute",
      "Documenti personali e contrattuali",
      "Scadenze e pagamenti",
      "Apertura e monitoraggio sinistri",
      "Upload documenti per la propria pratica",
      "Comunicazioni con l'agenzia",
    ],
  },
  {
    nome: "Prospect",
    livello: 4,
    icon: ClipboardList,
    color: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
    badgeColor: "bg-orange-500 text-white",
    descrizione: "Utente non ancora cliente, con accesso al portale dedicato per seguire le proprie trattative.",
    mansioni: [
      "Visualizzazione trattative in corso",
      "Download documenti relativi alle trattative",
      "Upload documenti richiesti dall'agenzia",
      "Monitoraggio stato delle proposte",
    ],
  },
];

/* ─── SEZIONI ─── */
const sezioni = [
  {
    area: "Home",
    icon: LayoutDashboard,
    pagine: [
      { nome: "Dashboard", desc: "Pannello principale con KPI, grafici e feed attività in tempo reale, profilato per ruolo", ruoli: ["admin", "cfo", "ufficio", "contabilita", "produttore", "backoffice", "corrispondente"] },
    ],
  },
  {
    area: "Anagrafiche Utenti",
    icon: Users,
    pagine: [
      { nome: "Gestione Utenti", desc: "Anagrafica utenti interni con ruoli e assegnazioni", ruoli: ["admin", "ufficio"] },
      { nome: "Anagrafiche Professionali", desc: "Gestione periti, medici, legali, carrozzerie e altri professionisti collegati", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Crea Utente", desc: "Creazione nuovo utente con assegnazione ruolo e sede", ruoli: ["admin"] },
      { nome: "Utenti di Rete", desc: "Lista utenti con modifica ruoli, permessi e stato attivazione", ruoli: ["admin"] },
      { nome: "Gestione Sedi", desc: "Configurazione sedi operative dell'agenzia", ruoli: ["admin"] },
    ],
  },
  {
    area: "Archivi",
    icon: FolderOpen,
    pagine: [
      { nome: "Clienti", desc: "Lista unificata di tutti i clienti (privati, aziende, enti) con ricerca avanzata multi-campo", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
      { nome: "Dettaglio Cliente", desc: "Scheda completa del cliente con dati anagrafici, polizze, sinistri, documenti e timeline", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
    ],
  },
  {
    area: "Trattative",
    icon: ClipboardList,
    pagine: [
      { nome: "Trattative", desc: "Pipeline commerciale unificata con filtri, viste (in corso, chiuse, archiviate) e collegamento bandi", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
    ],
  },
  {
    area: "Bandi Pubblici",
    icon: Landmark,
    pagine: [
      { nome: "Bandi Pubblici", desc: "Ricerca gare aperte su TED e Mondo Appalti, con decisione Non partecipo / Voglio partecipare", ruoli: ["admin", "cfo", "ufficio", "backoffice", "produttore", "executive"] },
      { nome: "Bandi partecipati", desc: "Bandi su cui si è deciso di partecipare, con dati portale e creazione trattativa", ruoli: ["admin", "cfo", "ufficio", "backoffice", "produttore", "executive"] },
      { nome: "Storico Gare", desc: "Archivio gare pubbliche e storico partecipazioni", ruoli: ["admin", "cfo", "ufficio", "backoffice", "produttore", "executive"] },
    ],
  },
  {
    area: "Portafoglio",
    icon: FileText,
    pagine: [
      { nome: "Lista Portafoglio", desc: "Vista complessiva di tutte le polizze attive, scadute e in lavorazione", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
      { nome: "Dettaglio Portafoglio", desc: "Scheda polizza con garanzie, premi, movimenti e documenti allegati", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
      { nome: "Gestione Polizze", desc: "Operazioni massive su polizze (filtri avanzati, azioni batch)", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Immissione Polizza", desc: "Inserimento nuova polizza con wizard guidato", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Rinnovi", desc: "Gestione rinnovi in scadenza con conferma o modifica condizioni", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Storno Polizza", desc: "Annullamento polizza con calcolo rateo e generazione documentazione", ruoli: ["admin", "ufficio"] },
      { nome: "Sospensione Polizza", desc: "Sospensione temporanea copertura con date e motivazione", ruoli: ["admin", "ufficio"] },
      { nome: "Riattivazione Polizza", desc: "Ripristino polizza precedentemente sospesa", ruoli: ["admin", "ufficio"] },
      { nome: "Appendici Polizza", desc: "Modifica condizioni polizza in corso (variazioni, integrazioni)", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Duplicazione Polizza", desc: "Copia polizza esistente come base per nuova emissione", ruoli: ["admin", "ufficio"] },
      { nome: "Conferma Emittende", desc: "Conferma emissione polizze in attesa di validazione", ruoli: ["admin", "ufficio"] },
      { nome: "Titoli", desc: "Gestione titoli di incasso (quietanze, ricevute) collegati alle polizze", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Incassi", desc: "Quietanze da mettere a cassa, KPI e bonifici aperti collegabili per ordinante", ruoli: ["admin", "ufficio", "contabilita", "backoffice"] },
      { nome: "Bonifici (in Incassi)", desc: "Pannello bonifici aperti su Incassi; match ordinante ↔ cliente, non importo", ruoli: ["admin", "cfo", "ufficio", "contabilita"] },
    ],
  },
  {
    area: "Sinistri",
    icon: AlertTriangle,
    pagine: [
      { nome: "Lista Sinistri", desc: "Elenco sinistri con filtri per stato, data, agenzia e tipo", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Caricamento massivo", desc: "Import Excel MODULO SX per un cliente, anteprima e collegamento a polizze CBnet o pratiche senza polizza", ruoli: ["admin", "ufficio", "backoffice", "produttore"] },
      { nome: "Dettaglio Sinistro", desc: "Scheda sinistro con cronologia, perizie, documenti e liquidazioni", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Doc Precontrattuale", desc: "Generazione documentazione precontrattuale obbligatoria", ruoli: ["admin", "ufficio"] },
    ],
  },
  {
    area: "Contabilità Ufficio",
    icon: Calculator,
    pagine: [
      { nome: "Contabilità Ufficio", desc: "Pannello principale contabilità della sede con riepilogo movimenti", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Cruscotto Giornaliero", desc: "Situazione contabile del giorno con incassi e sospesi", ruoli: ["admin", "ufficio", "contabilita"] },
      
      { nome: "Quadratura Premi", desc: "Verifica corrispondenza tra premi incassati e premi dovuti", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Chiusura Contabile", desc: "Chiusura periodo contabile con generazione report", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Clienti", desc: "Estratto conto per singolo cliente con saldo e movimenti", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Agenzie", desc: "Estratto conto verso agenzie/plurimandatarie con premi e provvigioni da rimettere", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "E/C Produttori", desc: "Estratto conto produttore con provvigioni maturate e liquidate", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Provvigioni Maturate", desc: "Provvigioni maturate per produttore con dettaglio, pagamento e distinta PDF", ruoli: ["admin", "ufficio"] },
      { nome: "Import Provvigioni", desc: "Importazione file provvigioni da agenzie (PDF/Excel)", ruoli: ["admin", "ufficio"] },
      { nome: "Diff. Provvigioni", desc: "Analisi differenze tra provvigioni attese e ricevute", ruoli: ["admin", "ufficio"] },
      { nome: "Report IVA", desc: "Report IVA periodico per adempimenti fiscali", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Caricamento Mov. Bancari", desc: "Import estratti conto (sede solo sui propri conti); i movimenti aperti si collegano da Incassi", ruoli: ["admin", "cfo", "ufficio", "backoffice", "contabilita"] },
      { nome: "Bonifici e Mov. Bancari", desc: "Da ricongiungere → Ricongiunti → Importazioni → Storico importazioni", ruoli: ["admin", "cfo", "ufficio", "contabilita"] },
    ],
  },
  {
    area: "Progetto RCA",
    icon: Car,
    pagine: [
      { nome: "Clientela", desc: "Clienti con auto o autocarro: targa, nominativo e scadenza polizza", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
      { nome: "Scadenze", desc: "Coda rinnovi RCA ordinata per scadenza, con avvio preventivazione", ruoli: ["admin", "ufficio", "produttore", "backoffice", "corrispondente"] },
      { nome: "Analisi preventivo", desc: "Dati CBnet e garanzie richieste prima della quotazione compagnie", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
      { nome: "Preventivi", desc: "Elenco e dettaglio preventivi RCA salvati in CBnet", ruoli: ["admin", "ufficio", "produttore", "backoffice"] },
    ],
  },
  {
    area: "Estrazioni & Stampe",
    icon: Package,
    pagine: [
      { nome: "Estrazioni e Stampe", desc: "Hub centrale per report e stampe personalizzate (visibile alle sedi; dati filtrati per sede)", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Nidificazione", desc: "Albero collegamenti tra clienti (incarichi, familiari, societari) con export Excel", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Portafoglio per Cliente", desc: "Estrazione portafoglio raggruppato per cliente", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Portafoglio per Agenzia", desc: "Estrazione portafoglio raggruppato per agenzia", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Premi e Provvigioni", desc: "Report premi e provvigioni con filtri temporali e per agenzia", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Premi Scoperti/Garantiti", desc: "Analisi premi scoperti vs garantiti (limite mora, per sede)", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "E/C Clienti (Estrazioni)", desc: "Estratti conto clienti in formato esportabile", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Comunicazioni di incasso", desc: "Registro avvisi email di incasso alle agenzie (sede solo le proprie; admin raggruppate per sede)", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Prima nota", desc: "Polizze incassate nel periodo (sede solo le proprie; admin raggruppate per sede) con export Excel", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Tacito rinnovo", desc: "Polizze con/senza tacito rinnovo per fine garanzia (sede solo le proprie; admin raggruppate per sede)", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "CIG Temporanei", desc: "Elenco polizze con numero CIG provvisorio", ruoli: ["admin", "cfo", "ufficio", "backoffice"] },
      { nome: "Regolazioni attese", desc: "Elenco polizze in attesa di regolazione", ruoli: ["admin", "cfo", "ufficio", "backoffice"] },
      { nome: "Restituzione originali", desc: "Documenti di polizza e quietanza da restituire alle compagnie, con distinta PDF per agenzia", ruoli: ["admin", "cfo", "ufficio"] },
    ],
  },
  {
    area: "Sistema",
    icon: Settings,
    pagine: [
      { nome: "Anomalie Sistema", desc: "Monitoraggio anomalie, errori e incongruenze nei dati", ruoli: ["admin", "cfo", "ufficio"] },
      { nome: "Backup & Export", desc: "Esportazione dati e backup del database", ruoli: ["admin"] },
      { nome: "Tabelle di Base", desc: "Gestione tabelle di lookup (rami, zone, indotti, settori, ecc.)", ruoli: ["admin", "ufficio", "backoffice", "contabilita", "responsabile_sede"] },
      { nome: "Agenzie", desc: "Anagrafica agenzie assicurative con categorie e prodotti", ruoli: ["admin"] },
      { nome: "Template Email", desc: "Modelli email personalizzabili per comunicazioni automatiche", ruoli: ["admin", "ufficio", "backoffice", "contabilita", "responsabile_sede"] },
      { nome: "Sitemap", desc: "Questa pagina — organigramma ruoli e mappa funzionale", ruoli: ["admin"] },
    ],
  },
  {
    area: "Altre Funzioni",
    icon: Send,
    pagine: [
      { nome: "Notifiche", desc: "Centro notifiche con avvisi di sistema, scadenze e comunicazioni", ruoli: ["admin", "ufficio", "contabilita", "produttore", "backoffice", "corrispondente"] },
      { nome: "Comunicazioni", desc: "Invio e gestione comunicazioni email/PEC a clienti e agenzie", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Spedizioni", desc: "Tracciamento spedizioni documenti e corrispondenza", ruoli: ["admin", "ufficio", "backoffice"] },
      { nome: "Note Restituzione", desc: "Gestione note di credito e restituzioni da agenzie", ruoli: ["admin", "ufficio", "contabilita"] },
      { nome: "Flussi Agenzie", desc: "Importazione e gestione flussi dati dalle agenzie", ruoli: ["admin", "ufficio"] },
      { nome: "Privacy & Consensi", desc: "Gestione consensi GDPR e documentazione privacy clienti", ruoli: ["admin", "ufficio"] },
      { nome: "Report", desc: "Report statistici e analitici personalizzabili", ruoli: ["admin", "ufficio", "cfo"] },
      { nome: "Archivio Documentale", desc: "Archivio documentale con cartelle e upload file", ruoli: ["admin", "ufficio"] },
      { nome: "CB Bot", desc: "Assistente Web e Libreria CGA sui siti autorizzati e sul catalogo CBnet", ruoli: ["admin", "ufficio"] },
      { nome: "Chat Interna", desc: "Messaggistica interna tra operatori con canali tematici", ruoli: ["admin", "ufficio", "contabilita", "produttore", "backoffice", "corrispondente"] },
    ],
  },
  {
    area: "Portale Cliente",
    icon: UserCircle,
    pagine: [
      { nome: "Dashboard Cliente", desc: "Riepilogo personale con polizze attive, scadenze prossime e avvisi", ruoli: ["cliente"] },
      { nome: "Le mie Polizze", desc: "Lista polizze personali con stato e dettagli copertura", ruoli: ["cliente"] },
      { nome: "Dettaglio Polizza", desc: "Visualizzazione completa di una polizza con garanzie e documenti", ruoli: ["cliente"] },
      { nome: "Documenti", desc: "Archivio documenti personali e contrattuali scaricabili", ruoli: ["cliente"] },
      { nome: "Scadenze", desc: "Calendario scadenze polizze e pagamenti", ruoli: ["cliente"] },
      { nome: "Pagamenti", desc: "Storico pagamenti e situazione contabile personale", ruoli: ["cliente"] },
      { nome: "Sinistri", desc: "Visualizzazione e apertura sinistri personali", ruoli: ["cliente"] },
      { nome: "Upload Documenti", desc: "Caricamento documenti richiesti dall'agenzia", ruoli: ["cliente"] },
      { nome: "Comunicazioni", desc: "Messaggi scambiati con l'agenzia", ruoli: ["cliente"] },
      { nome: "Notifiche", desc: "Avvisi e promemoria personali", ruoli: ["cliente"] },
    ],
  },
  {
    area: "Portale Prospect",
    icon: ClipboardList,
    pagine: [
      { nome: "Dashboard Prospect", desc: "Riepilogo personale con KPI trattative e documenti", ruoli: ["prospect"] },
      { nome: "Le mie Trattative", desc: "Lista trattative in corso con stato, agenzia e premio previsto", ruoli: ["prospect"] },
      { nome: "Documenti", desc: "Documenti relativi alle proprie trattative, scaricabili", ruoli: ["prospect"] },
      { nome: "Upload Documenti", desc: "Caricamento documenti richiesti dall'agenzia", ruoli: ["prospect"] },
    ],
  },
];

/* ─── PERMESSI JSON ─── */
const permessiJson = [
  { chiave: "dashboard", descrizione: "Accesso alla dashboard principale e KPI", sezioni: "Dashboard, Notifiche" },
  { chiave: "titoli", descrizione: "Gestione titoli e portafoglio polizze", sezioni: "Portafoglio, Titoli, Gestione Polizze, Progetto RCA" },
  { chiave: "sinistri", descrizione: "Accesso alla gestione sinistri", sezioni: "Sinistri (lista e dettaglio)" },
  { chiave: "contabilita", descrizione: "Operazioni contabili dell'ufficio", sezioni: "Contabilità Ufficio, Distinta, Quadratura, Chiusura, E/C" },
  
  { chiave: "impostazioni", descrizione: "Configurazione sistema e gestione utenti", sezioni: "Sistema (tutte le sotto-pagine)" },
  { chiave: "provvigioni", descrizione: "Gestione provvigioni maturate e pagamenti", sezioni: "Provvigioni Maturate" },
  
];

const roleBadgeColor: Record<string, string> = {
  admin: "bg-red-500 text-white hover:bg-red-600",
  cfo: "bg-amber-500 text-white hover:bg-amber-600",
  ufficio: "bg-blue-500 text-white hover:bg-blue-600",
  contabilita: "bg-green-500 text-white hover:bg-green-600",
  produttore: "bg-purple-500 text-white hover:bg-purple-600",
  backoffice: "bg-teal-500 text-white hover:bg-teal-600",
  corrispondente: "bg-indigo-500 text-white hover:bg-indigo-600",
  cliente: "bg-gray-500 text-white hover:bg-gray-600",
  prospect: "bg-orange-500 text-white hover:bg-orange-600",
};

const roleBadgeLabel: Record<string, string> = {
  backoffice: "specialist",
  ufficio: "sede",
  corrispondente: "produttore",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeColor[role] || "bg-muted text-muted-foreground"}`}>
      {roleBadgeLabel[role] || role}
    </span>
  );
}

function SezioneCard({ sezione }: { sezione: typeof sezioni[0] }) {
  const [open, setOpen] = useState(false);
  const Icon = sezione.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="flex flex-row items-center gap-3 py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <Icon className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-sm font-semibold flex-1">{sezione.area}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{sezione.pagine.length} pagine</Badge>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4">
            <div className="space-y-2">
              {sezione.pagine.map((p) => (
                <div key={p.nome} className="py-2 border-b border-border/50 last:border-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{p.nome}</span>
                    {p.ruoli.map((r) => <RoleBadge key={r} role={r} />)}
                  </div>
                  {"desc" in p && p.desc && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function SitemapPage() {
  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" />
          Sitemap — Organigramma Ruoli & Privilegi
        </h1>
        <p className="text-muted-foreground mt-1">
          Mappa completa del sistema CBnet: gerarchia ruoli, aree funzionali e permessi per ciascun livello.
        </p>
      </div>

      {/* ─── SEZIONE 1: GERARCHIA RUOLI ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Gerarchia Ruoli</h2>

        {/* Livello 1 */}
        <div className="flex justify-center mb-4">
          <RuoloCard ruolo={ruoli[0]} />
        </div>

        {/* Livello 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 max-w-4xl mx-auto">
          {ruoli.filter((r) => r.livello === 2).map((r) => <RuoloCard key={r.nome} ruolo={r} />)}
        </div>

        {/* Livello 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {ruoli.filter((r) => r.livello === 3).map((r) => <RuoloCard key={r.nome} ruolo={r} />)}
        </div>

        {/* Livello 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {ruoli.filter((r) => r.livello === 4).map((r) => <RuoloCard key={r.nome} ruolo={r} />)}
        </div>
      </section>

      {/* ─── SEZIONE 2: MAPPA SEZIONI ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Mappa delle Sezioni</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sezioni.map((s) => <SezioneCard key={s.area} sezione={s} />)}
        </div>
      </section>

      {/* ─── SEZIONE 3: PERMESSI JSON ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Permessi JSON (permessi_json)
        </h2>
        <Card>
          <CardContent className="p-0">
            <TableScrollArea>
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Chiave</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Descrizione</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Sezioni Controllate</th>
                  </tr>
                </thead>
                <tbody>
                  {permessiJson.map((p) => (
                    <tr key={p.chiave} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono text-primary">{p.chiave}</code>
                      </td>
                      <td className="py-2.5 px-4 text-foreground">{p.descrizione}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{p.sezioni}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScrollArea>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function RuoloCard({ ruolo }: { ruolo: typeof ruoli[0] }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ruolo.icon;

  return (
    <Card className={`border-l-4 ${ruolo.color} w-full`}>
      <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${ruolo.badgeColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">{ruolo.nome}</CardTitle>
              <Badge variant="outline" className="text-[10px]">Livello {ruolo.livello}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ruolo.descrizione}</p>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <ul className="space-y-1">
            {ruolo.mansioni.map((m, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {m}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
