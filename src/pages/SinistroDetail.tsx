import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, CheckCircle, AlertTriangle, Check, Pencil } from "lucide-react";
import { useTabParam } from "@/hooks/useTabParam";
import { cn } from "@/lib/utils";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { labelAgenziaRiferimento } from "@/lib/compagniaDisplay";
import SinistroDatiPraticaPanel from "@/components/sinistri/SinistroDatiPraticaPanel";
import SinistroPrescrizioniPanel from "@/components/sinistri/SinistroPrescrizioniPanel";
import SinistroNoteInternePanel from "@/components/sinistri/SinistroNoteInternePanel";
import SinistroPolizzaSelector from "@/components/sinistri/SinistroPolizzaSelector";
import SinistroCompagniaHeaderField from "@/components/sinistri/SinistroCompagniaHeaderField";
import { useAuth } from "@/contexts/AuthContext";
import {
  badgeClassStatoSinistro,
  isStatoChiusuraArchivio,
  labelStatoSinistro,
  optionsStatoSinistro,
  puoModificareCompagniaSinistro,
  puoRiaprireSinistro,
  statiSelezionabiliPerCambio,
} from "@/lib/sinistriStati";

const SINISTRO_TABS_BASE = ["dati", "checklist", "eventi", "prescrizioni", "documenti", "chat", "note_interne", "timeline"] as const;

const eventoStatoBadge: Record<string, string> = {
  attivo: "bg-blue-100 text-blue-800",
  completato: "bg-green-100 text-green-800",
  scaduto: "bg-red-100 text-red-800",
};

const fmtDateSafe = (value?: string | null) => {
  if (!value) return "—";
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yyyy") : "—";
};

