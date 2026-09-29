import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerPagination } from "@/hooks/useServerPagination";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServerPagination from "@/components/ServerPagination";
import { FilterMultiSelect } from "@/components/shared/FilterMultiSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { Bell, FileSpreadsheet, ArrowLeft, Search, RefreshCw, X } from "lucide-react";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import {
  type SinistroReminderRow,
  type SinistroReminderCategoria,
  type SinistroReminderStato,
  REMINDER_CATEGORIA_LABEL,
  REMINDER_CATEGORIA_OPTIONS,
  REMINDER_LIST_DEFAULT_STATI,
  REMINDER_STATO_CLASS,
  REMINDER_STATO_LABEL,
  reminderListSeesAllSedi,
} from "@/lib/sinistroPrescrizioniReminder";
import SinistroRiepilogoDialog from "@/components/sinistri/SinistroRiepilogoDialog";
import { useAuth } from "@/contexts/AuthContext";
import { applyStatoFiltroOperativo, labelStatoSinistro, SINISTRO_STATI } from "@/lib/sinistriStati";

const statiSinistro = [...SINISTRO_STATI];
const statiReminder: SinistroReminderStato[] = ["attivo", "completato", "annullato"];

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const parsed = parseISO(d);
  return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : "—";
};

export default function SinistroReminderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const seeAllSedi = reminderListSeesAllSedi(profile?.ruolo);

  const [filtroUffici, setFiltroUffici] = useState<string[]>([]);
  const [filtroCompagnie, setFiltroCompagnie] = useState<string[]>([]);
  const [filtroRami, setFiltroRami] = useState<string[]>([]);
  const [filtroStatiSinistro, setFiltroStatiSinistro] = useState<string[]>([]);
  const [filtroCategorie, setFiltroCategorie] = useState<string[]>([]);
  const [filtroStatiReminder, setFiltroStatiReminder] = useState<string[]>([...REMINDER_LIST_DEFAULT_STATI]);
  const [filtroResponsabili, setFiltroResponsabili] = useState<string[]>([]);
  const [dataScadenzaDal, setDataScadenzaDal] = useState("");
  const [dataScadenzaAl, setDataScadenzaAl] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSinistroId, setPreviewSinistroId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<SinistroReminderRow | null>(null);
  const [editTesto, setEditTesto] = useState("");
  const [editScadenza, setEditScadenza] = useState("");
  const [editCategoria, setEditCategoria] = useState<SinistroReminderCategoria>("altro");
  const [editAssegnato, setEditAssegnato] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<SinistroReminderRow | null>(null);
  const [completingRow, setCompletingRow] = useState<SinistroReminderRow | null>(null);
  const [acting, setActing] = useState(false);

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    filtroUffici.join(","),
    filtroCompagnie.join(","),
    filtroRami.join(","),
    filtroStatiSinistro.join(","),
    filtroCategorie.join(","),
    filtroStatiReminder.join(","),
    filtroResponsabili.join(","),
    dataScadenzaDal,
    dataScadenzaAl,
    search,
  ]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-reminder"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-reminder"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: rami = [] } = useQuery({
    queryKey: ["rami-reminder"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(descrizione)")
        .order("descrizione");
      return data || [];
    },
  });

  const { data: responsabili = [] } = useQuery({
    queryKey: ["profiles-responsabili-reminder-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return (data || []).map((p) => ({
        value: p.id,
        label: `${p.cognome || ""} ${p.nome || ""}`.trim(),
      }));
    },
  });

  const titoliSelect =
    filtroRami.length > 0
      ? "titoli!inner(numero_titolo, ramo_id, rami(descrizione))"
      : "titoli(numero_titolo, ramo_id, rami(descrizione))";

  const sinistriSelect = `
    id, numero_sinistro, stato, ufficio_id, compagnia_id, responsabile_id,
    compagnie(nome),
    profiles!sinistri_responsabile_id_fkey(nome, cognome),
    clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
    ${titoliSelect}
  `;

  const applyFilters = (q: any) => {
    if (filtroStatiReminder.length > 0) q = q.in("stato", filtroStatiReminder);
    if (filtroCategorie.length > 0) q = q.in("categoria", filtroCategorie);
    if (filtroResponsabili.length > 0) q = q.in("assegnato_a", filtroResponsabili);
    if (dataScadenzaDal) q = q.gte("data_scadenza", dataScadenzaDal);
    if (dataScadenzaAl) q = q.lte("data_scadenza", dataScadenzaAl);
    if (!seeAllSedi && profile?.ufficio_id) {
      q = q.eq("sinistri.ufficio_id", profile.ufficio_id);
    } else if (filtroUffici.length > 0) {
      q = q.in("sinistri.ufficio_id", filtroUffici);
    }
    if (filtroCompagnie.length > 0) q = q.in("sinistri.compagnia_id", filtroCompagnie);
    q = applyStatoFiltroOperativo(q, filtroStatiSinistro, "sinistri.stato");
    if (filtroRami.length > 0) q = q.in("sinistri.titoli.ramo_id", filtroRami);
    if (search) {
      q = q.or(`testo.ilike.%${search}%,sinistri.numero_sinistro.ilike.%${search}%`);
    }
    return q;
  };

  const { data: result, isLoading, refetch } = useQuery({
    queryKey: [
      "sinistri-reminder-list",
      page,
      filtroUffici,
      filtroCompagnie,
      filtroRami,
      filtroStatiSinistro,
      filtroCategorie,
      filtroStatiReminder,
      filtroResponsabili,
      dataScadenzaDal,
      dataScadenzaAl,
      search,
      seeAllSedi,
      profile?.ufficio_id,
    ],
    enabled: !!profile,
    queryFn: async () => {
      let q = supabase
        .from("sinistro_reminder" as any)
        .select(
          `*, assegnato:profiles!sinistro_reminder_assegnato_a_fkey(nome, cognome), sinistri!inner(${sinistriSelect})`,
          { count: "exact" },
        );
      q = applyFilters(q);
      const { data, count, error } = await q
        .order("data_scadenza", { ascending: true, nullsFirst: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: (data || []) as unknown as SinistroReminderRow[], count: count || 0 };
    },
  });

  const reminders = result?.data || [];
  const totalCount = result?.count || 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistri-reminder-list"] });
    qc.invalidateQueries({ queryKey: ["sinistro-reminder-popup"] });
  };

  const allPageSelected = reminders.length > 0 && reminders.every((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) reminders.forEach((r) => next.delete(r.id));
      else reminders.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const updateReminder = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("sinistro_reminder" as any).update(patch).eq("id", id);
    if (error) throw error;
    invalidate();
  };

  const bulkAction = async (patch: Record<string, unknown>, label: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Nessun reminder selezionato");
      return;
    }
    try {
      const { error } = await supabase.from("sinistro_reminder" as any).update(patch).in("id", ids);
      if (error) throw error;
      toast.success(`${label}: ${ids.length} reminder`);
      setSelectedIds(new Set());
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  };

  const openEdit = (row: SinistroReminderRow) => {
    setEditRow(row);
    setEditTesto(row.testo);
    setEditScadenza((row.data_scadenza || row.data_promemoria || "").slice(0, 10));
    setEditCategoria(row.categoria || "altro");
    setEditAssegnato(row.assegnato_a || "");
  };

  const requestSaveEdit = () => {
    if (!editRow) return;
    if (!editTesto.trim()) {
      toast.error("Inserisci il testo del reminder");
      return;
    }
    if (!editScadenza) {
      toast.error("Inserisci la data di scadenza");
      return;
    }
    if (!editAssegnato) {
      toast.error("Seleziona il responsabile assegnato");
      return;
    }
    setConfirmSaveOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await updateReminder(editRow.id, {
        testo: editTesto.trim(),
        data_scadenza: editScadenza,
        data_promemoria: editScadenza,
        categoria: editCategoria,
        assegnato_a: editAssegnato,
        popup_mostrato_at: null,
      });
      toast.success("Reminder aggiornato");
      setConfirmSaveOpen(false);
      setEditRow(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  };

  const isCompletato = (row: SinistroReminderRow) =>
    row.stato === "completato" || row.stato === "annullato" || row.completato === true;

  const handleElimina = async () => {
    if (!deletingRow) return;
    setActing(true);
    try {
      await updateReminder(deletingRow.id, { stato: "annullato", completato: true });
      toast.success("Reminder eliminato");
      setDeletingRow(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setActing(false);
    }
  };

  const handleCompleto = async () => {
    if (!completingRow) return;
    setActing(true);
    try {
      await updateReminder(completingRow.id, { stato: "completato", completato: true, letto: true });
      toast.success("Reminder completato");
      setCompletingRow(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setActing(false);
    }
  };

  const resetFiltri = () => {
    setFiltroUffici([]);
    setFiltroCompagnie([]);
    setFiltroRami([]);
    setFiltroStatiSinistro([]);
    setFiltroCategorie([]);
    setFiltroStatiReminder([...REMINDER_LIST_DEFAULT_STATI]);
    setFiltroResponsabili([]);
    setDataScadenzaDal("");
    setDataScadenzaAl("");
    setSearch("");
    setPage(0);
  };

  const hasFiltriAttivi =
    filtroUffici.length > 0 ||
    filtroCompagnie.length > 0 ||
    filtroRami.length > 0 ||
    filtroStatiSinistro.length > 0 ||
    filtroCategorie.length > 0 ||
    filtroStatiReminder.join(",") !== REMINDER_LIST_DEFAULT_STATI.join(",") ||
    filtroResponsabili.length > 0 ||
    dataScadenzaDal !== "" ||
    dataScadenzaAl !== "" ||
    search !== "";

  const ramiOptions = rami.map((r: any) => ({
    value: r.id,
    label: r.gruppo_ramo?.descrizione ? `${r.gruppo_ramo.descrizione} · ${r.descrizione || "—"}` : r.descrizione || "—",
  }));

  const mapExportRow = (r: SinistroReminderRow) => {
    const s = r.sinistri;
    return {
      Categoria: REMINDER_CATEGORIA_LABEL[r.categoria] || r.categoria,
      Testo: r.testo,
      Scadenza: fmtDate(r.data_scadenza || r.data_promemoria),
      Stato: REMINDER_STATO_LABEL[r.stato],
      Letto: r.letto ? "Sì" : "No",
      "N° Sinistro": s?.numero_sinistro || "",
      Cliente: resolveClienteNome(s?.clienti),
      Polizza: s?.titoli?.numero_titolo || "",
      Compagnia: s?.compagnie?.nome || "",
      Ramo: s?.titoli?.rami?.descrizione || "",
      Responsabile: r.assegnato ? `${r.assegnato.cognome || ""} ${r.assegnato.nome || ""}`.trim() : "",
    };
  };

  const handleExport = async (mode: "all" | "selected") => {
    try {
      toast.loading("Esportazione…");
      let rows: SinistroReminderRow[] = [];
      if (mode === "selected") {
        rows = reminders.filter((r) => selectedIds.has(r.id));
        if (rows.length === 0) {
          toast.dismiss();
          toast.error("Nessun reminder selezionato");
          return;
        }
      } else {
        let q = supabase
          .from("sinistro_reminder" as any)
          .select(`*, assegnato:profiles!sinistro_reminder_assegnato_a_fkey(nome, cognome), sinistri!inner(${sinistriSelect})`);
        q = applyFilters(q);
        const { data, error } = await q.order("data_scadenza", { ascending: true });
        if (error) throw error;
        rows = (data || []) as unknown as SinistroReminderRow[];
      }
      const ws = XLSX.utils.json_to_sheet(rows.map(mapExportRow));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reminder Sinistri");
      XLSX.writeFile(wb, `reminder_sinistri_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
      toast.dismiss();
      toast.success("Export completato");
    } catch (e: unknown) {
      toast.dismiss();
      toast.error(e instanceof Error ? e.message : "Errore export");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/sinistri")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> Reminder sinistri
            </h1>
            <p className="text-muted-foreground">
              Promemoria collegati alle pratiche sinistro, per responsabile e scadenza
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("all")} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-700" /> Esporta
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => bulkAction({ letto: true }, "Segnati come letti")}>
                Segna letti ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkAction({ stato: "completato", completato: true }, "Completati")}>
                Completa ({selectedIds.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkAction({ stato: "annullato", completato: true }, "Annullati")}>
                Annulla ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {seeAllSedi && (
            <div className="space-y-1">
              <Label className="text-xs">Ufficio</Label>
              <FilterMultiSelect value={filtroUffici} onChange={(v) => { setFiltroUffici(v); setPage(0); }} options={uffici.map((u: any) => ({ value: u.id, label: u.nome_ufficio }))} placeholder="Tutti" allLabel="Tutti gli uffici" searchPlaceholder="Cerca ufficio…" />
            </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Ramo</Label>
              <FilterMultiSelect value={filtroRami} onChange={(v) => { setFiltroRami(v); setPage(0); }} options={ramiOptions} placeholder="Tutti" allLabel="Tutti i rami" searchPlaceholder="Cerca ramo…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Compagnia</Label>
              <FilterMultiSelect value={filtroCompagnie} onChange={(v) => { setFiltroCompagnie(v); setPage(0); }} options={compagnie.map((c: any) => ({ value: c.id, label: c.nome }))} placeholder="Tutte" allLabel="Tutte le compagnie" searchPlaceholder="Cerca compagnia…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scadenza Dal</Label>
              <Input type="date" value={dataScadenzaDal} onChange={(e) => { setDataScadenzaDal(e.target.value); setPage(0); }} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scadenza Al</Label>
              <Input type="date" value={dataScadenzaAl} onChange={(e) => { setDataScadenzaAl(e.target.value); setPage(0); }} className="h-9" />
            </div>
          </div>
          <div className="flex gap-3 items-end flex-wrap pt-2 border-t">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Label className="text-xs">Ricerca</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Testo o N° sinistro…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
              </div>
            </div>
            <div className="space-y-1 w-48">
              <Label className="text-xs">Stato sinistro</Label>
              <FilterMultiSelect value={filtroStatiSinistro} onChange={(v) => { setFiltroStatiSinistro(v); setPage(0); }} options={statiSinistro.map((s) => ({ value: s, label: labelStatoSinistro(s) }))} placeholder="Tutti" allLabel="Tutti gli stati" searchPlaceholder="Cerca…" />
            </div>
            <div className="space-y-1 w-44">
              <Label className="text-xs">Categoria</Label>
              <FilterMultiSelect value={filtroCategorie} onChange={(v) => { setFiltroCategorie(v); setPage(0); }} options={REMINDER_CATEGORIA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} placeholder="Tutte" allLabel="Tutte" searchPlaceholder="Cerca…" />
            </div>
            <div className="space-y-1 w-44">
              <Label className="text-xs">Stato reminder</Label>
              <FilterMultiSelect value={filtroStatiReminder} onChange={(v) => { setFiltroStatiReminder(v); setPage(0); }} options={statiReminder.map((s) => ({ value: s, label: REMINDER_STATO_LABEL[s] }))} placeholder="Tutti" allLabel="Tutti" searchPlaceholder="Cerca…" />
            </div>
            <div className="space-y-1 w-48">
              <Label className="text-xs">Assegnato a</Label>
              <FilterMultiSelect value={filtroResponsabili} onChange={(v) => { setFiltroResponsabili(v); setPage(0); }} options={responsabili} placeholder="Tutti" allLabel="Tutti" searchPlaceholder="Cerca…" />
            </div>
            {hasFiltriAttivi && (
              <Button variant="ghost" size="sm" onClick={resetFiltri} className="h-9 text-xs">
                <X className="h-3.5 w-3.5 mr-1" /> Reset filtri
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Elenco reminder ({totalCount})</CardTitle>
          <CardDescription>
            {seeAllSedi
              ? "Tutti i reminder collegati alle pratiche sinistro"
              : "Reminder delle pratiche della tua sede (attivi e completati)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
              <TableHeader className="table-header-colored">
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAllPage} aria-label="Seleziona tutti" /></TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Testo</TableHead>
                  <TableHead>N° Sinistro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Polizza</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="w-[220px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Caricamento…</TableCell></TableRow>
                ) : reminders.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nessun reminder trovato</TableCell></TableRow>
                ) : (
                  reminders.map((r) => (
                    <TableRow key={r.id} className={r.letto ? "opacity-75" : ""}>
                      <TableCell><Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{REMINDER_CATEGORIA_LABEL[r.categoria]}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.testo}</TableCell>
                      <TableCell>
                        <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setPreviewSinistroId(r.sinistri?.id || r.sinistro_id)}>
                          {r.sinistri?.numero_sinistro || "—"}
                        </button>
                      </TableCell>
                      <TableCell>{resolveClienteNome(r.sinistri?.clienti)}</TableCell>
                      <TableCell>{r.sinistri?.titoli?.numero_titolo || "—"}</TableCell>
                      <TableCell>{r.assegnato ? `${r.assegnato.cognome || ""} ${r.assegnato.nome || ""}`.trim() : "—"}</TableCell>
                      <TableCell>{fmtDate(r.data_scadenza || r.data_promemoria)}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${REMINDER_STATO_CLASS[r.stato]}`}>{REMINDER_STATO_LABEL[r.stato]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(r)}>
                            Modifica
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setDeletingRow(r)}>
                            Elimina
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={isCompletato(r)}
                            onClick={() => setCompletingRow(r)}
                          >
                            Completo
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>

      <SinistroRiepilogoDialog
        sinistroId={previewSinistroId}
        open={!!previewSinistroId}
        onOpenChange={(o) => { if (!o) setPreviewSinistroId(null); }}
      />

      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) { setEditRow(null); setConfirmSaveOpen(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica reminder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Categoria</Label>
              <Select value={editCategoria} onValueChange={(v) => setEditCategoria(v as SinistroReminderCategoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_CATEGORIA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsabile</Label>
              <SearchableSelect value={editAssegnato} onValueChange={setEditAssegnato} options={responsabili} placeholder="Responsabile…" />
            </div>
            <div>
              <Label>Testo</Label>
              <Textarea value={editTesto} onChange={(e) => setEditTesto(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Scadenza</Label>
              <Input type="date" value={editScadenza} onChange={(e) => setEditScadenza(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Annulla</Button>
            <Button disabled={saving} onClick={requestSaveEdit}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSaveOpen} onOpenChange={(o) => !saving && setConfirmSaveOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermare le modifiche?</AlertDialogTitle>
            <AlertDialogDescription>
              Il reminder verrà aggiornato con testo, scadenza, assegnatario e categoria indicati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void saveEdit(); }} disabled={saving}>
              Conferma salvataggio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRow} onOpenChange={(o) => { if (!o && !acting) setDeletingRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Il reminder verrà annullato e rimosso dai promemoria attivi. L&apos;operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleElimina(); }}
              disabled={acting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Conferma elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!completingRow} onOpenChange={(o) => { if (!o && !acting) setCompletingRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Segnare come completato?</AlertDialogTitle>
            <AlertDialogDescription>
              Il reminder verrà contrassegnato come completato. Non riceverai più notifiche per questa scadenza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleCompleto(); }} disabled={acting}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
