import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Clock, Package, Plus, Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import DocumentiTab from "@/components/DocumentiTab";

const FLAG_LABELS: Record<string, string> = {
  libretto: "Libretto",
  quietanza: "Quietanza",
  delega: "Delega",
  contrassegno: "Contrassegno",
};

const NotaRestituzioneDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [addTitoloOpen, setAddTitoloOpen] = useState(false);
  const [selectedTitoloId, setSelectedTitoloId] = useState("");
  const [spedizioneOpen, setSpedizioneOpen] = useState(false);
  const [spedForm, setSpedForm] = useState({ corriere: "", tracking_code: "", tipo_spedizione: "singola" });

  const { data: nota, isLoading } = useQuery({
    queryKey: ["nota_restituzione", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_restituzione")
        .select("*, uffici(nome_ufficio), cliente:profiles!note_restituzione_cliente_id_fkey(nome, cognome)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: dettagli = [] } = useQuery({
    queryKey: ["nota_dettaglio", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_restituzione_dettaglio")
        .select("*, titoli(numero_titolo, premio_lordo, prodotti(nome_prodotto))")
        .eq("nota_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: spedizioni = [] } = useQuery({
    queryKey: ["spedizioni_nota", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spedizioni_cartacee")
        .select("*")
        .eq("nota_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: titoli = [] } = useQuery({
    queryKey: ["titoli_disponibili"],
    queryFn: async () => {
      const { data, error } = await supabase.from("titoli").select("id, numero_titolo, premio_lordo, prodotti(nome_prodotto)").order("numero_titolo");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["logs_nota", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("log_attivita")
        .select("*")
        .eq("entita_tipo", "nota_restituzione")
        .eq("entita_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Stessa queryKey di DocumentiTab (badge tab aggiornato su upload/delete).
  const { data: documentiNota = [] } = useQuery({
    queryKey: ["documenti", "nota_restituzione", id ?? "", "", ""],
    queryFn: async () => {
      const { data } = await supabase
        .from("documenti")
        .select("*, profiles:caricato_da(nome, cognome)")
        .eq("entita_tipo", "nota_restituzione")
        .in("entita_id", [id!])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateFlagMutation = useMutation({
    mutationFn: async (newFlags: Record<string, boolean>) => {
      const { error } = await supabase.from("note_restituzione").update({ flag_json: newFlags as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nota_restituzione", id] }),
    onError: (err: any) => toast.error("Errore"),
  });

  const changeStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const vecchio = nota?.stato;
      const { error } = await supabase.from("note_restituzione").update({ stato: nuovoStato }).eq("id", id!);
      if (error) throw error;
      await logAttivita({ azione: "cambio_stato_nota", entita_tipo: "nota_restituzione", entita_id: id!, dettagli_json: { da: vecchio, a: nuovoStato } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nota_restituzione", id] });
      queryClient.invalidateQueries({ queryKey: ["logs_nota", id] });
      toast.success("Stato aggiornato");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const addTitoloMutation = useMutation({
    mutationFn: async () => {
      const tit = titoli.find((t: any) => t.id === selectedTitoloId);
      // Fase 2: scrivi anche quietanza_id per agganciare al nuovo modello
      const { data: q } = await supabase
        .from("quietanze")
        .select("id")
        .eq("titolo_id", selectedTitoloId)
        .maybeSingle();
      const { error } = await supabase.from("note_restituzione_dettaglio").insert({
        nota_id: id!,
        titolo_id: selectedTitoloId,
        prodotto_id: (tit?.prodotti as any)?.id || null,
        quietanza_id: q?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nota_dettaglio", id] });
      setAddTitoloOpen(false);
      setSelectedTitoloId("");
      toast.success("Titolo aggiunto");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const removeTitoloMutation = useMutation({
    mutationFn: async (detId: string) => {
      const { error } = await supabase.from("note_restituzione_dettaglio").delete().eq("id", detId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nota_dettaglio", id] });
      toast.success("Titolo rimosso");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const createSpedizioneMutation = useMutation({
    mutationFn: async () => {
      const n = nota as any;
      const { data, error } = await supabase.from("spedizioni_cartacee").insert({
        ufficio_id: n.ufficio_id,
        nota_id: id,
        tipo_spedizione: dettagli.length > 1 ? "multipla" : "singola",
        corriere: spedForm.corriere || null,
        tracking_code: spedForm.tracking_code || null,
        data_spedizione: new Date().toISOString().split("T")[0],
        stato: "preparata",
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      await logAttivita({ azione: "creazione_spedizione", entita_tipo: "spedizione", entita_id: data.id, dettagli_json: { nota_id: id } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spedizioni_nota", id] });
      setSpedizioneOpen(false);
      setSpedForm({ corriere: "", tracking_code: "", tipo_spedizione: "singola" });
      toast.success("Spedizione creata");
    },
    onError: (err: any) => toast.error("Errore"),
  });

  if (isLoading) return <p className="text-muted-foreground p-8">Caricamento...</p>;
  if (!nota) return <p className="text-destructive p-8">Nota non trovata</p>;

  const n = nota as any;
  const flags = (n.flag_json || {}) as Record<string, boolean>;

  const statoBadge = (s: string) => {
    switch (s) { case "pronta": return "default"; case "spedita": return "secondary"; case "chiusa": return "outline"; default: return "outline"; }
  };

  const spedStatoBadge = (s: string) => {
    switch (s) { case "spedita": return "default"; case "consegnata": return "secondary"; case "problema": return "destructive"; default: return "outline"; }
  };

  const toggleFlag = (key: string) => {
    const newFlags = { ...flags, [key]: !flags[key] };
    updateFlagMutation.mutate(newFlags);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/note-restituzione")}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nota di Restituzione</h1>
          <p className="text-muted-foreground">
            {n.cliente ? `${n.cliente.cognome} ${n.cliente.nome}` : "Senza cliente"} — {n.uffici?.nome_ufficio || ""}
          </p>
        </div>
        <Badge variant={statoBadge(n.stato)} className="ml-auto text-sm">{n.stato}</Badge>
      </div>

      {/* Azioni */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Azioni</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {n.stato === "bozza" && (
            <Button onClick={() => changeStatoMutation.mutate("pronta")} disabled={changeStatoMutation.isPending}>
              <Package className="w-4 h-4 mr-2" />Segna Pronta
            </Button>
          )}
          {n.stato === "pronta" && (
            <>
              <Dialog open={spedizioneOpen} onOpenChange={setSpedizioneOpen}>
                <DialogTrigger asChild>
                  <Button><Truck className="w-4 h-4 mr-2" />Prepara Spedizione</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Prepara Spedizione</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Corriere</Label>
                      <Input value={spedForm.corriere} onChange={(e) => setSpedForm({ ...spedForm, corriere: e.target.value })} placeholder="es. Poste Italiane" />
                    </div>
                    <div>
                      <Label>Tracking Code</Label>
                      <Input value={spedForm.tracking_code} onChange={(e) => setSpedForm({ ...spedForm, tracking_code: e.target.value })} placeholder="Opzionale" />
                    </div>
                    <p className="text-xs text-muted-foreground">Tipo: {dettagli.length > 1 ? "Multipla" : "Singola"} — {dettagli.length} titoli</p>
                    <Button onClick={() => createSpedizioneMutation.mutate()} disabled={createSpedizioneMutation.isPending} className="w-full">Crea Spedizione</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={() => changeStatoMutation.mutate("spedita")} disabled={changeStatoMutation.isPending}>
                Segna Spedita
              </Button>
            </>
          )}
          {n.stato === "spedita" && (
            <Button variant="outline" onClick={() => changeStatoMutation.mutate("chiusa")} disabled={changeStatoMutation.isPending}>Chiudi Nota</Button>
          )}
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Checklist Documenti</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(FLAG_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <Switch checked={!!flags[key]} onCheckedChange={() => toggleFlag(key)} disabled={n.stato === "chiusa"} />
              <Label className="text-sm">{label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Note */}
      {n.note && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Note</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{n.note}</p></CardContent>
        </Card>
      )}

      <Tabs defaultValue="titoli">
        <TabsList>
          <TabsTrigger value="titoli"><FileText className="w-4 h-4 mr-1" />Titoli ({dettagli.length})</TabsTrigger>
          <TabsTrigger value="spedizioni"><Truck className="w-4 h-4 mr-1" />Spedizioni ({spedizioni.length})</TabsTrigger>
          <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti ({documentiNota.length})</TabsTrigger>
          <TabsTrigger value="log"><Clock className="w-4 h-4 mr-1" />Log ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="titoli">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Titoli Collegati</CardTitle>
              {n.stato === "bozza" && (
                <Dialog open={addTitoloOpen} onOpenChange={setAddTitoloOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Aggiungi</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Aggiungi Titolo</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <Select value={selectedTitoloId} onValueChange={setSelectedTitoloId}>
                        <SelectTrigger><SelectValue placeholder="Seleziona titolo" /></SelectTrigger>
                        <SelectContent>
                          {titoli.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.numero_titolo || t.id.slice(0, 8)} — {t.prodotti?.nome_prodotto || ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => addTitoloMutation.mutate()} disabled={!selectedTitoloId || addTitoloMutation.isPending} className="w-full">Aggiungi</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Titolo</TableHead>
                    <TableHead>Prodotto</TableHead>
                    <TableHead>Premio €</TableHead>
                    {n.stato === "bozza" && <TableHead></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dettagli.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titoli?.numero_titolo || "—"}</TableCell>
                      <TableCell>{d.titoli?.prodotti?.nome_prodotto || "—"}</TableCell>
                      <TableCell className="font-mono">{d.titoli?.premio_lordo?.toFixed(2) ?? "—"}</TableCell>
                      {n.stato === "bozza" && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeTitoloMutation.mutate(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {dettagli.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nessun titolo</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spedizioni">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Corriere</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spedizioni.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/spedizioni/${s.id}`)}>
                      <TableCell>{s.tipo_spedizione}</TableCell>
                      <TableCell>{s.corriere || "—"}</TableCell>
                      <TableCell className="font-mono">{s.tracking_code || "—"}</TableCell>
                      <TableCell>{s.data_spedizione}</TableCell>
                      <TableCell><Badge variant={spedStatoBadge(s.stato)}>{s.stato}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {spedizioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna spedizione</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documenti">
          <DocumentiTab entitaTipo="nota_restituzione" entitaId={id!} />
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {logs.map((l: any) => (
                <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{l.azione}</p>
                    {l.dettagli_json && <p className="text-xs text-muted-foreground mt-1">{JSON.stringify(l.dettagli_json)}</p>}
                    <p className="text-xs text-muted-foreground">{l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: it }) : ""}</p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && <p className="text-center text-muted-foreground text-sm">Nessuna attività</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotaRestituzioneDetail;
