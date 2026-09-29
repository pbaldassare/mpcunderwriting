import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator } from "lucide-react";
import { useAbbuoniCliente } from "@/hooks/useAbbuoniCliente";
import { fmtEuro } from "@/lib/formatCurrency";

interface Props {
  clienteId: string;
}

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString("it-IT");
  } catch {
    return s;
  }
};

export default function AbbuoniChip({ clienteId }: Props) {
  const { data: rows = [], isLoading } = useAbbuoniCliente(clienteId);
  const [open, setOpen] = useState(false);

  const totaleAssoluto = rows.reduce((s, r) => s + Math.abs(Number(r.importo) || 0), 0);
  const netto =
    rows.reduce((s, r) => s + (r.segno === "+" ? Number(r.importo) || 0 : -(Number(r.importo) || 0)), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Abbuoni e arrotondamenti del cliente"
      >
        <Calculator className="w-4 h-4 text-primary" />
        <span>Abbuoni e arrotondamenti</span>
        <Badge variant="secondary" className="ml-1 font-semibold">{fmtEuro(totaleAssoluto)}</Badge>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" /> Abbuoni e arrotondamenti
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <div>
              <div className="text-xs text-muted-foreground">Totale applicato</div>
              <div className="text-xl font-semibold text-primary">{fmtEuro(totaleAssoluto)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Effetto netto sul dovuto</div>
              <div className={`text-sm font-semibold ${netto >= 0 ? "text-green-700" : "text-red-700"}`}>
                {netto >= 0 ? "− " : "+ "}
                {fmtEuro(Math.abs(netto))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Caricamento...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-md">
              Nessun abbuono o arrotondamento registrato
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Quietanza</TableHead>
                  <TableHead className="text-xs">Causale</TableHead>
                  <TableHead className="text-xs">Segno</TableHead>
                  <TableHead className="text-xs text-right">Importo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs font-mono">{r.numero_titolo || "—"}</TableCell>
                    <TableCell className="text-xs">
                      <span className="font-mono">{r.causale_codice}</span>
                      {r.causale_descrizione && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          {r.causale_descrizione}
                        </div>
                      )}
                      {r.note && (
                        <div className="text-[10px] text-muted-foreground italic truncate max-w-[180px]">
                          {r.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-xs font-mono font-bold ${r.segno === "+" ? "text-green-600" : "text-red-600"}`}
                      title={r.segno === "+" ? "Riduce dovuto cliente" : "Aumenta dovuto cliente"}
                    >
                      {r.segno}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmtEuro(r.importo)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
