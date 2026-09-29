// Carico — consultazione ed estrazione (senza operatività incassi)
import { useServerPagination } from "@/hooks/useServerPagination";
import { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Clock,
  Search,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { SortableTableHead, nextSort } from "@/components/shared/SortableTableHead";
import { datePeriodoPolizzaGaranzia } from "@/lib/datePolizzaGaranzia";
import {
  rowBorderClass,
  isQuietanzaRow,
  isPolizzaMadreRow,
  displayStatoPolizza,
  messaCassaRowBgClass,
  isMessaACassa,
} from "@/lib/polizzeDisplay";
import { isInCoperturaGarantita } from "@/lib/garantitoTitolo";
import { UfficiFilterMultiSelect } from "@/components/portafoglio/UfficiFilterMultiSelect";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { provvigioneProduttoreForRow } from "@/lib/provvigioneProduttore";
import { useProvvigioniProduttoreLookup } from "@/hooks/useProvvigioniProduttoreLookup";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { mapCaricoExportRows } from "@/lib/portafoglioCarico/mapRow";
import { exportCaricoXlsx } from "@/lib/portafoglioCarico/exportXlsx";
import { buildCaricoPdf, downloadCaricoPdf } from "@/lib/portafoglioCarico/exportPdf";
import { buildCaricoDocx, downloadCaricoDocx } from "@/lib/portafoglioCarico/exportDocx";
import type { CaricoExportMeta } from "@/lib/portafoglioCarico/columns";
import {
  applyPeriodoFilter,
  applySearch,
  applySedeFilter,
  CARICO_SELECT_FIELDS,
  rowHref,
  type Periodo,
  type VistaIncasso,
} from "@/lib/portafoglioCarico/filters";

const provvigioneRiga = getProvvigioneEC;

const PortafoglioCaricoConsultazionePage = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAllSedi = isAdmin || isCfo;
  const sedeLockedId = !seeAllSedi && profile?.ufficio_id ? profile.ufficio_id : null;
  const authReady = !authLoading && !!profile && (seeAllSedi || !!sedeLockedId);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("garanzia_a");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [searchParams, setSearchParams] = useSearchParams();
  const initialPeriodo: Periodo = (() => {
    const p = searchParams.get("periodo");
    if (p === "messe_cassa") return "tutte";
    return p === "mese_corrente" || p === "tutte" ? p : "tutte";
  })();
  const [filtroPeriodo, setFiltroPeriodo] = useState<Periodo>(initialPeriodo);
  const [userTouched, setUserTouched] = useState<boolean>(() => {
    const p = searchParams.get("periodo");
    return !!p && p !== "messe_cassa";
  });
  const [dateDa, setDateDa] = useState<string>(searchParams.get("dal") || "");
  const [dateA, setDateA] = useState<string>(searchParams.get("al") || "");
  const isDefaultExtended = !userTouched && filtroPeriodo === "mese_corrente" && !dateDa && !dateA;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [filtroUffici, setFiltroUffici] = useState<string[]>(() => {
    const raw = searchParams.get("sedi");
    if (!raw) return [];
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  });
  const [vistaIncasso, setVistaIncasso] = useState<VistaIncasso>(() =>
    searchParams.get("vista") === "incassati" ? "incassati" : "pendenti",
  );
  const isVistaIncassati = vistaIncasso === "incassati";

  // Utenti sede: forza la propria sede (RLS su tutta la vista va in timeout)
  useEffect(() => {
    if (!sedeLockedId) return;
    setFiltroUffici((prev) => (prev.length === 1 && prev[0] === sedeLockedId ? prev : [sedeLockedId]));
    if (searchParams.get("sedi") !== sedeLockedId) {
      const sp = new URLSearchParams(searchParams);
      sp.set("sedi", sedeLockedId);
      setSearchParams(sp, { replace: true });
    }
  }, [sedeLockedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySede = (q: any) => {
    if (sedeLockedId) return q.eq("ufficio_id", sedeLockedId);
    return applySedeFilter(q, filtroUffici);
  };

  const hasActiveFilters =
    !!dateDa ||
    !!dateA ||
    !!search ||
    filtroPeriodo !== "tutte" ||
    userTouched ||
    filtroUffici.length > 0 ||
    vistaIncasso !== "pendenti";

  const updateUrl = (next: {
    periodo?: Periodo | null;
    dal?: string | null;
    al?: string | null;
    sedi?: string[] | null;
    vista?: VistaIncasso | null;
  }) => {
    const sp = new URLSearchParams(searchParams);
    if (next.periodo !== undefined) {
      if (next.periodo) sp.set("periodo", next.periodo);
      else sp.delete("periodo");
    }
    if (next.dal !== undefined) {
      if (next.dal) sp.set("dal", next.dal);
      else sp.delete("dal");
    }
    if (next.al !== undefined) {
      if (next.al) sp.set("al", next.al);
      else sp.delete("al");
    }
    if (next.sedi !== undefined) {
      if (next.sedi && next.sedi.length > 0) sp.set("sedi", next.sedi.join(","));
      else sp.delete("sedi");
    }
    if (next.vista !== undefined) {
      if (next.vista && next.vista !== "pendenti") sp.set("vista", next.vista);
      else sp.delete("vista");
    }
    setSearchParams(sp, { replace: true });
  };

  useEffect(() => {
    if (searchParams.get("periodo") !== "messe_cassa") return;
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo");
    setSearchParams(sp, { replace: true });
  }, []);

  useEffect(() => {
    const v = searchParams.get("vista");
    setVistaIncasso(v === "incassati" ? "incassati" : "pendenti");
  }, [searchParams]);

  const resetFilters = () => {
    setDateDa("");
    setDateA("");
    setSearch("");
    setFiltroPeriodo("tutte");
    setUserTouched(false);
    setFiltroUffici(sedeLockedId ? [sedeLockedId] : []);
    setVistaIncasso("pendenti");
    setSelectedIds(new Set());
    setPage(0);
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo");
    sp.delete("dal");
    sp.delete("al");
    if (sedeLockedId) sp.set("sedi", sedeLockedId);
    else sp.delete("sedi");
    sp.delete("vista");
    setSearchParams(sp, { replace: true });
  };

  const switchVista = (v: VistaIncasso) => {
    setVistaIncasso(v);
    setSelectedIds(new Set());
    setPage(0);
    if (v === "incassati") {
      setSortField("data_messa_cassa");
      setSortDirection("desc");
    } else {
      setSortField("garanzia_a");
      setSortDirection("asc");
    }
    updateUrl({ vista: v });
  };

  const handleSort = (field: string) => {
    const next = nextSort(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
    setPage(0);
  };

  const SortableHeader = ({
    field,
    children,
    className,
    title,
  }: {
    field: string;
    children: ReactNode;
    className?: string;
    title?: string;
  }) => (
    <SortableTableHead
      field={field}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
      className={className}
      title={title}
    >
      {children}
    </SortableTableHead>
  );

  const { page, setPage, pageSize, range } = useServerPagination(25, [
    search,
    filtroPeriodo,
    isDefaultExtended,
    dateDa,
    dateA,
    sortField,
    sortDirection,
    filtroUffici.join(","),
    vistaIncasso,
    sedeLockedId,
  ]);

  const periodoOpts = { isVistaIncassati, dateDa, dateA, filtroPeriodo };

  const { data: result, isLoading, isError, error: caricoError, refetch: refetchCarico } = useQuery({
    queryKey: [
      "portafoglio-carico-consultazione",
      search,
      filtroPeriodo,
      isDefaultExtended,
      page,
      dateDa,
      dateA,
      sortField,
      sortDirection,
      filtroUffici.join(","),
      vistaIncasso,
      sedeLockedId,
    ],
    enabled: authReady,
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_quietanze")
        .select(CARICO_SELECT_FIELDS, { count: "estimated" });
      q = applyPeriodoFilter(q, periodoOpts);
      q = applySearch(q, search);
      q = applySede(q);

      const orderCol =
        sortField === "inizioPolizza" ? "durata_da"
        : sortField === "finePolizza" ? "durata_a"
        : sortField === "inizioGaranzia" ? "garanzia_da"
        : sortField === "fineGaranzia" ? "garanzia_a"
        : sortField;

      const { data, count, error } = await q
        .order(orderCol, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      if (error) {
        console.error("[Carico] query v_portafoglio_quietanze:", error);
        throw new Error(error.message || "Errore caricamento Carico");
      }
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;
  const titoloIdsRiga = useMemo(() => polizze.map((p: any) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);
  const { data: provvProdLookup } = useProvvigioniProduttoreLookup(titoloIdsRiga);

  const { data: ufficiList = [] } = useQuery({
    queryKey: ["uffici-filter-multi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return (data || []) as Array<{ id: string; codice_ufficio: string; nome_ufficio: string }>;
    },
    staleTime: 60_000,
  });

  const ufficiById = useMemo(
    () => new Map(ufficiList.map((u) => [u.id, u.nome_ufficio])),
    [ufficiList],
  );

  const exportSourceRows = useMemo(
    () => (selectedIds.size > 0 ? polizze.filter((p) => selectedIds.has(p.id)) : polizze),
    [polizze, selectedIds],
  );

  const exportMeta = useMemo((): CaricoExportMeta => {
    const totPremio = exportSourceRows.reduce((s, p) => s + (Number(p.premio_lordo) || 0), 0);
    const totProvv = exportSourceRows.reduce((s, p) => s + provvigioneRiga(p), 0);
    const sedeLabel =
      filtroUffici.length === 0
        ? "Tutte"
        : filtroUffici
            .map((id) => ufficiList.find((u) => u.id === id))
            .filter(Boolean)
            .map((u) => `${u!.codice_ufficio} — ${u!.nome_ufficio}`)
            .join(", ") || `${filtroUffici.length} sedi`;

    return {
      vista: vistaIncasso,
      scope: selectedIds.size > 0 ? "selezione" : "pagina",
      nRighe: exportSourceRows.length,
      totalePremio: totPremio,
      totaleProvvigioni: totProvv,
      totaleFiltrate: totalCount,
      filtri: {
        Vista: isVistaIncassati ? "Incassati" : "Pendenti",
        Periodo: filtroPeriodo === "mese_corrente" ? "Mese corrente" : "Tutte",
        Dal: dateDa ? format(dateDa.length === 10 ? parseISO(dateDa) : new Date(dateDa), "dd/MM/yyyy") : "—",
        Al: dateA ? format(dateA.length === 10 ? parseISO(dateA) : new Date(dateA), "dd/MM/yyyy") : "—",
        Sedi: sedeLabel,
        Ricerca: search.trim() || "—",
      },
    };
  }, [
    exportSourceRows,
    selectedIds.size,
    vistaIncasso,
    isVistaIncassati,
    filtroPeriodo,
    dateDa,
    dateA,
    filtroUffici,
    ufficiList,
    search,
    totalCount,
  ]);

  const handleExportXlsx = useCallback(() => {
    if (!exportSourceRows.length) return;
    try {
      const rows = mapCaricoExportRows(exportSourceRows, ufficiById, provvProdLookup);
      exportCaricoXlsx(rows, exportMeta);
      if (exportMeta.scope === "pagina" && totalCount > exportSourceRows.length) {
        toast.message("Export pagina corrente", {
          description: `Esportate ${exportSourceRows.length} righe su ${totalCount} totali filtrate.`,
        });
      } else {
        toast.success(`Excel generato (${exportSourceRows.length} righe)`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore generazione Excel");
    }
  }, [exportSourceRows, ufficiById, exportMeta, totalCount, provvProdLookup]);

  const handleExportPdf = useCallback(async () => {
    if (!exportSourceRows.length) return;
    try {
      setExportingPdf(true);
      const rows = mapCaricoExportRows(exportSourceRows, ufficiById, provvProdLookup);
      const bytes = await buildCaricoPdf(rows, exportMeta);
      downloadCaricoPdf(bytes, exportMeta);
      if (exportMeta.scope === "pagina" && totalCount > exportSourceRows.length) {
        toast.message("Export pagina corrente", {
          description: `Esportate ${exportSourceRows.length} righe su ${totalCount} totali filtrate.`,
        });
      } else {
        toast.success(`PDF generato (${exportSourceRows.length} righe)`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  }, [exportSourceRows, ufficiById, exportMeta, totalCount, provvProdLookup]);

  const handleExportDocx = useCallback(async () => {
    if (!exportSourceRows.length) return;
    try {
      setExportingDocx(true);
      const rows = mapCaricoExportRows(exportSourceRows, ufficiById, provvProdLookup);
      const blob = await buildCaricoDocx(rows, exportMeta);
      downloadCaricoDocx(blob, exportMeta);
      if (exportMeta.scope === "pagina" && totalCount > exportSourceRows.length) {
        toast.message("Export pagina corrente", {
          description: `Esportate ${exportSourceRows.length} righe su ${totalCount} totali filtrate.`,
        });
      } else {
        toast.success(`Word generato (${exportSourceRows.length} righe)`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore generazione Word");
    } finally {
      setExportingDocx(false);
    }
  }, [exportSourceRows, ufficiById, exportMeta, totalCount, provvProdLookup]);

  const { data: totaleData } = useQuery({
    queryKey: [
      "portafoglio-carico-consultazione-totale",
      search,
      filtroPeriodo,
      isDefaultExtended,
      dateDa,
      dateA,
      filtroUffici.join(","),
      vistaIncasso,
      sedeLockedId,
    ],
    enabled: authReady,
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      const batchSize = 1000;
      let from = 0;
      const rows: any[] = [];
      for (;;) {
        let q = supabase
          .from("v_portafoglio_quietanze")
          .select(
            "premio_lordo, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, numero_rata, numero_rate_totali",
          );
        q = applyPeriodoFilter(q, periodoOpts);
        q = applySearch(q, search);
        q = applySede(q);
        const { data, error } = await q.range(from, from + batchSize - 1);
        if (error) throw new Error(error.message || "Errore totali Carico");
        const batch = data || [];
        rows.push(...batch);
        if (batch.length < batchSize) break;
        from += batchSize;
        if (from > 20_000) break;
      }
      const sumAll = rows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0);
      const sumProvv = rows.reduce((s, r) => s + provvigioneRiga(r), 0);
      return {
        totale: sumAll,
        totaleProvvigioni: sumProvv,
        titoliCount: rows.length,
      };
    },
  });

  const totalePremio = totaleData?.totale ?? 0;
  const totaleProvvigioni = totaleData?.totaleProvvigioni ?? 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === polizze.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(polizze.map((p) => p.id)));
    }
  };

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try {
      const parsed = d.length === 10 ? parseISO(d) : new Date(d);
      if (Number.isNaN(parsed.getTime())) return "—";
      return format(parsed, "dd/MM/yyyy");
    } catch {
      return "—";
    }
  };

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo":
        return "default" as const;
      case "incassato":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-1 pb-3 space-y-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Carico del mese</h1>
            <p className="text-sm text-muted-foreground">
              Polizze e quietanze del carico — consultazione ed estrazione
              {isVistaIncassati ? " · vista incassati" : " · vista pendenti"}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={vistaIncasso}
            onValueChange={(v) => {
              if (!v) return;
              switchVista(v as VistaIncasso);
            }}
            className="border rounded-md"
          >
            <ToggleGroupItem
              value="pendenti"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4"
            >
              Pendenti
            </ToggleGroupItem>
            <ToggleGroupItem
              value="incassati"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4"
            >
              Incassati
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-3">
              <div className="rounded-lg bg-accent/50 p-2.5">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isVistaIncassati ? "Incassate (filtro)" : "Totale titoli"}
                </p>
                <p className="text-xl font-bold text-foreground">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Premi {fmtCurrency(totalePremio)}</p>
                <p className="text-xs font-medium text-foreground/80">
                  Provvigioni totali {fmtCurrency(totaleProvvigioni)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-3">
              <div className="rounded-lg bg-secondary p-2.5">
                <FileSpreadsheet className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quietanze e appendici</p>
                <p className="text-xl font-bold text-foreground">{totaleData?.titoliCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">{fmtCurrency(totaleData?.totale ?? 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per n° polizza, cliente, codice, targa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          {seeAllSedi && (
            <UfficiFilterMultiSelect
              value={filtroUffici}
              onChange={(next) => {
                setFiltroUffici(next);
                setPage(0);
                updateUrl({ sedi: next });
              }}
            />
          )}
          <div className="flex items-center gap-1">
            <span
              className="text-xs text-muted-foreground"
              title={isVistaIncassati ? "Data messa a cassa" : "Inizio garanzia"}
            >
              Dal
            </span>
            <Input
              type="date"
              value={dateDa}
              onChange={(e) => {
                const v = e.target.value;
                setDateDa(v);
                setPage(0);
                if (v || dateA) {
                  setFiltroPeriodo("tutte");
                  setUserTouched(true);
                  updateUrl({ dal: v || null, periodo: "tutte" });
                } else {
                  updateUrl({ dal: null });
                }
              }}
              className="w-[150px]"
            />
            <span className="text-xs text-muted-foreground ml-1">Al</span>
            <Input
              type="date"
              value={dateA}
              onChange={(e) => {
                const v = e.target.value;
                setDateA(v);
                setPage(0);
                if (v || dateDa) {
                  setFiltroPeriodo("tutte");
                  setUserTouched(true);
                  updateUrl({ al: v || null, periodo: "tutte" });
                } else {
                  updateUrl({ al: null });
                }
              }}
              className="w-[150px]"
            />
            {isVistaIncassati && (
              <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">(messa a cassa)</span>
            )}
          </div>
          <ToggleGroup
            type="single"
            value={filtroPeriodo}
            onValueChange={(v) => {
              if (!v) return;
              setFiltroPeriodo(v as Periodo);
              setUserTouched(true);
              setPage(0);
              updateUrl({ periodo: v as Periodo });
            }}
            className="border rounded-md"
          >
            <ToggleGroupItem
              value="mese_corrente"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {isVistaIncassati ? "Mese corrente" : "Mese Corrente"}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tutte"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              Tutte
            </ToggleGroupItem>
          </ToggleGroup>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filtri
            </Button>
          )}
          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportXlsx}
              disabled={!exportSourceRows.length}
              className="gap-1"
              title={selectedIds.size > 0 ? "Esporta selezione" : "Esporta righe in pagina"}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-green-700" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={!exportSourceRows.length || exportingPdf}
              className="gap-1"
              title={selectedIds.size > 0 ? "Esporta selezione" : "Esporta righe in pagina"}
            >
              {exportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {exportingPdf ? "PDF..." : "PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDocx}
              disabled={!exportSourceRows.length || exportingDocx}
              className="gap-1"
              title={selectedIds.size > 0 ? "Esporta selezione" : "Esporta righe in pagina"}
            >
              {exportingDocx ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileType className="h-3.5 w-3.5" />
              )}
              {exportingDocx ? "Word..." : "Word"}
            </Button>
          </div>
        </div>
      </div>

      {isLoading || !authReady ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : isError ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-destructive">
            Errore caricamento Carico: {(caricoError as Error)?.message || "riprova"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchCarico()}>
            Riprova
          </Button>
        </div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {isVistaIncassati
            ? "Nessuna quietanza o appendice incassata con i filtri selezionati"
            : "Nessuna quietanza o appendice nel carico con i filtri selezionati"}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="[&_tr]:border-b sticky top-0 z-[5] bg-background shadow-sm">
                <TableRow className="hover:bg-background">
                  <TableHead className="w-[40px] bg-background" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={polizze.length > 0 && selectedIds.size === polizze.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader field="numero_titolo">N° Polizza</SortableHeader>
                  <TableHead className="bg-background">Tipo</TableHead>
                  <SortableHeader field="cliente_nome_display">Cliente</SortableHeader>
                  <SortableHeader field="compagnia_nome">Agenzia</SortableHeader>
                  <SortableHeader field="ramo_nome">Garanzia</SortableHeader>
                  <SortableHeader field="inizioPolizza" title="Inizio durata complessiva del contratto">
                    Inizio Polizza
                  </SortableHeader>
                  <SortableHeader field="finePolizza" title="Fine durata complessiva del contratto">
                    Fine Polizza
                  </SortableHeader>
                  <SortableHeader field="inizioGaranzia" title="Periodo di garanzia della quietanza">
                    Inizio Garanzia
                  </SortableHeader>
                  <SortableHeader field="fineGaranzia" title="Periodo di garanzia della quietanza">
                    Fine Garanzia
                  </SortableHeader>
                  <SortableHeader field="targa_telaio">Targa</SortableHeader>
                  <SortableHeader field="rate">Fraz</SortableHeader>
                  <SortableHeader field="premio_lordo" className="text-right">
                    Lordo
                  </SortableHeader>
                  <TableHead className="text-right bg-background">Provv. totali</TableHead>
                  <TableHead className="text-right bg-background">Provv. produttore</TableHead>
                  <SortableHeader field="ae_nome">AE</SortableHeader>
                  <SortableHeader field="produttore_nome">Produttore</SortableHeader>
                  <SortableHeader field="stato">Stato</SortableHeader>
                  <SortableHeader field="data_copertura" className="text-center">
                    Copertura
                  </SortableHeader>
                  <SortableHeader field="data_messa_cassa" className="text-center">
                    Messa a Cassa
                  </SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => {
                  const isIncassato = p.stato === "incassato";
                  const inCopertura = isInCoperturaGarantita(p);
                  const isQ = isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1;
                  const statoShown = displayStatoPolizza(p);
                  return (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${rowBorderClass(p)} ${inCopertura ? "bg-orange-50 hover:bg-orange-100/70" : p.is_proroga ? "bg-blue-50/40" : p.is_regolazione ? "bg-orange-50/40" : p.is_appendice_modifica ? "bg-primary/5" : messaCassaRowBgClass(p) || (!isMessaACassa(p) && isQ ? "hover:bg-muted/40" : "")}`}
                      onClick={() => {
                        const h = rowHref(p);
                        if (h) navigate(h);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell className={`font-medium ${isQ ? "pl-8 font-normal text-muted-foreground" : ""}`}>
                        {isQ && <span className="mr-1 text-muted-foreground">└</span>}
                        {p.is_proroga && (
                          <span className="text-blue-600 mr-1" title="Proroga collegata">
                            ↳
                          </span>
                        )}
                        {p.is_regolazione && (
                          <span className="text-orange-600 mr-1" title="Regolazione collegata">
                            ↳
                          </span>
                        )}
                        {p.is_appendice_modifica && (
                          <span className="text-primary mr-1" title="Appendice modifica">
                            ↳
                          </span>
                        )}
                        {p.titolo_derivato_numero || p.numero_titolo || "—"}
                        {p.titolo_derivato_numero &&
                          p.numero_titolo &&
                          p.titolo_derivato_numero !== p.numero_titolo && (
                            <span className="text-xs text-muted-foreground ml-1">({p.numero_titolo})</span>
                          )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {p.is_proroga ? (
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white" title="Titolo di proroga">
                            Proroga
                          </Badge>
                        ) : p.is_regolazione ? (
                          <Badge
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            title="Titolo di Regolazione Premio"
                          >
                            Regolazione
                          </Badge>
                        ) : p.is_appendice_modifica ? (
                          <Badge variant="secondary" title="Appendice di modifica">
                            Modifica
                          </Badge>
                        ) : (
                          <TipoPolizzaBadge
                            tipo="quietanza"
                            numero={p.numero_rata || (isQ ? undefined : 1)}
                            totale={p.numero_rate_totali || (isQ ? undefined : 1)}
                            messaACassa={isMessaACassa(p)}
                          />
                        )}
                      </TableCell>
                      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      {(() => {
                        const d = datePeriodoPolizzaGaranzia(p);
                        return (
                          <>
                            <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.inizioPolizza) : "—"}</TableCell>
                            <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.finePolizza) : "—"}</TableCell>
                            <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_da ?? d.inizioGaranzia) : "—"}</TableCell>
                            <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_a ?? d.fineGaranzia) : "—"}</TableCell>
                          </>
                        );
                      })()}
                      <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
                      <TableCell>{frazLabel(p.rate)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(provvigioneRiga(p))}</TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const n = provvigioneProduttoreForRow(p, provvProdLookup);
                          return n == null ? "—" : fmtCurrency(n);
                        })()}
                      </TableCell>
                      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                      <TableCell
                        className="text-sm max-w-[200px] truncate"
                        title={p.produttori_display || p.produttore_nome || undefined}
                      >
                        {p.produttori_display || p.produttore_nome || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant={statoBadgeVariant(statoShown)}>{statoShown}</Badge>
                          {p.conferimento_gestito && !p.fondi_ricevuti && (
                            <Badge variant="destructive" className="text-[10px] h-5">
                              Att. Fondi
                            </Badge>
                          )}
                          {p.conferimento_gestito && p.fondi_ricevuti && (
                            <Badge className="bg-orange-500 text-white text-[10px] h-5 hover:bg-orange-600">
                              Conf.
                            </Badge>
                          )}
                          <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {inCopertura || p.data_copertura ? fmtDate(p.data_copertura) : "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {p.data_messa_cassa ? fmtDate(p.data_messa_cassa) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioCaricoConsultazionePage;
