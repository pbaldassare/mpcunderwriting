// Carico – toggle Mese Corrente / Tutte, default = mese corrente + arretrati non a cassa
import { useServerPagination } from "@/hooks/useServerPagination";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Search, Euro, Banknote, Undo2, ArrowUpDown, ArrowUp, ArrowDown, Hourglass, RotateCcw, ArrowRightLeft, FileSpreadsheet, FileText, FileType, Loader2 } from "lucide-react";

import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { invokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { MessaCassaDialog, type PreferredBonificoContext } from "@/components/portafoglio/MessaCassaDialog";
import { GarantitoDialog } from "@/components/portafoglio/GarantitoDialog";
import { IncassiBonificiPanel } from "@/components/portafoglio/IncassiBonificiPanel";
import { BonificoMatchBadge } from "@/components/portafoglio/BonificoMatchBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield } from "lucide-react";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { rowBorderClass, isQuietanzaRow, displayStatoPolizza, messaCassaRowBgClass, isMessaACassa } from "@/lib/polizzeDisplay";
import { isInCoperturaGarantita, isDaChiudereIncasso, isGarantitoAperto, PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";
import { canHaveDataCopertura } from "@/lib/quietanze";
import { quietanzaSogliaGaranziaDa } from "@/lib/quietanzeClienteView";
import { UfficiFilterMultiSelect } from "@/components/portafoglio/UfficiFilterMultiSelect";
import { fetchBonificiApertiPerIncassi } from "@/lib/bonificoDaIncasso";
import {
  BONIFICO_MATCH_MIN_SCORE,
  scoreOrdinanteVsNomi,
  suggestBonificiPerCliente,
  type BonificoAperto,
  type BonificoSuggerito,
} from "@/lib/bonificoMatch";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { provvigioneProduttoreForRow } from "@/lib/provvigioneProduttore";
import { useProvvigioniProduttoreLookup } from "@/hooks/useProvvigioniProduttoreLookup";
import { mapCaricoExportRows } from "@/lib/portafoglioCarico/mapRow";
import { exportCaricoXlsx } from "@/lib/portafoglioCarico/exportXlsx";
import { buildCaricoPdf, downloadCaricoPdf } from "@/lib/portafoglioCarico/exportPdf";
import { buildCaricoDocx, downloadCaricoDocx } from "@/lib/portafoglioCarico/exportDocx";
import type { CaricoExportMeta } from "@/lib/portafoglioCarico/columns";

/** Stessa regola del dettaglio cliente / E/C (non usare ?? : lo 0 non fa fallback a firma). */
const provvigioneRiga = getProvvigioneEC;

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const startOfMonthStr = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
const endOfMonthStr = () => format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");
/** Da Incassi: priorità alla quietanza (non alla madre), come Portafoglio Attive. */
const rowHref = (p: any): string | null => {
  if (p?.quietanza_id) return `/quietanze/${p.quietanza_id}`;
  if (p?.is_appendice_modifica || p?.is_proroga || p?.is_regolazione) {
    if (p?.id) return `/titoli/${p.id}`;
  }
  if (p?.polizza_id) return `/polizze/${p.polizza_id}`;
  if (p?.id) return `/titoli/${p.id}`;
  return null;
};


const IncassiPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, profile } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAllSedi = isAdmin || isCfo;
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("garanzia_a");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const [searchParams, setSearchParams] = useSearchParams();
  type Periodo = "mese_corrente" | "tutte";
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cassaDialogTitoli, setCassaDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [cassaDialogOpen, setCassaDialogOpen] = useState(false);
  const [garantitoDialogTitoli, setGarantitoDialogTitoli] = useState<Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null }>>([]);
  const [garantitoDialogOpen, setGarantitoDialogOpen] = useState(false);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [filtroUffici, setFiltroUffici] = useState<string[]>(() => {
    const raw = searchParams.get("sedi");
    if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  });
  const [bonificiPanelOpen, setBonificiPanelOpen] = useState(() => searchParams.get("tab") === "bonifici");
  const [preferredBonifico, setPreferredBonifico] = useState<PreferredBonificoContext | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  type VistaIncasso = "pendenti" | "incassati";
  const [vistaIncasso, setVistaIncasso] = useState<VistaIncasso>(() =>
    searchParams.get("vista") === "incassati" ? "incassati" : "pendenti",
  );
  const isVistaIncassati = vistaIncasso === "incassati";

  // Utenti sede: forza filtro sulla propria sede (non admin/cfo)
  useEffect(() => {
    if (seeAllSedi || !profile?.ufficio_id) return;
    const sedeId = profile.ufficio_id;
    setFiltroUffici((prev) => (prev.length === 1 && prev[0] === sedeId ? prev : [sedeId]));
    const raw = searchParams.get("sedi");
    if (raw !== sedeId) {
      const sp = new URLSearchParams(searchParams);
      sp.set("sedi", sedeId);
      setSearchParams(sp, { replace: true });
    }
  }, [seeAllSedi, profile?.ufficio_id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (next.periodo) sp.set("periodo", next.periodo); else sp.delete("periodo");
    }
    if (next.dal !== undefined) {
      if (next.dal) sp.set("dal", next.dal); else sp.delete("dal");
    }
    if (next.al !== undefined) {
      if (next.al) sp.set("al", next.al); else sp.delete("al");
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
  }, []); // migrazione URL legacy messe_cassa → tutte (default)

  useEffect(() => {
    if (searchParams.get("tab") === "bonifici") setBonificiPanelOpen(true);
    const v = searchParams.get("vista");
    setVistaIncasso(v === "incassati" ? "incassati" : "pendenti");
  }, [searchParams]);

  const setBonificiPanelOpenSync = useCallback(
    (open: boolean) => {
      setBonificiPanelOpen(open);
      const sp = new URLSearchParams(searchParams);
      if (open) sp.set("tab", "bonifici");
      else sp.delete("tab");
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const resetFilters = () => {
    setDateDa("");
    setDateA("");
    setSearch("");
    setFiltroPeriodo("tutte");
    setUserTouched(false);
    setFiltroUffici([]);
    setVistaIncasso("pendenti");
    setSelectedIds(new Set());
    setPage(0);
    const sp = new URLSearchParams(searchParams);
    sp.delete("periodo"); sp.delete("dal"); sp.delete("al"); sp.delete("sedi"); sp.delete("vista");
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
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(0);
  };

  const SortableHeader = ({ field, children, className }: { field: string; children: React.ReactNode; className?: string }) => {
    const Icon = sortField === field ? (sortDirection === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={`cursor-pointer select-none bg-background ${className || ""}`} onClick={() => handleSort(field)}>
        <div className="flex items-center gap-1">
          {children}
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableHead>
    );
  };

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
  ]);

  /** Quietanze e appendici in un'unica lista. */
  const isAppendiceExpr = "is_appendice_modifica.eq.true,is_regolazione.eq.true,is_proroga.eq.true";

  const applyDateRange = (q: any, col: string) => {
    if (dateDa) q = q.gte(col, dateDa);
    if (dateA) q = q.lte(col, dateA);
    return q;
  };

  const applySedeFilter = (q: any) => {
    if (!seeAllSedi && profile?.ufficio_id) {
      return q.eq("ufficio_id", profile.ufficio_id);
    }
    return filtroUffici.length > 0 ? q.in("ufficio_id", filtroUffici) : q;
  };

  /**
   * Pendenti: attivo + (senza messa a cassa OR garantito aperto).
   * Incassati: stato=incassato; Dal/Al e "mese corrente" su data_messa_cassa.
   */
  const applyPeriodoFilter = (q: any) => {
    if (isVistaIncassati) {
      q = q.eq("stato", "incassato");
      if (dateDa || dateA) return applyDateRange(q, "data_messa_cassa");
      if (filtroPeriodo === "mese_corrente") {
        return q
          .gte("data_messa_cassa", startOfMonthStr())
          .lte("data_messa_cassa", endOfMonthStr());
      }
      return q;
    }

    // Pendenti: quietanze e appendici (include garantito con data_messa_cassa valorizzata)
    q = q.eq("stato", "attivo").or(PENDENTI_OR_GARANTITO_APERTO_FILTER);

    // Range esplicito Dal/Al: solo garanzia_da (senza soglia 60gg né null)
    if (dateDa || dateA) {
      return applyDateRange(q, "garanzia_da");
    }

    if (filtroPeriodo === "mese_corrente") {
      const today = todayStr();
      const start = startOfMonthStr();
      const end = endOfMonthStr();
      const meseOArretrato = `or(garanzia_da.lt.${today},and(garanzia_da.gte.${start},garanzia_da.lte.${end}))`;
      const soglia = quietanzaSogliaGaranziaDa();
      // Rate: soglia 60gg + mese/arretrato; appendici: mese/arretrato senza soglia
      return q.or(
        `garanzia_da.is.null,and(garanzia_da.lte.${soglia},${meseOArretrato}),and(or(${isAppendiceExpr}),${meseOArretrato})`,
      );
    }

    // "tutte": rate con soglia 60gg + tutte le appendici da incassare
    const soglia = quietanzaSogliaGaranziaDa();
    return q.or(
      `garanzia_da.is.null,garanzia_da.lte.${soglia},${isAppendiceExpr}`,
    );
  };

  const applySearch = (q: any) =>
    search ? q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`) : q;

  const { data: result, isLoading, isError, error: caricoError, refetch: refetchCarico } = useQuery({
    queryKey: [
      "portafoglio-carico",
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
    ],
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      // count estimated: evita secondo full-scan pesante su v_portafoglio_quietanze
      let q = supabase.from("v_portafoglio_quietanze").select(
        "id, quietanza_id, polizza_id, numero_titolo, titolo_derivato_numero, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, ufficio_id, data_messa_cassa, data_copertura, data_pagamento, data_decorrenza_rinnovo, conferimento_gestito, fondi_ricevuti, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, appendice_tipo, regolazione_quietanza_id, proroga_polizza_madre_id, numero_rata, numero_rate_totali",
        { count: "estimated" }
      );
      q = applyPeriodoFilter(q);
      q = applySearch(q);
      q = applySedeFilter(q);

      const { data, count, error } = await q
        .order(sortField, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      if (error) {
        console.error("[Incassi] query v_portafoglio_quietanze:", error);
        throw new Error(error.message || "Errore caricamento Incassi");
      }
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = (result?.data || []);
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
      "portafoglio-carico-totale",
      search,
      filtroPeriodo,
      isDefaultExtended,
      dateDa,
      dateA,
      filtroUffici.join(","),
      vistaIncasso,
    ],
    retry: 1,
    staleTime: 15_000,
    queryFn: async () => {
      // Pagine da 1000: evita timeout su un'unica response enorme
      const pageSize = 1000;
      let from = 0;
      const rows: any[] = [];
      for (;;) {
        let q = supabase
          .from("v_portafoglio_quietanze")
          .select(
            "premio_lordo, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, numero_rata, numero_rate_totali, cliente_anagrafica_id, cliente_nome_display",
          );
        q = applyPeriodoFilter(q);
        q = applySearch(q);
        q = applySedeFilter(q);
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw new Error(error.message || "Errore totali Incassi");
        const batch = data || [];
        rows.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
        if (from > 20_000) break;
      }
      const sumAll = rows.reduce((s, r) => s + (Number(r.premio_lordo) || 0), 0);
      const sumProvv = rows.reduce((s, r) => s + provvigioneRiga(r), 0);
      const clientiById = new Map<string, string>();
      for (const r of rows) {
        const id = (r as any).cliente_anagrafica_id as string | null;
        const nome = String((r as any).cliente_nome_display || "").trim();
        if (id && nome && !clientiById.has(id)) clientiById.set(id, nome);
      }
      return {
        totale: sumAll,
        totaleProvvigioni: sumProvv,
        titoliCount: rows.length,
        clientiScope: Array.from(clientiById.entries()).map(([id, nome]) => ({ id, nome })),
      };
    },
  });
  const totalePremio = totaleData?.totale ?? 0;
  const totaleProvvigioni = totaleData?.totaleProvvigioni ?? 0;

  // Rinnovi in attesa di messa a cassa della polizza precedente
  const { data: pendingRinnovi } = useQuery({
    queryKey: ["portafoglio-carico-pending", dateDa, dateA, filtroUffici.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_quietanze")
        .select("id, quietanza_id, polizza_id, numero_titolo, cliente_nome_display, compagnia_nome, data_scadenza, premio_lordo, sostituisce_polizza, ufficio_id")
        .eq("stato", "in_attesa_rinnovo");
      q = applyDateRange(q, "data_scadenza");
      q = applySedeFilter(q);
      const { data } = await q.order("data_scadenza", { ascending: true });
      return (data || []);
    },
  });
  const pendingCount = pendingRinnovi?.length || 0;

  const { data: bonificiAperti = [], isFetching: bonificiLoading } = useQuery({
    queryKey: ["incassi-bonifici-aperti", filtroUffici.join(","), seeAllSedi, profile?.ufficio_id],
    queryFn: () => {
      const ufficioIds = seeAllSedi
        ? (filtroUffici.length > 0 ? filtroUffici : undefined)
        : (profile?.ufficio_id ? [profile.ufficio_id] : undefined);
      return fetchBonificiApertiPerIncassi({ ufficioIds });
    },
    staleTime: 30_000,
  });

  const searchTrim = search.trim();
  const searchActive = !!searchTrim && !isVistaIncassati;

  /** Con search: solo bonifici collegati (cliente_id / nome / testo ordinante). */
  const bonificiVisibili = useMemo(() => {
    if (!searchActive) return bonificiAperti;
    const term = searchTrim.toLowerCase();
    const clienti = totaleData?.clientiScope || [];
    const clienteIds = new Set(clienti.map((c) => c.id));
    const nomi = clienti.map((c) => c.nome);

    return bonificiAperti.filter((b) => {
      if (b.cliente_id && clienteIds.has(b.cliente_id)) return true;
      const hay = `${b.ordinante || ""} ${b.descrizione || ""}`.toLowerCase();
      if (term.length >= 2 && hay.includes(term)) return true;
      if (nomi.length > 0 && scoreOrdinanteVsNomi(b.ordinante, b.descrizione, nomi) >= BONIFICO_MATCH_MIN_SCORE) {
        return true;
      }
      return false;
    });
  }, [bonificiAperti, searchActive, searchTrim, totaleData?.clientiScope]);

  const totaleBonificiAperti = useMemo(
    () => bonificiVisibili.reduce((s, b) => s + (Number(b.importo) || 0), 0),
    [bonificiVisibili],
  );

  // Con ricerca e match: apri il pannello bonifici per farli vedere subito
  useEffect(() => {
    if (!searchActive) return;
    if (bonificiVisibili.length > 0) setBonificiPanelOpenSync(true);
  }, [searchActive, searchTrim, bonificiVisibili.length, setBonificiPanelOpenSync]);

  /** Per riga quietanza: match nome (importo ignorato). */
  const suggerimentiByTitoloId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof suggestBonificiPerCliente>>();
    for (const p of polizze) {
      if (!isDaChiudereIncasso(p)) continue;
      const sug = suggestBonificiPerCliente(bonificiAperti, {
        clienteId: (p as any).cliente_anagrafica_id,
        clienteNome: p.cliente_nome_display,
      });
      if (sug.length > 0) map.set(p.id, sug);
    }
    return map;
  }, [polizze, bonificiAperti]);

  const quietanzeConSuggerimento = suggerimentiByTitoloId.size;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-pending"] });
    queryClient.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
    queryClient.invalidateQueries({ queryKey: ["messa-cassa-bonifici-candidati"] });
    queryClient.invalidateQueries({ queryKey: ["mov-bancari"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
    queryClient.invalidateQueries({ queryKey: ["anticipi-globale"] });
    queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
  };

  const openIncassa = useCallback(
    (
      rows: Array<{ id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null; cliente_nome_display?: string | null }>,
      prefer?: PreferredBonificoContext | null,
    ) => {
      setPreferredBonifico(prefer ?? null);
      setCassaDialogTitoli(rows);
      setCassaDialogOpen(true);
    },
    [],
  );

  const pickBonificoPerRiga = useCallback(
    (
      p: { id: string; numero_titolo?: string | null; premio_lordo?: number | null; cliente_anagrafica_id?: string | null; cliente_nome_display?: string | null },
      b: BonificoSuggerito | BonificoAperto,
    ) => {
      openIncassa(
        [{
          id: p.id,
          numero_titolo: p.numero_titolo,
          premio_lordo: p.premio_lordo,
          cliente_anagrafica_id: p.cliente_anagrafica_id,
          cliente_nome_display: (p as any).cliente_nome_display ?? null,
        }],
        {
          movimentoId: b.id,
          contoBancarioId: b.conto_bancario_id,
        },
      );
    },
    [openIncassa],
  );

  // Attive da chiudere: senza messa a cassa, oppure garantito ancora da convertire in incasso pieno
  const selectedAttive = useMemo(
    () => polizze.filter(p => selectedIds.has(p.id) && isDaChiudereIncasso(p)),
    [polizze, selectedIds]
  );

  const handleUsaBonifico = useCallback(
    (b: BonificoAperto) => {
      const prefer: PreferredBonificoContext = {
        movimentoId: b.id,
        contoBancarioId: b.conto_bancario_id,
      };
      if (selectedAttive.length === 0) {
        setPreferredBonifico(prefer);
        toast.message("Bonifico memorizzato", {
          description: "Seleziona le quietanze e poi clicca Incassa: il bonifico sarà già proposto.",
        });
        return;
      }
      openIncassa(
        selectedAttive.map((p) => ({
          id: p.id,
          numero_titolo: p.numero_titolo,
          premio_lordo: p.premio_lordo,
          cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
          cliente_nome_display: (p as any).cliente_nome_display ?? null,
        })),
        prefer,
      );
    },
    [selectedAttive, openIncassa],
  );
  const selectedGarantibile = useMemo(
    () => selectedAttive.filter((p) => canHaveDataCopertura(p as any) && !isGarantitoAperto(p)),
    [selectedAttive]
  );
  const selectedIncassate = useMemo(() => polizze.filter(p => selectedIds.has(p.id) && p.stato === "incassato"), [polizze, selectedIds]);

  const selectedRows = useMemo(
    () => polizze.filter((p) => selectedIds.has(p.id)),
    [polizze, selectedIds],
  );
  const selectedPremi = useMemo(
    () => selectedRows.reduce((s, p) => s + (Number(p.premio_lordo) || 0), 0),
    [selectedRows],
  );
  const selectedProvvigioni = useMemo(
    () => selectedRows.reduce((s, p) => s + provvigioneRiga(p), 0),
    [selectedRows],
  );
  const selectedProvvigioniProduttore = useMemo(
    () =>
      selectedRows.reduce((s, p) => {
        const n = provvigioneProduttoreForRow(p, provvProdLookup);
        return s + (n ?? 0);
      }, 0),
    [selectedRows, provvProdLookup],
  );
  const selectedHasProduttore = useMemo(
    () => selectedRows.some((p) => provvigioneProduttoreForRow(p, provvProdLookup) != null),
    [selectedRows, provvProdLookup],
  );

  const bulkMettiACassa = useCallback(async () => {
    if (selectedAttive.length === 0) return;
    setBulkLoading(true);
    const today = todayStr();
    let ok = 0, ko = 0;
    const notificaIds: string[] = [];
    for (const p of selectedAttive) {
      // Native write: aggiorniamo la quietanza per titolo_id legacy
      const { error } = await (supabase.from("quietanze") as any).update({
        stato: "incassato",
        data_incasso: today,
        data_messa_cassa: today,
        data_pagamento: today,
        importo_incassato: p.premio_lordo ?? null,
      }).eq("titolo_id", p.id);
      if (error) ko++; else {
        ok++;
        notificaIds.push(p.id);
        // Genera provvigioni per ogni polizza messa a cassa
        supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: p.id } }).catch(() => {});
      }

    }
    if (notificaIds.length > 0) {
      invokeNotificaMessaCassa(notificaIds)
        .then(({ data, error }) => {
          if (error || (data && data.ok === false && !data.skipped && !(data.invii_ok))) {
            toast.warning("Notifica agenzia non inviata");
          } else if (data?.invii_ko) {
            toast.warning(`Notifiche: ${data.invii_ok} agenzie ok, ${data.invii_ko} con errore`);
          } else if ((data?.agenzie ?? 0) > 1) {
            toast.success(`Notifiche inviate a ${data.agenzie} agenzie (ognuna solo le proprie polizze)`);
          } else if (data?.archive_error) {
            toast.warning(`Email inviata ma archivio PDF fallito: ${data.archive_error}`);
          }
          if (data?.documenti_archiviati) {
            queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
          }
        })
        .catch(() => toast.warning("Notifica agenzia non inviata"));
    }
    if (ok > 0) {
      await logAttivita({
        azione: "messa_a_cassa_massiva",
        entita_tipo: "quietanza",
        entita_id: "batch",
        dettagli_json: { messe_a_cassa: ok, errori: ko },
      });
    }
    toast.success(`${ok} polizze messe a cassa${ko > 0 ? `, ${ko} errori` : ""}`);
    setSelectedIds(new Set());
    invalidateQueries();
    setBulkLoading(false);
  }, [selectedAttive, queryClient]);

  const bulkAnnullaIncasso = useCallback(async () => {
    if (selectedIncassate.length === 0) return;
    setBulkLoading(true);
    let ok = 0, ko = 0;
    for (const p of selectedIncassate) {
      const res = await annullaMessaACassa(p.id);
      if (res.ok) ok++; else ko++;
    }
    if (ok > 0) {
      await logAttivita({
        azione: "annulla_incasso_massiva",
        entita_tipo: "titolo",
        entita_id: "batch",
        dettagli_json: { annullate: ok, errori: ko },
      });
    }
    toast.success(`${ok} incassi annullati${ko > 0 ? `, ${ko} errori` : ""}`);
    setSelectedIds(new Set());
    invalidateQueries();
    setBulkLoading(false);
  }, [selectedIncassate]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === polizze.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(polizze.map(p => p.id)));
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
      case "attivo": return "default" as const;
      case "incassato": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra fissa sotto Topbar: titolo, KPI, filtri restano visibili mentre scorri le polizze */}
      <div className="sticky top-14 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 pt-1 pb-3 space-y-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Incassi</h1>
            <p className="text-sm text-muted-foreground">
              {isVistaIncassati ? (
                (() => {
                  if (!dateDa && !dateA && filtroPeriodo === "tutte") {
                    return "Quietanze e appendici già messe a cassa. Annullando un incasso tornano tra i pendenti.";
                  }
                  if (!dateDa && !dateA && filtroPeriodo === "mese_corrente") {
                    return "Incassate nel mese corrente (data messa a cassa).";
                  }
                  const da = dateDa ? format(dateDa.length === 10 ? parseISO(dateDa) : new Date(dateDa), "dd/MM/yyyy") : null;
                  const a = dateA ? format(dateA.length === 10 ? parseISO(dateA) : new Date(dateA), "dd/MM/yyyy") : null;
                  if (da && a) return `Incassate dal ${da} al ${a}`;
                  if (da) return `Incassate dal ${da}`;
                  return `Incassate fino al ${a}`;
                })()
              ) : (
                (() => {
                  const labelBase = "Da incassare";
                  if (!dateDa && !dateA) {
                    return (
                      <>
                        Quietanze e appendici ancora da mettere a cassa
                        {isDefaultExtended && <span className="ml-2 text-xs text-primary">· inclusi arretrati</span>}
                      </>
                    );
                  }
                  const da = dateDa ? format(dateDa.length === 10 ? parseISO(dateDa) : new Date(dateDa), "dd/MM/yyyy") : null;
                  const a = dateA ? format(dateA.length === 10 ? parseISO(dateA) : new Date(dateA), "dd/MM/yyyy") : null;
                  if (da && a) return `${labelBase} dal ${da} al ${a}`;
                  if (da) return `${labelBase} dal ${da}`;
                  return `${labelBase} fino al ${a}`;
                })()
              )}
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
            <ToggleGroupItem value="pendenti" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4">
              Pendenti
            </ToggleGroupItem>
            <ToggleGroupItem value="incassati" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-4">
              Incassati
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Bulk action buttons */}
        {(selectedAttive.length > 0 || selectedGarantibile.length > 0 || selectedIncassate.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selezionat{selectedIds.size === 1 ? "a" : "e"}
            </span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              Premi {fmtCurrency(selectedPremi)}
            </span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              Provvigioni totali {fmtCurrency(selectedProvvigioni)}
            </span>
            {selectedHasProduttore && (
              <span className="text-sm font-medium text-foreground tabular-nums">
                Provvigioni produttore {fmtCurrency(selectedProvvigioniProduttore)}
              </span>
            )}
            {!isVistaIncassati && selectedAttive.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  openIncassa(
                    selectedAttive.map((p) => ({
                      id: p.id,
                      numero_titolo: p.numero_titolo,
                      premio_lordo: p.premio_lordo,
                      cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
                      cliente_nome_display: (p as any).cliente_nome_display ?? null,
                    })),
                    preferredBonifico,
                  )
                }
                disabled={bulkLoading}
                className="gap-1"
              >
                <Banknote className="h-3.5 w-3.5" />
                Incassa ({selectedAttive.length})
              </Button>
            )}
            {!isVistaIncassati && selectedGarantibile.length > 0 && (
              <Button size="sm" onClick={() => { setGarantitoDialogTitoli(selectedGarantibile.map(p => ({ id: p.id, numero_titolo: p.numero_titolo, premio_lordo: p.premio_lordo, cliente_anagrafica_id: (p as any).cliente_anagrafica_id }))); setGarantitoDialogOpen(true); }} disabled={bulkLoading} className="gap-1 bg-orange-500 hover:bg-orange-600 text-white">
                <Shield className="h-3.5 w-3.5" />
                Garantito ({selectedGarantibile.length})
              </Button>
            )}
            {selectedIncassate.length > 0 && isAdmin && (
              <Button size="sm" variant="outline" onClick={bulkAnnullaIncasso} disabled={bulkLoading} className="gap-1">
                <Undo2 className="h-3.5 w-3.5" />
                {bulkLoading ? "In corso..." : `Annulla Incasso (${selectedIncassate.length})`}
              </Button>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-2 ${isVistaIncassati ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-3`}>
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
                <p className="text-xs text-muted-foreground">
                  Premi {fmtCurrency(totalePremio)}
                </p>
                <p className="text-xs font-medium text-foreground/80">
                  Provvigioni totali {fmtCurrency(totaleProvvigioni)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-3">
              <div className="rounded-lg bg-secondary p-2.5">
                <Banknote className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isVistaIncassati ? "Incassate (filtro)" : "Quietanze e appendici"}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {totaleData?.titoliCount ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtCurrency(totaleData?.totale ?? 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          {!isVistaIncassati && (
            <Card
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setBonificiPanelOpenSync(!bonificiPanelOpen)}
            >
              <CardContent className="flex items-center gap-4 p-3">
                <div className="rounded-lg bg-sky-100 p-2.5">
                  <ArrowRightLeft className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {searchActive ? "Bonifici (ricerca)" : "Bonifici aperti"}
                  </p>
                  <p className="text-xl font-bold text-foreground">{bonificiVisibili.length}</p>
                  <p className="text-xs text-muted-foreground">{fmtCurrency(totaleBonificiAperti)}</p>
                  {searchActive && bonificiAperti.length !== bonificiVisibili.length && (
                    <p className="text-[10px] text-sky-700">su {bonificiAperti.length} aperti</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {!isVistaIncassati && (
            <Card>
              <CardContent className="flex items-center gap-4 p-3">
                <div className="rounded-lg bg-orange-100 p-2.5">
                  <Hourglass className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In attesa rinnovo</p>
                  <p className="text-xl font-bold text-foreground">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">polizza precedente non a cassa</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per n° polizza, cliente, codice, targa..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
            <span className="text-xs text-muted-foreground" title={isVistaIncassati ? "Data messa a cassa" : "Inizio garanzia"}>
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
            <ToggleGroupItem value="mese_corrente" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {isVistaIncassati ? "Mese corrente" : "Mese Corrente"}
            </ToggleGroupItem>
            <ToggleGroupItem value="tutte" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Tutte</ToggleGroupItem>
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
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
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
              {exportingDocx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5" />}
              {exportingDocx ? "Word..." : "Word"}
            </Button>
          </div>
        </div>
      </div>

      {!isVistaIncassati && (
        <IncassiBonificiPanel
          open={bonificiPanelOpen}
          onOpenChange={setBonificiPanelOpenSync}
          bonifici={bonificiVisibili}
          loading={bonificiLoading}
          sedeFilterActive={filtroUffici.length > 0}
          suggerimentiCount={quietanzeConSuggerimento}
          searchTerm={searchActive ? searchTrim : undefined}
          totaleApertiCount={bonificiAperti.length}
          onUsaPerIncasso={handleUsaBonifico}
        />
      )}

      {/* Banner: rinnovi in attesa di messa a cassa della polizza precedente */}
      {!isVistaIncassati && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => setPendingDialogOpen(true)}
          className="w-full text-left rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 transition-colors p-3 flex items-center gap-3"
        >
          <Hourglass className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-900">
              {pendingCount} {pendingCount === 1 ? "rinnovo in attesa" : "rinnovi in attesa"} di messa a cassa della polizza precedente
            </p>
            <p className="text-xs text-orange-700">
              Compariranno nel carico solo dopo che la polizza precedente sarà messa a cassa. Click per dettagli.
            </p>
          </div>
        </button>
      )}

      <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-orange-600" /> Rinnovi in attesa di messa a cassa
            </DialogTitle>
            <DialogDescription>
              Questi rinnovi diventeranno attivi automaticamente quando la polizza precedente verrà messa a cassa.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polizza nuova</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead className="text-right">Premio</TableHead>
                  <TableHead>Origina da</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendingRinnovi || []).map((p: any) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { const h = rowHref(p); if (h) { setPendingDialogOpen(false); navigate(h); } }}
                  >
                    <TableCell className="font-mono text-sm">{p.numero_titolo}</TableCell>
                    <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                    <TableCell>{p.compagnia_nome || "—"}</TableCell>
                    <TableCell>{fmtDate(p.data_scadenza)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.sostituisce_polizza}
                    </TableCell>
                  </TableRow>
                ))}
                {pendingCount === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nessun rinnovo in attesa</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : isError ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-destructive">
            Errore caricamento Incassi: {(caricoError as Error)?.message || "riprova"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchCarico()}>
            Riprova
          </Button>
        </div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {isVistaIncassati
            ? "Nessuna quietanza o appendice incassata con i filtri selezionati"
            : "Nessuna quietanza o appendice da incassare"}
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
                  <SortableHeader field="garanzia_da">Inizio Garanzia</SortableHeader>
                  <SortableHeader field="garanzia_a">Fine Garanzia</SortableHeader>
                  <SortableHeader field="targa_telaio">Targa</SortableHeader>
                  <SortableHeader field="rate">Fraz</SortableHeader>
                  <SortableHeader field="premio_lordo" className="text-right">Lordo</SortableHeader>
                  <TableHead className="text-right bg-background">Provv. totali</TableHead>
                  <TableHead className="text-right bg-background">Provv. produttore</TableHead>
                  <SortableHeader field="ae_nome">AE</SortableHeader>
                  <SortableHeader field="produttore_nome">Produttore</SortableHeader>
                  <SortableHeader field="stato">Stato</SortableHeader>
                  <SortableHeader field="data_copertura" className="text-center">Copertura</SortableHeader>
                  <SortableHeader field="data_messa_cassa" className="text-center">Messa a Cassa</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => {
                  const isIncassato = p.stato === "incassato";
                  const inCopertura = isInCoperturaGarantita(p);
                  const isQ = isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1;
                  const statoShown = displayStatoPolizza(p);
                  const polizzaMadreNumero = p.numero_polizza_snapshot || p.numero_titolo;
                  return (
                    <TableRow
                      key={p.id}
                      className={`cursor-pointer ${rowBorderClass(p)} ${inCopertura ? "bg-orange-50 hover:bg-orange-100/70" : p.is_proroga ? "bg-blue-50/40" : p.is_regolazione ? "bg-orange-50/40" : p.is_appendice_modifica ? "bg-primary/5" : messaCassaRowBgClass(p) || (!isMessaACassa(p) && isQ ? "hover:bg-muted/40" : "")}`}
                      onClick={() => { const h = rowHref(p); if (h) navigate(h); }}

                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell className={`font-medium ${isQ ? "pl-8 font-normal text-muted-foreground" : ""}`}>
                        {isQ && <span className="mr-1 text-muted-foreground">└</span>}
                        {p.is_proroga && <span className="text-blue-600 mr-1" title="Proroga collegata">↳</span>}
                        {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                        {p.is_appendice_modifica && <span className="text-primary mr-1" title="Appendice modifica">↳</span>}
                        {p.titolo_derivato_numero || p.numero_titolo || "—"}
                        {p.titolo_derivato_numero && p.numero_titolo && p.titolo_derivato_numero !== p.numero_titolo && (
                          <span className="text-xs text-muted-foreground ml-1">({p.numero_titolo})</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {p.is_proroga ? (
                          <Badge className="bg-blue-500 hover:bg-blue-600 text-white" title="Titolo di proroga">Proroga</Badge>
                        ) : p.is_regolazione ? (
                          <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">Regolazione</Badge>
                        ) : p.is_appendice_modifica ? (
                          <Badge variant="secondary" title="Appendice di modifica">Modifica</Badge>
                        ) : (
                          <TipoPolizzaBadge
                            tipo="quietanza"
                            numero={p.numero_rata || (isQ ? undefined : 1)}
                            totale={p.numero_rate_totali || (isQ ? undefined : 1)}
                            messaACassa={isMessaACassa(p)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{p.cliente_nome_display || "—"}</span>
                          {(() => {
                            const sug = suggerimentiByTitoloId.get(p.id);
                            if (!sug?.length || !isDaChiudereIncasso(p)) return null;
                            return (
                              <BonificoMatchBadge
                                suggerimenti={sug}
                                onPick={(b) =>
                                  pickBonificoPerRiga(
                                    {
                                      id: p.id,
                                      numero_titolo: p.numero_titolo,
                                      premio_lordo: p.premio_lordo,
                                      cliente_anagrafica_id: (p as any).cliente_anagrafica_id,
                                      cliente_nome_display: p.cliente_nome_display ?? null,
                                    },
                                    b,
                                  )
                                }
                              />
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_da)}</TableCell>
                      <TableCell>{fmtDate(p.garanzia_a)}</TableCell>
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
                      <TableCell className="text-sm max-w-[200px] truncate" title={p.produttori_display || p.produttore_nome || undefined}>{p.produttori_display || p.produttore_nome || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Badge variant={statoBadgeVariant(statoShown)}>{statoShown}</Badge>
                          {p.conferimento_gestito && !p.fondi_ricevuti && (
                            <Badge variant="destructive" className="text-[10px] h-5">Att. Fondi</Badge>
                          )}
                          {p.conferimento_gestito && p.fondi_ricevuti && (
                            <Badge className="bg-orange-500 text-white text-[10px] h-5 hover:bg-orange-600">Conf.</Badge>
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

      <MessaCassaDialog
        open={cassaDialogOpen}
        onOpenChange={(o) => {
          setCassaDialogOpen(o);
          if (!o) setPreferredBonifico(null);
        }}
        titoli={cassaDialogTitoli}
        preferredBonifico={preferredBonifico}
        onSuccess={() => {
          setSelectedIds(new Set());
          setPreferredBonifico(null);
          invalidateQueries();
        }}
      />

      <GarantitoDialog
        open={garantitoDialogOpen}
        onOpenChange={setGarantitoDialogOpen}
        titoli={garantitoDialogTitoli}
        onSuccess={() => { setSelectedIds(new Set()); invalidateQueries(); }}
      />

    </div>
  );
};

export default IncassiPage;
