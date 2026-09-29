import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getTipoSinistroLabel } from "@/lib/tipiSinistro";
import { badgeClassStatoSinistro, isSinistroAperto, labelStatoSinistro } from "@/lib/sinistriStati";

export default function SinistriClienteTab({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!clienteId) return;
    const ch = supabase
      .channel(`sinistri-cliente-rt-${clienteId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri", filter: `cliente_anagrafica_id=eq.${clienteId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["sinistri-cliente", clienteId] });
          qc.invalidateQueries({ queryKey: ["cliente_related_ids", clienteId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clienteId, qc]);

  const { data: sinistri = [] } = useQuery({
    queryKey: ["sinistri-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, compagnie(nome), titoli(numero_titolo)")
        .eq("cliente_anagrafica_id", clienteId)
        .neq("stato", "archiviato")
        .order("data_apertura", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totaleRiserva = sinistri.reduce((s: number, x: any) => s + (x.importo_riserva || 0), 0);
  const totaleLiquidato = sinistri.reduce((s: number, x: any) => s + (x.importo_liquidato || 0), 0);
  const aperti = sinistri.filter((s: any) => isSinistroAperto(s.stato)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4" style={{ borderLeftColor: "#2563eb" }}>
          <CardContent className="pt-4"><p className="text-sm text-muted-foreground">Totale Sinistri</p><p className="text-2xl font-bold">{sinistri.length}</p></CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#ea580c" }}>
          <CardContent className="pt-4"><p className="text-sm text-muted-foreground">Aperti / In Lavorazione</p><p className="text-2xl font-bold text-orange-600">{aperti}</p></CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#dc2626" }}>
          <CardContent className="pt-4"><p className="text-sm text-muted-foreground">Riserva Totale</p><p className="text-2xl font-bold font-mono">€ {totaleRiserva.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: "#0d9488" }}>
          <CardContent className="pt-4"><p className="text-sm text-muted-foreground">Liquidato Totale</p><p className="text-2xl font-bold font-mono">€ {totaleLiquidato.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sinistri.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun sinistro collegato a questo cliente</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>N. Sinistro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Luogo</TableHead>
                  <TableHead className="text-right">Riserva €</TableHead>
                  <TableHead className="text-right">Liquidato €</TableHead>
                  <TableHead>Data Apertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sinistri.map((s: any, idx: number) => (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer hover:bg-accent/50 ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    onClick={() => navigate(`/sinistri/${s.id}`)}
                  >
                    <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                    <TableCell>{getTipoSinistroLabel(s.tipo_sinistro)}</TableCell>
                    <TableCell>{s.titoli?.numero_titolo || "—"}</TableCell>
                    <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                    <TableCell><Badge className={`text-[10px] px-2 py-0 ${badgeClassStatoSinistro(s.stato)}`}>{labelStatoSinistro(s.stato)}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.citta_sinistro || s.luogo_sinistro || "—"}</TableCell>
                    <TableCell className="font-mono text-right">{s.importo_riserva ? s.importo_riserva.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "—"}</TableCell>
                    <TableCell className="font-mono text-right text-emerald-700">{s.importo_liquidato ? s.importo_liquidato.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "—"}</TableCell>
                    <TableCell>{s.data_apertura ? format(new Date(s.data_apertura), "dd/MM/yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
