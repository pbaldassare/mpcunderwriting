import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";
import { Link } from "react-router-dom";
import type { CompensazioneSummary } from "@/hooks/useCompensazioniByTitoli";

interface Props {
  summary?: CompensazioneSummary;
  titoloId?: string;
}

/**
 * Indicatore visivo per titoli con compensazioni contabili applicate.
 * Mostra il numero di righe + impatto netto sul dovuto cliente.
 * Se viene passato `titoloId`, il badge diventa cliccabile e apre la pagina
 * di dettaglio delle compensazioni del titolo.
 */
export function CompensazioneBadge({ summary, titoloId }: Props) {
  if (!summary || summary.count === 0) return null;
  const segno = summary.totale >= 0 ? "−" : "+";
  const abs = Math.abs(summary.totale).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const title = `${summary.count} compensazion${summary.count === 1 ? "e" : "i"} contabil${summary.count === 1 ? "e" : "i"} · impatto netto ${segno} € ${abs}${titoloId ? " · clicca per dettaglio" : ""}`;
  const badge = (
    <Badge
      variant="outline"
      className={`border-teal-500 text-teal-700 bg-teal-50 gap-1 text-[10px] h-5 ${titoloId ? "cursor-pointer hover:bg-teal-100 transition-colors" : ""}`}
      title={title}
    >
      <Scale className="h-3 w-3" />
      Comp. {segno}€{abs}
    </Badge>
  );
  if (!titoloId) return badge;
  return (
    <Link to={`/portafoglio/${titoloId}/compensazioni`} onClick={(e) => e.stopPropagation()}>
      {badge}
    </Link>
  );
}
