import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  if (s === "rimborsato") return <Badge variant="secondary">Rimborsato</Badge>;
  return <Badge variant="secondary">Esaurito</Badge>;
};

export default function AnticipiChip({ clienteId }: Props) {
  const { data: anticipi = [], isLoading } = useAnticipiCliente(clienteId);
  const elimina = useEliminaAnticipo(clienteId);
  const [open, setOpen] = useState(false);
  const [openNuovo, setOpenNuovo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const crediti = anticipi.filter((a) => a.segno !== "-");
  const debiti = anticipi.filter((a) => a.segno === "-");
  const creditoDisponibile = crediti.reduce((s, a) => s + Number(a.importo_residuo || 0), 0);
  const debitoDaCompensare = debiti.reduce((s, a) => s + Number(a.importo || 0), 0);
  const attivi = anticipi.filter((a) => a.segno === "-" || a.importo_residuo > 0);
  const esauriti = anticipi.filter((a) => a.segno !== "-" && a.importo_residuo <= 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Acconti e compensazioni del cliente"
      >
        <Wallet className="w-4 h-4 text-primary" />
        <span>Acconti e compensazioni</span>
        <Badge variant="secondary" className="ml-1 font-semibold text-primary">
          {fmtEuro(creditoDisponibile)}
        </Badge>
        {debitoDaCompensare > 0 && (
          <Badge variant="outline" className="ml-0.5 font-semibold border-red-300 text-red-700">
            −{fmtEuro(debitoDaCompensare)}
          </Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> Acconti e compensazioni
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <div className="grid grid-cols-2 gap-4 flex-1 min-w-0">
              <div>
                <div className="text-xs text-muted-foreground">Credito disponibile</div>
                <div className="text-xl font-semibold text-primary">{fmtEuro(creditoDisponibile)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Debito da compensare</div>
                <div className={`text-xl font-semibold ${debitoDaCompensare > 0 ? "text-red-700" : "text-muted-foreground"}`}>
                  {fmtEuro(debitoDaCompensare)}
                </div>
              </div>
            </div>
            <Button size="sm" onClick={() => setOpenNuovo(true)}>
              <Plus className="w-3 h-3 mr-1" /> Nuovo
            </Button>
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
                    <TableHead className="text-xs">Causale</TableHead>
                    <TableHead className="text-xs">Segno</TableHead>
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
                      <TableCell className="text-xs">
                        <span className="font-mono">{a.causale?.codice || "—"}</span>
                        {a.causale?.descrizione && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{a.causale.descrizione}</div>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs font-mono font-bold ${a.segno === "-" ? "text-red-600" : "text-green-600"}`}>
                        {a.segno || "+"}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]">{a.conto?.etichetta || "—"}</TableCell>
                      <TableCell className="text-xs text-right">{fmtEuro(a.importo)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {a.segno === "-" ? "—" : fmtEuro(a.importo_residuo)}
                      </TableCell>
                      <TableCell><StatoBadge a={a} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(a.segno === "-" || a.importo_residuo === a.importo) && (
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => {
                              if (confirm("Eliminare questa partita?")) elimina.mutate(a.id);
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
                    Storico crediti esauriti ({esauriti.length})
                  </summary>
                  <Table className="mt-2">
                    <TableBody>
                      {esauriti.map((a, i) => (
                        <TableRow key={a.id} className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                          onClick={() => setSelectedId(a.id)}>
                          <TableCell className="text-xs">{fmtDate(a.data_anticipo)}</TableCell>
                          <TableCell className="text-xs font-mono">{a.causale?.codice || "—"}</TableCell>
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
        </DialogContent>
      </Dialog>

      <NuovoAnticipoDialog open={openNuovo} onOpenChange={setOpenNuovo} clienteId={clienteId} />
      <AnticipoUtilizziDrawer anticipoId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
