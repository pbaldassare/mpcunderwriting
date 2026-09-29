import { Info } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  text: string;
  title?: string;
  className?: string;
  size?: "xs" | "sm";
  /** retained for backward compatibility — ignored (Popover non richiede provider) */
  inProvider?: boolean;
}

/**
 * Piccola icona "i" CLICCABILE con popover esplicativo.
 * Mostrato su KPI card / header del portale cliente per spiegare cosa
 * rappresenta un valore. Funziona anche su touch (click), non solo hover.
 */
const InfoHint = ({ text, title, className, size = "sm" }: InfoHintProps) => {
  const [open, setOpen] = useState(false);
  const iconCls = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={title || "Informazioni"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen((v) => !v);
          }}
          onMouseEnter={() => setOpen(true)}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors align-middle p-0.5",
            className
          )}
        >
          <Info className={iconCls} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[280px] text-xs leading-relaxed p-3 border-primary/20 shadow-lg"
      >
        {title && (
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1">
            {title}
          </div>
        )}
        <p className="text-foreground/90">{text}</p>
      </PopoverContent>
    </Popover>
  );
};

export default InfoHint;
