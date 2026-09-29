import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Download, FileSpreadsheet, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { TITOLI_DA_INCASSARE_COLUMNS } from "@/lib/titoliDaIncassare/columns";
import { fetchTitoliDaIncassare, meseCompetenzaLabel } from "@/lib/titoliDaIncassare/fetch";
import { exportTitoliDaIncassareXlsx } from "@/lib/titoliDaIncassare/exportXlsx";
import { buildTitoliDaIncassarePdf, downloadTitoliDaIncassarePdf } from "@/lib/titoliDaIncassare/exportPdf";
import { buildPivotCommentary, totaliPivot } from "@/lib/titoliDaIncassare/pivot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PREVIEW_COLS = ["cliente", "compagnia", "polizza", "competenza", "premio", "garantito"] as const;

const TitoliDaIncassarePage = () => {
  const navigate = useNavigate();
  const [mese, setMese] = useState(() => startOfMonth(new Date(2026, 5, 1)));
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [exportingPdf, setExportingPdf] = useState(false);

  const meseLabel = meseCompetenzaLabel(mese);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["titoli-da-incassare", mese, filters, search],
    queryFn: () =>
      fetchTitoliDaIncassare({
        mese,
        ufficioId: filters.ufficio_id,
        produttoreId: filters.produttore_id,
        compagniaId: filters.compagnia_id,
        search,
      }),
  });

  const tot = useMemo(() => totaliPivot(rows), [rows]);
  const commentary = useMemo(() => buildPivotCommentary(rows, meseLabel), [rows, meseLabel]);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const filtriExport: Record<string, string> = {
    Competenza: meseLabel,
    Sede: filters.ufficio_id || "Tutte",
    Produttore: filters.produttore_id || "Tutti",
    Compagnia: filters.compagnia_id || "Tutte",
    Ricerca: search || "—",
  };

  const handleExportXlsx = () => {
    if (!rows.length) return;
    exportTitoliDaIncassareXlsx(rows, { meseLabel, filtri: filtriExport });
    toast.success("Excel generato");
  };

  const handleExportPdf = async () => {
    if (!rows.length) return;
    try {
      setExportingPdf(true);
      const bytes = await buildTitoliDaIncassarePdf(rows, meseLabel);
      downloadTitoliDaIncassarePdf(bytes, meseLabel);
      toast.success("PDF generato");
    } catch (e: any) {
      toast.error(e?.message || "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const colHeader = (key: typeof PREVIEW_COLS[number]) =>
    TITOLI_DA_INCASSARE_COLUMNS.find((c) => c.key === key)?.header || key;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Titoli da incassare</h1>
            <p className="text-sm text-muted-foreground">
              Estrazione per mese di competenza — export Excel con pivot e report PDF
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportXlsx} disabled={!rows.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-700" /> Esporta Excel
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={!rows.length || exportingPdf}>
            <FileText className="mr-2 h-4 w-4" /> {exportingPdf ? "PDF..." : "Report PDF"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Mese competenza</p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarDays className="mr-2 h-4 w-4" />
                {format(mese, "MMMM yyyy", { locale: it })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={mese}
                onSelect={(d) => d && setMese(startOfMonth(d))}
                locale={it}
                captionLayout="dropdown-buttons"
                fromYear={2020}
                toYear={2030}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-muted-foreground mb-1">Ricerca</p>
          <Input
            placeholder="Polizza, cliente, compagnia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={() => refetch()}>Aggiorna</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "N. Titoli", value: isLoading ? "..." : String(tot.nTitoli) },
          { label: "Totale Premi", value: isLoading ? "..." : fmt(tot.totPremio) },
          { label: "Provv. Attive", value: isLoading ? "..." : fmt(tot.totProvvAttive) },
          { label: "Garantiti", value: isLoading ? "..." : String(tot.nGarantiti) },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showProduttore showCompagnia />

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Analisi</p>
          <p className="text-sm whitespace-pre-line text-foreground/90">{commentary}</p>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {PREVIEW_COLS.map((k) => (
                <TableHead key={k} className={k === "premio" ? "text-right" : ""}>{colHeader(k)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun titolo per competenza {meseLabel}</TableCell></TableRow>
            ) : rows.slice(0, 100).map((r, i) => (
              <TableRow key={`${r.polizza}-${i}`}>
                {PREVIEW_COLS.map((k) => (
                  <TableCell key={k} className={cn(k === "premio" && "text-right font-mono", k === "cliente" && "font-medium")}>
                    {k === "premio" ? fmt(Number(r.premio)) : String(r[k] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-muted-foreground">
                  {rows.length > 100 ? `Anteprima 100 di ${rows.length} — export completo in Excel` : `${rows.length} righe`}
                </TableCell>
                <TableCell className="text-right font-bold">{fmt(tot.totPremio)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default TitoliDaIncassarePage;
