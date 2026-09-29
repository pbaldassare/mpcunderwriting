import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Users, FileText, TrendingUp, Wallet, FileSpreadsheet, Search, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { useProduttoriLookup } from "@/hooks/useProduttoriLookup";
import { format, parseISO, isValid } from "date-fns";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";
import { buildEstrazionePdf, downloadEstrazionePdf } from "@/lib/estrazioni/exportPdf";
import { aggregatePivot } from "@/lib/estrazioni/pivot";
import { periodoLabel } from "@/lib/estrazioni/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TacitoFiltro = "tutti" | "si" | "no";

interface ClientePortafoglio {
  cliente_id: string;
  label: string;
  tipo_cliente: string;
  num_polizze: number;
  totale_premi: number;
  totale_incassato: number;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

const PortafoglioPerClientePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateDa, setDateDa] = useState("");
  const [dateA, setDateA] = useState("");
  const [ufficioId, setUfficioId] = useState<string | null>(null);
  const [produttoreId, setProduttoreId] = useState<string | null>(null);
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [tacito, setTacito] = useState<TacitoFiltro>("tutti");
  const [exportingPdf, setExportingPdf] = useState(false);

  const dateFrom = parseDateInput(dateDa);
  const dateTo = parseDateInput(dateA);
  const periodo = periodoLabel(dateFrom, dateTo);

  const hasActiveFilters =
    !!search.trim() ||
    !!dateDa ||
    !!dateA ||
    !!ufficioId ||
    !!produttoreId ||
    !!agenziaId ||
    tacito !== "tutti";

  const resetFilters = () => {
    setSearch("");
    setDateDa("");
    setDateA("");
    setUfficioId(null);
    setProduttoreId(null);
    setAgenziaId(null);
    setTacito("tutti");
  };

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-filter-portafoglio-cliente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
  });

  const { data: produttori = [] } = useProduttoriLookup();

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie-attive-portafoglio-cliente"],
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

  const ufficioOpts = useMemo(
    () => uffici.map((u) => ({ value: u.id, label: u.nome_ufficio })),
    [uffici],
  );

  const produttoreOpts = useMemo(
    () => produttori.map((p) => ({ value: p.value, label: p.label })),
    [produttori],
  );

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

  const { data, isLoading } = useQuery({
    queryKey: [
      "portafoglio-per-cliente",
      search,
      dateDa,
      dateA,
      ufficioId,
      produttoreId,
      agenziaId,
      tacito,
    ],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select(
          "premio_lordo, importo_incassato, stato, cliente_anagrafica_id, ufficio_id, anagrafica_commerciale_id, compagnia_id, numero_titolo, tacito_rinnovo, data_incasso, clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale, tipo_cliente)",
        )
        .not("cliente_anagrafica_id", "is", null)
        .is("sostituisce_polizza", null);

      if (dateDa) query = query.gte("data_incasso", dateDa);
      if (dateA) query = query.lte("data_incasso", dateA);
      if (ufficioId) query = query.eq("ufficio_id", ufficioId);
      if (produttoreId) query = query.eq("anagrafica_commerciale_id", produttoreId);
      if (agenziaId) query = query.eq("compagnia_id", agenziaId);
      if (tacito === "si") query = query.eq("tacito_rinnovo", true);
      if (tacito === "no") query = query.eq("tacito_rinnovo", false);

      const searchTrim = search.trim();
      if (searchTrim) {
        const { data: clientiMatch, error: cliErr } = await supabase
          .from("clienti")
          .select("id")
          .or(
            `ragione_sociale.ilike.%${searchTrim}%,cognome.ilike.%${searchTrim}%,nome.ilike.%${searchTrim}%`,
          )
          .limit(500);
        if (cliErr) throw cliErr;
        const clienteIds = (clientiMatch || []).map((c) => c.id);
        if (clienteIds.length > 0) {
          query = query.or(
            `numero_titolo.ilike.%${searchTrim}%,cliente_anagrafica_id.in.(${clienteIds.join(",")})`,
          );
        } else {
          query = query.ilike("numero_titolo", `%${searchTrim}%`);
        }
      }

      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, ClientePortafoglio> = {};
      for (const t of titoli || []) {
        const cli = t.clienti as {
          id: string;
          nome: string | null;
          cognome: string | null;
          ragione_sociale: string | null;
          tipo_cliente: string | null;
        } | null;
        if (!cli) continue;
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            label: cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim(),
            tipo_cliente: cli.tipo_cliente || "",
            num_polizze: 0,
            totale_premi: 0,
            totale_incassato: 0,
          };
        }
        grouped[key].num_polizze++;
        grouped[key].totale_premi += Number(t.premio_lordo) || 0;
        grouped[key].totale_incassato += Number(t.importo_incassato) || 0;
      }
      return Object.values(grouped).sort((a, b) => b.totale_premi - a.totale_premi);
    },
  });

  const rows = data || [];
  const totPremi = rows.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = rows.reduce((s, c) => s + c.totale_incassato, 0);
  const totPolizze = rows.reduce((s, c) => s + c.num_polizze, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const pivotTipo = useMemo(
    () =>
      aggregatePivot(
        rows,
        (c) => (c.tipo_cliente === "azienda" ? "Azienda" : "Privato"),
        (c) => ({ premio: c.totale_premi, incassato: c.totale_incassato }),
      ),
    [rows],
  );

  const commentary = useMemo(() => {
    if (!rows.length) return `Nessun dato nel periodo ${periodo}.`;
    const top = rows[0];
    return [
      `Portafoglio per cliente — periodo ${periodo}.`,
      `${rows.length} clienti, ${totPolizze} polizze, ${fmt(totPremi)} di premi.`,
      top ? `Cliente principale: ${top.label} (${fmt(top.totale_premi)}).` : "",
    ].join("\n");
  }, [rows, periodo, totPolizze, totPremi]);

  const exportExcel = () => {
    exportEstrazioneWorkbook({
      title: "Portafoglio per Cliente — Consulnet",
      subtitle: `Periodo: ${periodo}`,
      metaRows: [
        [],
        ["N. clienti", rows.length],
        ["N. polizze", totPolizze],
        ["Totale premi (€)", Number(totPremi.toFixed(2))],
        ["Totale incassato (€)", Number(totIncassato.toFixed(2))],
      ],
      commentary,
      dettaglio: {
        name: "Riepilogo Clienti",
        rows: rows.map((c) => ({
          Cliente: c.label,
          Tipo: c.tipo_cliente === "azienda" ? "Azienda" : "Privato",
          "N. Polizze": c.num_polizze,
          "Totale Premi (€)": Number(c.totale_premi.toFixed(2)),
          "Totale Incassato (€)": Number(c.totale_incassato.toFixed(2)),
        })),
      },
      pivots: [{ dimensione: "Tipo Cliente", rows: pivotTipo }],
      fileName: `portafoglio_per_cliente_${format(new Date(), "yyyyMMdd")}.xlsx`,
    });
    toast.success("Excel generato");
  };

  const exportPdf = async () => {
    try {
      setExportingPdf(true);
      const bytes = await buildEstrazionePdf({
        title: "Portafoglio per Cliente",
        subtitle: `Periodo: ${periodo}`,
        kpis: [
          { label: "Clienti", value: String(rows.length) },
          { label: "Polizze", value: String(totPolizze) },
          { label: "Premi", value: fmt(totPremi) },
          { label: "Incassato", value: fmt(totIncassato) },
        ],
        commentary,
        pivotTables: [{ title: "Pivot per Tipo Cliente", rows: pivotTipo }],
      });
      downloadEstrazionePdf(bytes, `portafoglio_per_cliente_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const kpiCards = [
    { label: "N. Clienti", value: rows.length.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "N. Polizze", value: totPolizze.toString(), icon: FileText, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
    { label: "Totale Premi", value: fmt(totPremi), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Incassato", value: fmt(totIncassato), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portafoglio per Cliente</h1>
            <p className="text-sm text-muted-foreground">Cerca cliente → apri analisi polizze, garanzie e report</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={!rows.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-700" /> Esporta Excel
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={!rows.length || exportingPdf}>
            <FileText className="mr-2 h-4 w-4" /> {exportingPdf ? "PDF..." : "Report PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Cerca cliente o n° polizza…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Incasso dal</p>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateDa}
                onChange={(e) => setDateDa(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">al</p>
              <Input
                type="date"
                className="h-9 w-[150px]"
                value={dateA}
                onChange={(e) => setDateA(e.target.value)}
              />
            </div>
            <FilterSearchableSelect
              value={ufficioId}
              onValueChange={setUfficioId}
              options={ufficioOpts}
              placeholder="Sede"
              allLabel="Tutte le sedi"
              className="w-[200px] h-9"
            />
            <FilterSearchableSelect
              value={produttoreId}
              onValueChange={setProduttoreId}
              options={produttoreOpts}
              placeholder="Produttore"
              allLabel="Tutti i produttori"
              className="w-[220px] h-9"
            />
            <FilterSearchableSelect
              value={agenziaId}
              onValueChange={setAgenziaId}
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
                  if (v) setTacito(v as TacitoFiltro);
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
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">N. Polizze</TableHead>
              <TableHead className="text-right">Totale Premi</TableHead>
              <TableHead className="text-right">Totale Incassato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.cliente_id} className="cursor-pointer" onClick={() => navigate(`/portafoglio/estrazioni/per-cliente/${c.cliente_id}`)}>
                <TableCell className="font-medium text-primary hover:underline">{c.label}</TableCell>
                <TableCell>{c.tipo_cliente === "azienda" ? "Azienda" : "Privato"}</TableCell>
                <TableCell className="text-right">{c.num_polizze}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{totPolizze}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totPremi)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totIncassato)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default PortafoglioPerClientePage;
