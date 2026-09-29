import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { useCfoFilters } from "@/hooks/useCfoFilters";
import { callCfoRpc } from "@/hooks/useCfoRpc";
import { Link } from "react-router-dom";

export interface DrillFilters {
  compagniaId?: string;
  produttoreNome?: string;
  ramo?: string;
  mese?: string;
  label?: string;
}

interface DrillRow {
  id: string;
  numero_titolo: string;
  data_incasso: string;
  cliente: string;
  ramo: string;
  compagnia: string;
  sede: string;
  produttore: string;
  premio_lordo: number;
  importo_incassato: number;
  provvigioni: number;
  stato: string;
}

interface CfoDrillTableProps {
  drill: DrillFilters | null;
  onClose: () => void;
}

export function CfoDrillTable({ drill, onClose }: CfoDrillTableProps) {
  const { rpcParams } = useCfoFilters();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cfo-drill-titoli", rpcParams, drill],
    enabled: !!drill,
    queryFn: async () => {
      const params: Record<string, unknown> = { ...rpcParams };
      if (drill?.compagniaId) params._compagnia_id = drill.compagniaId;
      if (drill?.produttoreNome) params._produttore_nome = drill.produttoreNome;
      if (drill?.ramo) params._ramo = drill.ramo;
      if (drill?.mese) params._mese = drill.mese;
      const data = await callCfoRpc<DrillRow[]>("cfo_drill_titoli", params);
      return Array.isArray(data) ? data : [];
    },
  });

  if (!drill) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Dettaglio titoli{drill.label ? `: ${drill.label}` : ""}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table containerClassName="max-h-[420px]">
            <TableHeader>
              <TableRow>
                <TableHead>N. Titolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Ramo</TableHead>
                <TableHead>Produttore</TableHead>
                <TableHead className="text-right">Incassato</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Caricamento...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nessun titolo nel drill-down selezionato
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/titoli/${r.id}`} className="text-primary hover:underline font-medium">
                      {r.numero_titolo}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.cliente}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.compagnia}</TableCell>
                  <TableCell className="max-w-[100px] truncate">{r.ramo}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{r.produttore}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtEuro(r.importo_incassato)}</TableCell>
                  <TableCell>
                    {r.data_incasso ? format(new Date(r.data_incasso), "dd/MM/yyyy") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        {!isLoading && rows.length > 0 && (
          <p className="text-xs text-muted-foreground px-4 py-2 border-t">
            {rows.length} titoli · max 500 righe
          </p>
        )}
      </CardContent>
    </Card>
  );
}
