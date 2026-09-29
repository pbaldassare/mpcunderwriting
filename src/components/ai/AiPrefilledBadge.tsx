import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  /** True se il valore corrente è stato generato dall'AI e non ancora toccato dall'utente. */
  prefilled: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Piccolo badge per marcare visivamente un valore "Precompilato da AI".
 * Il valore resta sempre editabile dal componente sottostante: il badge
 * scompare automaticamente non appena l'utente modifica il campo
 * (gestito dal componente che imposta `prefilled=false` sul change).
 */
export function AiPrefilledBadge({ prefilled, className, children }: Props) {
  if (!prefilled) return <>{children}</>;
  return (
    <div className={cn("space-y-1", className)}>
      <Badge
        variant="outline"
        className="gap-1 border-primary/40 bg-primary/5 text-[10px] font-medium text-primary"
      >
        <Sparkles className="h-3 w-3" />
        Precompilato da AI
      </Badge>
      {children}
    </div>
  );
}
