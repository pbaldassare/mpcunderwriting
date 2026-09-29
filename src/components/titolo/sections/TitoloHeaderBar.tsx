import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Clock, FilePen, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { calcLordoQuietanzaTitolo } from "@/lib/premiGaranziaLoad";
import { labelCompagniaEAgenzia } from "@/lib/compagniaDisplay";
import { fmtEuro } from "@/lib/formatCurrency";
import { appendiceTipoLabel, isAppendice } from "@/lib/quietanze";

interface MadreInfo {
  id: string;
  numero_titolo?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  rataLabel?: string | null;
}

interface Props {
  t: any;
  onBack: () => void;
  /** Quietanza madre collegata a una regolazione (RG). */
  madre?: MadreInfo | null;
  /** Polizza madre della catena quando il titolo corrente è quietanza o appendice. */
  polizzaMadre?: MadreInfo | null;
  /** Titolo corrente è una quietanza (sostituisce_polizza valorizzato). */
  isQuietanzaCorrente?: boolean;
  /** Stato della polizza (tabella `polizze`). Nel nuovo modello la polizza non viene mai messa a cassa. */
  polizzaStato?: string | null;
  /** Indice della rata corrente nella catena (1-based). */
  rataIndex?: number;
  /** Numero totale di rate della catena. */
  totRate?: number;
  /** Apre la modifica dell'importo firma (solo polizza originale). */
  onEditImportoFirma?: () => void;
  /** Pulsante Documenti (popup) in alto a destra. */
  documentiAction?: ReactNode;
}

/**
 * Header sticky del dettaglio titolo.
 * Distingue polizza madre, quietanza, appendice modifica, proroga, regolazione.
 */
