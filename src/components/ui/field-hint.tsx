import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FieldHintProps {
  /** Testo del tooltip. Può essere stringa o ReactNode per markup ricco. */
  children: React.ReactNode;
  className?: string;
  /** Dimensione icona (default 14px). */
  size?: number;
  /** Label aria per accessibilità. */
  ariaLabel?: string;
}

/**
 * Piccola icona "?" cliccabile/hoverable con tooltip esplicativo.
 * Pensata per affiancare label di campi tecnici (es. mora_giorni,
 * percentuale_ae, tacito_rinnovo) senza appesantire il form.
 *
 * Uso:
 *   <Label>
 *     Mora giorni <FieldHint>Giorni di tolleranza concessi dopo la scadenza prima che la copertura decada.</FieldHint>
 *   </Label>
 */
export function FieldHint({ children, className, size = 14, ariaLabel = "Informazioni" }: FieldHintProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors align-middle",
              className,
            )}
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle style={{ width: size, height: size }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FieldHint;
