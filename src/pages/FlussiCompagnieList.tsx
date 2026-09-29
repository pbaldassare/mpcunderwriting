import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { useNavigate } from "react-router-dom";
import { Plus, FileCode, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

const statoBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  bozza: "secondary",
  pronto: "outline",
  inviato: "default",
  errore: "destructive",
};

const FlussiCompagnieList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [dialogOpen, setDialogOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");

  const [form, setForm] = useState({
    compagnia_id: "",
    tipo_flusso: "foglio_cassa",
    periodo: `${currentYear}-${currentMonth}`,
    formato: "xml",
  });

  const { data: compagnie } = useQuery({
    queryKey: ["compagnie_attive"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: flussi, isLoading } = useQuery({
    queryKey: ["flussi_compagnia", filtroStato],
    queryFn: async () => {
      let q = supabase
        .from("flussi_compagnia")
        .select("*, agenzie(nome), uffici(nome_ufficio), profiles(nome, cognome)")
        .order("created_at", { ascending: false });
      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const myUfficio = await supabase.rpc("get_my_ufficio_id");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("flussi_compagnia").insert([{
        compagnia_id: form.compagnia_id,
        ufficio_id: myUfficio.data,
        tipo_flusso: form.tipo_flusso,
        periodo: form.periodo,
        formato: form.formato,
        stato: "bozza",
        created_by: user?.id,
      }]).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data: any) => {
      await logAttivita({ azione: "creazione_flusso", entita_tipo: "flussi_compagnia", entita_id: data.id });
      queryClient.invalidateQueries({ queryKey: ["flussi_compagnia"] });
      setDialogOpen(false);
      toast.success("Flusso creato");
      navigate(`/flussi-agenzie/${data.id}`);
    },
    onError: () => toast.error("Errore", { description: "Impossibile creare il flusso" }),
  });

  const totali = {
    bozza: flussi?.filter((f: any) => f.stato === "bozza").length || 0,
    pronto: flussi?.filter((f: any) => f.stato === "pronto").length || 0,
    inviato: flussi?.filter((f: any) => f.stato === "inviato").length || 0,
    errore: flussi?.filter((f: any) => f.stato === "errore").length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flussi Agenzie</h1>
          <p className="text-muted-foreground">Invio reportistica e foglio cassa alle agenzie</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Flusso</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo Flusso Agenzia</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Agenzia</Label>
                <Select value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona agenzia" /></SelectTrigger>
                  <SelectContent>
                    {compagnie?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo Flusso</Label>
                  <Select value={form.tipo_flusso} onValueChange={(v) => setForm({ ...form, tipo_flusso: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="foglio_cassa">Foglio Cassa</SelectItem>
                      <SelectItem value="reportistica">Reportistica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Formato</Label>
                  <Select value={form.formato} onValueChange={(v) => setForm({ ...form, formato: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xml">XML</SelectItem>
                      <SelectItem value="api">API (JSON)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Periodo (YYYY-MM)</Label>
                <Input value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} placeholder="2026-01" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.compagnia_id || !form.periodo} className="w-full">
                Crea Flusso
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Clock className="w-8 h-8 text-muted-foreground" />
          <div><p className="text-2xl font-bold">{totali.bozza}</p><p className="text-xs text-muted-foreground">Bozze</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <FileCode className="w-8 h-8 text-primary" />
          <div><p className="text-2xl font-bold">{totali.pronto}</p><p className="text-xs text-muted-foreground">Pronti</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <div><p className="text-2xl font-bold">{totali.inviato}</p><p className="text-xs text-muted-foreground">Inviati</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <div><p className="text-2xl font-bold">{totali.errore}</p><p className="text-xs text-muted-foreground">Errori</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <Select value={filtroStato} onValueChange={setFiltroStato}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli stati</SelectItem>
              <SelectItem value="bozza">Bozza</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="inviato">Inviato</SelectItem>
              <SelectItem value="errore">Errore</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Lista Flussi</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agenzia</TableHead>
                <TableHead>Sede</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Creato il</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : !flussi?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun flusso trovato</TableCell></TableRow>
              ) : flussi.map((f: any) => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/flussi-agenzie/${f.id}`)}>
                  <TableCell className="font-medium">{f.compagnie?.nome || "-"}</TableCell>
                  <TableCell>{f.uffici?.nome_ufficio || "-"}</TableCell>
                  <TableCell className="capitalize">{f.tipo_flusso?.replace("_", " ")}</TableCell>
                  <TableCell>{f.periodo}</TableCell>
                  <TableCell className="uppercase">{f.formato}</TableCell>
                  <TableCell><Badge variant={statoBadge[f.stato] || "secondary"} className="capitalize">{f.stato}</Badge></TableCell>
                  <TableCell>{format(new Date(f.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FlussiCompagnieList;
