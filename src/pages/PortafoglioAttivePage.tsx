import { Fragment, useMemo, useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Shield, Search, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NuovaPolizzaButton } from "@/components/shared/NuovaPolizzaButton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { RamoSottoramoFilter, expandRamoFilter } from "@/components/polizze/RamoSottoramoFilter";
import { useRamiAll } from "@/hooks/useRamiLookup";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
import { TipoFilterSegmented, type FiltroTipo } from "@/components/polizze/TipoFilterSegmented";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";
import { SortableTableHead, nextSort } from "@/components/shared/SortableTableHead";
import { datePeriodoPolizzaGaranzia } from "@/lib/datePolizzaGaranzia";
import { rowBorderClass, isQuietanzaRow, isPolizzaMadreRow, messaCassaRowBgClass, isMessaACassa } from "@/lib/polizzeDisplay";
import { cn } from "@/lib/utils";

const ROW_SELECT =
  "id, quietanza_id, polizza_id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, sostituisce_polizza, is_regolazione, regolazione_quietanza_id, numero_rata, numero_rate_totali";

type PortafoglioRow = Record<string, any>;

const rowHref = (p: PortafoglioRow) =>
  p?.sostituisce_polizza
    ? `/quietanze/${p.quietanza_id}`
    : `/polizze/${p.polizza_id}`;

const KPI_LABELS: Record<FiltroTipo, string> = {
  polizze: "Polizze attive",
  quietanze: "Quietanze attive",
  regolazioni: "Regolazioni attive",
  garantiti: "Garantiti attivi",
};

const EMPTY_LABELS: Record<FiltroTipo, string> = {
  polizze: "Nessuna polizza trovata",
  quietanze: "Nessuna quietanza trovata",
  regolazioni: "Nessuna regolazione trovata",
  garantiti: "Nessun titolo garantito trovato",
};

const PortafoglioAttivePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string | null>(null);
  const [filtroRamo, setFiltroRamo] = useState<string | null>(null);
  const [escludiMeseCorrente, setEscludiMeseCorrente] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("quietanze");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState("fineGaranzia");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const today = format(new Date(), "yyyy-MM-dd");
  const inizioMese = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const fineMese = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: ramiAll = [] } = useRamiAll();
  const { ramoIds: filterRamoIds } = expandRamoFilter(filtroGruppoRamo, filtroRamo, ramiAll);
  const { page, setPage, pageSize, range } = useServerPagination(25, [
    search,
    filtroGruppoRamo,
    filtroRamo,
    escludiMeseCorrente,
    filtroTipo,
    sortField,
    sortDirection,
  ]);

  const applyTipoFilter = (q: any, tipo: FiltroTipo) => {
    if (tipo === "polizze") return q.is("sostituisce_polizza", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (tipo === "quietanze") return q.not("sostituisce_polizza", "is", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (tipo === "regolazioni") return q.eq("is_regolazione", true);
    return q;
  };

  const applyBaseFilters = (q: any) => {
    let next = q
      .in("stato", ["attivo", "sospeso"])
      .gte("garanzia_a", today);
    if (escludiMeseCorrente) {
      next = next.or(`data_scadenza.lt.${inizioMese},data_scadenza.gt.${fineMese},data_scadenza.is.null`);
    }
    if (search) {
      next = next.or(
        `numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`,
      );
    }
    if (filterRamoIds && filterRamoIds.length > 0) next = next.in("ramo_id", filterRamoIds);
    return next;
  };

  const { data: tipoCounts } = useQuery({
    queryKey: ["portafoglio-attive-counts", search, filterRamoIds, today, escludiMeseCorrente],
    queryFn: async () => {
      const countFor = async (tipo: FiltroTipo) => {
        let q = applyBaseFilters(supabase.from("v_portafoglio_quietanze").select("id", { count: "exact", head: true }));
        q = applyTipoFilter(q, tipo);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
      };
      const [polizze, quietanze, regolazioni] = await Promise.all([
        countFor("polizze"),
        countFor("quietanze"),
        countFor("regolazioni"),
      ]);
      return { polizze, quietanze, regolazioni };
    },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-attive", search, filterRamoIds, page, today, escludiMeseCorrente, filtroTipo, sortField, sortDirection],
    queryFn: async () => {
      const orderCol =
        sortField === "ramo_nome" ? "ramo_nome"
        : sortField === "inizioPolizza" ? "durata_da"
        : sortField === "finePolizza" ? "durata_a"
        : sortField === "inizioGaranzia" ? "garanzia_da"
        : "garanzia_a";
      let q = applyBaseFilters(
        supabase.from("v_portafoglio_quietanze").select(ROW_SELECT, { count: "exact" }),
      );
      q = applyTipoFilter(q, filtroTipo);
      const { data, count, error } = await q
            .order(orderCol, { ascending: sortDirection === "asc" })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const polizzaIdsOnPage = useMemo(
    () =>
      filtroTipo === "polizze"
        ? polizze.filter((p: PortafoglioRow) => !isQuietanzaRow(p)).map((p: PortafoglioRow) => p.polizza_id as string)
        : [],
    [polizze, filtroTipo],
  );

  const { data: rateByPolizza = {} } = useQuery({
    queryKey: ["portafoglio-attive-rate", polizzaIdsOnPage, today, escludiMeseCorrente],
    enabled: filtroTipo === "polizze" && polizzaIdsOnPage.length > 0,
    queryFn: async () => {
      let q = applyBaseFilters(
        supabase.from("v_portafoglio_quietanze").select(ROW_SELECT),
      );
      q = q.in("polizza_id", polizzaIdsOnPage).not("sostituisce_polizza", "is", null);
      const { data, error } = await q.order("garanzia_da", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, PortafoglioRow[]> = {};
      for (const row of data || []) {
        const key = String(row.polizza_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }
      return grouped;
    },
  });

  const titoloIdsRiga = useMemo(() => {
    const ids: string[] = polizze.map((p: PortafoglioRow) => p.id);
    if (filtroTipo === "polizze") {
      for (const pid of polizzaIdsOnPage) {
        if (expanded[pid]) {
          (rateByPolizza[pid] || []).forEach((r) => ids.push(r.id));
        }
      }
    }
    return ids;
  }, [polizze, filtroTipo, polizzaIdsOnPage, expanded, rateByPolizza]);

  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-attive-totale", search, filterRamoIds, today, escludiMeseCorrente, filtroTipo],
    queryFn: async () => {
      let q = applyBaseFilters(supabase.from("v_portafoglio_quietanze").select("premio_lordo"));
      q = applyTipoFilter(q, filtroTipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r.premio_lordo) || 0), 0);
    },
  });

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const toggleExpand = (polizzaId: string) => {
    setExpanded((prev) => ({ ...prev, [polizzaId]: !prev[polizzaId] }));
  };

  const handleSort = (field: string) => {
    const next = nextSort(sortField, sortDirection, field);
    setSortField(next.field);
    setSortDirection(next.direction);
    setPage(0);
  };

  const renderTipoCell = (p: PortafoglioRow) => {
    const isQ = isQuietanzaRow(p);
    return (
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {p.is_regolazione ? (
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">
              Regolazione
            </Badge>
          ) : isQ ? (
            <TipoPolizzaBadge
              tipo="quietanza"
              messaACassa={isMessaACassa(p)}
              numero={p.numero_rata ?? undefined}
              totale={p.numero_rate_totali ?? undefined}
            />
          ) : (
            <TipoPolizzaBadge tipo="polizza" />
          )}
          {p.stato === "sospeso" && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">
              Sospesa
            </Badge>
          )}
          <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
        </div>
      </TableCell>
    );
  };

  const renderDataCells = (p: PortafoglioRow, dates?: ReturnType<typeof datePeriodoPolizzaGaranzia>) => {
    const d = dates || datePeriodoPolizzaGaranzia(p);
    return (
    <>
      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
      <TableCell>{p.compagnia_nome || "—"}</TableCell>
      <TableCell>{p.ramo_nome || "—"}</TableCell>
      <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.inizioPolizza) : "—"}</TableCell>
      <TableCell>{isPolizzaMadreRow(p) ? fmtDate(d.finePolizza) : "—"}</TableCell>
      <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_da ?? d.inizioGaranzia) : "—"}</TableCell>
      <TableCell>{isQuietanzaRow(p) ? fmtDate(p.garanzia_a ?? d.fineGaranzia) : "—"}</TableCell>
      <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
      <TableCell>{frazLabel(p.rate)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.provvigioni_firma)}</TableCell>
      <TableCell className="text-right">{fmtCurrency(p.provvigioni_quietanza)}</TableCell>
      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
      <TableCell className="text-sm">{p.specialist || "—"}</TableCell>
      <TableCell className="text-sm max-w-[200px] truncate" title={p.produttori_display || p.produttore_nome || undefined}>{p.produttori_display || p.produttore_nome || "—"}</TableCell>
    </>
    );
  };

  const renderQuietanzaRow = (p: PortafoglioRow, opts?: { child?: boolean; chainDates?: ReturnType<typeof datePeriodoPolizzaGaranzia> }) => {
    const child = !!opts?.child;
    const dates = opts?.chainDates
      ? { ...opts.chainDates, inizioGaranzia: p.garanzia_da ?? null, fineGaranzia: p.garanzia_a ?? null }
      : datePeriodoPolizzaGaranzia(p);
    return (
      <TableRow
        key={p.id}
        className={cn(
          "cursor-pointer",
          rowBorderClass(p),
          messaCassaRowBgClass(p),
          !isMessaACassa(p) && isQuietanzaRow(p) && "hover:bg-muted/40",
          p.is_regolazione && "bg-orange-50/40",
          child && "bg-muted/20 hover:bg-muted/40",
        )}
        onClick={() => navigate(rowHref(p))}
        title={child ? "Apri quietanza" : "Apri titolo"}
      >
        {filtroTipo === "polizze" && <TableCell />}
        <TableCell className={cn("font-mono text-xs", child && "pl-8 text-muted-foreground")}>
          {child && <span className="mr-1 text-quietanza/70">↳</span>}
          {p.is_regolazione && !child && (
            <span className="text-orange-600 mr-1" title="Regolazione collegata">
              ↳
            </span>
          )}
          {p.numero_titolo || "—"}
        </TableCell>
        {renderTipoCell(p)}
        {filtroTipo === "quietanze" && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            {p.polizza_id ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-mono text-xs"
                onClick={() => navigate(`/polizze/${p.polizza_id}`)}
              >
                {p.numero_titolo || "—"}
              </Button>
            ) : (
              "—"
            )}
          </TableCell>
        )}
        {renderDataCells(p, dates)}
      </TableRow>
    );
  };

  const renderPolizzaMadreRow = (p: PortafoglioRow) => {
    const polizzaId = String(p.polizza_id);
    const rate = rateByPolizza[polizzaId] || [];
    const dates = datePeriodoPolizzaGaranzia(p, rate);
    const isOpen = !!expanded[polizzaId];
    const hasRate = rate.length > 0;

    return (
      <Fragment key={p.id}>
        <TableRow
          className={cn(
            "cursor-pointer border-l-4 border-l-polizza hover:bg-polizza/5 hover:ring-1 hover:ring-inset hover:ring-polizza/30 transition-colors",
            messaCassaRowBgClass(p),
          )}
          onClick={() => navigate(rowHref(p))}
          title="Apri polizza"
        >
          <TableCell className="w-8 p-0 text-center" onClick={(e) => e.stopPropagation()}>
            {hasRate ? (
              <button
                type="button"
                onClick={() => toggleExpand(polizzaId)}
                className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                aria-expanded={isOpen}
                title={isOpen ? "Nascondi quietanze collegate" : `Mostra ${rate.length} quietanze collegate`}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : null}
          </TableCell>
          <TableCell className="font-medium">{p.numero_titolo || "—"}</TableCell>
          {renderTipoCell(p)}
          {renderDataCells(p, dates)}
        </TableRow>
        {isOpen && rate.map((r) => renderQuietanzaRow(r, { child: true, chainDates: dates }))}
      </Fragment>
    );
  };

  const showChevronCol = filtroTipo === "polizze";
  const showPolizzaMadreCol = filtroTipo === "quietanze";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizze Attive</h1>
          <p className="text-sm text-muted-foreground">Polizze in corso di validità</p>
        </div>
        <NuovaPolizzaButton />
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{KPI_LABELS[filtroTipo]}</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            {totaleData != null && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Premio lordo filtrato: {fmtCurrency(totaleData)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
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
        <RamoSottoramoFilter
          gruppoRamoId={filtroGruppoRamo}
          ramoId={filtroRamo}
          onChange={({ gruppoRamoId, ramoId }) => {
            setFiltroGruppoRamo(gruppoRamoId);
            setFiltroRamo(ramoId);
            setPage(0);
          }}
        />
        <TipoFilterSegmented
          value={filtroTipo}
          onChange={(v) => {
            setFiltroTipo(v);
            setExpanded({});
            setPage(0);
          }}
          withRegolazioni
          counts={tipoCounts}
        />
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="escludi-mese"
            checked={escludiMeseCorrente}
            onCheckedChange={(v) => {
              setEscludiMeseCorrente(v);
              setPage(0);
            }}
          />
          <Label htmlFor="escludi-mese" className="text-sm cursor-pointer whitespace-nowrap">
            Escludi scadenze del mese
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">{EMPTY_LABELS[filtroTipo]}</div>
      ) : (
        <>
          <Table>
              <TableHeader>
                <TableRow>
                  {showChevronCol && <TableHead className="w-8" />}
                  <TableHead>{filtroTipo === "quietanze" ? "N° Rata" : "N° Polizza"}</TableHead>
                  <TableHead>Tipo</TableHead>
                  {showPolizzaMadreCol && <TableHead>Polizza madre</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <SortableTableHead field="ramo_nome" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Ordina per garanzia">Garanzia</SortableTableHead>
                  <SortableTableHead field="inizioPolizza" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Inizio durata complessiva del contratto">Inizio Polizza</SortableTableHead>
                  <SortableTableHead field="finePolizza" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Fine durata complessiva del contratto">Fine Polizza</SortableTableHead>
                  <SortableTableHead field="inizioGaranzia" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Periodo di garanzia della quietanza">Inizio Garanzia</SortableTableHead>
                  <SortableTableHead field="fineGaranzia" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} title="Periodo di garanzia della quietanza">Fine Garanzia</SortableTableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead className="text-right">Attive</TableHead>
                  <TableHead className="text-right">Passive</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Specialist</TableHead>
                  <TableHead>Produttore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtroTipo === "polizze"
                  ? polizze.map((p: PortafoglioRow) => renderPolizzaMadreRow(p))
                  : polizze.map((p: PortafoglioRow) => renderQuietanzaRow(p))}
              </TableBody>
            </Table>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioAttivePage;
