import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BonificoAperto } from "@/lib/bonificoMatch";
import { formatDateIT } from "@/lib/formatDate";
import { ArrowRightLeft, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);

const statoLabel = (s: string) => {
  switch (s) {
    case "importato":
      return "Importato";
    case "matchato":
      return "Matchato";
    case "assegnato":
      return "Assegnato";
    default:
      return s;
  }
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bonifici: BonificoAperto[];
  loading?: boolean;
  sedeFilterActive?: boolean;
  /** Quietanze in elenco con almeno un suggerimento nome. */
  suggerimentiCount?: number;
  /** Testo search Incassi: elenco già ristretto ai bonifici collegati. */
  searchTerm?: string;
  /** Totale bonifici aperti prima del filtro search (per contesto). */
  totaleApertiCount?: number;
  onUsaPerIncasso?: (bonifico: BonificoAperto) => void;
};

/**
 * Pannello Bonifici aperti su Incassi.
 * Match alle quietanze: solo ordinante/descrizione ↔ cliente (non l'importo).
 */
export function IncassiBonificiPanel({
  open,
  onOpenChange,
  bonifici,
  loading,
  sedeFilterActive,
  suggerimentiCount = 0,
  searchTerm,
  totaleApertiCount,
  onUsaPerIncasso,
}: Props) {
  const [filterOrdinante, setFilterOrdinante] = useState("");
  const searchActive = !!searchTerm?.trim();

  const filtrati = useMemo(() => {
    const q = filterOrdinante.trim().toLowerCase();
    if (!q) return bonifici;
    return bonifici.filter((b) => {
      const hay = `${b.ordinante || ""} ${b.descrizione || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bonifici, filterOrdinante]);

  const totale = filtrati.reduce((s, b) => s + (Number(b.importo) || 0), 0);

  return (
    <div className={`rounded-lg border bg-card ${searchActive && bonifici.length > 0 ? "border-sky-300 ring-1 ring-sky-200/80" : ""}`}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors rounded-lg"
      >
        <div className="rounded-lg bg-sky-100 p-2.5 shrink-0">
          <ArrowRightLeft className="h-5 w-5 text-sky-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {searchActive ? "Bonifici collegati alla ricerca" : "Bonifici aperti"} ({bonifici.length})
            <span className="ml-2 font-normal text-muted-foreground">{fmtCurrency(totale)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {searchActive ? (
              <>
                Match con quietanze/clienti per «{searchTerm!.trim()}»
                {typeof totaleApertiCount === "number" && totaleApertiCount > bonifici.length && (
                  <span className="ml-1">· su {totaleApertiCount} aperti</span>
                )}
                . Solo ordinante ↔ cliente (non l&apos;importo).
              </>
            ) : (
              <>
                Ambito: {sedeFilterActive ? "conti delle sedi filtrate" : "tutti i conti abilitati"}.
                Il match alle quietanze usa solo ordinante ↔ cliente (non l&apos;importo).
              </>
            )}
            {suggerimentiCount > 0 && (
              <span className="ml-1 text-sky-700 font-medium">
                · {suggerimentiCount} quietanz{suggerimentiCount === 1 ? "a" : "e"} con suggerimento
              </span>
            )}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-3 pb-3 space-y-2">
          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filterOrdinante}
              onChange={(e) => setFilterOrdinante(e.target.value)}
              placeholder="Filtra per ordinante o descrizione…"
              className="h-8 pl-8 text-xs"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Caricamento bonifici…</p>
          ) : filtrati.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {bonifici.length === 0
                ? searchActive
                  ? "Nessun bonifico collegato a questa ricerca."
                  : `Nessun bonifico aperto${sedeFilterActive ? " per le sedi selezionate" : ""}.`
                : "Nessun bonifico corrisponde al filtro ordinante."}
            </p>
          ) : (
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ordinante</TableHead>
                    <TableHead>Conto</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    {onUsaPerIncasso && <TableHead className="w-[100px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrati.map((b) => (
                    <TableRow key={b.id} className={searchActive ? "bg-sky-50/60" : undefined}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateIT(b.data_movimento)}</TableCell>
                      <TableCell className="text-sm max-w-[280px]">
                        <div className="truncate font-medium" title={b.ordinante || undefined}>
                          {b.ordinante || "—"}
                        </div>
                        {b.descrizione && (
                          <div className="truncate text-xs text-muted-foreground" title={b.descrizione}>
                            {b.descrizione}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.conto_etichetta || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {statoLabel(b.stato)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{fmtCurrency(b.importo)}</TableCell>
                      {onUsaPerIncasso && (
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => onUsaPerIncasso(b)}
                          >
                            Usa
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            Storico bonifici già collegati:{" "}
            <Link
              to="/contabilita/caricamento-mov-bancari?tab=ricongiunti"
              className="text-sky-700 underline underline-offset-2 font-medium"
            >
              apri storico
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
