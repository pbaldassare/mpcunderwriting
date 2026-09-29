import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";
import { TrattativaDetailDialog } from "@/components/trattative/TrattativaDetailDialog";
import { NuovoClienteDialog } from "@/components/clienti/NuovoClienteDialog";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import { STATI_TRATTATIVA_FULL, getStatoLabel, getStatoColor } from "@/components/trattative/StatoPipeline";
import { toast } from "sonner";
import { FileText, Search, Plus, Landmark, Archive, Download, RotateCcw, TrendingUp, TrendingDown, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

type ViewPreset = "in_corso" | "chiuse" | "archiviate" | "tutte";

const VIEW_PRESETS: { value: ViewPreset; label: string }[] = [
  { value: "in_corso", label: "In corso" },
  { value: "chiuse", label: "Chiuse" },
  { value: "archiviate", label: "Archiviate" },
  { value: "tutte", label: "Tutte" },
];

const CLOSED_STATI = ["chiusa_vinta", "chiusa_persa"];

interface TrattativaForm {
  cliente_id: string;
  ramo_id: string;
  gruppo_ramo_id: string;
  compagnia_id: string;
  ufficio_id: string;
  premio_previsto: string;
  priorita: string;
  note: string;
}

const emptyForm: TrattativaForm = {
  cliente_id: "",
  ramo_id: "",
  gruppo_ramo_id: "",
  compagnia_id: "",
  ufficio_id: "",
  premio_previsto: "",
  priorita: "media",
  note: "",
};

const PRIORITA_ICONS: Record<string, string> = {
  urgente: "🔴",
  alta: "🟠",
  media: "🟡",
  bassa: "🟢",
};

const TRATTATIVA_SELECT =
  "*, prospect:prospect_id(nome, cognome, ragione_sociale, tipo_cliente, ufficio_id), cliente:cliente_id(nome, cognome, ragione_sociale, tipo_cliente), ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome), profiles:created_by(nome, cognome), ufficio:ufficio_id(nome_ufficio), assegnato:assegnato_a(nome, cognome)";

function parseViewParam(raw: string | null): ViewPreset {
  if (raw === "chiuse" || raw === "archiviate" || raw === "tutte" || raw === "in_corso") return raw;
  if (raw === "attive") return "in_corso";
  if (raw === "storico") return "archiviate";
  return "in_corso";
}

function matchesView(t: { archiviata?: boolean | null; stato?: string | null }, view: ViewPreset): boolean {
  const closed = CLOSED_STATI.includes(t.stato || "");
  const archived = !!t.archiviata;
  switch (view) {
    case "in_corso":
      return !archived && !closed;
    case "chiuse":
      return !archived && closed;
    case "archiviate":
      return archived;
    case "tutte":
      return true;
  }
}

const TrattativeList = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseViewParam(searchParams.get("view"));

  const setView = (next: ViewPreset) => {
    const params = new URLSearchParams(searchParams);
    if (next === "in_corso") params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [filtroUfficio, setFiltroUfficio] = useState("tutti");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutti");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [filtroScadenzaDa, setFiltroScadenzaDa] = useState("");
  const [filtroScadenzaA, setFiltroScadenzaA] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [nuovoClienteOpen, setNuovoClienteOpen] = useState(false);
  const [form, setForm] = useState<TrattativaForm>({ ...emptyForm });
  const [selectedTrattativa, setSelectedTrattativa] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<"selected" | "all_closed">("selected");
  const [reopenId, setReopenId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [view]);

  const { data: trattative, isLoading } = useQuery({
    queryKey: ["trattative_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select(TRATTATIVA_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (data || []).map((t) => t.id);
      let bandiMap: Record<string, any[]> = {};
      if (ids.length > 0) {
        const { data: links } = await supabase
          .from("bandi_trattative")
          .select("trattativa_id, bando:bando_id(id, titolo, ente, scheda_id, link)")
          .in("trattativa_id", ids);
        if (links) {
          for (const l of links) {
            if (!bandiMap[l.trattativa_id]) bandiMap[l.trattativa_id] = [];
            bandiMap[l.trattativa_id].push(l.bando);
          }
        }
      }

      return (data || []).map((t) => ({
        ...t,
        bandi_collegati: bandiMap[t.id] || [],
      }));
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []).map((u) => ({ value: u.id, label: u.nome_ufficio }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        stato: "aperta",
        created_by: profile?.id || null,
        cliente_id: form.cliente_id,
        ramo_id: form.ramo_id || null,
        compagnia_id: form.compagnia_id || null,
        ufficio_id: form.ufficio_id || null,
        premio_previsto: form.premio_previsto ? parseFloat(form.premio_previsto) : null,
        priorita: form.priorita || "media",
        note: form.note || null,
        data_apertura: new Date().toISOString().split("T")[0],
      };
      const { data, error } = await supabase.from("trattative").insert(payload).select().single();
      if (error) throw error;

      await supabase.from("trattativa_eventi").insert({
        trattativa_id: data.id,
        tipo_evento: "cambio_stato",
        descrizione: "Trattativa creata con stato: Aperta",
        created_by: profile?.id,
      });

      await logAttivita({
        azione: "creazione_trattativa",
        entita_tipo: "cliente",
        entita_id: form.cliente_id,
        dettagli_json: { trattativa_id: data.id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa creata");
      setForm({ ...emptyForm });
      setCreateOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (mode: "selected" | "all_closed") => {
      if (mode === "selected") {
        const ids = Array.from(selectedIds);
        if (!ids.length) return;
        const { error } = await supabase.from("trattative").update({ archiviata: true }).in("id", ids);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trattative")
          .update({ archiviata: true })
          .in("stato", CLOSED_STATI)
          .or("archiviata.eq.false,archiviata.is.null");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattative archiviate");
      setSelectedIds(new Set());
      setArchiveDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trattative")
        .update({ archiviata: false, stato: "aperta" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa riaperta");
      setReopenId(null);
      setView("in_corso");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getSoggettoName = (t: any) => {
    if (t.cliente) {
      return t.cliente.tipo_cliente === "privato"
        ? `${t.cliente.cognome || ""} ${t.cliente.nome || ""}`.trim()
        : t.cliente.ragione_sociale || "—";
    }
    if (t.prospect) {
      if (t.prospect.tipo_cliente === "ente" || t.prospect.ragione_sociale) {
        return t.prospect.ragione_sociale || "—";
      }
      return `${t.prospect.cognome || ""} ${t.prospect.nome || ""}`.trim() || "—";
    }
    return "—";
  };

  const viewFiltered = useMemo(
    () => (trattative || []).filter((t) => matchesView(t, view)),
    [trattative, view],
  );

  const fonti = useMemo(
    () => [...new Set((trattative || []).map((t) => t.fonte).filter(Boolean))] as string[],
    [trattative],
  );

  const filtered = viewFiltered.filter((t) => {
    if (filtroStato !== "tutti" && t.stato !== filtroStato) return false;
    if (filtroUfficio !== "tutti" && t.ufficio_id !== filtroUfficio) return false;
    if (filtroCompagnia !== "tutti" && t.compagnia_id !== filtroCompagnia) return false;
    if (filtroFonte !== "tutti" && (t.fonte || "") !== filtroFonte) return false;
    if (filtroScadenzaDa && t.data_scadenza && t.data_scadenza < filtroScadenzaDa) return false;
    if (filtroScadenzaDa && !t.data_scadenza) return false;
    if (filtroScadenzaA && t.data_scadenza && t.data_scadenza > filtroScadenzaA) return false;
    if (filtroScadenzaA && !t.data_scadenza) return false;
    if (filtroSearch) {
      const search = filtroSearch.toLowerCase();
      const soggetto = getSoggettoName(t).toLowerCase();
      const comp = (t.compagnia_rel?.nome || t.compagnia || "").toLowerCase();
      const bandoTitolo = (t.bandi_collegati?.[0]?.titolo || "").toLowerCase();
      if (!soggetto.includes(search) && !comp.includes(search) && !bandoTitolo.includes(search)) return false;
    }
    return true;
  });

  const counts = useMemo(() => {
    const all = trattative || [];
    return {
      in_corso: all.filter((t) => matchesView(t, "in_corso")).length,
      chiuse: all.filter((t) => matchesView(t, "chiuse")).length,
      archiviate: all.filter((t) => matchesView(t, "archiviate")).length,
      tutte: all.length,
    };
  }, [trattative]);

  const kpiSource = viewFiltered;
  const vinte = kpiSource.filter((t) => t.stato === "chiusa_vinta");
  const perse = kpiSource.filter((t) => t.stato === "chiusa_persa");
  const premioVinto = vinte.reduce((a, t) => a + (Number(t.premio_previsto) || 0), 0);
  const premioPerso = perse.reduce((a, t) => a + (Number(t.premio_previsto) || 0), 0);
  const showKpi = view !== "in_corso";

  const exportCSV = () => {
    if (!filtered.length) return;
    const header = "Soggetto;Garanzia;Agenzia;Ufficio;Premio;Stato;Fonte;Scadenza;Data";
    const rows = filtered.map((t) =>
      [
        getSoggettoName(t),
        t.ramo?.descrizione || t.prodotto || "",
        t.compagnia_rel?.nome || t.compagnia || "",
        t.ufficio?.nome_ufficio || "",
        t.premio_previsto || "",
        getStatoLabel(t.stato),
        t.fonte || "",
        t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy") : "",
        format(new Date(t.created_at), "dd/MM/yyyy"),
      ].join(";"),
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trattative_${view}_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (t: any) => {
    setSelectedTrattativa(t);
    setDetailOpen(true);
  };

  const handleClienteCreated = async (clienteId: string) => {
    setForm((f) => ({ ...f, cliente_id: clienteId }));
    setNuovoClienteOpen(false);
    toast.success("Cliente creato — selezionato per la trattativa");
  };

  const canReopen = (t: { archiviata?: boolean | null; stato?: string | null }) =>
    !!t.archiviata || CLOSED_STATI.includes(t.stato || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Trattative</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trattative</h1>
            <p className="text-sm text-muted-foreground">
              {counts.in_corso} in corso • {counts.chiuse} chiuse • {counts.archiviate} archiviate
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={exportCSV} disabled={!filtered.length}>
            <Download className="w-4 h-4" />Esporta CSV
          </Button>
          {view === "in_corso" && selectedIds.size > 0 && (
            <Button variant="outline" className="gap-1.5" onClick={() => { setArchiveMode("selected"); setArchiveDialogOpen(true); }}>
              <Archive className="w-4 h-4" />Archivia ({selectedIds.size})
            </Button>
          )}
          {view === "in_corso" && (
            <Button variant="outline" className="gap-1.5" onClick={() => { setArchiveMode("all_closed"); setArchiveDialogOpen(true); }}>
              <Archive className="w-4 h-4" />Archivia chiuse
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5"><Plus className="w-4 h-4" />Nuova Trattativa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nuova Trattativa</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Cliente *</Label>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs gap-1" onClick={() => setNuovoClienteOpen(true)}>
                      <UserPlus className="w-3.5 h-3.5" />Crea cliente in anagrafica
                    </Button>
                  </div>
                  <ClienteSearchSelect
                    value={form.cliente_id}
                    onValueChange={(v) => setForm({ ...form, cliente_id: v })}
                    placeholder="Cerca cliente..."
                    searchPlaceholder="Nome, più nomi, indirizzo, CF…"
                  />
                  <p className="text-xs text-muted-foreground">I nuovi contatti vanno creati come clienti in Anagrafiche (anche senza polizze).</p>
                </div>
                <RamoSottoramoSelect
                  gruppoRamoId={form.gruppo_ramo_id || null}
                  ramoId={form.ramo_id || null}
                  onChange={({ gruppoRamoId, ramoId }) =>
                    setForm({ ...form, gruppo_ramo_id: gruppoRamoId || "", ramo_id: ramoId || "" })
                  }
                />
                <div className="space-y-1.5">
                  <Label>Agenzia</Label>
                  <SearchableSelect options={compagnie} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Agenzia..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ufficio</Label>
                    <SearchableSelect options={uffici} value={form.ufficio_id} onValueChange={(v) => setForm({ ...form, ufficio_id: v })} placeholder="Ufficio..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorità</Label>
                    <Select value={form.priorita} onValueChange={(v) => setForm({ ...form, priorita: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bassa">🟢 Bassa</SelectItem>
                        <SelectItem value="media">🟡 Media</SelectItem>
                        <SelectItem value="alta">🟠 Alta</SelectItem>
                        <SelectItem value="urgente">🔴 Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Premio Previsto (€)</Label>
                  <Input type="number" value={form.premio_previsto} onChange={(e) => setForm({ ...form, premio_previsto: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.cliente_id}>
                  Crea Trattativa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <NuovoClienteDialog
        controlledOpen={nuovoClienteOpen}
        onOpenChange={setNuovoClienteOpen}
        onCreated={(id) => handleClienteCreated(id)}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewPreset)}>
        <TabsList>
          {VIEW_PRESETS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="gap-1.5">
              {p.label}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">{counts[p.value]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showKpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">In vista</p>
            <p className="text-2xl font-bold">{viewFiltered.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Vinte</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{vinte.length}</p>
            <p className="text-xs text-muted-foreground">€ {premioVinto.toLocaleString("it-IT")}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Perse</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{perse.length}</p>
            <p className="text-xs text-muted-foreground">€ {premioPerso.toLocaleString("it-IT")}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Tasso vittoria</p>
            <p className="text-2xl font-bold">
              {vinte.length + perse.length > 0 ? `${Math.round((vinte.length / (vinte.length + perse.length)) * 100)}%` : "—"}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Cerca soggetto, agenzia, bando..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_TRATTATIVA_FULL.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCompagnia} onValueChange={setFiltroCompagnia}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Agenzia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte le agenzie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ufficio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli uffici</SelectItem>
            {uffici.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {fonti.length > 0 && (
          <Select value={filtroFonte} onValueChange={setFiltroFonte}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Fonte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte le fonti</SelectItem>
              {fonti.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scadenza da</Label>
            <Input type="date" className="w-36 h-10" value={filtroScadenzaDa} onChange={(e) => setFiltroScadenzaDa(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Scadenza a</Label>
            <Input type="date" className="w-36 h-10" value={filtroScadenzaA} onChange={(e) => setFiltroScadenzaA(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !filtered.length ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessuna trattativa trovata</h3>
          <p className="text-sm text-muted-foreground">
            {view === "in_corso" ? 'Usa "Nuova Trattativa" per crearne una.' : "Prova un&apos;altra vista o modifica i filtri."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {view === "in_corso" && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedIds(new Set(filtered.map((t) => t.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </TableHead>
                )}
                <TableHead className="w-8"></TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Garanzia</TableHead>
                <TableHead>Agenzia</TableHead>
                <TableHead>Ufficio</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Bando</TableHead>
                <TableHead>{view === "in_corso" ? "Scadenza" : "Data"}</TableHead>
                {(view === "chiuse" || view === "archiviate" || view === "tutte") && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(t)}>
                  {view === "in_corso" && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(t.id);
                          else next.delete(t.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    {PRIORITA_ICONS[t.priorita || "media"] || "🟡"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getSoggettoName(t)}
                      {!t.cliente_id && t.prospect_id && (
                        <Badge variant="outline" className="text-[10px]">Legacy prospect</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.ramo?.descrizione || t.prodotto || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.compagnia_rel?.nome || t.compagnia || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.ufficio?.nome_ufficio || "—"}</TableCell>
                  <TableCell>{t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full text-white ${getStatoColor(t.stato)}`}>
                      {getStatoLabel(t.stato)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {t.bandi_collegati?.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {t.bandi_collegati.map((b: any) => {
                          const label = b.titolo || b.scheda_id || "—";
                          const short = label.length > 60 ? label.slice(0, 57) + "…" : label;
                          return (
                            <a key={b.id} href={b.link || "#"} target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Landmark className="h-3 w-3 shrink-0" />
                              {short}
                            </a>
                          );
                        })}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {view === "in_corso"
                      ? (t.data_scadenza ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it }) : "—")
                      : format(new Date(t.created_at), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  {(view === "chiuse" || view === "archiviate" || view === "tutte") && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canReopen(t) && (
                        <Button variant="ghost" size="icon" title="Riapri trattativa" onClick={() => setReopenId(t.id)}>
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedTrattativa && (
        <TrattativaDetailDialog
          trattativa={selectedTrattativa}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedTrattativa(null);
          }}
        />
      )}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivia trattative</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveMode === "selected"
                ? `Stai per archiviare ${selectedIds.size} trattativa/e selezionata/e. Saranno visibili nella vista Archiviate.`
                : "Stai per archiviare tutte le trattative chiuse (vinte e perse). Saranno visibili nella vista Archiviate."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveMutation.mutate(archiveMode)}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reopenId} onOpenChange={(o) => !o && setReopenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riapri trattativa</AlertDialogTitle>
            <AlertDialogDescription>
              La trattativa verrà rimessa in stato &quot;Aperta&quot; e tornerà nella vista In corso. Confermi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => reopenId && reopenMutation.mutate(reopenId)}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrattativeList;
