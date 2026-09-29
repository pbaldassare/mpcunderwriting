import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Link2, Plus } from "lucide-react";
import { toast } from "sonner";

const AnomalieKO = () => {
  const queryClient = useQueryClient();
  const { user, profile, isAdmin } = useAuth();

  const [filtroUfficio, setFiltroUfficio] = useState("all");
  const [filtroStato, setFiltroStato] = useState("ko");
  const [associaDialog, setAssociaDialog] = useState<any>(null);
  const [verificaDialog, setVerificaDialog] = useState<any>(null);
  const [creaMovDialog, setCreaMovDialog] = useState<any>(null);
  const [note, setNote] = useState("");
  const [selectedMovId, setSelectedMovId] = useState("");
  const [movTipo, setMovTipo] = useState("entrata");
  const [movCategoria, setMovCategoria] = useState("");

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: anomalie = [] } = useQuery({
    queryKey: ["anomalie_ko", filtroUfficio, filtroStato],
    queryFn: async () => {
      let query = supabase
        .from("incroci_bancari")
        .select("*, estratti_conto!inner(*, uffici(nome_ufficio)), movimenti_contabili(importo, descrizione, data_movimento)")
        .order("created_at", { ascending: false });

      if (filtroStato !== "all") query = query.eq("esito", filtroStato);
      if (filtroUfficio !== "all") query = query.eq("estratti_conto.ufficio_id", filtroUfficio);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: movimentiDisponibili = [] } = useQuery({
    queryKey: ["movimenti_per_associazione"],
    queryFn: async () => {
      const { data, error } = await supabase.from("movimenti_contabili").select("*").eq("stato", "registrato").order("data_movimento", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!associaDialog,
  });

  const associaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMovId || !associaDialog) throw new Error("Seleziona un movimento");

      // Update incrocio
      const { error: updErr } = await supabase.from("incroci_bancari").update({
        movimento_id: selectedMovId,
        esito: "ok",
        verificato: true,
        note: note || "Associazione manuale",
        matching_metodo: "manuale",
      }).eq("id", associaDialog.id);
      if (updErr) throw updErr;

      // Update estratto stato
      await supabase.from("estratti_conto").update({ stato: "ok" }).eq("id", associaDialog.estratto_id);

      // Update movimento stato
      await supabase.from("movimenti_contabili").update({ stato: "verificato" }).eq("id", selectedMovId);

      await logAttivita({
        azione: "associazione_manuale",
        entita_tipo: "incrocio_bancario",
        entita_id: associaDialog.id,
        dettagli_json: { movimento_id: selectedMovId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalie_ko"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti_contabili"] });
      queryClient.invalidateQueries({ queryKey: ["estratti_conto"] });
      setAssociaDialog(null);
      setSelectedMovId("");
      setNote("");
      toast.success("Associazione completata");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const verificaMutation = useMutation({
    mutationFn: async () => {
      if (!verificaDialog || !note) throw new Error("Note obbligatorie");

      await supabase.from("incroci_bancari").update({
        verificato: true,
        note,
      }).eq("id", verificaDialog.id);

      await supabase.from("estratti_conto").update({ stato: "ok" }).eq("id", verificaDialog.estratto_id);

      await logAttivita({
        azione: "anomalia_risolta",
        entita_tipo: "incrocio_bancario",
        entita_id: verificaDialog.id,
        dettagli_json: { note },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalie_ko"] });
      setVerificaDialog(null);
      setNote("");
      toast.success("Anomalia risolta");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const creaMovMutation = useMutation({
    mutationFn: async () => {
      if (!creaMovDialog) return;
      const estratto = creaMovDialog.estratti_conto;

      const { data: mov, error: movErr } = await supabase.from("movimenti_contabili").insert({
        ufficio_id: estratto.ufficio_id,
        tipo: movTipo,
        categoria: movCategoria || null,
        importo: Math.abs(estratto.importo),
        data_movimento: estratto.data_operazione,
        descrizione: estratto.descrizione || "Creato da estratto conto",
        created_by: user?.id,
        riferimento_tipo: "estratto_conto",
      }).select().single();
      if (movErr) throw movErr;

      // Update incrocio
      await supabase.from("incroci_bancari").update({
        movimento_id: mov.id,
        esito: "ok",
        verificato: true,
        matching_metodo: "manuale_creazione",
      }).eq("id", creaMovDialog.id);

      await supabase.from("estratti_conto").update({ stato: "ok" }).eq("id", creaMovDialog.estratto_id);

      await logAttivita({
        azione: "creazione_movimento_da_estratto",
        entita_tipo: "movimento_contabile",
        entita_id: mov.id,
        dettagli_json: { estratto_id: creaMovDialog.estratto_id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalie_ko"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti_contabili"] });
      setCreaMovDialog(null);
      setMovTipo("entrata");
      setMovCategoria("");
      toast.success("Movimento creato e anomalia risolta");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Incroci / Anomalie KO</h1>
        <p className="text-muted-foreground">Gestisci le righe bancarie non riconciliate</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sede" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {uffici.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="ko">Solo KO</SelectItem>
            <SelectItem value="ok">Solo OK</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Anomalies table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Esito</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalie.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>{a.estratti_conto?.data_operazione}</TableCell>
                  <TableCell className="max-w-[250px] truncate">{a.estratti_conto?.descrizione || "—"}</TableCell>
                  <TableCell className="font-mono">€ {a.estratti_conto?.importo?.toFixed(2)}</TableCell>
                  <TableCell>{a.matching_score != null ? `${a.matching_score}%` : "—"}</TableCell>
                  <TableCell><Badge variant="outline">{a.matching_metodo || "—"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={a.esito === "ok" ? "default" : "destructive"}>
                      {a.esito === "ok" ? <><CheckCircle className="w-3 h-3 mr-1" />OK</> : <><AlertTriangle className="w-3 h-3 mr-1" />KO</>}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.esito === "ko" && !a.verificato && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setAssociaDialog(a)} title="Associa manualmente">
                          <Link2 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setVerificaDialog(a); setNote(""); }} title="Segna verificato">
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCreaMovDialog(a)} title="Crea movimento">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {a.verificato && <Badge variant="outline">Verificato</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {anomalie.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nessuna anomalia</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Associa Dialog */}
      <Dialog open={!!associaDialog} onOpenChange={(open) => !open && setAssociaDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Associa Manualmente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <strong>Estratto:</strong> € {associaDialog?.estratti_conto?.importo?.toFixed(2)} - {associaDialog?.estratti_conto?.descrizione || "—"}
            </div>
            <div>
              <Label>Seleziona Movimento</Label>
              <Select value={selectedMovId} onValueChange={setSelectedMovId}>
                <SelectTrigger><SelectValue placeholder="Scegli movimento..." /></SelectTrigger>
                <SelectContent>
                  {movimentiDisponibili.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      € {m.importo?.toFixed(2)} - {m.data_movimento} - {m.descrizione?.substring(0, 40) || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button onClick={() => associaMutation.mutate()} disabled={!selectedMovId || associaMutation.isPending} className="w-full">Associa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verifica Dialog */}
      <Dialog open={!!verificaDialog} onOpenChange={(open) => !open && setVerificaDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Segna come Verificato</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Note (obbligatorie) *</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo della verifica manuale..." /></div>
            <Button onClick={() => verificaMutation.mutate()} disabled={!note || verificaMutation.isPending} className="w-full">Segna Verificato</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crea Movimento Dialog */}
      <Dialog open={!!creaMovDialog} onOpenChange={(open) => !open && setCreaMovDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crea Movimento da Riga</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <strong>Importo:</strong> € {creaMovDialog?.estratti_conto?.importo?.toFixed(2)}<br />
              <strong>Data:</strong> {creaMovDialog?.estratti_conto?.data_operazione}<br />
              <strong>Descrizione:</strong> {creaMovDialog?.estratti_conto?.descrizione || "—"}
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={movTipo} onValueChange={setMovTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="entrata">Entrata</SelectItem><SelectItem value="uscita">Uscita</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Categoria</Label><Input value={movCategoria} onChange={(e) => setMovCategoria(e.target.value)} placeholder="es. premio, rimborso..." /></div>
            <Button onClick={() => creaMovMutation.mutate()} disabled={creaMovMutation.isPending} className="w-full">Crea Movimento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnomalieKO;
