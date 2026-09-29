import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTabParam } from "@/hooks/useTabParam";

const PROSPECT_TABS = ["documenti", "chat"] as const;
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Users, Phone, Mail, Globe, StickyNote, Plus,
  Clock, FileText, TrendingUp, CheckCircle2, XCircle, UserPlus, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import DocumentiTab from "@/components/DocumentiTab";
import { SearchableSelect } from "@/components/SearchableSelect";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import AiDocumentScanner from "@/components/AiDocumentScanner";

const STATI_PROSPECT = [
  { value: "nuovo", label: "Nuovo" },
  { value: "in_trattativa", label: "In Trattativa" },
  { value: "preventivo_inviato", label: "Preventivo Inviato" },
  { value: "chiuso_vinto", label: "Chiuso Vinto" },
  { value: "chiuso_perso", label: "Chiuso Perso" },
];

const STATI_TRATTATIVA = [
  { value: "aperta", label: "Aperta" },
  { value: "in_negoziazione", label: "In Negoziazione" },
  { value: "chiusa_vinta", label: "Chiusa Vinta" },
  { value: "chiusa_persa", label: "Chiusa Persa" },
];

const AZIONE_ICONS: Record<string, React.ElementType> = {
  creazione_prospect: Users,
  modifica_stato_prospect: TrendingUp,
  creazione_trattativa: FileText,
  chiusura_trattativa: CheckCircle2,
  modifica_stato_trattativa: TrendingUp,
};

const ProspectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [trattativaOpen, setTrattativaOpen] = useState(false);
  const [activeTab, setActiveTab] = useTabParam(PROSPECT_TABS, "documenti");
  const [trattativaForm, setTrattativaForm] = useState({
    ramo_id: "", compagnia_id: "", premio_previsto: "", note: "",
  });

  const { data: prospect, isLoading } = useQuery({
    queryKey: ["prospect", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect")
        .select("*, profiles:assegnato_a(nome, cognome), uffici:ufficio_id(nome_ufficio)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: trattative } = useQuery({
    queryKey: ["trattative", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome)")
        .eq("prospect_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ramiOptions = [] } = useQuery({
    queryKey: ["rami_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });

  const { data: compagnieOptions = [] } = useQuery({
    queryKey: ["compagnie_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const trattativeIds = trattative?.map((t) => t.id) || [];

  const convertToClientMutation = useMutation({
    mutationFn: async () => {
      const { data: newClient, error: insertErr } = await supabase
        .from("clienti")
        .insert({
          tipo_cliente: "privato",
          nome: prospect?.nome || null,
          cognome: prospect?.cognome || null,
          email: prospect?.email || null,
          telefono: prospect?.telefono || null,
          note: prospect?.note || null,
          ufficio_id: prospect?.ufficio_id || null,
          attivo: true,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from("prospect")
        .update({ convertito_cliente_id: newClient.id } as any)
        .eq("id", id!);
      if (updateErr) throw updateErr;

      await logAttivita({
        azione: "conversione_prospect_cliente",
        entita_tipo: "prospect",
        entita_id: id!,
        dettagli_json: { cliente_id: newClient.id, nome: prospect?.nome, cognome: prospect?.cognome },
      });

      return newClient.id;
    },
    onSuccess: (clienteId) => {
      toast.success("Prospect convertito in cliente con successo!");
      navigate(`/archivi/clienti/${clienteId}`);
    },
    onError: () => toast.error("Errore durante la conversione"),
  });

  const updateStatoMutation = useMutation({
    mutationFn: async (newStato: string) => {
      const oldStato = prospect?.stato;
      const { error } = await supabase.from("prospect").update({ stato: newStato, updated_at: new Date().toISOString() }).eq("id", id!);
      if (error) throw error;

      await logAttivita({
        azione: "modifica_stato_prospect",
        entita_tipo: "prospect",
        entita_id: id!,
        dettagli_json: { stato_precedente: oldStato, nuovo_stato: newStato },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast.success("Stato aggiornato");
    },
  });

  const createTrattativaMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        prospect_id: id!,
        ramo_id: trattativaForm.ramo_id || null,
        compagnia_id: trattativaForm.compagnia_id || null,
        premio_previsto: trattativaForm.premio_previsto ? parseFloat(trattativaForm.premio_previsto) : null,
        note: trattativaForm.note || null,
        stato: "aperta",
        created_by: profile?.id || null,
      };
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;

      await logAttivita({
        azione: "creazione_trattativa",
        entita_tipo: "prospect",
        entita_id: id!,
        dettagli_json: { trattativa_id: data.id, ramo_id: trattativaForm.ramo_id, compagnia_id: trattativaForm.compagnia_id },
      });

      // Update prospect stato if still "nuovo"
      if (prospect?.stato === "nuovo") {
        await supabase.from("prospect").update({ stato: "in_trattativa", updated_at: new Date().toISOString() }).eq("id", id!);
        await logAttivita({
          azione: "modifica_stato_prospect",
          entita_tipo: "prospect",
          entita_id: id!,
          dettagli_json: { stato_precedente: "nuovo", nuovo_stato: "in_trattativa", motivo: "apertura_trattativa" },
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative", id] });
      queryClient.invalidateQueries({ queryKey: ["prospect", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast.success("Trattativa creata");
      setTrattativaForm({ ramo_id: "", compagnia_id: "", premio_previsto: "", note: "" });
      setTrattativaOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Errore");
    },
  });

  const updateTrattativaStato = useMutation({
    mutationFn: async ({ trattativaId, newStato, oldStato }: { trattativaId: string; newStato: string; oldStato: string }) => {
      const update: Record<string, unknown> = { stato: newStato, updated_at: new Date().toISOString() };
      if (newStato === "chiusa_vinta" || newStato === "chiusa_persa") {
        update.data_chiusura = new Date().toISOString();
      }
      const { error } = await supabase.from("trattative").update(update).eq("id", trattativaId);
      if (error) throw error;

      const azione = (newStato === "chiusa_vinta" || newStato === "chiusa_persa") ? "chiusura_trattativa" : "modifica_stato_trattativa";
      await logAttivita({
        azione,
        entita_tipo: "trattativa",
        entita_id: trattativaId,
        dettagli_json: { prospect_id: id, stato_precedente: oldStato, nuovo_stato: newStato },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative", id] });
      queryClient.invalidateQueries({ queryKey: ["log_attivita", "prospect", id] });
      toast.success("Trattativa aggiornata");
    },
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Caricamento...</div>;
  if (!prospect) return <div className="text-center py-12 text-muted-foreground">Prospect non trovato</div>;

  const getTrattativaColor = (stato: string) => {
    switch (stato) {
      case "aperta": return "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border";
      case "in_negoziazione": return "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border";
      case "chiusa_vinta": return "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border";
      case "chiusa_persa": return "bg-destructive/10 text-destructive border-destructive/30";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/archivi/clienti")} className="hover:text-foreground">Clienti</button>
        <span>›</span>
        <span>{prospect.nome} {prospect.cognome}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/archivi/clienti")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{prospect.nome} {prospect.cognome}</h1>
            <p className="text-sm text-muted-foreground">
              Creato il {format(new Date(prospect.created_at), "dd MMMM yyyy", { locale: it })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {prospect.stato === "chiuso_vinto" && !prospect.convertito_cliente_id && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2 bg-kpi-green-text hover:bg-kpi-green-text/90 text-white">
                  <UserPlus className="w-4 h-4" />Converti in Cliente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Converti Prospect in Cliente</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>Verrà creato un nuovo cliente con i seguenti dati:</p>
                      <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                        <p><strong>Nome:</strong> {prospect.nome} {prospect.cognome}</p>
                        <p><strong>Email:</strong> {prospect.email || "—"}</p>
                        <p><strong>Telefono:</strong> {prospect.telefono || "—"}</p>
                        {prospect.note && <p><strong>Note:</strong> {prospect.note}</p>}
                      </div>
                      <p>Il prospect verrà segnato come convertito. Questa azione non è reversibile.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => convertToClientMutation.mutate()} disabled={convertToClientMutation.isPending}>
                    Conferma Conversione
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {prospect.convertito_cliente_id && (
            <Button variant="outline" className="gap-2 text-kpi-green-text border-kpi-green-border" onClick={() => navigate(`/archivi/clienti/${prospect.convertito_cliente_id}`)}>
              <ExternalLink className="w-4 h-4" />Vai al Cliente
            </Button>
          )}
          <Select value={prospect.stato} onValueChange={(v) => updateStatoMutation.mutate(v)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATI_PROSPECT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + Trattative */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Dati Anagrafici</h3>
              <AiDocumentScanner
                documentType="carta_identita"
                label="Scansiona Documento"
                entityContext={prospect ? {
                  entityType: "prospect",
                  scopeHint: `${prospect.cognome ?? ""} ${prospect.nome ?? ""}`.trim() || "Prospect",
                  expectedCF: prospect.codice_fiscale ?? null,
                  expectedPIVA: prospect.partita_iva ?? null,
                } : undefined}
                onExtracted={async (data) => {
                  const updates: Record<string, unknown> = {};
                  if (data.nome) updates.nome = data.nome;
                  if (data.cognome) updates.cognome = data.cognome;
                  if (data.codice_fiscale) updates.note = `CF: ${data.codice_fiscale}`;
                  if (Object.keys(updates).length > 0) {
                    updates.updated_at = new Date().toISOString();
                    await supabase.from("prospect").update(updates).eq("id", id!);
                    queryClient.invalidateQueries({ queryKey: ["prospect", id] });
                    toast.success("Dati aggiornati dal documento");
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{prospect.email || "Nessuna email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{prospect.telefono || "Nessun telefono"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Fonte: {prospect.fonte || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Assegnato a: {prospect.profiles ? `${prospect.profiles.nome || ""} ${prospect.profiles.cognome || ""}`.trim() : "—"}
                </span>
              </div>
            </div>
            {prospect.note && (
              <div className="flex items-start gap-2 text-sm pt-2 border-t border-border">
                <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground">{prospect.note}</p>
              </div>
            )}
          </Card>

          {/* Trattative */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Trattative ({trattative?.length || 0})</h3>
              <Dialog open={trattativaOpen} onOpenChange={setTrattativaOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" />Nuova Trattativa</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuova Trattativa</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>Garanzia</Label>
                      <SearchableSelect options={ramiOptions} value={trattativaForm.ramo_id} onValueChange={(v) => setTrattativaForm({ ...trattativaForm, ramo_id: v })} placeholder="Seleziona garanzia..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agenzia</Label>
                      <SearchableSelect options={compagnieOptions} value={trattativaForm.compagnia_id} onValueChange={(v) => setTrattativaForm({ ...trattativaForm, compagnia_id: v })} placeholder="Seleziona agenzia..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Premio Previsto (€)</Label>
                      <Input type="number" value={trattativaForm.premio_previsto} onChange={(e) => setTrattativaForm({ ...trattativaForm, premio_previsto: e.target.value })} placeholder="0.00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Note</Label>
                      <Textarea value={trattativaForm.note} onChange={(e) => setTrattativaForm({ ...trattativaForm, note: e.target.value })} placeholder="Note..." rows={3} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setTrattativaOpen(false)}>Annulla</Button>
                      <Button onClick={() => createTrattativaMutation.mutate()} disabled={createTrattativaMutation.isPending}>
                        Crea Trattativa
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {!trattative?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nessuna trattativa ancora</div>
            ) : (
              <div className="space-y-3">
                {trattative.map((t) => (
                  <div key={t.id} className="border border-border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{t.ramo?.descrizione || t.prodotto || "—"}</p>
                      <p className="text-sm text-muted-foreground">{t.compagnia_rel?.nome || t.compagnia || "—"} • {t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "Premio n.d."}</p>
                      {t.data_chiusura && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Chiusa il {format(new Date(t.data_chiusura), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${getTrattativaColor(t.stato)}`}>
                        {STATI_TRATTATIVA.find((s) => s.value === t.stato)?.label || t.stato}
                      </span>
                      <Select value={t.stato} onValueChange={(v) => updateTrattativaStato.mutate({ trattativaId: t.id, newStato: v, oldStato: t.stato })}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATI_TRATTATIVA.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Timeline */}
        <div>
          <Card className="p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />Log Attività
            </h3>
            <TimelineTab
              entitaTipo="prospect"
              entitaId={id!}
              extraEntities={trattativeIds.length ? [{ tipo: "trattativa", ids: trattativeIds }] : undefined}
            />
          </Card>
        </div>
      </div>
      {/* Documenti e Chat */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documenti">Documenti</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="documenti">
          <Card className="p-5"><DocumentiTab entitaTipo="prospect" entitaId={id!} /></Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card className="p-5"><ChatTab entitaTipo="prospect" entitaId={id!} /></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProspectDetail;