export default function SinistroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, hasPermission, user, profile } = useAuth();
  const canManage = isAdmin || hasPermission("sinistri");
  const [checklistDialog, setChecklistDialog] = useState(false);
  const [eventoDialog, setEventoDialog] = useState(false);
  const [newChecklist, setNewChecklist] = useState({ descrizione: "", obbligatorio: true });
  const [newEvento, setNewEvento] = useState({ tipo_evento: "", data_scadenza: "", note: "" });
  const [statoTarget, setStatoTarget] = useState<string>("");
  const [statoNote, setStatoNote] = useState<string>("");
  const [polizzaDialogOpen, setPolizzaDialogOpen] = useState(false);

  const { data: sinistro } = useQuery({
    queryKey: ["sinistro", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sinistri")
        .select("*, compagnie(id, nome, telefono, cellulare, mail, mail_ec, pec, tipo), profiles!sinistri_responsabile_id_fkey(nome, cognome), liquidatore:anagrafiche_professionali!sinistri_liquidatore_id_fkey(nome, cognome, ragione_sociale), titoli(numero_titolo, stato, garanzia_a, data_scadenza, compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome, telefono, cellulare, mail, mail_ec, pec, tipo, gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione)), compagnia_rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(gruppi_compagnia:gruppo_compagnia_id(descrizione, compagnie:compagnie(id, nome, telefono, cellulare, mail, mail_ec, pec, tipo))), ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione))), clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva)")
        .eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (sinistro?.stato === "bozza" && id) {
      navigate(`/sinistri/apertura?bozza_id=${id}`, { replace: true });
    }
  }, [sinistro?.stato, id, navigate]);

  const tabList = SINISTRO_TABS_BASE;
  const [activeTab, setActiveTab] = useTabParam(tabList as any, "dati");

  const { data: checklist } = useQuery({
    queryKey: ["sinistro-checklist", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_checklist").select("*").eq("sinistro_id", id!).order("created_at");
      return data || [];
    },
  });

  const { data: eventi } = useQuery({
    queryKey: ["sinistro-eventi", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("*").eq("sinistro_id", id!).order("data_scadenza");
      return data || [];
    },
  });

  const { data: prescrizioni } = useQuery({
    queryKey: ["sinistro-prescrizioni", id],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_prescrizioni").select("id, stato").eq("sinistro_id", id!);
      return data || [];
    },
  });

  const prescrizioniAttive = prescrizioni?.filter((p: { stato: string }) => p.stato === "bozza" || p.stato === "inviata").length ?? 0;

  // Timeline is now rendered by TimelineTab component

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-checklist", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-eventi", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-prescrizioni", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-note-interne", id] });
    qc.invalidateQueries({ queryKey: ["sinistro-reminder", id] });
    qc.invalidateQueries({ queryKey: ["timeline", "sinistro", id] });
  };

  // Realtime: aggiorna dettaglio sinistro, checklist ed eventi su qualsiasi change
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`sinistro-rt-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["sinistro", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistro_checklist", filter: `sinistro_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["sinistro-checklist", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistro_eventi", filter: `sinistro_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["sinistro-eventi", id] });
          qc.invalidateQueries({ queryKey: ["timeline", "sinistro", id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const toggleChecklist = async (item: any) => {
    await supabase.from("sinistro_checklist").update({ completato: !item.completato }).eq("id", item.id);
    invalidate();
  };

  const addChecklist = async () => {
    await supabase.from("sinistro_checklist").insert({ sinistro_id: id, ...newChecklist });
    setChecklistDialog(false);
    setNewChecklist({ descrizione: "", obbligatorio: true });
    invalidate();
  };

  const addEvento = async () => {
    await supabase.from("sinistro_eventi").insert({ sinistro_id: id, ...newEvento });
    setEventoDialog(false);
    setNewEvento({ tipo_evento: "", data_scadenza: "", note: "" });
    invalidate();
  };

  const completaEvento = async (eventoId: string) => {
    await supabase.from("sinistro_eventi").update({ stato: "completato" }).eq("id", eventoId);
    invalidate();
  };

  const cambiaStato = async (nuovo: string, note?: string) => {
    if (!puoRiaprireSinistro(isAdmin ? "admin" : profile?.ruolo, sinistro?.stato, nuovo)) {
      toast.error("Solo un amministratore può riaprire una pratica chiusa o archiviata.");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: { azione: "cambia_stato", sinistro_id: id, nuovo_stato: nuovo, user_id: user?.id, note: note || undefined },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      toast.success(`Stato aggiornato a "${labelStatoSinistro(nuovo)}"`);
      setStatoTarget("");
      setStatoNote("");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!sinistro) return null;

  const isChiuso = isStatoChiusuraArchivio(sinistro.stato);
  const statiCambio = statiSelezionabiliPerCambio(sinistro.stato, isAdmin);

  const clienteNome = resolveClienteNome(sinistro.clienti);

  const checklistDone = checklist?.filter((c: any) => c.completato).length ?? 0;
  const checklistTot = checklist?.length ?? 0;
  const eventiAttivi = eventi?.filter((e: any) => e.stato === "attivo").length ?? 0;

  const stepMeta: Record<string, { label: string; badge?: string }> = {
    dati: { label: "Dati Pratica" },
    checklist: {
      label: "Checklist",
      badge: checklistTot > 0 ? `${checklistDone}/${checklistTot}` : undefined,
    },
    eventi: {
      label: "Eventi",
      badge: eventiAttivi > 0 ? String(eventiAttivi) : undefined,
    },
    prescrizioni: {
      label: "Prescrizioni",
      badge: prescrizioniAttive > 0 ? String(prescrizioniAttive) : undefined,
    },
    documenti: { label: "Documenti" },
    chat: { label: "Chat" },
    note_interne: { label: "Note interne" },
    timeline: { label: "Log Attività" },
  };

  const safeTab: string = (tabList as readonly string[]).includes(activeTab) ? activeTab : "dati";

  // Contesto AI per gli scanner di sinistro: include CF/P.IVA del cliente
  // collegato così l'AI sa a chi appartengono perizie e referti.
  const sinistroAiContext = {
    entityType: "sinistro" as const,
    scopeHint: `Sinistro ${sinistro.numero_sinistro ?? id} — ${clienteNome}`,
    expectedCF: sinistro.clienti?.codice_fiscale ?? null,
    expectedPIVA: sinistro.clienti?.partita_iva ?? null,
  };

  const responsabileNome = sinistro.profiles
    ? `${sinistro.profiles.nome || ""} ${sinistro.profiles.cognome || ""}`.trim()
    : "—";

  return (
    <Tabs value={safeTab} onValueChange={setActiveTab} className="space-y-4">
      {/*
        Chrome sticky sotto topbar globale (Topbar h-14 → top-14, z-10 < topbar z-20).
        Titolo + cambio stato + step condividono lo stesso wrapper: gli step restano
        sempre sotto l'header (niente offset fisso — l'altezza varia con wrap/stato).
      */}
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 bg-background border-b border-border/60">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
              <h1 className="text-xl font-bold truncate">
                Sinistro {sinistro.numero_sinistro || "—"}
              </h1>
              <Badge className={`text-xs px-2.5 py-0.5 ${badgeClassStatoSinistro(sinistro.stato)}`}>
                {labelStatoSinistro(sinistro.stato)}
              </Badge>
              {sinistro.sinistro_terzi && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-800 bg-amber-50 font-medium">
                  Sinistro Terzi
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="uppercase tracking-wide text-[10px] font-medium text-muted-foreground/80">Cliente</span>
              {sinistro.cliente_anagrafica_id ? (
                <button
                  type="button"
                  className="font-medium text-foreground hover:underline truncate max-w-[220px]"
                  onClick={() => navigate(`/archivi/clienti/${sinistro.cliente_anagrafica_id}`)}
                >
                  {clienteNome}
                </button>
              ) : (
                <span className="font-medium text-foreground">{clienteNome}</span>
              )}
              <span className="text-border">·</span>
              <span className="uppercase tracking-wide text-[10px] font-medium text-muted-foreground/80">Polizza</span>
              {!sinistro.sinistro_terzi && sinistro.titolo_id ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    className="font-medium text-foreground hover:underline truncate max-w-[180px]"
                    onClick={() => navigate(`/titoli/${sinistro.titolo_id}`)}
                  >
                    {sinistro.titoli?.numero_titolo || "—"}
                  </button>
                  {canManage && !isChiuso && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      title="Modifica polizza e tipo di copertura"
                      onClick={() => setPolizzaDialogOpen(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </span>
              ) : !sinistro.sinistro_terzi && canManage && !isChiuso && sinistro.cliente_anagrafica_id ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs font-medium"
                  onClick={() => setPolizzaDialogOpen(true)}
                >
                  Collega polizza
                </Button>
              ) : (
                <span className="font-medium text-foreground">
                  {sinistro.sinistro_terzi
                    ? (sinistro.numero_polizza || "Terzi (senza CBnet)")
                    : "—"}
                </span>
              )}
              <span className="text-border">·</span>
              <span>{formatTipoSinistro(sinistro)}</span>
              <span className="text-border">·</span>
              <span className="uppercase tracking-wide text-[10px] font-medium text-muted-foreground/80">
                Compagnia
              </span>
              {canManage && puoModificareCompagniaSinistro(sinistro.stato) ? (
                <SinistroCompagniaHeaderField
                  sinistroId={id!}
                  compagniaId={sinistro.compagnia_id}
                  compagniaNome={sinistro.compagnie?.nome}
                  onSaved={invalidate}
                />
              ) : (
                <span className="truncate max-w-[160px]" title={sinistro.compagnie?.nome || undefined}>
                  {sinistro.compagnie?.nome || "—"}
                </span>
              )}
              <span className="text-border">·</span>
              <span>
                Accadimento {fmtDateSafe(sinistro.data_evento)}
              </span>
              <span className="text-border">·</span>
              <span className="truncate max-w-[160px]">Resp. {responsabileNome || "—"}</span>
            </div>
          </div>
        </div>

        {/* Cambio stato compatto */}
        {canManage && (
          <div className="mt-3 ml-12 flex flex-col sm:flex-row gap-2 sm:items-end">
            {isChiuso && (
              <p className="text-[11px] text-amber-700 sm:w-full basis-full">
                {isAdmin
                  ? "Pratica chiusa o archiviata: solo admin può riaprire/modificare lo stato."
                  : "Pratica chiusa o archiviata: la tendina non offre la riapertura. Solo un amministratore può riaprire."}
              </p>
            )}
            <div className="flex-1 min-w-[220px]">
              <Label className="text-[10px] uppercase text-muted-foreground">Nuovo stato</Label>
              <SearchableSelect
                options={optionsStatoSinistro(statiCambio)}
                value={statoTarget}
                onValueChange={setStatoTarget}
                placeholder="Seleziona…"
                searchPlaceholder="Cerca stato…"
                emptyText="Nessuno stato disponibile."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-[2]">
              <Label className="text-[10px] uppercase text-muted-foreground">Note</Label>
              <Input
                className="h-8 text-xs"
                value={statoNote}
                onChange={(e) => setStatoNote(e.target.value)}
                placeholder="Motivazione (opzionale)"
              />
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0"
              disabled={!statoTarget}
              onClick={() => cambiaStato(statoTarget, statoNote)}
            >
              Aggiorna stato
            </Button>
          </div>
        )}

        {/* Stepper: overflow-x invariato; pin con il wrapper sticky sopra */}
        <div className="overflow-x-auto -mx-1 px-1 mt-3 pb-1 bg-background">
          <TabsList className="h-auto w-max min-w-full justify-start gap-0 bg-transparent p-0 border-b-0 rounded-none">
            {tabList.map((tab, idx) => {
              const meta = stepMeta[tab] || { label: tab };
              const isActive = safeTab === tab;
              const isPast = idx < Math.max(0, tabList.indexOf(safeTab as any));
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={cn(
                    "relative flex items-center gap-2 rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs font-medium shadow-none",
                    "data-[state=active]:shadow-none data-[state=active]:bg-transparent",
                    isActive && "border-b-[#0B4C50] text-[#0B4C50]",
                    !isActive && isPast && "text-foreground/80",
                    !isActive && !isPast && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold border shrink-0",
                      isActive && "bg-[#0B4C50] text-white border-[#0B4C50]",
                      !isActive && isPast && "bg-[#0B4C50]/15 text-[#0B4C50] border-[#0B4C50]/40",
                      !isActive && !isPast && "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {isPast && !isActive ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <span className="whitespace-nowrap">{meta.label}</span>
                  {meta.badge && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums",
                        isActive ? "bg-[#0B4C50]/15 text-[#0B4C50]" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {meta.badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>

      <Dialog open={polizzaDialogOpen} onOpenChange={setPolizzaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica polizza e tipo di copertura</DialogTitle>
          </DialogHeader>
          <SinistroPolizzaSelector
            sinistroId={id!}
            clienteId={sinistro.cliente_anagrafica_id}
            currentTitoloId={sinistro.titolo_id}
            showTipoCopertura
            currentTipoSinistro={sinistro.tipo_sinistro}
            currentTipoPersonalizzato={sinistro.tipo_sinistro_personalizzato}
            onSaved={() => {
              setPolizzaDialogOpen(false);
              invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

        <TabsContent value="dati" className="space-y-4 mt-0">
          <SinistroDatiPraticaPanel
            sinistro={sinistro as unknown as React.ComponentProps<typeof SinistroDatiPraticaPanel>["sinistro"]}
            canEdit={canManage}
            onSaved={invalidate}
          />
          {sinistro.note_perito && (
            <div className="rounded-md border border-border/70 bg-background p-4">
              <p className="text-sm font-semibold mb-2">Note Perito / Report SIR</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {sinistro.note_perito.startsWith("[SIR_REPORT]")
                  ? "Bozza report SIR salvata (apri Report SIR per modificare)"
                  : sinistro.note_perito}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4 mt-0">
          <div className="rounded-md border border-border/70 bg-background p-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={checklistDialog} onOpenChange={setChecklistDialog}>
              <DialogTrigger asChild><Button size="sm" disabled={isChiuso}><Plus className="h-4 w-4 mr-1" /> Aggiungi</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova Checklist</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Descrizione</Label><Input value={newChecklist.descrizione} onChange={e => setNewChecklist({ ...newChecklist, descrizione: e.target.value })} /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={newChecklist.obbligatorio} onCheckedChange={v => setNewChecklist({ ...newChecklist, obbligatorio: !!v })} />
                    <Label>Obbligatorio</Label>
                  </div>
                  <Button onClick={addChecklist} className="w-full">Aggiungi</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="space-y-2">
            {checklist?.map((item: any) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 border rounded-md ${item.completato ? "bg-muted/50" : ""}`}>
                <Checkbox checked={item.completato} onCheckedChange={() => toggleChecklist(item)} disabled={isChiuso} />
                <span className={item.completato ? "line-through text-muted-foreground" : ""}>{item.descrizione}</span>
                {item.obbligatorio && <Badge variant="outline" className="ml-auto text-xs">Obbligatorio</Badge>}
              </div>
            ))}
            {!checklist?.length && <p className="text-center text-muted-foreground py-4">Nessun elemento</p>}
          </div>
          </div>
        </TabsContent>

        <TabsContent value="eventi" className="space-y-4 mt-0">
          <div className="rounded-md border border-border/70 bg-background p-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={eventoDialog} onOpenChange={setEventoDialog}>
              <DialogTrigger asChild><Button size="sm" disabled={isChiuso}><Plus className="h-4 w-4 mr-1" /> Aggiungi Evento</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuovo Evento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Tipo Evento</Label>
                    <Select value={newEvento.tipo_evento} onValueChange={v => setNewEvento({ ...newEvento, tipo_evento: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attesa_documento">Attesa Documento</SelectItem>
                        <SelectItem value="perizia">Perizia</SelectItem>
                        <SelectItem value="sollecito">Sollecito</SelectItem>
                        <SelectItem value="altro">Altro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Scadenza</Label><Input type="date" value={newEvento.data_scadenza} onChange={e => setNewEvento({ ...newEvento, data_scadenza: e.target.value })} /></div>
                  <div><Label>Note</Label><Input value={newEvento.note} onChange={e => setNewEvento({ ...newEvento, note: e.target.value })} /></div>
                  <Button onClick={addEvento} className="w-full">Aggiungi</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Note</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventi?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="capitalize">{(e.tipo_evento || "—").replace(/_/g, " ")}</TableCell>
                  <TableCell>{fmtDateSafe(e.data_scadenza)}</TableCell>
                  <TableCell><Badge className={eventoStatoBadge[e.stato]}>{e.stato}</Badge></TableCell>
                  <TableCell>{e.note || "—"}</TableCell>
                  <TableCell>
                    {e.stato === "attivo" && (
                      <Button size="sm" variant="outline" onClick={() => completaEvento(e.id)}><CheckCircle className="h-4 w-4 mr-1" /> Completa</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!eventi?.length && <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nessun evento</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </TabsContent>

        <TabsContent value="prescrizioni" className="space-y-4">
          {safeTab === "prescrizioni" && (
            <SinistroPrescrizioniPanel
              sinistroId={id!}
              dataDenuncia={sinistro.data_evento || sinistro.data_denuncia}
              agenziaRiferimento={
                labelAgenziaRiferimento(sinistro.titoli as any) ||
                null
              }
              disabled={isChiuso && !isAdmin}
            />
          )}
        </TabsContent>

        <TabsContent value="documenti" className="space-y-4 mt-0">
          {!isChiuso && (
            <div className="rounded-md border border-border/70 p-4 space-y-2">
              <p className="text-sm font-semibold">Scansione AI documenti</p>
              <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="perizia"
                    entityContext={sinistroAiContext}
                    onFileReady={async (file) => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const path = `sinistro/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
                        if (uploadErr) throw uploadErr;
                        await supabase.from("documenti").insert({
                          nome_file: file.name,
                          path_storage: path,
                          bucket_name: "documenti_sinistri",
                          entita_tipo: "sinistro",
                          entita_id: id!,
                          caricato_da: user?.id,
                          categoria: "perizia",
                        });
                        toast.success("Perizia salvata nei documenti");
                        qc.invalidateQueries({ queryKey: ["documenti", "sinistro", id] });
                      } catch (err: any) {
                        toast.error("Errore salvataggio: " + err.message);
                      }
                    }}
                    onExtracted={() => {}}
                  />
                  <AiDocumentScanner
                    documentType="referto_medico"
                    entityContext={sinistroAiContext}
                    onFileReady={async (file) => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const path = `sinistro/${id}/${Date.now()}_${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from("documenti_sinistri").upload(path, file);
                        if (uploadErr) throw uploadErr;
                        await supabase.from("documenti").insert({
                          nome_file: file.name,
                          path_storage: path,
                          bucket_name: "documenti_sinistri",
                          entita_tipo: "sinistro",
                          entita_id: id!,
                          caricato_da: user?.id,
                          categoria: "referto_medico",
                        });
                        toast.success("Referto medico salvato nei documenti");
                        qc.invalidateQueries({ queryKey: ["documenti", "sinistro", id] });
                      } catch (err: any) {
                        toast.error("Errore salvataggio: " + err.message);
                      }
                    }}
                    onExtracted={() => {}}
                  />
              </div>
            </div>
          )}
          <DocumentiTab entitaTipo="sinistro" entitaId={id!} bucketName="documenti_sinistri" />
        </TabsContent>

        <TabsContent value="chat">
          <ChatTab entitaTipo="sinistro" entitaId={id!} />
        </TabsContent>

        <TabsContent value="note_interne" className="space-y-4 mt-0">
          <SinistroNoteInternePanel
            sinistroId={id!}
            currentUserId={user?.id}
            disabled={isChiuso && !isAdmin}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab entitaTipo="sinistro" entitaId={id!} />
        </TabsContent>
    </Tabs>
  );
}
