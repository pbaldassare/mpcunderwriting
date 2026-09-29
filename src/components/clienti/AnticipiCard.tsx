import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wallet, Trash2 } from "lucide-react";
import { useAnticipiCliente, statoAnticipo, useEliminaAnticipo, type Anticipo } from "@/hooks/useAnticipiCliente";
import NuovoAnticipoDialog from "./NuovoAnticipoDialog";
import AnticipoUtilizziDrawer from "./AnticipoUtilizziDrawer";
import { fmtEuro } from "@/lib/formatCurrency";

interface Props {
  clienteId: string;
}

const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString("it-IT"); } catch { return s; }
};

const StatoBadge = ({ a }: { a: Anticipo }) => {
  if (a.segno === "-") return <Badge variant="outline" className="border-red-300 text-red-700">Debito</Badge>;
  const s = statoAnticipo(a);
  if (s === "disponibile") return <Badge className="bg-green-600 hover:bg-green-700">Disponibile</Badge>;
  if (s === "parziale") return <Badge className="bg-amber-500 hover:bg-amber-600">Parziale</Badge>;
  return <Badge variant="secondary">Esaurito</Badge>;
};

export default function AnticipiCard({ clienteId }: Props) {
  const { data: anticipi = [], isLoading } = useAnticipiCliente(clienteId);
  const elimina = useEliminaAnticipo(clienteId);
  const [openNuovo, setOpenNuovo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const creditoDisponibile = anticipi
    .filter((a) => a.segno !== "-")
    .reduce((s, a) => s + Number(a.importo_residuo || 0), 0);
  const debitoDaCompensare = anticipi
    .filter((a) => a.segno === "-")
    .reduce((s, a) => s + Number(a.importo || 0), 0);
  const attivi = anticipi.filter((a) => a.segno === "-" || a.importo_residuo > 0);
  const esauriti = anticipi.filter((a) => a.segno !== "-" && a.importo_residuo <= 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Acconti e compensazioni</CardTitle>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpenNuovo(true)}>
          <Plus className="w-3 h-3 mr-1" /> Nuovo
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">Credito disponibile</div>
            <div className="text-xl font-semibold text-primary">{fmtEuro(creditoDisponibile)}</div>
          </div>
          <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">Debito da compensare</div>
            <div className={`text-xl font-semibold ${debitoDaCompensare > 0 ? "text-red-700" : "text-muted-foreground"}`}>
              {fmtEuro(debitoDaCompensare)}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Caricamento...</div>
        ) : anticipi.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-md">
            Nessuna partita registrata
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Conto</TableHead>
                  <TableHead className="text-xs text-right">Importo</TableHead>
                  <TableHead className="text-xs text-right">Residuo</TableHead>
                  <TableHead className="text-xs">Stato</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attivi.map((a, i) => (
                  <TableRow
                    key={a.id}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <TableCell className="text-xs">{fmtDate(a.data_anticipo)}</TableCell>
                    <TableCell className="text-xs truncate max-w-[120px]">{a.conto?.etichetta || "—"}</TableCell>
                    <TableCell className="text-xs text-right">{fmtEuro(a.importo)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmtEuro(a.importo_residuo)}</TableCell>
                    <TableCell><StatoBadge a={a} /></TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {a.importo_residuo === a.importo && (
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => {
                            if (confirm("Eliminare questo acconto?")) elimina.mutate(a.id);
                          }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {esauriti.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Storico acconti esauriti ({esauriti.length})
                </summary>
                <Table className="mt-2">
                  <TableBody>
                    {esauriti.map((a, i) => (
                      <TableRow key={a.id} className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                        onClick={() => setSelectedId(a.id)}>
                        <TableCell className="text-xs">{fmtDate(a.data_anticipo)}</TableCell>
                        <TableCell className="text-xs">{a.conto?.etichetta || "—"}</TableCell>
                        <TableCell className="text-xs text-right">{fmtEuro(a.importo)}</TableCell>
                        <TableCell><StatoBadge a={a} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </details>
            )}
          </>
        )}
      </CardContent>

      <NuovoAnticipoDialog open={openNuovo} onOpenChange={setOpenNuovo} clienteId={clienteId} />
      <AnticipoUtilizziDrawer anticipoId={selectedId} onClose={() => setSelectedId(null)} />
    </Card>
  );
}
