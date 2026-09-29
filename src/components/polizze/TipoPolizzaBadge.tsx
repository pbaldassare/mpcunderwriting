import { FileText, Receipt, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TipoPolizzaBadgeProps = {
  tipo: "polizza" | "quietanza" | "appendice";
  /** Indice rata (>=2 per le quietanze). Ignorato per le polizze. */
  numero?: number;
  /** Totale rate nella catena (per mostrare "Quietanza N/M"). */
  totale?: number;
  /** Quietanza messa a cassa: badge canarino; altrimenti outline neutro senza sfondo. */
  messaACassa?: boolean;
  /** Sottotipo appendice: "Modifica" | "Proroga" | "Regolazione". */
  appendiceLabel?: string | null;
  className?: string;
};

/**
 * Badge condiviso per distinguere Polizza (teal pieno), Quietanza (ambra) e
 * Appendice (viola). Usa i token design system `--polizza` / `--quietanza` /
 * `--appendice`, niente colori hardcoded.
 */
export function TipoPolizzaBadge({ tipo, numero, totale, messaACassa, appendiceLabel, className }: TipoPolizzaBadgeProps) {
  if (tipo === "appendice") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-appendice/30 bg-appendice px-2 py-0.5 text-[11px] font-medium text-appendice-foreground",
          className,
        )}
      >
        <FilePlus2 className="h-3 w-3" />
        {appendiceLabel ? `App. ${appendiceLabel}` : "Appendice"}
      </span>
    );
  }

  if (tipo === "polizza") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-polizza/30 bg-polizza px-2 py-0.5 text-[11px] font-medium text-polizza-foreground",
          className,
        )}
      >
        <FileText className="h-3 w-3" />
        Polizza
      </span>
    );
  }

  const label =
    numero && totale
      ? `Quietanza ${numero}/${totale}`
      : numero
        ? `Quietanza ${numero}`
        : "Quietanza";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        messaACassa
          ? "border-quietanza/50 bg-quietanza/15 text-quietanza-foreground"
          : "border-border bg-transparent text-muted-foreground",
        className,
      )}
    >
      <Receipt className="h-3 w-3" />
      {label}
    </span>
  );
}
