import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { List, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtEuro } from "@/lib/formatCurrency";

interface Props {
  t: any;
  totRate: number;
  catena: { all: any[]; rate: any[] } | null;
  onNavigate: (id: string) => void;
}

/**
 * Collapsible "Quietanze di questa polizza" — tabella di tutte le rate
 * della catena della polizza corrente. Estratto 1:1 da TitoloDetail.tsx.
 */
export function TitoloQuietanzePanel({ t, totRate, catena, onNavigate }: Props) {
  if (!(totRate > 1 && catena)) return null;
  return (
    <Collapsible defaultOpen={false}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/40">
            <CardTitle className="text-sm flex items-center gap-2">
              <List className="w-4 h-4" /> Quietanze di questa polizza ({totRate})
              <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Tipo</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Premio Lordo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Messa a Cassa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catena.all.map((r: any) => {
                  const isCurrent = r.id === t.id;
                  const rateIdx = catena.rate.findIndex((x) => x.id === r.id);
                  return (
                    <TableRow
                      key={r.id}
                      className={cn("cursor-pointer", isCurrent ? "bg-primary/10 hover:bg-primary/15 font-semibold" : "hover:bg-muted/40")}
                      onClick={() => !isCurrent && onNavigate(r.id)}
                    >
                      <TableCell>
                        {!r.sostituisce_polizza ? (
                          <Badge variant="outline">Polizza</Badge>
                        ) : (
                          <Badge variant="secondary">Rata {rateIdx + 1}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.garanzia_da || "—"} {r.garanzia_a ? `→ ${r.garanzia_a}` : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmtEuro(r.premio_lordo)}</TableCell>
                      <TableCell>
                        <Badge variant={r.stato === "incassato" ? "default" : r.stato === "stornato" ? "destructive" : "secondary"}>{r.stato}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.data_messa_cassa || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground mt-2">
              Ogni rata è un record indipendente: cliccala per aprirla. Salvataggi e modifiche valgono solo per la rata aperta.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
