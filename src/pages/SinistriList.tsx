import { useEffect, useMemo, useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, AlertTriangle, Search, ArrowUp, ArrowDown, ArrowUpDown, X, List, SlidersHorizontal, Archive } from "lucide-react";
import { toast } from "sonner";
import { exportSinistriXlsx } from "@/lib/exportSinistriXlsx";
import { fetchTitoloIdsByTarga } from "@/lib/sinistriTargaLookup";
import { useNavigate } from "react-router-dom";
import ServerPagination from "@/components/ServerPagination";
import { SearchableSelect } from "@/components/SearchableSelect";
import { SinistriRicercaForm } from "@/components/sinistri/SinistriRicercaForm";
import { formatTipoSinistro, getTipoSinistroLabel } from "@/lib/tipiSinistro";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { fetchClientiSearch, useClienteSearch } from "@/hooks/useClienteSearch";
import { clienteSearchDescription, clienteSearchLabel } from "@/lib/clienteSearch";
import { formatDateIT } from "@/lib/formatDate";
import { formatPolizzaRamo } from "@/lib/titoliDisplay";
import {
  EMPTY_SINISTRI_FILTERS,
  applySinistriOrder,
  hasSinistriFilters,
  sanitizePostgrestTerm,
  sinistriFilterChips,
  sinistriRamoOrClause,
  sinistroPolizzaDisplay,
  targaSinistriOrClause,
  type SinistriListFilters,
  type SinistriSortField,
} from "@/lib/sinistriListSearch";
import {
  applyStatoFiltroLista,
  badgeClassStatoSinistro,
  labelStatoSinistro,
  optionsStatoSinistro,
} from "@/lib/sinistriStati";

const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";
const EXPORT_PAGE = 1000;

type RamoRicerca = { id: string; label: string; descrizione?: string | null; codice?: string | null; gruppo?: string | null };

type SinistriFilterLookups = {
  polizzaTitoloIds: string[] | null;
  targaTitoloIds: string[] | null;
  ramoTitoloIds: string[] | null;
  quickClienteIds: string[];
  quickResponsabileIds: string[];
  quickTitoloIds: string[];
};

/** Lookup async: NON restituire mai il query builder da una funzione async (è thenable e `await` lo esegue). */
async function loadSinistriFilterLookups(
  filters: SinistriListFilters,
): Promise<SinistriFilterLookups> {
  const lookups: SinistriFilterLookups = {
    polizzaTitoloIds: null,
    targaTitoloIds: null,
    ramoTitoloIds: null,
    quickClienteIds: [],
    quickResponsabileIds: [],
    quickTitoloIds: [],
  };

  const polizza = sanitizePostgrestTerm(filters.polizza);
  if (polizza) {
    const { data } = await supabase
      .from("titoli")
      .select("id")
      .ilike("numero_titolo", `%${polizza}%`)
      .limit(200);
    lookups.polizzaTitoloIds = (data || []).map((t) => t.id);
  }

  if (filters.targa.trim()) {
    lookups.targaTitoloIds = await fetchTitoloIdsByTarga(filters.targa);
  }

  if (filters.ramoId) {
    const { data } = await supabase
      .from("titoli")
      .select("id")
      .eq("ramo_id", filters.ramoId)
      .limit(500);
    lookups.ramoTitoloIds = (data || []).map((t) => t.id);
  }

  const term = sanitizePostgrestTerm(filters.quickSearch);
  if (term) {
    const [clientiMatch, { data: profilesMatch }, { data: titoliMatch }] = await Promise.all([
      fetchClientiSearch(term, { limit: 200, onlyAttivi: false }),
      supabase.from("profiles").select("id").or(`cognome.ilike.%${term}%,nome.ilike.%${term}%`).limit(100),
      supabase.from("titoli").select("id").ilike("numero_titolo", `%${term}%`).limit(200),
    ]);
    lookups.quickClienteIds = (clientiMatch || []).map((c) => c.id);
    lookups.quickResponsabileIds = (profilesMatch || []).map((p) => p.id);
    lookups.quickTitoloIds = (titoliMatch || []).map((t) => t.id);
  }

  return lookups;
}

