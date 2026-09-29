import { useNavigate } from "react-router-dom";
import { Search, ShieldCheck, Landmark, type LucideIcon } from "lucide-react";

interface ActionCard {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

const actions: ActionCard[] = [
  {
    label: "RUI Search",
    description: "Ricerca iscrizioni e intermediari nel Registro Unico degli Intermediari",
    icon: Search,
    path: "/opportunity/rui-search",
  },
  {
    label: "ID Guard",
    description: "Verifica email e domini clienti contro data breach (ID Guard)",
    icon: ShieldCheck,
    path: "/opportunity/iid-guard",
  },
  {
    label: "RNA Aiuti di stato e bandi",
    description: "Registro Nazionale Aiuti, agevolazioni e bandi pubblici",
    icon: Landmark,
    path: "/opportunity/rna-aiuti-bandi",
  },
];

const OpportunityPage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Opportunity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seleziona lo strumento di ricerca e verifica
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {actions.map((action) => (
          <button
            key={action.path}
            type="button"
            onClick={() => navigate(action.path)}
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

export default OpportunityPage;
