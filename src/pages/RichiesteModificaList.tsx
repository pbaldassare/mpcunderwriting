import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Clock, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statoBadge = (s: string) => {
  if (s === "in_attesa") return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />In attesa</Badge>;
  if (s === "approvata") return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Approvata</Badge>;
  if (s === "rifiutata") return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rifiutata</Badge>;
  return <Badge variant="outline">{s}</Badge>;
};

const RichiesteModificaList = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("richieste_modifica_cliente")
      .select("*, clienti(ragione_sociale)")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (approva: boolean) => {
    if (!selected || !user) return;
    setBusy(true);
    try {
      if (approva) {
        // applica modifica
        const upd: any = {};
        upd[selected.campo] = selected.valore_proposto;
        const { error: e1 } = await supabase.from("clienti").update(upd).eq("id", selected.cliente_id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase
        .from("richieste_modifica_cliente")
        .update({
          stato: approva ? "approvata" : "rifiutata",
          note_agenzia: note || null,
          gestita_da: user.id,
          gestita_il: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (e2) throw e2;
      toast.success(approva ? "Richiesta approvata e dato aggiornato" : "Richiesta rifiutata");
      setSelected(null);
      setNote("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      setBusy(false);
    }
  };

  const pendenti = items.filter(i => i.stato === "in_attesa").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Pencil className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Richieste di modifica anagrafica</h1>
          <p className="text-sm text-muted-foreground">{pendenti} in attesa · {items.length} totali</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Elenco</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Caricamento...</p>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nessuna richiesta</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Valore attuale</TableHead>
                  <TableHead>Valore richiesto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r, i) => (
                  <TableRow key={r.id} className={i % 2 ? "bg-muted/20" : ""}>
                    <TableCell className="font-medium">{r.clienti?.ragione_sociale || "—"}</TableCell>
                    <TableCell>{r.campo_label || r.campo}</TableCell>
                    <TableCell className="text-muted-foreground line-through max-w-[180px] truncate">{r.valore_attuale || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{r.valore_proposto}</TableCell>
                    <TableCell>{statoBadge(r.stato)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      {r.stato === "in_attesa" && (
                        <Button size="sm" variant="outline" onClick={() => { setSelected(r); setNote(""); }}>
                          Gestisci
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestione richiesta modifica</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Cliente:</strong> {selected.clienti?.ragione_sociale}</div>
              <div><strong>Campo:</strong> {selected.campo_label || selected.campo}</div>
              <div className="bg-muted/50 p-2 rounded">
                <div className="text-xs text-muted-foreground">Attuale</div>
                <div className="line-through">{selected.valore_attuale || "—"}</div>
                <div className="text-xs text-muted-foreground mt-2">Richiesto</div>
                <div className="font-medium">{selected.valore_proposto}</div>
              </div>
              {selected.motivazione && (
                <div className="text-xs italic text-muted-foreground">Motivazione cliente: {selected.motivazione}</div>
              )}
              <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs">
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                Approvando, il valore verrà scritto direttamente nel record cliente.
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Note (opzionale, obbligatorio se rifiuti)</label>
                <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Chiudi</Button>
            <Button variant="destructive" onClick={() => decide(false)} disabled={busy || !note.trim()}>
              <XCircle className="h-4 w-4 mr-1" />Rifiuta
            </Button>
            <Button onClick={() => decide(true)} disabled={busy}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Approva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RichiesteModificaList;