function applySinistriListFilters<T>(
  q: T,
  args: { tab: string; filters: SinistriListFilters; rami: RamoRicerca[]; lookups: SinistriFilterLookups },
): T {
  const { tab, filters, rami, lookups } = args;
  let next = q as any;
  next = applyStatoFiltroLista(next, { tab, stato: filters.stato });
  if (filters.compagniaId !== "tutti") next = next.eq("compagnia_id", filters.compagniaId);
  if (filters.terzi === "terzi") next = next.eq("sinistro_terzi", true);
  if (filters.terzi === "con_polizza") next = next.eq("sinistro_terzi", false).not("titolo_id", "is", null);
  if (filters.responsabileId !== "tutti") next = next.eq("responsabile_id", filters.responsabileId);
  if (filters.clienteId) next = next.eq("cliente_anagrafica_id", filters.clienteId);

  const controparte = sanitizePostgrestTerm(filters.controparte);
  if (controparte) next = next.ilike("controparte", `%${controparte}%`);

  if (filters.tipo) {
    const tipoLabel = sanitizePostgrestTerm(getTipoSinistroLabel(filters.tipo));
    next = next.or(
      [`tipo_sinistro.eq.${filters.tipo}`, tipoLabel ? `tipo_sinistro_personalizzato.ilike.%${tipoLabel}%` : ""]
        .filter(Boolean)
        .join(","),
    );
  }

  const numero = sanitizePostgrestTerm(filters.numero);
  if (numero) {
    next = next.or(`numero_sinistro.ilike.%${numero}%,numero_sinistro_compagnia.ilike.%${numero}%`);
  }

  if (lookups.polizzaTitoloIds) {
    next = next.in("titolo_id", lookups.polizzaTitoloIds.length ? lookups.polizzaTitoloIds : [NO_MATCH_ID]);
  }

  if (filters.dataDa) next = next.gte("data_apertura", filters.dataDa);
  if (filters.dataA) next = next.lte("data_apertura", filters.dataA);
  if (filters.eventoDa) next = next.gte("data_evento", filters.eventoDa);
  if (filters.eventoA) next = next.lte("data_evento", filters.eventoA);

  if (filters.targa.trim()) {
    const targaClause = targaSinistriOrClause(filters.targa, lookups.targaTitoloIds || []);
    if (targaClause) next = next.or(targaClause);
    else next = next.in("id", [NO_MATCH_ID]);
  }

  if (filters.ramoId || filters.ramoLabel.trim()) {
    const ramo = rami.find((r) => r.id === filters.ramoId);
    const ramoClause = sinistriRamoOrClause(
      {
        id: filters.ramoId,
        label: filters.ramoLabel,
        descrizione: ramo?.descrizione,
        codice: ramo?.codice,
        gruppo: ramo?.gruppo,
      },
      lookups.ramoTitoloIds || [],
    );
    if (ramoClause) next = next.or(ramoClause);
    else next = next.in("titolo_id", [NO_MATCH_ID]);
  }

  const term = sanitizePostgrestTerm(filters.quickSearch);
  if (term) {
    const parts = [
      `numero_sinistro.ilike.%${term}%`,
      `numero_sinistro_compagnia.ilike.%${term}%`,
      `numero_polizza.ilike.%${term}%`,
      `descrizione.ilike.%${term}%`,
      `controparte.ilike.%${term}%`,
      `targa_veicolo.ilike.%${term}%`,
    ];
    if (lookups.quickClienteIds.length > 0) {
      parts.push(`cliente_anagrafica_id.in.(${lookups.quickClienteIds.join(",")})`);
    }
    if (lookups.quickResponsabileIds.length > 0) {
      parts.push(`responsabile_id.in.(${lookups.quickResponsabileIds.join(",")})`);
    }
    if (lookups.quickTitoloIds.length > 0) {
      parts.push(`titolo_id.in.(${lookups.quickTitoloIds.join(",")})`);
    }
    next = next.or(parts.join(","));
  }

  return next as T;
}

