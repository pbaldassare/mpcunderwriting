import { useMemo } from "react";
import { Users } from "lucide-react";
import { calcRipartoImporti, isRipartoSumValidForPreview, type RipartoCoassicurazioneRow } from "@/lib/coassicurazione";
import { cn } from "@/lib/utils";

interface CompagniaLookup {
  id: string;
  nome?: string | null;
  codice?: string | null;
}

export interface CoassicurazioneImportiBreakdownProps {
  ripartoRows: RipartoCoassicurazioneRow[];
  compagnieList: CompagniaLookup[];
  gruppiCompagniaList: { id: string; nome?: string | null; codice?: string | null }[];
  totNetto: number;
  totAccessori: number;
  totTasse: number;
  totSsn: number;
  lordo: number;
  provvFirma?: number;
  provvNetto?: number;
  provvAccessori?: number;
}

export function CoassicurazioneImportiBreakdown({
  ripartoRows,
  compagnieList,
  gruppiCompagniaList,
  totNetto,
  totAccessori,
  totTasse,
  totSsn,
  lordo,
  provvFirma = 0,
  provvNetto,
  provvAccessori,
}: CoassicurazioneImportiBreakdownProps) {
  const importi = useMemo(
    () =>
      calcRipartoImporti(
        { netto: totNetto, addizionali: totAccessori, tasse: totTasse, lordo },
        ripartoRows,
        provvFirma > 0
          ? {
              totale: provvFirma,
              provvNetto: provvNetto ?? provvFirma,
              provvAddizionali: provvAccessori ?? 0,
              percProvvNetto: 0,
              percProvvAddizionali: 0,
            }
          : undefined,
      ),
    [ripartoRows, totNetto, totAccessori, totTasse, lordo, provvFirma, provvNetto, provvAccessori],
  );

  if (!Array.isArray(ripartoRows) || ripartoRows.length === 0 || !isRipartoSumValidForPreview(ripartoRows)) return null;

  const labelFor = (row: RipartoCoassicurazioneRow) => {
    const ag = compagnieList.find((c) => c.id === row.compagniaId);
    const gc = gruppiCompagniaList.find((g) => g.id === row.gruppoCompagniaId);
    const agLabel = ag ? `${ag.codice || ""} ${ag.nome || ""}`.trim() : "—";
    const gcLabel = gc?.nome || gc?.codice || "";
    return gcLabel ? `${gcLabel} · ${agLabel}` : agLabel;
  };

  return (
    <div className="mx-3 mb-3 rounded-md border border-teal-200 bg-teal-50/40 dark:bg-teal-950/20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-teal-200/80 bg-teal-100/50 dark:bg-teal-900/30">
        <Users className="h-3.5 w-3.5 text-teal-700" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
          Riparto coassicurazione
        </p>
      </div>
      <div className="divide-y divide-teal-100 dark:divide-teal-900/50">
        {ripartoRows.map((row, idx) => {
          const imp = importi[idx];
          if (!imp) return null;
          const ssnShare = totSsn > 0 && lordo > 0 ? (imp.totale / lordo) * totSsn : 0;
          return (
            <div key={row.localId} className="px-3 py-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-[11px]">
              <div className="md:col-span-2 min-w-0">
                <p className="font-medium text-foreground truncate" title={labelFor(row)}>
                  {labelFor(row)}
                </p>
                <p className="text-muted-foreground font-mono">{row.quotaPercentuale || "0"}%</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[9px]">Netto</span>
                <p className="font-mono font-semibold">{imp.netto.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[9px]">Accessori</span>
                <p className="font-mono font-semibold">{imp.addizionali.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[9px]">Tasse</span>
                <p className="font-mono font-semibold">{imp.tasse.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase text-[9px]">Lordo</span>
                <p className={cn("font-mono font-bold text-teal-800 dark:text-teal-200")}>
                  {imp.totale.toFixed(2)} €
                </p>
                {ssnShare > 0.005 && (
                  <p className="text-[9px] text-muted-foreground font-mono">di cui SSN {ssnShare.toFixed(2)} €</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CoassicurazioneImportiBreakdown;
