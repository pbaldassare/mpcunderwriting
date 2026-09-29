import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, Plus, Pencil, Star, Trash2, Search, Building2, Briefcase, Landmark, List, Network, ShieldCheck, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import ServerPagination from "@/components/ServerPagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import ContoSediMultiSelect from "@/components/anagrafiche/ContoSediMultiSelect";
import { validateIban } from "@/lib/validateIban";
import { isConsulbrokersContoTipo, validateContoBancarioSedi } from "@/lib/contiBancariSedi";
import {
  saveSediContoBancario,
  fetchSediContoBancario,
  formatContoBancarioSaveError,
} from "@/lib/contiBancariSediDb";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ContoBancario {
  id: string;
  etichetta: string;
  iban: string;
  intestato_a: string;
  banca: string | null;
  bic: string | null;
  codice_abi: string | null;
  codice_cab: string | null;
  citta_banca: string | null;
  tipo: string;
  is_default: boolean;
  ufficio_id: string | null;
  ufficio_ids?: string[];
  compagnia_id: string | null;
  rapporto_id: string | null;
  piano_conti_conto_id: string | null;
  attivo: boolean;
  note: string | null;
  conti_bancari_uffici?: Array<{
    ufficio_id: string;
    ufficio?: { nome_ufficio: string; codice_ufficio: string } | null;
  }>;
}

// Tipi Consul (sottocategorie) — usate solo nella tab Consulbrokers
const CONSUL_SUBTIPI = [
  { value: "incasso_clienti", label: "Incasso clienti" },
  { value: "provvigioni", label: "Provvigioni" },
  { value: "generico", label: "Generico" },
];

// Tipi entità — uno per tab
const ENTITY_TIPI = [
  { value: "agenzia", label: "Agenzia" },
  { value: "broker", label: "Broker" },
  { value: "direzione", label: "Direzione" },
  { value: "plurimandataria", label: "Plurimandataria" },
] as const;

const TIPO_LABEL: Record<string, string> = {
  incasso_clienti: "Incasso clienti",
  provvigioni: "Provvigioni",
  generico: "Generico",
  agenzia: "Agenzia",
  broker: "Broker",
  direzione: "Direzione",
  plurimandataria: "Plurimandataria",
};

const TIPO_BADGE: Record<string, string> = {
  incasso_clienti: "bg-teal-100 text-teal-800 border-teal-200",
  provvigioni: "bg-sky-100 text-sky-800 border-sky-200",
  generico: "bg-slate-100 text-slate-800 border-slate-200",
  agenzia: "bg-emerald-100 text-emerald-800 border-emerald-200",
  broker: "bg-blue-100 text-blue-800 border-blue-200",
  direzione: "bg-purple-100 text-purple-800 border-purple-200",
  plurimandataria: "bg-orange-100 text-orange-800 border-orange-200",
};

type CategoriaKey = "consul" | "agenzie" | "broker" | "direzioni" | "plurimandatari" | "all";

const CATEGORIE: Record<CategoriaKey, { label: string; icon: React.ComponentType<any>; tipi: string[] | null; defaultTipo: string }> = {
  consul:          { label: "Consulbrokers",  icon: Briefcase, tipi: ["incasso_clienti", "provvigioni", "generico"], defaultTipo: "incasso_clienti" },
  agenzie:         { label: "Agenzie",        icon: Landmark,  tipi: ["agenzia"],                                     defaultTipo: "agenzia" },
  broker:          { label: "Broker",         icon: Building,  tipi: ["broker"],                                      defaultTipo: "broker" },
  direzioni:       { label: "Direzioni",      icon: ShieldCheck, tipi: ["direzione"],                                 defaultTipo: "direzione" },
  plurimandatari:  { label: "Plurimandatari", icon: Network,   tipi: ["plurimandataria"],                             defaultTipo: "plurimandataria" },
  all:             { label: "Tutti",          icon: List,      tipi: null,                                            defaultTipo: "incasso_clienti" },
};

// PAGE_SIZE gestito da useServerPagination (default 25)

