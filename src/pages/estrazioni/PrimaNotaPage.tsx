import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { SortableTableHead, nextSort } from "@/components/shared/SortableTableHead";
import { formatDateIT } from "@/lib/formatDate";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  detectPresetPeriodo,
  exportPrimaNotaXlsx,
  fetchPrimaNota,
  applySedeFilter,
  filterPrimaNotaRows,
  groupPrimaNotaByAgenzia,
  groupPrimaNotaByCliente,
  groupPrimaNotaByClienteEAgenzia,
  groupPrimaNotaBySede,
  normalizeDateRange,
  paginatePrimaNota,
  rangeForPreset,
  resolveSedeLock,
  rowsForPrimaNotaExport,
  sortPrimaNotaRows,
  uniquePrimaNotaOptions,
  todayISODate,
  type PrimaNotaRow,
  type PrimaNotaSortField,
  type RaggruppaPrimaNota,
} from "@/lib/primaNota";
import type { PresetPeriodoIncasso } from "@/lib/comunicazioniIncasso";

const PrimaNotaTable = ({
  rows,
  loading,
  sortField,
  sortDirection,
  onSort,
  hideHeader,
}: {
  rows: PrimaNotaRow[];
  loading?: boolean;
  sortField: PrimaNotaSortField;
  sortDirection: "asc" | "desc";
  onSort: (field: PrimaNotaSortField) => void;
  hideHeader?: boolean;
}) => {
  const navigate = useNavigate();
  const header = (field: PrimaNotaSortField, label: string, className?: string) => (
    <SortableTableHead
      field={field}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={(f) => onSort(f as PrimaNotaSortField)}
      className={className}
    >
      <span className="text-xs">{label}</span>
    </SortableTableHead>
  );

  return (
    <div className="border rounded-md">
      <Table>
        {!hideHeader && (
          <TableHeader>
            <TableRow className="bg-muted/40">
              {header("numeroPolizza", "N. polizza")}
              {header("clienteNome", "Nome cliente")}
              {header("agenziaNome", "Agenzia")}
              {header("premioIncassato", "Premio incassato", "text-right")}
              {header("dataIncasso", "Data incasso")}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Caricamento…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                Nessuna polizza incassata per i filtri selezionati
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.titoloId}>
                <TableCell
                  className="text-xs font-mono cursor-pointer hover:underline"
                  onClick={() => navigate(`/titoli/${r.titoloId}`)}
                >
                  {r.numeroPolizza}
                </TableCell>
                <TableCell className="text-xs">{r.clienteNome}</TableCell>
                <TableCell className="text-xs">{r.agenziaNome}</TableCell>
                <TableCell className="text-xs text-right tabular-nums whitespace-nowrap">
                  {fmtEuro(r.premioIncassato)}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDateIT(r.dataIncasso)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const GroupHeading = ({ label, count, total }: { label: string; count: number; total: number }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2">
    <h3 className="text-sm font-semibold text-foreground">
      {label}
      <span className="ml-2 text-xs font-normal text-muted-foreground">
        {count} polizz{count === 1 ? "a" : "e"}
      </span>
    </h3>
    <p className="text-xs tabular-nums text-muted-foreground">{fmtEuro(total)}</p>
  </div>
);

const PrimaNotaPage = () => {
  const navigate = useNavigate();
  const { isAdmin, profile, loading: authLoading } = useAuth();
  const { seeAllSedi, sedeLockedId, authReady } = resolveSedeLock({
    authLoading,
    isAdmin,
    ruolo: profile?.ruolo,
    ufficioId: profile?.ufficio_id,
    hasProfile: !!profile,
  });

  const [dateDa, setDateDa] = useState(() => todayISODate());
  const [dateA, setDateA] = useState(() => todayISODate());
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [raggruppa, setRaggruppa] = useState<RaggruppaPrimaNota>("nessuno");
  const [sortField, setSortField] = useState<PrimaNotaSortField>("dataIncasso");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const presetPeriodo = detectPresetPeriodo(dateDa, dateA);
  const { page, setPage, pageSize } = useServerPagination(25, [
    dateDa,
    dateA,
    agenziaId,
    clienteId,
    raggruppa,
    sortField,
    sortDirection,
    sedeLockedId,
  ]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-prima-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, nome, codice")
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["prima-nota", dateDa, dateA, sedeLockedId, seeAllSedi],
    enabled: authReady,
    queryFn: () =>
      fetchPrimaNota({
        dataDa: dateDa,
        dataA: dateA,
        ufficioId: sedeLockedId,
      }),
  });

  const scopedRows = useMemo(
    () => applySedeFilter(allRows, sedeLockedId),
    [allRows, sedeLockedId],
  );

  const clienteOpts = useMemo(() => uniquePrimaNotaOptions(scopedRows, "cliente"), [scopedRows]);
  const agenziaOptsFromRows = useMemo(() => uniquePrimaNotaOptions(scopedRows, "agenzia"), [scopedRows]);
  const agenziaOpts = useMemo(() => {
    if (agenziaOptsFromRows.length > 0) return agenziaOptsFromRows;
    return compagnie.map((c) => ({
      value: c.id,
      label: c.nome,
      searchText: `${c.nome} ${c.codice || ""}`,
    }));
  }, [agenziaOptsFromRows, compagnie]);

  const filteredRows = useMemo(
    () => filterPrimaNotaRows(scopedRows, { clienteId, agenziaId }),
    [scopedRows, clienteId, agenziaId],
  );
  const sortedRows = useMemo(
    () => sortPrimaNotaRows(filteredRows, sortField, sortDirection),
    [filteredRows, sortField, sortDirection],
  );

  const paged = useMemo(
    () => (raggruppa === "nessuno" && !seeAllSedi ? paginatePrimaNota(sortedRows, page, pageSize) : sortedRows),
    [raggruppa, seeAllSedi, sortedRows, page, pageSize],
  );

  const applyPreset = (preset: Exclude<PresetPeriodoIncasso, "personalizzato">) => {
    const range = rangeForPreset(preset);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const applyCustomRange = (nextDa: string, nextA: string) => {
    const range = normalizeDateRange(nextDa || dateDa, nextA || dateA);
    setDateDa(range.da);
    setDateA(range.a);
  };

  const resetFilters = () => {
    applyPreset("oggi");
    setAgenziaId(null);
    setClienteId(null);
    setRaggruppa("nessuno");
    setSortField("dataIncasso");
    setSortDirection("desc");
  };

  const handleSort = (field: PrimaNotaSortField) => {
    const next = nextSort(sortField, sortDirection, field);
    setSortField(next.field as PrimaNotaSortField);
    setSortDirection(next.direction);
  };

  const handleExport = () => {
    const rows = rowsForPrimaNotaExport(sortedRows, seeAllSedi);
    if (rows.length === 0) return;
    exportPrimaNotaXlsx(rows, { dataDa: dateDa, dataA: dateA, includeSede: seeAllSedi });
  };

  const tableProps = {
    sortField,
    sortDirection,
    onSort: handleSort,
  };

  const renderGrouped = (rows: PrimaNotaRow[]) => {
    if (raggruppa === "cliente") {
      return groupPrimaNotaByCliente(rows).map((g) => (
        <section key={g.key} className="space-y-2">
          <GroupHeading label={g.label} count={g.rows.length} total={g.totalPremio} />
          <PrimaNotaTable rows={g.rows} {...tableProps} />
        </section>
      ));
    }
    if (raggruppa === "agenzia") {
      return groupPrimaNotaByAgenzia(rows).map((g) => (
        <section key={g.key} className="space-y-2">
          <GroupHeading label={g.label} count={g.rows.length} total={g.totalPremio} />
          <PrimaNotaTable rows={g.rows} {...tableProps} />
        </section>
      ));
    }
    return groupPrimaNotaByClienteEAgenzia(rows).map((cliente) => (
      <section key={cliente.key} className="space-y-3">
        <GroupHeading label={cliente.label} count={cliente.groups.reduce((n, g) => n + g.rows.length, 0)} total={cliente.totalPremio} />
        <div className="space-y-3 pl-2 border-l">
          {cliente.groups.map((ag) => (
            <div key={ag.key} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{ag.label}</p>
              <PrimaNotaTable rows={ag.rows} {...tableProps} />
            </div>
          ))}
        </div>
      </section>
    ));
  };

  const renderBody = () => {
    if (!authReady) {
      return (
        <div className="text-sm text-muted-foreground py-8 text-center">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Verifica sede…
        </div>
      );
    }
    if (isLoading) return <PrimaNotaTable rows={[]} loading {...tableProps} />;
    if (sortedRows.length === 0) return <PrimaNotaTable rows={[]} {...tableProps} />;

    if (seeAllSedi && raggruppa === "nessuno") {
      return (
        <div className="space-y-6">
          {groupPrimaNotaBySede(sortedRows).map((g) => (
            <section key={g.sedeId} className="space-y-2">
              <GroupHeading label={g.sedeNome} count={g.rows.length} total={g.rows.reduce((s, r) => s + (r.premioIncassato || 0), 0)} />
              <PrimaNotaTable rows={g.rows} {...tableProps} />
            </section>
          ))}
        </div>
      );
    }

    if (raggruppa !== "nessuno") {
      if (seeAllSedi) {
        return (
          <div className="space-y-8">
            {groupPrimaNotaBySede(sortedRows).map((sede) => (
              <section key={sede.sedeId} className="space-y-4">
                <h2 className="text-base font-semibold">{sede.sedeNome}</h2>
                <div className="space-y-4">{renderGrouped(sede.rows)}</div>
              </section>
            ))}
          </div>
        );
      }
      return <div className="space-y-4">{renderGrouped(sortedRows)}</div>;
    }

    return (
      <>
        <PrimaNotaTable rows={paged} {...tableProps} />
        <ServerPagination
          page={page}
          pageSize={pageSize}
          totalCount={sortedRows.length}
          onPageChange={setPage}
        />
      </>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Prima nota
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Polizze incassate nel periodo. Default: oggi
              {seeAllSedi ? " — tutte le sedi, raggruppate." : " — solo la tua sede."}
            </p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={sortedRows.length === 0 || isLoading}>
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Esporta Excel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Periodo di incasso</p>
              <ToggleGroup
                type="single"
                value={presetPeriodo === "personalizzato" ? "" : presetPeriodo}
                onValueChange={(v) => {
                  if (v === "oggi" || v === "mese_corrente") applyPreset(v);
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="oggi" className="h-9 px-3 text-xs">
                  Oggi
                </ToggleGroupItem>
                <ToggleGroupItem value="mese_corrente" className="h-9 px-3 text-xs">
                  Mese corrente
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dal</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateDa}
                onChange={(e) => applyCustomRange(e.target.value, dateA)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Al</p>
              <Input
                type="date"
                className="h-9 w-[160px]"
                value={dateA}
                onChange={(e) => applyCustomRange(dateDa, e.target.value)}
              />
            </div>
            <FilterSearchableSelect
              value={clienteId}
              onValueChange={setClienteId}
              options={clienteOpts}
              placeholder="Cliente"
              allLabel="Tutti i clienti"
              className="w-[260px] h-9"
            />
            <FilterSearchableSelect
              value={agenziaId}
              onValueChange={setAgenziaId}
              options={agenziaOpts}
              placeholder="Agenzia"
              allLabel="Tutte le agenzie"
              className="w-[260px] h-9"
            />
            <FilterSearchableSelect
              value={raggruppa === "nessuno" ? null : raggruppa}
              onValueChange={(v) => setRaggruppa((v as RaggruppaPrimaNota) || "nessuno")}
              options={[
                { value: "cliente", label: "Cliente" },
                { value: "agenzia", label: "Agenzia" },
                { value: "cliente_agenzia", label: "Cliente e agenzia" },
              ]}
              placeholder="Raggruppa"
              allLabel="Nessun raggruppamento"
              className="w-[220px] h-9"
            />
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset (oggi)
            </Button>
          </div>
        </CardContent>
      </Card>

      {renderBody()}
    </div>
  );
};

export default PrimaNotaPage;
