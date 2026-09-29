import { fmtEuro } from "@/lib/formatCurrency";

/** Solo display: Provvigioni attive (tot titolo) e passive (quota produttori). */
export function MessaCassaProvvigioniDisplay({
  attive,
  passive,
}: {
  attive: number;
  passive: number;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1" data-testid="messa-cassa-provvigioni">
      <div className="flex justify-between gap-3">
        <span>Provvigioni attive</span>
        <span className="tabular-nums font-medium">{fmtEuro(attive)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span>Provvigioni passive</span>
        <span className="tabular-nums font-medium">{fmtEuro(passive)}</span>
      </div>
    </div>
  );
}
