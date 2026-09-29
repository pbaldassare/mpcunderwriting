import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface PolizzaSectionProps {
  title: string;
  icon?: any; // lucide icon component
  children: ReactNode;
  defaultOpen?: boolean;
  /** Quando true, sezione non collassabile (header sempre visibile, contenuto sempre aperto). */
  static?: boolean;
  className?: string;
  /** Slot opzionale a destra del titolo (badge, azioni). */
  headerExtra?: ReactNode;
}

/**
 * Sezione moderna unificata per le pagine polizza:
 * border-l teal, header teal con icona, collapsible.
 * Sostituisce i vecchi <fieldset><legend>.
 */
export function PolizzaSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  static: isStatic = false,
  className,
  headerExtra,
}: PolizzaSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const Header = (
    <div className="w-full flex items-center gap-2 px-4 py-3 bg-teal-50/60 dark:bg-teal-950/20 border-b border-border">
      {Icon && <Icon className="w-4 h-4 text-teal-700 dark:text-teal-300" />}
      <span className="text-sm sm:text-base font-semibold text-teal-900 dark:text-teal-100">
        {title}
      </span>
      {headerExtra && <div className="ml-auto flex items-center gap-2">{headerExtra}</div>}
      {!isStatic && (
        <ChevronDown
          className={cn(
            "w-4 h-4 text-teal-700/70 dark:text-teal-300/70 transition-transform",
            headerExtra ? "ml-2" : "ml-auto",
            open ? "rotate-180" : "",
          )}
        />
      )}
    </div>
  );

  if (isStatic) {
    return (
      <div className={cn(
        "rounded-lg border border-border border-l-4 border-l-teal-600 bg-card shadow-sm",
        className,
      )}>
        <div className="overflow-hidden rounded-t-lg">{Header}</div>
        <div className="p-5 md:p-6 overflow-visible space-y-4 md:space-y-5">{children}</div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn(
        "rounded-lg border border-border border-l-4 border-l-teal-600 bg-card shadow-sm",
        className,
      )}>
        <div className="overflow-hidden rounded-t-lg">
          <CollapsibleTrigger asChild>
            <button className="w-full text-left hover:bg-teal-100/60 dark:hover:bg-teal-900/30 transition-colors">
              {Header}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="p-5 md:p-6 overflow-visible space-y-4 md:space-y-5">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default PolizzaSection;