export function TitoloHeaderBar({
  t,
  onBack,
  madre,
  polizzaMadre,
  isQuietanzaCorrente,
  polizzaStato,
  rataIndex,
  totRate,
  onEditImportoFirma,
  documentiAction,
}: Props) {
  const isRegolazione = !!t.is_regolazione;
  const isProroga = !!t.is_proroga;
  const isAppendiceModifica = !!t.is_appendice_modifica;
  const isAppendiceTitolo = isAppendice(t);
  const appendiceSub = appendiceTipoLabel(t);
  const isQuietanza = !!isQuietanzaCorrente && !isAppendiceTitolo;
  const fmtD = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy", { locale: it }) : "");
  const rataLbl = isQuietanza
    ? rataIndex && totRate && totRate > 1
      ? `Rata ${rataIndex}/${totRate}`
      : "Rata unica"
    : "";
  const rataHeader = isQuietanza
    ? rataIndex && totRate && totRate > 1
      ? `Rata ${rataIndex}/${totRate}`
      : totRate === 1
        ? "Rata unica"
        : rataIndex
          ? `Rata ${rataIndex}/${totRate ?? 1}`
          : ""
    : "";
  const periodoGaranzia = t.garanzia_da
    ? `${fmtD(t.garanzia_da)}${t.garanzia_a ? ` → ${fmtD(t.garanzia_a)}` : ""}`
    : "";
  const importoLordo = isQuietanza
    ? calcLordoQuietanzaTitolo(t)
    : Number((t as any).premio_lordo ?? 0);
  const importoLabel = isQuietanza
    ? "Importo Rata"
    : isAppendiceTitolo
      ? "Importo Appendice"
      : "Importo Firma";

  const numeroDisplay = t.numero_titolo || t.id.slice(0, 8);
  const statoContrattoLabel = isAppendiceTitolo
    ? "Appendice"
    : isQuietanza
      ? "Quietanza"
      : "Polizza";

  return (
    <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {isProroga ? (
                <>Proroga {numeroDisplay}</>
              ) : isRegolazione ? (
                <>Regolazione {numeroDisplay}</>
              ) : isAppendiceModifica ? (
                <>Appendice {numeroDisplay}</>
              ) : isQuietanza ? (
                <>
                  Quietanza
                  {rataHeader ? ` · ${rataHeader}` : ""}
                  {periodoGaranzia ? ` · ${periodoGaranzia}` : ""}
                </>
              ) : (
                <>Polizza {numeroDisplay}</>
              )}
            </h1>
            {isProroga ? (
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white" title="Titolo di proroga">
                <Clock className="w-3 h-3 mr-1" /> Proroga
              </Badge>
            ) : isRegolazione ? (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">
                <RefreshCw className="w-3 h-3 mr-1" /> Regolazione
              </Badge>
            ) : isAppendiceModifica ? (
              <Badge
                className="bg-appendice text-appendice-foreground border border-appendice/30 hover:bg-appendice"
                title="Appendice di modifica"
              >
                <FilePen className="w-3 h-3 mr-1" />
                {appendiceSub ? `Appendice ${appendiceSub}` : "Appendice"}
              </Badge>
            ) : isQuietanza ? null : (
              <Badge variant="outline">Polizza originale</Badge>
            )}
            {!isRegolazione && !isProroga && !isQuietanza && !isAppendiceModifica && t.coassicurazione && (
              <Badge className="bg-teal-600 hover:bg-teal-700 text-white" title="Premio ripartito tra più compagnie">
                Coassicurazione
              </Badge>
            )}
            {!!t.emittenda && (
              <Badge variant="outline" title="Polizza emittenda: N° modificabile anche dopo messa a cassa">
                Emittenda
              </Badge>
            )}
          </div>

          {isQuietanza && (
            <p className="text-sm mt-0.5">
              <span className="text-muted-foreground">Polizza n° </span>
              {polizzaMadre?.id ? (
                <Link
                  to={`/titoli/${polizzaMadre.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {polizzaMadre.numero_titolo || t.numero_titolo || "—"}
                </Link>
              ) : (
                <span className="text-muted-foreground">{t.numero_titolo || "—"}</span>
              )}
            </p>
          )}

          {isAppendiceTitolo && !isProroga && !isRegolazione && polizzaMadre?.id && (
            <p className="text-sm mt-0.5">
              <span className="text-muted-foreground">Appendice della polizza </span>
              <Link
                to={`/titoli/${polizzaMadre.id}`}
                className="font-medium text-primary hover:underline"
              >
                {polizzaMadre.numero_titolo || "—"}
              </Link>
            </p>
          )}

          {isProroga && madre && (
            <p className="text-sm mt-0.5">
              <span className="text-muted-foreground">Proroga di </span>
              <Link
                to={`/titoli/${madre.id}`}
                className="font-medium text-blue-700 hover:text-blue-800 hover:underline"
              >
                {madre.numero_titolo || "polizza"}
              </Link>
            </p>
          )}

          {isRegolazione && madre && (
            <p className="text-sm mt-0.5">
              <span className="text-muted-foreground">Collegata a </span>
              <Link
                to={`/titoli/${madre.id}`}
                className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
              >
                {madre.numero_titolo || "polizza"}
                {madre.rataLabel ? ` · ${madre.rataLabel}` : ""}
                {madre.garanzia_da ? ` (${fmtD(madre.garanzia_da)}${madre.garanzia_a ? ` → ${fmtD(madre.garanzia_a)}` : ""})` : ""}
              </Link>
            </p>
          )}

          <p className="text-muted-foreground text-sm">
            {(t as any).prodotto_nome || t.prodotti?.nome_prodotto || ""}
            {((t as any).prodotto_nome || t.prodotti?.nome_prodotto) ? " — " : ""}
            {labelCompagniaEAgenzia(t as any) || "N/D"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Cliente:</span>
              <span className="font-medium text-foreground">
                {t.cliente_anagrafica
                  ? ((t.cliente_anagrafica as any).tipo_cliente === "privato"
                    ? `${(t.cliente_anagrafica as any).cognome || ""} ${(t.cliente_anagrafica as any).nome || ""}`.trim() || "—"
                    : (t.cliente_anagrafica as any).ragione_sociale || "—")
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Sede:</span>
              <span className="font-medium text-foreground">{(t as any).uffici?.nome_ufficio || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{importoLabel}:</span>
              <span className="font-semibold text-teal-700 tabular-nums">{fmtEuro(importoLordo)}</span>
              {importoLabel === "Importo Firma" && onEditImportoFirma && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={onEditImportoFirma}
                  title="Modifica importo firma"
                  aria-label="Modifica importo firma"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {t.stato === "in_attesa_rinnovo" ? (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {documentiAction}
            <Badge className="text-sm bg-orange-500 hover:bg-orange-600 text-white" title="Diventerà attivo quando la polizza precedente sarà messa a cassa">
              In attesa rinnovo
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-2 shrink-0">
            {documentiAction}
            {polizzaStato && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{statoContrattoLabel}</span>
                <Badge
                  variant={polizzaStato === "attiva" ? "default" : polizzaStato === "annullata" ? "destructive" : "secondary"}
                  className={`text-xs ${polizzaStato === "attiva" ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}`}
                  title={isAppendiceTitolo ? "Stato contratto collegato" : "Stato del contratto (tabella polizze)"}
                >
                  {polizzaStato}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {isQuietanza && rataLbl ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{rataLbl}</span>
              ) : null}
              <Badge
                variant={t.stato === "incassato" ? "default" : t.stato === "stornato" ? "destructive" : "secondary"}
                className="text-xs"
                title={
                  isQuietanza
                    ? "Stato della quietanza (rata)"
                    : isAppendiceTitolo
                      ? "Stato dell'appendice"
                      : "Stato del titolo"
                }
              >
                {t.stato}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
