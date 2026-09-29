import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calculator } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";

interface Props {
  titoloId: string;
}

interface CompRow {
  id: string;
  causale_codice: string;
  causale_descrizione: string;
  segno: "+" | "-";
  importo: number;
  note: string | null;
  created_at: string;
}

/**
 * Box read-only mostrato nel pannello "Messa a Cassa" di TitoloDetail.
 * Mostra le compensazioni contabili applicate al titolo al momento dell'incasso.
 * Si auto-nasconde se non ci sono compensazioni.
 */
export const CompensazioniBox = ({ titoloId }: Props) => {
  const { data = [] } = useQuery({
    queryKey: ["titoli-compensazioni", titoloId],
    enabled: !!titoloId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select("id, causale_codice, causale_descrizione, segno, importo, note, created_at")
        .eq("titolo_id", titoloId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CompRow[];
    },
  });

  if (data.length === 0) return null;

  const totPlus = data.filter((c) => c.segno === "+").reduce((s, c) => s + Number(c.importo), 0);
  const totMinus = data.filter((c) => c.segno === "-").reduce((s, c) => s + Number(c.importo), 0);
  const nettoComp = totMinus - totPlus; // effetto netto sul dovuto cliente (+ aumenta / − diminuisce)

  return (
    <div className="mt-4 rounded-md border border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2">
        <Calculator className="w-4 h-4" />
        Compensazioni contabili applicate ({data.length})
      </div>
      <div className="space-y-1 text-xs">
        {data.map((c) => (
          <div key={c.id} className="flex items-center gap-2 bg-background/70 rounded px-2 py-1.5">
            <span
              className={`font-mono text-sm font-bold w-4 text-center ${
                c.segno === "+" ? "text-green-600" : "text-red-600"
              }`}
              title={c.segno === "+" ? "Riduce dovuto cliente" : "Aumenta dovuto cliente"}
            >
              {c.segno}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {c.causale_codice} — {c.causale_descrizione}
              </div>
              {c.note && <div className="text-muted-foreground truncate italic">{c.note}</div>}
            </div>
            <span className="font-mono tabular-nums">{fmtEuro(Number(c.importo))}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-amber-400/30 flex justify-between text-xs font-semibold">
        <span>Effetto netto sul dovuto</span>
        <span className={nettoComp >= 0 ? "text-red-700" : "text-green-700"}>
          {nettoComp >= 0 ? "+ " : "− "}
          {fmtEuro(Math.abs(nettoComp))}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground italic">
        Abbuoni/arrotondamenti dalla messa a cassa (livello cliente). In Prima Nota:{" "}
        <code className="font-mono">compensazione_titolo</code> / <code className="font-mono">abbuono</code>.
      </p>
    </div>
  );
};

export default CompensazioniBox;
