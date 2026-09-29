import { useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
const statiSpedizione = ["preparata", "spedita", "consegnata", "problema"];

const SpedizioniList = () => {
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("all");
  const { page, setPage, pageSize, range } = useServerPagination(25, [filtroStato]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [newStato, setNewStato] = useState("");
  const [newTracking, setNewTracking] = useState("");

  const { data: result, isLoading } = useQuery({
    queryKey: ["spedizioni_cartacee", page, filtroStato],
    queryFn: async () => {
      let q = supabase
        .from("spedizioni_cartacee")
        .select("*, uffici(nome_ufficio), note_restituzione(id, cliente:profiles!note_restituzione_cliente_id_fkey(nome, cognome))", { count: "exact" });

      if (filtroStato !== "all") q = q.eq("stato", filtroStato);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const spedizioni = result?.data || [];
  const totalCount = result?.count || 0;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {};
      if (newStato && newStato !== selected.stato) updates.stato = newStato;
      if (newTracking) updates.tracking_code = newTracking;
      if (Object.keys(updates).length === 0) return;
      const { error } = await supabase.from("spedizioni_cartacee").update(updates).eq("id", selected.id);
      if (error) throw error;
      if (updates.stato) {
        await logAttivita({ azione: "cambio_stato_spedizione", entita_tipo: "spedizione", entita_id: selected.id, dettagli_json: { da: selected.stato, a: updates.stato } });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spedizioni_cartacee"] });
      setDetailOpen(false);
      toast.success("Spedizione aggiornata");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const statoBadge = (s: string) => {
    switch (s) { case "spedita": return "default"; case "consegnata": return "secondary"; case "problema": return "destructive"; default: return "outline"; }
  };

  const openDetail = (s: any) => {
    setSelected(s);
    setNewStato(s.stato);
    setNewTracking(s.tracking_code || "");
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Spedizioni Cartacee</h1>
        <p className="text-muted-foreground">Tracking e gestione spedizioni documenti</p>
      </div>

      <div className="flex gap-4">
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiSpedizione.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" />Spedizioni ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Corriere</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spedizioni.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => openDetail(s)}>
                      <TableCell>{s.tipo_spedizione}</TableCell>
                      <TableCell>{s.uffici?.nome_ufficio || "—"}</TableCell>
                      <TableCell>{s.corriere || "—"}</TableCell>
                      <TableCell className="font-mono">{s.tracking_code || "—"}</TableCell>
                      <TableCell>{s.data_spedizione}</TableCell>
                      <TableCell><Badge variant={statoBadge(s.stato)}>{s.stato}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {spedizioni.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nessuna spedizione</TableCell></TableRow>}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dettaglio Spedizione</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Tipo:</span> {selected.tipo_spedizione}</div>
                <div><span className="text-muted-foreground">Data:</span> {selected.data_spedizione}</div>
                <div><span className="text-muted-foreground">Corriere:</span> {selected.corriere || "—"}</div>
                <div><span className="text-muted-foreground">Sede:</span> {selected.uffici?.nome_ufficio || "—"}</div>
              </div>
              <div>
                <Label>Tracking Code</Label>
                <Input value={newTracking} onChange={(e) => setNewTracking(e.target.value)} />
              </div>
              <div>
                <Label>Stato</Label>
                <Select value={newStato} onValueChange={setNewStato}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statiSpedizione.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full">Salva Modifiche</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpedizioniList;
