import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const PIPELINE_STATI = [
  { value: "aperta", label: "Aperta", color: "bg-blue-500" },
  { value: "contatto", label: "Contatto", color: "bg-cyan-500" },
  { value: "preventivo", label: "Preventivo", color: "bg-indigo-500" },
  { value: "in_negoziazione", label: "Negoziazione", color: "bg-amber-500" },
  { value: "proposta_inviata", label: "Proposta", color: "bg-purple-500" },
  { value: "chiusa_vinta", label: "Vinta", color: "bg-green-500" },
  { value: "chiusa_persa", label: "Persa", color: "bg-red-500" },
  { value: "sospesa", label: "Sospesa", color: "bg-gray-500" },
];

export const STATI_TRATTATIVA_FULL = PIPELINE_STATI;

interface StatoPipelineProps {
  statoCorrente: string;
  onCambiaStato?: (nuovoStato: string) => void;
  readonly?: boolean;
}

export const StatoPipeline = ({ statoCorrente, onCambiaStato, readonly }: StatoPipelineProps) => {
  const currentIdx = PIPELINE_STATI.findIndex((s) => s.value === statoCorrente);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE_STATI.map((stato, idx) => {
        const isActive = stato.value === statoCorrente;
        const isPast = idx < currentIdx && currentIdx >= 0;
        const isTerminal = stato.value === "chiusa_vinta" || stato.value === "chiusa_persa" || stato.value === "sospesa";

        return (
          <button
            key={stato.value}
            disabled={readonly}
            onClick={() => !readonly && onCambiaStato?.(stato.value)}
            className={cn(
              "relative flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              isActive && `${stato.color} text-white border-transparent shadow-md`,
              isPast && "bg-muted text-muted-foreground border-border",
              !isActive && !isPast && "bg-background text-muted-foreground border-border hover:border-primary/50",
              readonly && "cursor-default",
              !readonly && !isActive && "cursor-pointer",
              isTerminal && !isActive && "opacity-70"
            )}
          >
            {isPast && <Check className="w-3 h-3" />}
            {stato.label}
          </button>
        );
      })}
    </div>
  );
};

export const getStatoLabel = (stato: string) =>
  PIPELINE_STATI.find((s) => s.value === stato)?.label || stato;

export const getStatoColor = (stato: string) =>
  PIPELINE_STATI.find((s) => s.value === stato)?.color || "bg-muted";
