import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { ArrowLeft, Plus, Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format, addMonths, addDays } from "date-fns";

const esitoBadge: Record<string, "default" | "secondary" | "destructive"> = {
  atteso: "secondary",
  incassato: "default",
  ko: "destructive",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PortafoglioDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventoForm, setEventoForm] = useState({ data_scadenza: "", importo_atteso: "", note: "" });
  const isValidId = !!id && UUID_RE.test(id);

  const { data: portafoglio, isLoading } = useQuery({
    queryKey: ["portafoglio_incassi", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portafoglio_incassi")
        .select("*, uffici(nome_ufficio), profiles(nome, cognome)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: isValidId,
  });

  const { data: eventi } = useQuery({
    queryKey: ["portafoglio_eventi", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("portafoglio_incassi_eventi")
        .select("*")
        .eq("portafoglio_id", id!)
        .order("data_scadenza", { ascending: true });
      return (data || []);
    },
    enabled: isValidId,
  });

  const updateStatoMutation = useMutation({
    mutationFn: async (nuovoStato: string) => {
      const { error } = await supabase.from("portafoglio_incassi").update({ stato: nuovoStato }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      logAttivita({ azione: "cambio_stato_portafoglio", entita_tipo: "portafoglio_incassi", entita_id: id! });
      queryClient.invalidateQueries({ queryKey: ["portafoglio_incassi", id] });
      toast.success("Stato aggiornato");
    },
  });

  const createEventoMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("portafoglio_incassi_eventi").insert([{
        portafoglio_id: id,
        data_scadenza: eventoForm.data_scadenza,
        importo_atteso: parseFloat(eventoForm.importo_atteso),
        esito: "atteso",
        note: eventoForm.note || null,
      }]).select().single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data: any) => {
      await logAttivita({ azione: "evento_incasso_generato", entita_tipo: "portafoglio_incassi_eventi", entita_id: data.id });
      queryClient.invalidateQueries({ queryKey: ["portafoglio_eventi", id] });
      setDialogOpen(false);
      setEventoForm({ data_scadenza: "", importo_atteso: "", note: "" });
      toast.success("Evento creato");
    },
  });

  const generateEventsMutation = useMutation({
    mutationFn: async () => {
      if (!portafoglio) return;
      const mesi = portafoglio.periodicita === "mensile" ? 1 : portafoglio.periodicita === "trimestrale" ? 3 : 12;
      const numEventi = portafoglio.periodicita === "una_tantum" ? 1 : 12 / mesi;
      const events = [];
      let baseDate = new Date(portafoglio.prossima_scadenza);
      for (let i = 0; i < numEventi; i++) {
        events.push({
          portafoglio_id: id,
          data_scadenza: format(addMonths(baseDate, i * mesi), "yyyy-MM-dd"),
          importo_atteso: Number(portafoglio.importo_atteso),
          esito: "atteso",
        });
      }
      const { error } = await supabase.from("portafoglio_incassi_eventi").insert(events);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portafoglio_eventi", id] });
      toast.success("Eventi generati automaticamente");
    },
  });

  const updateEsitoMutation = useMutation({
    mutationFn: async ({ eventoId, esito }: { eventoId: string; esito: string }) => {
      const { error } = await supabase.from("portafoglio_incassi_eventi").update({ esito }).eq("id", eventoId);
      if (error) throw error;
      return { eventoId, esito };
    },
    onSuccess: async ({ eventoId, esito }) => {
      const azione = esito === "incassato" ? "evento_incasso_matchato" : esito === "ko" ? "evento_incasso_ko" : "evento_incasso_generato";
      await logAttivita({ azione, entita_tipo: "portafoglio_incassi_eventi", entita_id: eventoId });
      queryClient.invalidateQueries({ queryKey: ["portafoglio_eventi", id] });
      toast.success(`Esito aggiornato a "${esito}"`);
    },
  });

  const eventiKO = eventi?.filter((e: any) => e.esito === "ko") || [];
  const eventiAttesi = eventi?.filter((e: any) => e.esito === "atteso") || [];
  const eventiIncassati = eventi?.filter((e: any) => e.esito === "incassato") || [];

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Caricamento...</div>;
  if (!portafoglio) return <div className="p-8 text-center text-muted-foreground">Portafoglio non trovato</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio")}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{portafoglio.descrizione}</h1>
          <p className="text-muted-foreground">
            {portafoglio.uffici?.nome_ufficio || ""} · {portafoglio.periodicita?.replace("_", " ")}
          </p>
        </div>
        <Select value={portafoglio.stato} onValueChange={(v) => updateStatoMutation.mutate(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="attivo">Attivo</SelectItem>
            <SelectItem value="sospeso">Sospeso</SelectItem>
            <SelectItem value="chiuso">Chiuso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" />
          <div><p className="text-2xl font-bold">{eventi?.length || 0}</p><p className="text-xs text-muted-foreground">Tot. eventi</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Clock className="w-8 h-8 text-yellow-500" />
          <div><p className="text-2xl font-bold">{eventiAttesi.length}</p><p className="text-xs text-muted-foreground">Attesi</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <div><p className="text-2xl font-bold">{eventiIncassati.length}</p><p className="text-xs text-muted-foreground">Incassati</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <div><p className="text-2xl font-bold">{eventiKO.length}</p><p className="text-xs text-muted-foreground">KO</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList>
          <TabsTrigger value="calendario">Calendario Eventi</TabsTrigger>
          <TabsTrigger value="ko">KO da Gestire ({eventiKO.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => generateEventsMutation.mutate()}>
              <Calendar className="w-4 h-4 mr-2" />Genera eventi automatici
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Aggiungi evento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Evento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Data Scadenza</Label><Input type="date" value={eventoForm.data_scadenza} onChange={(e) => setEventoForm({ ...eventoForm, data_scadenza: e.target.value })} /></div>
                  <div><Label>Importo Atteso (€)</Label><Input type="number" step="0.01" value={eventoForm.importo_atteso} onChange={(e) => setEventoForm({ ...eventoForm, importo_atteso: e.target.value })} /></div>
                  <div><Label>Note</Label><Textarea value={eventoForm.note} onChange={(e) => setEventoForm({ ...eventoForm, note: e.target.value })} /></div>
                  <Button onClick={() => createEventoMutation.mutate()} disabled={!eventoForm.data_scadenza || !eventoForm.importo_atteso} className="w-full">Crea Evento</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle>Tutti gli Eventi</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Scadenza</TableHead>
                    <TableHead>Importo Atteso</TableHead>
                    <TableHead>Esito</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!eventi?.length ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun evento. Genera automaticamente o aggiungine uno.</TableCell></TableRow>
                  ) : eventi.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{format(new Date(e.data_scadenza), "dd/MM/yyyy")}</TableCell>
                      <TableCell>€{Number(e.importo_atteso).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={esitoBadge[e.esito] || "secondary"} className="capitalize">{e.esito}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.note || "-"}</TableCell>
                      <TableCell>
                        {e.esito === "atteso" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => updateEsitoMutation.mutate({ eventoId: e.id, esito: "incassato" })}>
                              <CheckCircle className="w-3 h-3 mr-1" />Incassato
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateEsitoMutation.mutate({ eventoId: e.id, esito: "ko" })}>
                              <AlertTriangle className="w-3 h-3 mr-1" />KO
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ko">
          <Card>
            <CardHeader><CardTitle>Eventi KO da Gestire</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Scadenza</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!eventiKO.length ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun evento KO</TableCell></TableRow>
                  ) : eventiKO.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{format(new Date(e.data_scadenza), "dd/MM/yyyy")}</TableCell>
                      <TableCell>€{Number(e.importo_atteso).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{e.note || "-"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => updateEsitoMutation.mutate({ eventoId: e.id, esito: "incassato" })}>
                          <CheckCircle className="w-3 h-3 mr-1" />Segna incassato
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortafoglioDetail;
