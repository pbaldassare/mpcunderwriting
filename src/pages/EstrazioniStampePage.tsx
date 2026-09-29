import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  DollarSign,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  Archive,
  Wallet,
  Mail,
  Inbox,
  RefreshCw,
  Wand2,
  GitBranch,
  BookOpen,
  Hash,
  FileClock,
  FileOutput,
  LucideIcon,
} from "lucide-react";

interface ActionCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

export const ESTRAZIONI_ACTIONS: ActionCard[] = [
  { label: "Titoli da incassare", description: "Estrazione per competenza con Excel pivot e report PDF", icon: Wallet, path: "/portafoglio/estrazioni/titoli-da-incassare" },
  { label: "Nidificazione", description: "Albero clienti: incarichi, titoli familiari e rapporti societari", icon: GitBranch, path: "/portafoglio/estrazioni/nidificazione" },
  { label: "Portafoglio per Cliente", description: "Portafoglio per cliente con Excel pivot e report PDF", icon: Users, path: "/portafoglio/estrazioni/per-cliente" },
  { label: "Portafoglio per Agenzia", description: "Portafoglio per agenzia con Excel pivot e report PDF", icon: Building2, path: "/portafoglio/estrazioni/per-compagnia" },
  { label: "Premi e Provvigioni", description: "Titoli incassati — 36 colonne, pivot e report PDF", icon: DollarSign, path: "/portafoglio/estrazioni/premi-provvigioni" },
  { label: "Premi Scoperti e Garantiti", description: "Analisi scoperti/garantiti con Excel pivot e PDF", icon: ShieldCheck, path: "/portafoglio/estrazioni/premi-scoperti-garantiti" },
  { label: "E/C Clienti", description: "Estratto conto clienti con Excel pivot e report PDF", icon: FileSpreadsheet, path: "/portafoglio/estrazioni/ec-clienti" },
  { label: "E/C Agenzie", description: "Estratto conto verso agenzie con anteprima, stampa e archivio", icon: FileText, path: "/contabilita/ec-agenzia" },
  { label: "Storico E/C Agenzie", description: "PDF E/C Agenzie archiviati: ricerca, filtri e anteprima", icon: Archive, path: "/contabilita/ec-agenzia/storico" },
  { label: "Storico E/C Clienti", description: "PDF E/C Clienti archiviati: ricerca per cliente, periodo e download", icon: Archive, path: "/contabilita/ec-cliente/storico" },
  { label: "Richiesta Quietanza", description: "Polizze in scadenza: filtri, invio mail aggregata e registro", icon: Mail, path: "/portafoglio/estrazioni/richiesta-quietanza" },
  { label: "Comunicazioni di incasso", description: "Avvisi email di incasso alle agenzie: filtri, stato e anteprima", icon: Inbox, path: "/portafoglio/estrazioni/comunicazioni-incasso" },
  { label: "Prima nota", description: "Polizze incassate nel periodo, per sede e agenzia, con export Excel", icon: BookOpen, path: "/portafoglio/estrazioni/prima-nota" },
  { label: "Tacito rinnovo", description: "Polizze con o senza tacito rinnovo, per sede e periodo di scadenza", icon: RefreshCw, path: "/portafoglio/estrazioni/tacito-rinnovo" },
  { label: "CIG Temporanei", description: "Polizze con numero CIG provvisorio", icon: Hash, path: "/portafoglio/estrazioni/cig-temporanei" },
  { label: "Regolazioni attese", description: "Polizze in attesa di regolazione", icon: FileClock, path: "/portafoglio/estrazioni/regolazioni-attese" },
  { label: "Elaborazioni", description: "Analisi IA dei documenti di polizza e generazione documenti da template", icon: Wand2, path: "/portafoglio/estrazioni/elaborazioni" },
  { label: "Restituzione originali", description: "Documenti di polizza e quietanza da restituire alle compagnie, distinta PDF per agenzia", icon: FileOutput, path: "/portafoglio/estrazioni/restituzione-originali" },
  { label: "Registro Richieste Quietanza", description: "Storico invii email richiesta quietanza alle agenzie", icon: Archive, path: "/portafoglio/estrazioni/richiesta-quietanza/registro" },
];

const EstrazioniStampePage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estrazioni e Stampe</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona il tipo di estrazione o stampa da generare
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {ESTRAZIONI_ACTIONS.map((action) => (
          <button
            key={action.path}
            type="button"
            onClick={() => navigate(action.path)}
            data-testid={`estrazione-card-${action.path.split("/").pop()}`}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-center group"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <action.icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default EstrazioniStampePage;
