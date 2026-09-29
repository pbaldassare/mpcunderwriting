import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BonificoSuggerito } from "@/lib/bonificoMatch";
import { formatDateIT } from "@/lib/formatDate";
import { ArrowRightLeft } from "lucide-react";
import { useState } from "react";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

type Props = {
  suggerimenti: BonificoSuggerito[];
  onPick: (b: BonificoSuggerito) => void;
};

/**
 * Badge riga Incassi: 1 match → un click; più match → popover per scegliere il bonifico
 * (ordinante ↔ cliente, senza criterio importo).
 */
export function BonificoMatchBadge({ suggerimenti, onPick }: Props) {
  const [open, setOpen] = useState(false);
  if (!suggerimenti.length) return null;

  const best = suggerimenti[0];
  const multi = suggerimenti.length > 1;

  if (!multi) {
    return (
      <button
        type="button"
        className="inline-flex"
        title={`Ordinante: ${best.ordinante || "—"}`}
        onClick={(e) => {
          e.stopPropagation();
          onPick(best);
        }}
      >
        <Badge className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] h-5 gap-1">
          <ArrowRightLeft className="h-3 w-3" />
          Bonifico
        </Badge>
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex"
          title={`${suggerimenti.length} bonifici possibili (match nome)`}
          onClick={(e) => e.stopPropagation()}
        >
          <Badge className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] h-5 gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            Bonifico · {suggerimenti.length}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-semibold">Scegli il bonifico</p>
          <p className="text-[11px] text-muted-foreground">
            {suggerimenti.length} corrispondenze su ordinante/cliente (non sull&apos;importo).
          </p>
        </div>
        <ul className="max-h-[280px] overflow-auto py-1">
          {suggerimenti.map((b, idx) => (
            <li key={b.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                onClick={() => {
                  onPick(b);
                  setOpen(false);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{b.ordinante || "—"}</div>
                    {b.descrizione && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2">{b.descrizione}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDateIT(b.data_movimento)}
                      {b.conto_etichetta ? ` · ${b.conto_etichetta}` : ""}
                      {" · "}
                      {b.matchReason === "cliente" ? "Cliente assegnato" : "Ordinante"}
                      {idx === 0 ? " · migliore" : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">{fmtCurrency(b.importo)}</div>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] mt-1 px-2">
                      Usa
                    </Button>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
