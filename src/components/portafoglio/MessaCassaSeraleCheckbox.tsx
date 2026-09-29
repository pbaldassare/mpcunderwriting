import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const MESSA_CASSA_SERALE_HINT =
  "Pianifica la comunicazione di messa a cassa per le 19:30 del giorno corrente";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

/** Checkbox in alto a destra (a sinistra della X del Dialog) per l'invio serale. */
export function MessaCassaSeraleCheckbox({
  checked,
  onCheckedChange,
  id = "messa-cassa-serale",
  className,
}: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          "absolute right-12 top-4 z-10 flex items-center gap-1.5 pr-1",
          className,
        )}
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <Label htmlFor={id} className="text-xs font-medium cursor-pointer whitespace-nowrap leading-none">
          Messa a cassa serale
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={MESSA_CASSA_SERALE_HINT}
              className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={(e) => e.preventDefault()}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
            {MESSA_CASSA_SERALE_HINT}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default MessaCassaSeraleCheckbox;
