import { Check, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RcaCompagniaLogo } from "@/components/rca/RcaCompagniaLogo";
import {
  extractPremioOfferta,
  formatEuroPremio,
  labelStatoOfferta,
  type AssicurappOffer,
} from "@/lib/rca/assicurapp";
import { bestCompletedOffer, offertaKey, sortOfferte } from "@/lib/rca/offerteUi";
import { cn } from "@/lib/utils";

export function RcaOfferteCards({
  offerte,
  selectedKey,
  onSelect,
  emptyLabel,
}: {
  offerte: AssicurappOffer[];
  selectedKey?: string | null;
  onSelect?: (offer: AssicurappOffer) => void;
  emptyLabel?: string;
}) {
  const sorted = sortOfferte(offerte);
  const best = bestCompletedOffer(offerte);
  const bestKey = best ? offertaKey(best) : null;

  if (sorted.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel || "Nessuna offerta."}</p>;
  }

  return (
    <div className="space-y-3 p-4">
      {sorted.map((offer, index) => {
        const key = offertaKey(offer, index);
        const premio = extractPremioOfferta(offer.prices);
        const isBest = bestKey === key && premio != null;
        const selected = selectedKey === key;
        const status = String(offer.status || "").toLowerCase();
        const completed = status === "completed" || status === "success" || status === "ok";
        return (
          <button
            key={key}
            type="button"
            disabled={!onSelect || !completed}
            onClick={() => onSelect?.(offer)}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
              selected && "border-primary bg-primary/5 shadow-md",
              !selected && isBest && "border-emerald-400/70 bg-emerald-50/70",
              !selected && !isBest && "border-border bg-card hover:border-primary/40",
              (!onSelect || !completed) && "cursor-default",
            )}
          >
            <RcaCompagniaLogo slug={offer.company_slug} label={offer.label} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{offer.label || offer.company_slug || "Compagnia"}</p>
                {isBest && (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    <Trophy className="mr-1 h-3 w-3" />
                    Miglior prezzo
                  </Badge>
                )}
                {offer.origin === "cvt" && <Badge variant="outline">CVT</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {labelStatoOfferta(offer.status)}
                {offer.notes ? ` · ${offer.notes}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("text-xl font-bold tabular-nums", isBest ? "text-emerald-700" : "text-foreground")}>
                {formatEuroPremio(premio)}
              </p>
              {selected && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-3.5 w-3.5" />
                  Selezionata
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
