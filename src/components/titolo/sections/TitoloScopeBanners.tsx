import { Button } from "@/components/ui/button";
import { ShieldCheck, Info } from "lucide-react";

interface Props {
  t: any;
  isLocked: boolean;
  isQuietanzaCorrente: boolean;
  totRate: number;
  rataIndex: number;
  madre: any | null;
  onNavigateMadre: (id: string) => void;
}

/**
 * Banner di blocco (polizza chiusa) + banner scope quietanza/madre.
 * Estratti 1:1 da TitoloDetail.tsx.
 */
export function TitoloScopeBanners({ t, isLocked, isQuietanzaCorrente, totRate, rataIndex, madre, onNavigateMadre }: Props) {
  return (
    <>
      {isLocked && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            <strong>
              Quietanza{totRate > 1 ? ` (Rata ${rataIndex} di ${totRate})` : ""} {t.stato === "stornato" ? "stornata" : "messa a cassa"}
            </strong>{" "}
            — modifiche dirette bloccate (la polizza/contratto resta attiva).
            {t.stato === "incassato" && " Per riaprirla usa Annulla Incasso / Annulla Messa a Cassa."}
          </span>
        </div>
      )}


      {totRate > 1 && (
        isQuietanzaCorrente ? (
          <div className="rounded-md border border-sky-300 bg-sky-50 dark:bg-sky-950/20 px-3 py-2 text-sm text-sky-900 dark:text-sky-200 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Stai modificando la Rata {rataIndex} di {totRate}</strong>
              {t.garanzia_da ? <> · periodo {t.garanzia_da}{t.garanzia_a ? ` → ${t.garanzia_a}` : ""}</> : null}.
              <span className="ml-1">Le modifiche valgono solo per questa quietanza, non per la polizza madre o le altre rate.</span>
              {madre && madre.id !== t.id && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-1 h-auto text-sky-700 dark:text-sky-300"
                  onClick={() => onNavigateMadre(madre.id)}
                >
                  Vai alla polizza madre
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-sky-300 bg-sky-50 dark:bg-sky-950/20 px-3 py-2 text-sm text-sky-900 dark:text-sky-200 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong>Polizza madre</strong> — questa polizza ha {totRate} {totRate === 1 ? "quietanza" : "quietanze"}.
              Ogni quietanza ha premi e dati propri: le modifiche su questa pagina valgono solo per la madre.
            </div>
          </div>
        )
      )}
    </>
  );
}