export default function SinistriList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("elenco");
  const [filters, setFilters] = useState<SinistriListFilters>(EMPTY_SINISTRI_FILTERS);
  const [debounced, setDebounced] = useState<SinistriListFilters>(EMPTY_SINISTRI_FILTERS);
  const [clientiSearch, setClientiSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sortField, setSortField] = useState<SinistriSortField>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const { page, setPage, pageSize, range } = useServerPagination(25, [
    tab,
    debounced,
    sortField,
    sortDirection,
  ]);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    const ch = supabase
      .channel("sinistri-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sinistri" },
        () => qc.invalidateQueries({ queryKey: ["sinistri"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const patchFilters = (patch: Partial<SinistriListFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const resetFilters = () => {
    setFilters(EMPTY_SINISTRI_FILTERS);
    setClientiSearch("");
    setPage(0);
  };

  const clearChip = (key: string) => {
    if (key === "cliente") patchFilters({ clienteId: "", clienteLabel: "" });
    else if (key === "date") patchFilters({ dataDa: "", dataA: "" });
    else if (key === "evento") patchFilters({ eventoDa: "", eventoA: "" });
    else if (key === "ramo") patchFilters({ ramoId: "", ramoLabel: "" });
    else if (key === "compagniaId") patchFilters({ compagniaId: "tutti", compagniaLabel: "" });
    else if (key === "responsabileId") patchFilters({ responsabileId: "tutti", responsabileLabel: "" });
    else if (key === "stato") patchFilters({ stato: "tutti" });
    else if (key === "terzi") patchFilters({ terzi: "tutti" });
    else if (key === "tipo") patchFilters({ tipo: "" });
    else if (key === "quickSearch") patchFilters({ quickSearch: "" });
    else patchFilters({ [key]: "" } as Partial<SinistriListFilters>);
  };

  const { data: compagnie = [] } = useQuery({
    queryKey: ["agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: rami = [] } = useQuery({
    queryKey: ["rami-sinistri-ricerca"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("id, codice, descrizione, gruppo_ramo:gruppi_ramo(descrizione)")
        .eq("attivo", true)
        .order("descrizione")
        .limit(1000);
      if (error) throw error;
      return (data || []).map((r) => {
        const gruppo = Array.isArray(r.gruppo_ramo) ? r.gruppo_ramo[0] : r.gruppo_ramo;
        const label = formatPolizzaRamo({ ramo: { descrizione: r.descrizione, gruppo_ramo: gruppo } });
        return {
          id: r.id,
          label: label === "—" ? (r.descrizione || r.codice || r.id) : label,
          descrizione: r.descrizione || "",
          codice: r.codice || "",
          gruppo: gruppo?.descrizione || "",
        };
      });
    },
    staleTime: 300_000,
  });

  const { data: responsabili = [] } = useQuery({
    queryKey: ["profiles-responsabili-list"],
    queryFn: async () => {
      const { data: ss } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id");
      const ids = [...new Set(((ss || []) as unknown as { profilo_id: string }[]).map((r) => r.profilo_id))];
      let q = supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return data || [];
    },
  });

  const { rows: clientiRows = [], isFetching: clientiLoading } = useClienteSearch(clientiSearch, {
    selectedId: filters.clienteId,
    onlyAttivi: false,
    enabled: clientiSearch.trim().length >= 2 || !!filters.clienteId,
  });
  const clientiHits = clientiRows.map((c) => ({
    id: c.id,
    label: clienteSearchLabel(c) || "(senza nome)",
    description: clienteSearchDescription(c),
  }));

  const { data: sinistriResult, isError: sinistriError, error: sinistriQueryError } = useQuery({
    queryKey: ["sinistri", tab, debounced, page, sortField, sortDirection],
    queryFn: async () => {
      const lookups = await loadSinistriFilterLookups(debounced);
      let q = supabase.from("sinistri").select(
        `id, numero_sinistro, stato, descrizione, data_apertura, data_denuncia, data_evento, controparte, sinistro_terzi, titolo_id, compagnia_id,
         numero_polizza, ramo_sinistro, prodotto_sinistro,
         tipo_sinistro, tipo_sinistro_personalizzato,
         compagnie(nome), profiles!sinistri_responsabile_id_fkey(nome, cognome),
         clienti!sinistri_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente),
         titoli(numero_titolo)`,
        { count: "exact" }
      );

      q = applySinistriListFilters(q, { tab, filters: debounced, rami, lookups });

      const { data, error, count } = await applySinistriOrder(q, sortField, sortDirection)
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const sinistri = sinistriResult?.data || [];
  const totalCount = sinistriResult?.count || 0;

  const handleExportRicerca = async () => {
    if (!totalCount) {
      toast.error("Nessun sinistro da esportare");
      return;
    }
    setExporting(true);
    try {
      const rows: any[] = [];
      const lookups = await loadSinistriFilterLookups(debounced);
      for (let from = 0; from < totalCount; from += EXPORT_PAGE) {
        let q = supabase.from("sinistri").select(
          `*, compagnie(nome), titoli(numero_titolo)`,
        );
        q = applySinistriListFilters(q, { tab: "ricerca", filters: debounced, rami, lookups });
        const { data, error } = await applySinistriOrder(q, sortField, sortDirection)
          .range(from, from + EXPORT_PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < EXPORT_PAGE) break;
      }
      if (!rows.length) {
        toast.error("Nessun sinistro da esportare");
        return;
      }
      await exportSinistriXlsx(rows);
      toast.success(`Esportati ${rows.length} sinistri`);
    } catch (e: any) {
      toast.error("Errore export: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const { data: eventiScaduti } = useQuery({
    queryKey: ["eventi-scaduti"],
    queryFn: async () => {
      const { data } = await supabase.from("sinistro_eventi").select("id").eq("stato", "scaduto");
      return data?.length || 0;
    },
  });

  const handleSort = (field: SinistriSortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const chips = useMemo(
    () => sinistriFilterChips(filters, filters.tipo ? getTipoSinistroLabel(filters.tipo) : undefined),
    [filters],
  );

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SinistriSortField;
    children: React.ReactNode;
    className?: string;
  }) => {
    const Icon = sortField === field ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead
        className={`cursor-pointer select-none bg-background ${className || ""}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" /> Sinistri
          </h1>
          <p className="text-muted-foreground">Gestione pratiche sinistri</p>
        </div>
        <div className="flex items-center gap-2">
          {(eventiScaduti ?? 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              ⚠ {eventiScaduti} eventi scaduti
            </Badge>
          )}
          <Button variant="outline" onClick={() => navigate("/sinistri/caricamento")}>
            Caricamento massivo
          </Button>
          <Button onClick={() => navigate("/sinistri/apertura")}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo Sinistro
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(0); }} className="space-y-3">
        <TabsList>
          <TabsTrigger value="elenco" className="gap-1.5">
            <List className="h-4 w-4" /> Elenco
          </TabsTrigger>
          <TabsTrigger value="ricerca" className="gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> Ricerca
          </TabsTrigger>
          <TabsTrigger value="archiviati" className="gap-1.5">
            <Archive className="h-4 w-4" /> Archiviati
          </TabsTrigger>
        </TabsList>

        <TabsContent value="elenco" className="mt-0">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[16rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per cliente, numero, polizza, controparte, descrizione..."
                value={filters.quickSearch}
                onChange={(e) => patchFilters({ quickSearch: e.target.value })}
                className="pl-9"
              />
            </div>
            <SearchableSelect
              options={optionsStatoSinistro()}
              value={filters.stato === "tutti" ? "" : filters.stato}
              onValueChange={(stato) => patchFilters({ stato: stato || "tutti" })}
              placeholder="Tutti gli stati"
              searchPlaceholder="Cerca stato…"
              clearable
              clearLabel="Tutti gli stati"
              className="w-64"
            />
            <Select
              value={filters.compagniaId}
              onValueChange={(id) => patchFilters({
                compagniaId: id,
                compagniaLabel: compagnie.find((c) => c.id === id)?.nome || "",
              })}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutte le compagnie</SelectItem>
                {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.terzi} onValueChange={(terzi) => patchFilters({ terzi })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                <SelectItem value="con_polizza">Con polizza</SelectItem>
                <SelectItem value="terzi">Sinistro Terzi</SelectItem>
              </SelectContent>
            </Select>
            <SearchableSelect
              value={filters.responsabileId === "tutti" ? "" : filters.responsabileId}
              onValueChange={(id) => {
                const r = responsabili.find((x) => x.id === id);
                patchFilters({
                  responsabileId: id || "tutti",
                  responsabileLabel: r ? `${r.cognome || ""} ${r.nome || ""}`.trim() : "",
                });
              }}
              placeholder="Responsabile interno"
              clearable
              clearLabel="Tutti"
              className="w-52"
              options={responsabili.map((r) => ({
                value: r.id,
                label: `${r.cognome || ""} ${r.nome || ""}`.trim(),
              }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="ricerca" className="mt-0">
          <Card>
            <CardContent className="pt-5">
              <SinistriRicercaForm
                filters={filters}
                onChange={patchFilters}
                onReset={resetFilters}
                clientiSearch={clientiSearch}
                onClientiSearch={setClientiSearch}
                clientiOptions={clientiHits}
                clientiLoading={clientiLoading}
                compagnie={compagnie}
                responsabili={responsabili}
                rami={rami}
                onExport={handleExportRicerca}
                exporting={exporting}
                exportCount={totalCount}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archiviati" className="mt-0">
          <div className="flex gap-3 flex-wrap items-center">
            <p className="text-sm text-muted-foreground w-full">
              Solo pratiche in stato Archiviato. Non comparono in Elenco, Ricerca, estrazioni o portale cliente.
            </p>
            <div className="relative flex-1 min-w-[16rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca tra gli archiviati: cliente, numero, polizza…"
                value={filters.quickSearch}
                onChange={(e) => patchFilters({ quickSearch: e.target.value })}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.compagniaId}
              onValueChange={(id) => patchFilters({
                compagniaId: id,
                compagniaLabel: compagnie.find((c) => c.id === id)?.nome || "",
              })}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutte le compagnie</SelectItem>
                {compagnie.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className="gap-1 pr-1 font-normal">
              {c.label}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => clearChip(c.key)}
                aria-label={`Rimuovi ${c.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {hasSinistriFilters(filters) && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={resetFilters}>
              Azzera
            </Button>
          )}
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader field="numero_sinistro">N° Sinistro</SortableHeader>
              <SortableHeader field="cliente">Cliente</SortableHeader>
              <SortableHeader field="polizza">Polizza</SortableHeader>
              <SortableHeader field="data_evento">Data accadimento</SortableHeader>
              <SortableHeader field="controparte">Controparte</SortableHeader>
              <SortableHeader field="tipo_sinistro">Tipo</SortableHeader>
              <SortableHeader field="stato">Stato</SortableHeader>
              <SortableHeader field="compagnia_id">Compagnia</SortableHeader>
              <SortableHeader field="data_apertura">Data Apertura</SortableHeader>
              <SortableHeader field="data_denuncia">Data Denuncia</SortableHeader>
              <TableHead className="min-w-[20rem] max-w-[40rem]">Descrizione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinistri.map((s: any) => (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  if (s.stato === "bozza") {
                    navigate(`/sinistri/apertura?bozza_id=${s.id}`);
                  } else {
                    navigate(`/sinistri/${s.id}`);
                  }
                }}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{s.numero_sinistro || "—"}</span>
                    {s.stato === "bozza" && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-400 text-slate-700 bg-slate-50">
                        Bozza
                      </Badge>
                    )}
                    {s.sinistro_terzi && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-800 bg-amber-50">
                        Sinistro Terzi
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{resolveClienteNome(s.clienti)}</TableCell>
                <TableCell>{sinistroPolizzaDisplay(s)}</TableCell>
                <TableCell>{formatDateIT(s.data_evento)}</TableCell>
                <TableCell className="max-w-[10rem] truncate">{s.controparte || "—"}</TableCell>
                <TableCell>{formatTipoSinistro(s)}</TableCell>
                <TableCell>
                  <Badge className={`text-[10px] px-2 py-0 ${badgeClassStatoSinistro(s.stato)}`}>
                    {labelStatoSinistro(s.stato)}
                  </Badge>
                </TableCell>
                <TableCell>{s.compagnie?.nome || "—"}</TableCell>
                <TableCell>{formatDateIT(s.data_apertura)}</TableCell>
                <TableCell>{formatDateIT(s.data_denuncia)}</TableCell>
                <TableCell className="min-w-[20rem] max-w-[40rem]">
                  <span className="line-clamp-4 whitespace-normal break-words">{s.descrizione || "—"}</span>
                </TableCell>
              </TableRow>
            ))}
            {sinistriError && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-destructive">
                  Errore nel caricamento dei sinistri:{" "}
                  {sinistriQueryError instanceof Error ? sinistriQueryError.message : "riprova"}
                </TableCell>
              </TableRow>
            )}
            {!sinistriError && !sinistri.length && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Nessun sinistro trovato
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="p-4">
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
