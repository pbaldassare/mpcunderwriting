import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type TourActionType = "navigate" | "scroll" | "wait";

export interface TourAction {
  type: TourActionType;
  target?: string;
  delay?: number;
}

export interface TourStep {
  selector: string;
  title: string;
  description: string;
  page?: string;
  action?: TourAction;
  duration?: number;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  totalSteps: number;
  startTour: () => void;
  startTourAt: (selector: string) => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
};

export const CLIENTE_TOUR_STEPS: TourStep[] = [
  // Sidebar
  { selector: "cl-logo", title: "Benvenuto in CBnet! 👋", description: "Questa è la tua Area Clienti: polizze, scadenze, sinistri, chat e documenti del tuo ente — tutto in un solo posto, in tempo reale.", page: "/cliente" },
  { selector: "cl-nav-dashboard", title: "Dashboard 📊", description: "Il tuo punto di partenza: KPI, prossime scadenze, sinistri aperti e premi totali, sempre aggiornati.", page: "/cliente" },

  // Dashboard
  { selector: "cl-dash-kpi", title: "Le tue polizze a colpo d'occhio 📈", description: "Polizze attive, premi totali, sinistri aperti e prossime scadenze: i numeri chiave del tuo ente. Passa il mouse sulle icone ⓘ per la definizione esatta.", page: "/cliente", action: { type: "navigate", target: "/cliente", delay: 400 } },

  // Polizze
  { selector: "cl-nav-polizze", title: "Le tue Polizze 🛡️", description: "Tutte le polizze del tuo ente: stato, premio, scadenza, ramo e compagnia. Filtra e apri il dettaglio con un click.", page: "/cliente" },
  { selector: "cl-pol-page", title: "Pagina Polizze 🛡️", description: "Tabella zebrata con riga espandibile: clicca per vedere decorrenza, periodicità, quietanze e documenti senza cambiare pagina.", page: "/cliente/polizze", action: { type: "navigate", target: "/cliente/polizze", delay: 500 } },
  { selector: "cl-pol-filters", title: "Filtri avanzati & ricerca 🔍", description: "Cerca per numero polizza, targa, prodotto o CIG. Combina filtri per garanzia, compagnia e intervallo di scadenza. Esporta CSV/Excel in un click.", page: "/cliente/polizze" },

  // Scadenziario
  { selector: "cl-nav-scadenziario", title: "Scadenziario 📅", description: "Niente più sorprese: vedi cosa scade nei prossimi 30, 60 o 90 giorni e organizza i rinnovi in anticipo.", page: "/cliente" },
  { selector: "cl-scad-page", title: "Le tue Scadenze ⏰", description: "Lista ordinata per priorità: badge 🔴 URGENTE (≤30gg), 🟠 IN SCADENZA (≤60gg). La barra colorata mostra a colpo d'occhio quanto manca alla scadenza.", page: "/cliente/scadenze", action: { type: "navigate", target: "/cliente/scadenze", delay: 500 } },

  // Sinistri
  { selector: "cl-nav-sinistri", title: "Sinistri 🚨", description: "Apri una nuova denuncia, allega foto e documenti, e segui ogni aggiornamento del perito direttamente dal portale.", page: "/cliente" },
  { selector: "cl-sin-page", title: "Gestione Sinistri 📋", description: "5 KPI in alto (Totale, Aperti, Chiusi, Riserve, Liquidato) e due grafici interattivi per ramo e per importo. Apri un sinistro con il pulsante in alto a destra.", page: "/cliente/sinistri", action: { type: "navigate", target: "/cliente/sinistri", delay: 500 } },
  { selector: "cl-sin-filters", title: "Filtri multi-selezione 🎯", description: "Filtra per stato, garanzia, compagnia, polizza, città e intervallo date evento. Tutti i filtri sono multipli e combinabili.", page: "/cliente/sinistri" },
  { selector: "cl-sin-export", title: "Export Excel 📤", description: "Esporta in XLSX solo i sinistri selezionati (checkbox) oppure l'intero set filtrato. Utile per analisi offline e report interni.", page: "/cliente/sinistri" },

  // Chat
  { selector: "cl-nav-chat", title: "Chat con la tua agenzia 💬", description: "Parla direttamente con i tuoi referenti: una conversazione per ogni polizza, sinistro o argomento. Tutto tracciato.", page: "/cliente" },
  { selector: "cl-chat-page", title: "Le tue Conversazioni 💬", description: "Sulla sinistra l'elenco dei canali con anteprima, conteggio non letti e timestamp. A destra la chat con header contestuale (polizza/sinistro collegato).", page: "/cliente/chat", action: { type: "navigate", target: "/cliente/chat", delay: 500 } },
  { selector: "cl-chat-search", title: "Ricerca conversazioni 🔎", description: "Cerca nei titoli E dentro i messaggi: bastano 2 caratteri. I canali con match nei messaggi mostrano il badge 'match'.", page: "/cliente/chat" },
  { selector: "cl-chat-new", title: "Nuova conversazione ➕", description: "Apri un canale legato a una specifica polizza, a un sinistro, oppure un argomento libero. Scegli i destinatari interni dell'agenzia.", page: "/cliente/chat" },
  { selector: "cl-chat-export", title: "Esporta la chat in PDF 📄", description: "NOVITÀ: scarica l'intera conversazione in PDF brandizzato CBnet — header, partecipanti, bolle messaggi con timestamp e log attività completo. Perfetto per archivio o per portarla in agenzia.", page: "/cliente/chat" },

  // Assistente Polizze (AI)
  { selector: "cl-nav-assistente", title: "Assistente Polizze ✨", description: "Un assistente AI che conosce TUTTE le tue polizze e risponde in linguaggio naturale, citando sempre la fonte.", page: "/cliente" },
  { selector: "cl-assist-page", title: "Chiedi all'AI 🤖", description: "Interroga il tuo intero portafoglio: coperture, massimali, franchigie, esclusioni, scadenze. L'AI consulta sia i dati amministrativi sia le condizioni contrattuali (CGA) analizzate.", page: "/cliente/assistente", action: { type: "navigate", target: "/cliente/assistente", delay: 500 } },
  { selector: "cl-assist-stats", title: "Polizze indicizzate 📚", description: "Il badge mostra quante polizze e quanti set di CGA l'assistente sta consultando in tempo reale per rispondere alle tue domande.", page: "/cliente/assistente" },
  { selector: "cl-assist-suggerimenti", title: "Domande di esempio 💡", description: "Non sai da dove iniziare? Clicca uno degli esempi: 'Ho un sinistro: sono coperto?', 'Quali franchigie ho?', 'Ho copertura cyber?' e tante altre.", page: "/cliente/assistente" },
  { selector: "cl-assist-page", title: "Citazione delle fonti 🔖", description: "Ogni risposta cita SEMPRE la polizza di origine tra parentesi quadre, es: [All Risks Property · n° K24IT018712 · AXA XL]. Sai sempre da dove arriva l'informazione.", page: "/cliente/assistente" },

  // Documentazione Ente — rifatta
  { selector: "cl-nav-documenti", title: "Documentazione Ente 📁", description: "L'archivio completo del tuo ente: contratti, CGA, polizze firmate, quietanze, appendici e privacy. Accesso protetto.", page: "/cliente" },
  { selector: "cl-doc-page", title: "Archivio Documenti 🗂️", description: "Layout rinnovato: KPI in alto, filtri potenti e 3 tab dedicate. Ogni documento è classificato per tipologia con icona e colore.", page: "/cliente/documenti", action: { type: "navigate", target: "/cliente/documenti", delay: 500 } },
  { selector: "cl-doc-kpi", title: "I tuoi KPI documentali 📊", description: "Totale documenti, polizze documentate, set CGA caricati e file caricati da te: tutto in un colpo d'occhio.", page: "/cliente/documenti" },
  { selector: "cl-doc-filters", title: "Filtri intelligenti 🎯", description: "Cerca per nome/categoria/polizza/compagnia, oppure filtra per tipologia (CGA, Polizza firmata, Quietanze, Appendici, Privacy…) o per singola polizza.", page: "/cliente/documenti" },
  { selector: "cl-doc-tab-polizza", title: "Tab 'Per Polizza' 🛡️", description: "Accordion per ogni polizza: vedi quanti documenti ha, quando è stata aggiornata e i file raggruppati per tipologia. Ideale per trovare subito CGA o quietanze.", page: "/cliente/documenti" },
  { selector: "cl-doc-tab-ente", title: "Tab 'Ente' 🏢", description: "Solo i documenti generali dell'ente, non legati a una specifica polizza: visure, statuti, deleghe, ecc.", page: "/cliente/documenti" },
  { selector: "cl-doc-tab-tutti", title: "Tab 'Tutti' 📜", description: "Vista cronologica completa con badge della polizza di appartenenza. Utile per scaricamenti massivi e ricerche trasversali.", page: "/cliente/documenti" },
  { selector: "cl-doc-upload", title: "Carica un documento 📤", description: "Trascina o seleziona un file: sarà archiviato nel bucket privato del tuo ente. Solo tu e l'agenzia potete accedervi.", page: "/cliente/documenti" },

  // Notifiche
  { selector: "cl-nav-notifiche", title: "Notifiche 🔔", description: "Tutti gli aggiornamenti che ti riguardano: nuove polizze, scadenze, sinistri e messaggi dall'agenzia.", page: "/cliente" },
  { selector: "cl-notif-page", title: "Centro Notifiche 🔔", description: "Le notifiche non lette sono evidenziate. Clicca per leggere e marcarle come viste.", page: "/cliente/notifiche", action: { type: "navigate", target: "/cliente/notifiche", delay: 500 } },

  // Dati Ente
  { selector: "cl-nav-dati", title: "Dati Ente 🏢", description: "Anagrafica completa del tuo ente: ragione sociale, P.IVA, sede, contatti. Da qui richiedi modifiche all'agenzia.", page: "/cliente" },
  { selector: "cl-anag-page", title: "Anagrafica Ente 🏢", description: "Visualizzi tutti i dati ufficiali. Per i campi modificabili puoi inviare una richiesta che l'agenzia approverà.", page: "/cliente/anagrafica", action: { type: "navigate", target: "/cliente/anagrafica", delay: 500 } },

  // Info & Contatti
  { selector: "cl-nav-contatti", title: "Info e Contatti ☎️", description: "Tutto il team dell'agenzia: broker, gestione polizze, sinistri, commerciale e legal con contatti diretti.", page: "/cliente" },
  { selector: "cl-uff-page", title: "Il tuo Team 👥", description: "Sai sempre chi contattare per cosa: ogni reparto con nome, ruolo ed email. Un click e parte la mail.", page: "/cliente/ufficio", action: { type: "navigate", target: "/cliente/ufficio", delay: 500 } },

  // Topbar
  { selector: "cl-topbar-bell", title: "Notifiche rapide 🔔", description: "Il badge sul campanello mostra i messaggi non letti: un click per andare al centro notifiche.", page: "/cliente", action: { type: "navigate", target: "/cliente", delay: 400 } },
  { selector: "cl-topbar-logout", title: "Esci in sicurezza 🔐", description: "Quando hai finito, premi Esci per chiudere la sessione. Per riaprire il tour usa il pulsante ✨ in basso a destra.", page: "/cliente" },

  // Final
  { selector: "cl-logo", title: "Buon lavoro! 🎉", description: "Hai visto tutte le sezioni della tua Area Clienti, comprese le novità (export PDF chat, nuovo archivio documenti, filtri sinistri). La tua agenzia è a un click. A presto!", page: "/cliente" },
];

const STORAGE_KEY = "cbnet_cliente_tour_done_v2";

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = CLIENTE_TOUR_STEPS;

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const startTourAt = useCallback((selector: string) => {
    const idx = steps.findIndex((s) => s.selector === selector);
    setCurrentStep(idx >= 0 ? idx : 0);
    setIsActive(true);
  }, [steps]);

  const stopTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((s) => {
      if (s + 1 >= steps.length) {
        setIsActive(false);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
        return 0;
      }
      return s + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), []);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        totalSteps: steps.length,
        startTour,
        startTourAt,
        stopTour,
        nextStep,
        prevStep,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const hasSeenClienteTour = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};

const AI_SEEN_KEY = "cbnet_cliente_ai_seen";
export const hasSeenAIAssistant = () => {
  try { return localStorage.getItem(AI_SEEN_KEY) === "1"; } catch { return false; }
};
export const markAIAssistantSeen = () => {
  try { localStorage.setItem(AI_SEEN_KEY, "1"); } catch {}
};
