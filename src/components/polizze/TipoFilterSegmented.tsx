import { cn } from "@/lib/utils";

export type FiltroTipo = "polizze" | "quietanze" | "regolazioni" | "garantiti";

export type TipoFilterSegmentedProps = {
  value: FiltroTipo;
  onChange: (v: FiltroTipo) => void;
  counts?: { polizze?: number; quietanze?: number; regolazioni?: number; garantiti?: number };
  /** Mostra anche il chip Regolazioni (solo portafoglio). Default: false. */
  withRegolazioni?: boolean;
  /** Mostra chip Garantiti (copertura / attesa fondi). Default: false. */
  withGarantiti?: boolean;
  /** Nasconde il chip Polizze (es. pagina Carico dove ci sono solo quietanze). Default: false. */
  hidePolizze?: boolean;
  className?: string;
};

/**
 * Segmented control "Tipo": Polizze · Quietanze · (Regolazioni).
 * Il chip attivo prende il colore del tipo (teal/ambra/arancio), così la modalità è leggibile a colpo d'occhio.
 */
export function TipoFilterSegmented({
  value,
  onChange,
  counts,
  withRegolazioni = false,
  withGarantiti = false,
  hidePolizze = false,
  className,
}: TipoFilterSegmentedProps) {
  const items: Array<{
    key: FiltroTipo;
    label: string;
    count?: number;
    activeClasses: string;
  }> = [
    ...(hidePolizze
      ? []
      : [
          {
            key: "polizze" as FiltroTipo,
            label: "Polizze",
            count: counts?.polizze,
            activeClasses: "bg-polizza text-polizza-foreground shadow-sm",
          },
        ]),
    {
      key: "quietanze",
      label: "Quietanze",
      count: counts?.quietanze,
      activeClasses: "bg-quietanza text-quietanza-foreground shadow-sm",
    },
  ];

  if (withGarantiti) {
    items.push({
      key: "garantiti",
      label: "Garantiti",
      count: counts?.garantiti,
      activeClasses: "bg-orange-500 text-white shadow-sm",
    });
  }

  if (withRegolazioni) {
    items.push({
      key: "regolazioni",
      label: "Appendici",
      count: counts?.regolazioni,
      activeClasses: "bg-appendice text-appendice-foreground shadow-sm",
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Filtro tipo polizza"
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
              active
                ? it.activeClasses
                : "text-muted-foreground hover:text-foreground hover:bg-background/60",
            )}
          >
            {it.label}
            {typeof it.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums",
                  active ? "bg-background/20" : "bg-background/80 text-foreground/70",
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
