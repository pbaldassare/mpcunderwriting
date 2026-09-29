import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ArrowLeft, Mail, Archive, Search, RotateCcw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { RichiestaQuietanzaEmailDialog } from "@/components/estrazioni/RichiestaQuietanzaEmailDialog";
import type { RichiestaQuietanzaRiga } from "@/lib/richiestaQuietanza";
import { toast } from "sonner";

const SELECT_FIELDS =
  "id, numero_titolo, compagnia_id, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, tacito_rinnovo, sostituisce_polizza";

type TacitoFiltro = "tutti" | "si" | "no";

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

const fmtEuro = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const RichiestaQuietanzaPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateDa, setDateDa] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateA, setDateA] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [tacito, setTacito] = useState<TacitoFiltro>("tutti");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailOpen, setEmailOpen] = useState(false);
  const [selectedCache, setSelectedCache] = useState<Map<string, RichiestaQuietanzaRiga>>(new Map());

  const { page, setPage, pageSize, range } = useServerPagination(25, [search, dateDa, dateA, agenziaId, tacito]);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-richiesta-quietanza"],
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

  const agenziaOpts = useMemo(
    () =>
      compagnie.map((c) => ({
        value: c.id,
        label: c.nome,
        description: c.codice || undefined,
        searchText: `${c.nome} ${c.codice || ""}`,
      })),
    [compagnie],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["richiesta-quietanza", page, search, dateDa, dateA, agenziaId, tacito],
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_titoli")
        .select(SELECT_FIELDS, { count: "exact" })
        .in("stato", ["attivo", "sospeso"])
        .is("sostituisce_polizza", null);

      if (dateDa) q = q.gte("garanzia_a", dateDa);
      if (dateA) q = q.lte("garanzia_a", dateA);
      if (agenziaId) q = q.eq("compagnia_id", agenziaId);
      if (tacito === "si") q = q.eq("tacito_rinnovo", true);
      if (tacito === "no") q = q.eq("tacito_rinnovo", false);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(
          `numero_titolo.ilike.%${s}%,cliente_nome_display.ilike.%${s}%,cliente_codice.ilike.%${s}%,compagnia_nome.ilike.%${s}%`,
        );
      }

      const { data: rows, error: qErr, count } = await q
        .order("garanzia_a", { ascending: true, nullsFirst: false })
        .order("numero_titolo", { ascending: true })
        .range(range.from, range.to);
      if (qErr) throw qErr;
      return { rows: (rows || []) as RichiestaQuietanzaRiga[], count: count || 0 };
    },
  });

  const rows = data?.rows || [];
  const totalCount = data?.count || 0;
  const syncSelection = (ids: Set<string>, pageRows: RichiestaQuietanzaRiga[]) => {
    setSelectedIds(ids);
    setSelectedCache((prev) => {
      const next = new Map(prev);
      for (const id of [...next.keys()]) {
        if (!ids.has(id)) next.delete(id);
      }
      for (const r of pageRows) {
        if (ids.has(r.id)) next.set(r.id, r);
      }
      return next;
    });
  };

  const allSelectedOnPage = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelectedOnPage = rows.some((r) => selectedIds.has(r.id));

  const toggleAllPage = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) rows.forEach((r) => next.add(r.id));
    else rows.forEach((r) => next.delete(r.id));
    syncSelection(next, rows);
  };

  const toggleOne = (row: RichiestaQuietanzaRiga, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(row.id);
    else next.delete(row.id);
    syncSelection(next, rows);
  };

  const resetFilters = () => {
    setSearch("");
    setDateDa(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    setDateA(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    setAgenziaId(null);
    setTacito("tutti");
    syncSelection(new Set(), []);
  };

  const openEmail = () => {
    const picked = [...selectedCache.values()];
    if (!picked.length) {
      toast.error("Seleziona almeno una polizza");
      return;
    }
    const compagniaIds = [...new Set(picked.map((r) => r.compagnia_id).filter(Boolean))];
    if (compagniaIds.length > 1) {
      toast.error("Le polizze selezionate devono appartenere alla stessa agenzia");
      return;
    }
    if (!compagniaIds.length) {
      toast.error("Agenzia mancante sulle polizze selezionate");
      return;
    }
    setEmailOpen(true);
  };

  const pickedForEmail = useMemo(() => [...selectedCache.values()], [selectedCache]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Richiesta Quietanza</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Polizze in scadenza — seleziona e invia la richiesta aggregata all&apos;agenzia
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/portafoglio/estrazioni/richiesta-quietanza/registro")}>
            <Archive className="h-4 w-4 mr-1" /> Registro invii
          </Button>
          <Button size="sm" onClick={openEmail} disabled={selectedIds.size === 0}>
            <Mail className="h-4 w-4 mr-1" /> Invia richiesta ({selectedIds.size})
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Cerca polizza, cliente, agenzia…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Scadenza dal</p>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateDa}
                onChange={(e) => {
                  setDateDa(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">al</p>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateA}
                onChange={(e) => {
                  setDateA(e.target.value);
                }}
              />
            </div>
            <FilterSearchableSelect
              value={agenziaId}
              onValueChange={(v) => {
                setAgenziaId(v);
              }}
              options={agenziaOpts}
              placeholder="Agenzia"
              allLabel="Tutte le agenzie"
              className="w-[240px] h-9"
            />
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tacito rinnovo</p>
              <ToggleGroup
                type="single"
                value={tacito}
                onValueChange={(v) => {
                  if (v) {
                    setTacito(v as TacitoFiltro);
                  }
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="tutti" className="h-9 px-3 text-xs">
                  Tutti
                </ToggleGroupItem>
                <ToggleGroupItem value="si" className="h-9 px-3 text-xs">
                  Sì
                </ToggleGroupItem>
                <ToggleGroupItem value="no" className="h-9 px-3 text-xs">
                  No
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelectedOnPage ? true : someSelectedOnPage ? "indeterminate" : false}
                  onCheckedChange={(c) => toggleAllPage(c === true)}
                  aria-label="Seleziona pagina"
                />
              </TableHead>
              <TableHead className="text-xs">Polizza</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Agenzia</TableHead>
              <TableHead className="text-xs">Ramo</TableHead>
              <TableHead className="text-xs text-right">Premio</TableHead>
              <TableHead className="text-xs">Scadenza</TableHead>
              <TableHead className="text-xs">Tacito</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-destructive text-sm">
                  Errore caricamento: {error instanceof Error ? error.message : "query fallita"}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                  Nessuna polizza in scadenza con i filtri selezionati
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/titoli/${r.id}`)}
                >
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={(c) => toggleOne(r, c === true)}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.numero_titolo || "—"}</TableCell>
                  <TableCell className="text-xs">{r.cliente_nome_display || "—"}</TableCell>
                  <TableCell className="text-xs">{r.compagnia_nome || "—"}</TableCell>
                  <TableCell className="text-xs">{r.ramo_nome || "—"}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmtEuro(r.premio_lordo)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.garanzia_a || r.data_scadenza)}</TableCell>
                  <TableCell className="text-xs">
                    {r.tacito_rinnovo == null ? (
                      "—"
                    ) : (
                      <Badge variant={r.tacito_rinnovo ? "default" : "secondary"}>
                        {r.tacito_rinnovo ? "Sì" : "No"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />

      <RichiestaQuietanzaEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        righe={pickedForEmail}
        onSent={() => {
          syncSelection(new Set(), []);
          void refetch();
        }}
      />
    </div>
  );
};

export default RichiestaQuietanzaPage;