const emptyForm: Partial<ContoBancario> = {
  etichetta: "",
  iban: "",
  intestato_a: "",
  banca: "",
  bic: "",
  codice_abi: "",
  codice_cab: "",
  citta_banca: "",
  tipo: "incasso_clienti",
  is_default: false,
  ufficio_id: null,
  ufficio_ids: [],
  compagnia_id: null,
  rapporto_id: null,
  attivo: true,
  note: "",
};

const maskIban = (iban: string) => {
  if (!iban || iban.length < 8) return iban;
  return iban.slice(0, 4) + " **** **** **** " + iban.slice(-4);
};

const isConsulTipo = (t?: string | null) => t === "incasso_clienti" || t === "provvigioni" || t === "generico";
const isEntityTipo = (t?: string | null) => t === "agenzia" || t === "broker" || t === "direzione" || t === "plurimandataria";
const supportsRapporto = (t?: string | null) => t === "broker" || t === "plurimandataria";

export default function ContiBancariPage() {
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<CategoriaKey>("consul");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [soloAttivi, setSoloAttivi] = useState(true);
  const { page, setPage, pageSize, range, resetPage } = useServerPagination(25, [categoria, search, soloAttivi]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<ContoBancario>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ContoBancario | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: counts } = useQuery({
    queryKey: ["conti_bancari_counts", soloAttivi],
    queryFn: async () => {
      const fetchCount = async (tipi: string[] | null) => {
        let q = supabase.from("conti_bancari").select("id", { count: "exact", head: true });
        if (soloAttivi) q = q.eq("attivo", true);
        if (tipi) q = q.in("tipo", tipi);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
      };
      const [consul, agenzie, broker, direzioni, plurimandatari, all] = await Promise.all([
        fetchCount(CATEGORIE.consul.tipi),
        fetchCount(CATEGORIE.agenzie.tipi),
        fetchCount(CATEGORIE.broker.tipi),
        fetchCount(CATEGORIE.direzioni.tipi),
        fetchCount(CATEGORIE.plurimandatari.tipi),
        fetchCount(null),
      ]);
      return { consul, agenzie, broker, direzioni, plurimandatari, all };
    },
    staleTime: 300000,
  });

  const tipiCorrenti = CATEGORIE[categoria].tipi;

  const { data: result, isLoading } = useQuery({
    queryKey: ["conti_bancari_admin", categoria, search, page, soloAttivi],
    queryFn: async () => {
      let q = supabase.from("conti_bancari").select("*, compagnia:compagnie!conti_bancari_compagnia_id_fkey(id,nome,codice,tipo), rapporto:compagnia_rapporti!conti_bancari_rapporto_id_fkey(id,codice_rapporto,gruppo_compagnia:gruppi_compagnia(descrizione)), conti_bancari_uffici(ufficio_id, ufficio:uffici(nome_ufficio, codice_ufficio))", { count: "exact" });
      if (tipiCorrenti) q = q.in("tipo", tipiCorrenti);
      if (soloAttivi) q = q.eq("attivo", true);
      if (search) {
        const s = search.replace(/[%,]/g, "");
        q = q.or(`etichetta.ilike.%${s}%,iban.ilike.%${s}%,intestato_a.ilike.%${s}%,banca.ilike.%${s}%`);
      }
      const { data, error, count } = await q
        .order("tipo")
        .order("is_default", { ascending: false })
        .order("etichetta")
        .range(range.from, range.to);
      if (error) throw error;
      return { rows: (data || []), total: count || 0 };
    },
  });

  const conti = result?.rows || [];
  const total = result?.total || 0;

  // Compagnie filtrate per tipo selezionato nella form
  const { data: compagnieForType = [] } = useQuery({
    queryKey: ["compagnie_for_conto", form.tipo],
    enabled: isEntityTipo(form.tipo),
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("tipo", form.tipo!)
        .eq("attiva", true)
        .order("nome");
      return ((data || []) as unknown) as Array<{ id: string; nome: string; codice: string | null }>;
    },
  });

  // Rapporti della compagnia scelta (solo broker/plurimandataria)
  const { data: rapportiForCompagnia = [] } = useQuery({
    queryKey: ["rapporti_for_conto", form.compagnia_id],
    enabled: supportsRapporto(form.tipo) && !!form.compagnia_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id, codice_rapporto, attivo, gruppo_compagnia:gruppi_compagnia(descrizione)")
        .eq("compagnia_id", form.compagnia_id!)
        .eq("attivo", true)
        .order("codice_rapporto");
      return (data || []);
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<ContoBancario>) => {
      const isEntity = isEntityTipo(payload.tipo);
      const sediValidation = validateContoBancarioSedi(payload.tipo, payload.ufficio_ids || []);
      if (!sediValidation.valid) throw new Error(sediValidation.error);

      const data: any = {
        etichetta: payload.etichetta?.trim(),
        iban: payload.iban?.trim(),
        intestato_a: payload.intestato_a?.trim(),
        banca: payload.banca?.trim() || null,
        bic: payload.bic?.trim() || null,
        codice_abi: payload.codice_abi?.trim() || null,
        codice_cab: payload.codice_cab?.trim() || null,
        citta_banca: payload.citta_banca?.trim() || null,
        tipo: payload.tipo,
        is_default: !!payload.is_default,
        compagnia_id: isEntity ? (payload.compagnia_id || null) : null,
        rapporto_id: supportsRapporto(payload.tipo) ? (payload.rapporto_id || null) : null,
        attivo: payload.attivo ?? true,
        note: payload.note?.trim() || null,
      };
      if (data.is_default) {
        await supabase.from("conti_bancari").update({ is_default: false }).eq("tipo", data.tipo).eq("is_default", true);
      }

      let contoId = payload.id;
      if (contoId) {
        const { error } = await supabase.from("conti_bancari").update(data).eq("id", contoId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("conti_bancari").insert(data).select("id").single();
        if (error) throw error;
        contoId = inserted.id;
      }

      if (isConsulbrokersContoTipo(payload.tipo) && contoId) {
        await saveSediContoBancario(contoId, payload.ufficio_ids || []);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari_counts"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Conto bancario salvato");
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: unknown) => toast.error(formatContoBancarioSaveError(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conti_bancari").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari_counts"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Conto eliminato");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message || "Impossibile eliminare (potrebbe essere referenziato)"),
  });

  const setAsDefault = useMutation({
    mutationFn: async (c: ContoBancario) => {
      await supabase.from("conti_bancari").update({ is_default: false }).eq("tipo", c.tipo).eq("is_default", true);
      const { error } = await supabase.from("conti_bancari").update({ is_default: true }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conti_bancari_admin"] });
      qc.invalidateQueries({ queryKey: ["conti_bancari"] });
      toast.success("Default aggiornato");
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const openNew = () => {
    setForm({ ...emptyForm, tipo: CATEGORIE[categoria].defaultTipo, ufficio_ids: [] });
    setDialogOpen(true);
  };
  const openEdit = async (c: ContoBancario) => {
    const ufficioIds = c.conti_bancari_uffici?.map((r) => r.ufficio_id)
      ?? (c.id ? await fetchSediContoBancario(c.id) : []);
    setForm({ ...c, ufficio_ids: ufficioIds });
    setDialogOpen(true);
  };

  const ibanValidation = validateIban(form.iban || "");

  const handleSave = () => {
    if (!form.etichetta?.trim() || !form.intestato_a?.trim()) {
      toast.error("Etichetta e intestatario sono obbligatori");
      return;
    }
    if (!ibanValidation.valid) {
      toast.error(ibanValidation.error || "IBAN non valido");
      return;
    }
    if (isEntityTipo(form.tipo) && !form.compagnia_id) {
      toast.error(`Per tipo "${TIPO_LABEL[form.tipo!]}" devi selezionare la compagnia intestataria`);
      return;
    }
    const sediValidation = validateContoBancarioSedi(form.tipo, form.ufficio_ids || []);
    if (!sediValidation.valid) {
      toast.error(sediValidation.error || "Seleziona almeno una sede abilitata");
      return;
    }
    upsert.mutate({ ...form, iban: ibanValidation.normalized });
  };

  const mostraDefault = categoria === "consul" || categoria === "all";
  const mostraSedi = categoria === "consul" || categoria === "all";
  const mostraCompagnia = categoria !== "consul";
  const mostraRapporto = categoria === "broker" || categoria === "plurimandatari" || categoria === "all";

  const tabBadge = (n: number | undefined, colorClass?: string) =>
    typeof n === "number" ? (
      <Badge variant="outline" className={`ml-1.5 px-1.5 py-0 text-[10px] font-semibold ${colorClass || "bg-muted text-muted-foreground"}`}>
        {n}
      </Badge>
    ) : null;

  const formatRapportoLabel = (r: any) =>
    `${r.gruppo_compagnia?.descrizione || "Compagnia"} · ${r.codice_rapporto || "—"}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" /> Conti Bancari
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro unico degli IBAN. <Star className="inline w-3 h-3 fill-primary text-primary" /> indica il conto di default per tipo (catena IBAN cliente: Specialist → Sede → Default Consulbrokers).
          </p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nuovo Conto</Button>
      </div>

      <Tabs value={categoria} onValueChange={(v) => setCategoria(v as CategoriaKey)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="consul"><Briefcase className="w-4 h-4 mr-1.5" />Consulbrokers{tabBadge(counts?.consul, TIPO_BADGE.generico)}</TabsTrigger>
          <TabsTrigger value="agenzie"><Landmark className="w-4 h-4 mr-1.5" />Agenzie{tabBadge(counts?.agenzie, TIPO_BADGE.agenzia)}</TabsTrigger>
          <TabsTrigger value="broker"><Building className="w-4 h-4 mr-1.5" />Broker{tabBadge(counts?.broker, TIPO_BADGE.broker)}</TabsTrigger>
          <TabsTrigger value="direzioni"><ShieldCheck className="w-4 h-4 mr-1.5" />Direzioni{tabBadge(counts?.direzioni, TIPO_BADGE.direzione)}</TabsTrigger>
          <TabsTrigger value="plurimandatari"><Network className="w-4 h-4 mr-1.5" />Plurimandatarie{tabBadge(counts?.plurimandatari, TIPO_BADGE.plurimandataria)}</TabsTrigger>
          <TabsTrigger value="all"><List className="w-4 h-4 mr-1.5" />Tutti{tabBadge(counts?.all)}</TabsTrigger>
        </TabsList>
      </Tabs>

      {mostraRapporto && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
          <Network className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Colonna "Rapporto":</strong> per broker e plurimandatarie un conto può essere
            <em> generico</em> (intestato all'entità, usato per tutti i mandati) oppure
            <em> specifico per rapporto</em> (intestato all'entità ma riservato agli incassi/pagamenti di una singola compagnia madre tramite il relativo codice mandato).
          </div>
        </div>
      )}


      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cerca per etichetta, IBAN, intestatario, banca…"
                className="pl-9"
              />
            </div>
            <Label className="flex items-center gap-2 text-sm font-normal cursor-pointer whitespace-nowrap">
              <Switch checked={soloAttivi} onCheckedChange={setSoloAttivi} /> Solo attivi
            </Label>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Caricamento...</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {mostraDefault && <TableHead className="w-[80px]">Default</TableHead>}
                    <TableHead>Etichetta</TableHead>
                    <TableHead>Tipo</TableHead>
                    {mostraCompagnia && <TableHead>Compagnia</TableHead>}
                    {mostraRapporto && <TableHead>Rapporto</TableHead>}
                    {mostraSedi && <TableHead>Sedi abilitate</TableHead>}
                    <TableHead>IBAN</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conti.map((c: any, i: number) => (
                    <TableRow key={c.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      {mostraDefault && (
                        <TableCell>
                          {c.is_default ? (
                            <Badge className="gap-1"><Star className="w-3 h-3 fill-current" /> Default</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => setAsDefault.mutate(c)} title="Imposta come default">
                              <Star className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{c.etichetta}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TIPO_BADGE[c.tipo] || ""}>
                          {TIPO_LABEL[c.tipo] || c.tipo}
                        </Badge>
                      </TableCell>
                      {mostraCompagnia && (
                        <TableCell className="text-sm">
                          {c.compagnia ? (
                            <span>
                              {c.compagnia.codice ? <span className="font-mono text-xs text-muted-foreground mr-1">{c.compagnia.codice}</span> : null}
                              {c.compagnia.nome}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      {mostraRapporto && (
                        <TableCell className="text-sm">
                          {c.rapporto ? formatRapportoLabel(c.rapporto) : <span className="text-muted-foreground">— (generico)</span>}
                        </TableCell>
                      )}
                      {mostraSedi && (
                        <TableCell className="text-sm">
                          {isConsulbrokersContoTipo(c.tipo) ? (
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {(c.conti_bancari_uffici || []).length > 0 ? (
                                c.conti_bancari_uffici!.map((r: any) => (
                                  <Badge key={r.ufficio_id} variant="outline" className="text-[10px] font-normal">
                                    {r.ufficio?.codice_ufficio || r.ufficio?.nome_ufficio || "?"}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-destructive text-xs">Nessuna sede</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{maskIban(c.iban)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.banca || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.attivo ? "default" : "secondary"}>{c.attivo ? "Attivo" : "Disattivo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {conti.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3 + (mostraDefault ? 1 : 0) + (mostraCompagnia ? 1 : 0) + (mostraRapporto ? 1 : 0) + (mostraSedi ? 1 : 0) + 3} className="text-center text-muted-foreground py-10">
                        {search ? (
                          <>Nessun conto trovato per "<span className="font-medium">{search}</span>"</>
                        ) : (
                          <div className="space-y-3">
                            <p>Nessun conto in questa categoria. Verranno popolati man mano che crei {CATEGORIE[categoria].label.toLowerCase()}.</p>
                            <Button size="sm" variant="outline" onClick={openNew}>
                              <Plus className="w-4 h-4 mr-2" /> Nuovo conto {CATEGORIE[categoria].label}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ServerPagination page={page} pageSize={pageSize} totalCount={total} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Conto Bancario" : "Nuovo Conto Bancario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Tipologia: radio gruppo (Consul vs Entità) */}
            <div className="space-y-2">
              <Label>Tipo conto *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v, compagnia_id: null, rapporto_id: null, ufficio_ids: isConsulbrokersContoTipo(v) ? (form.ufficio_ids || []) : [] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incasso_clienti">Consulbrokers · Incasso clienti</SelectItem>
                  <SelectItem value="provvigioni">Consulbrokers · Provvigioni</SelectItem>
                  <SelectItem value="generico">Consulbrokers · Generico</SelectItem>
                  <SelectItem value="agenzia">Agenzia</SelectItem>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="direzione">Direzione</SelectItem>
                  <SelectItem value="plurimandataria">Plurimandataria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Compagnia intestataria — solo per tipi entità */}
            {isEntityTipo(form.tipo) && (
              <div>
                <Label>Compagnia intestataria * <span className="text-xs text-muted-foreground font-normal">(filtrate per tipo "{TIPO_LABEL[form.tipo!]}")</span></Label>
                <SearchableSelect
                  options={compagnieForType.map(c => ({
                    value: c.id,
                    label: c.nome,
                    description: c.codice || undefined,
                    searchText: `${c.nome} ${c.codice || ""}`,
                  }))}
                  value={form.compagnia_id || ""}
                  onValueChange={(v) => setForm({ ...form, compagnia_id: v || null, rapporto_id: null })}
                  placeholder={compagnieForType.length === 0 ? `Nessuna ${TIPO_LABEL[form.tipo!].toLowerCase()} ancora creata` : "Seleziona compagnia…"}
                  emptyText="Nessuna compagnia trovata"
                  disabled={compagnieForType.length === 0}
                />
              </div>
            )}

            {/* Rapporto opzionale — solo broker/plurimandataria con compagnia selezionata */}
            {supportsRapporto(form.tipo) && form.compagnia_id && (
              <div>
                <Label>
                  Rapporto specifico <span className="text-xs text-muted-foreground font-normal">(opzionale — vuoto = conto generico dell'entità)</span>
                </Label>
                <SearchableSelect
                  options={[
                    { value: "__none__", label: "— Conto generico (nessun rapporto specifico) —" },
                    ...rapportiForCompagnia.map((r: any) => ({
                      value: r.id,
                      label: formatRapportoLabel(r),
                    })),
                  ]}
                  value={form.rapporto_id || "__none__"}
                  onValueChange={(v) => setForm({ ...form, rapporto_id: v === "__none__" ? null : v })}
                  placeholder="Seleziona rapporto…"
                  emptyText={rapportiForCompagnia.length === 0 ? "Nessun rapporto attivo per questa compagnia" : "Nessun risultato"}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Etichetta *</Label>
                <Input value={form.etichetta || ""} onChange={(e) => setForm({ ...form, etichetta: e.target.value })} placeholder="Es. Conto incassi Napoli" />
              </div>
              <div>
                <Label>Intestato a *</Label>
                <Input value={form.intestato_a || ""} onChange={(e) => setForm({ ...form, intestato_a: e.target.value })} placeholder="Es. Consulbrokers Digital SRL" />
              </div>
            </div>

            <div>
              <Label>IBAN *</Label>
              <Input
                value={form.iban || ""}
                onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                placeholder="IT70Q0306904214100000016469"
                className={`font-mono ${form.iban && !ibanValidation.valid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                aria-invalid={!!form.iban && !ibanValidation.valid}
              />
              {form.iban ? (
                ibanValidation.valid ? (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> IBAN valido ({form.iban.slice(0, 2)})
                  </p>
                ) : (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {ibanValidation.error}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Inserisci un IBAN valido (es. IT + 25 caratteri)</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Banca</Label>
                <Input value={form.banca || ""} onChange={(e) => setForm({ ...form, banca: e.target.value })} placeholder="Es. Intesa Sanpaolo SpA" />
              </div>
              <div>
                <Label>BIC / SWIFT</Label>
                <Input value={form.bic || ""} onChange={(e) => setForm({ ...form, bic: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>ABI</Label>
                <Input value={form.codice_abi || ""} onChange={(e) => setForm({ ...form, codice_abi: e.target.value })} />
              </div>
              <div>
                <Label>CAB</Label>
                <Input value={form.codice_cab || ""} onChange={(e) => setForm({ ...form, codice_cab: e.target.value })} />
              </div>
              <div>
                <Label>Città banca</Label>
                <Input value={form.citta_banca || ""} onChange={(e) => setForm({ ...form, citta_banca: e.target.value })} />
              </div>
            </div>

            {isConsulbrokersContoTipo(form.tipo) && (
              <ContoSediMultiSelect
                value={form.ufficio_ids || []}
                onChange={(ufficio_ids) => setForm({ ...form, ufficio_ids })}
                required
              />
            )}

            <div>
              <Label>Note</Label>
              <Textarea value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={!!form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                Imposta come default per questo tipo
              </Label>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.attivo ?? true} onCheckedChange={(v) => setForm({ ...form, attivo: v })} />
                Attivo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={upsert.isPending || !ibanValidation.valid}>{upsert.isPending ? "Salvataggio…" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteWithImpactDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityId={deleteTarget?.id}
        entityType="conto bancario"
        entityName={deleteTarget ? `${deleteTarget.etichetta} (${deleteTarget.iban?.slice(0, 4)}…${deleteTarget.iban?.slice(-4)})` : "—"}
        checks={[
          { table: "uffici", column: "conto_bancario_id", label: "Sedi (IBAN incassi)" },
          { table: "uffici", column: "conto_incasso_id", label: "Sedi (IBAN secondario)" },
          { table: "compagnie", column: "conto_bancario_id", label: "Compagnie collegate" },
          { table: "compagnia_rapporti", column: "conto_bancario_id", label: "Rapporti agenzia-compagnia" },
          { table: "profiles", column: "conto_bancario_id", label: "Specialist collegati" },
        ]}
        onConfirmDelete={() => deleteTarget && del.mutate(deleteTarget.id)}
        onDeactivateInstead={
          deleteTarget?.attivo
            ? () => deleteTarget && upsert.mutate({ ...deleteTarget, attivo: false })
            : undefined
        }
        isDeleting={del.isPending}
      />
    </div>
  );
}
