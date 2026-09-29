import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, DollarSign, FileSpreadsheet, FileText, TrendingUp, Wallet, Percent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { PREMI_PROVVIGIONI_COLUMNS } from "@/lib/premiProvvigioni/columns";
import {
  labelPremiProvvigioniCriterioData,
  periodoConCriterioLabel,
  PREMI_PROVVIGIONI_CRITERIO_DATA,
  type PremiProvvigioniCriterioData,
} from "@/lib/premiProvvigioni/criterioData";
import { fetchPremiProvvigioni, periodoLabel } from "@/lib/premiProvvigioni/fetch";
import { exportPremiProvvigioniXlsx } from "@/lib/premiProvvigioni/exportXlsx";
import { buildPremiProvvigioniPdf, downloadPremiProvvigioniPdf } from "@/lib/premiProvvigioni/exportPdf";
import { buildPremiProvvigioniCommentary, totaliPremiProvvigioni } from "@/lib/premiProvvigioni/pivot";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PREVIEW_COLS = ["nomeCliente", "nomeCompagnia", "polizza", "premio", "attive", "passive", "pagata"] as const;

const PremiProvvigioniPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [criterioData, setCriterioData] = useState<PremiProvvigioniCriterioData>("cassa");
  const [filtroPagata, setFiltroPagata] = useState<string>("tutte");
  const [exportingPdf, setExportingPdf] = useState(false);

  const pagataFilter = filtroPagata === "pagate" ? "pagate" : filtroPagata === "non_pagate" ? "non_pagate" : "tutte";
  const periodo = periodoLabel(filters.dateFrom, filters.dateTo);
  const criterioLabel = labelPremiProvvigioniCriterioData(criterioData);
  const periodoDisplay = periodoConCriterioLabel(periodo, criterioData);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["premi-provvigioni", filters, pagataFilter, criterioData],
    queryFn: () =>
      fetchPremiProvvigioni({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        ufficioId: filters.ufficio_id,
        produttoreId: filters.produttore_id,
        compagniaId: filters.compagnia_id,
        pagata: pagataFilter,
        criterioData,
      }),
  });

  const tot = useMemo(() => totaliPremiProvvigioni(rows), [rows]);
  const commentary = useMemo(
    () => buildPremiProvvigioniCommentary(rows, periodo, criterioLabel),
    [rows, periodo, criterioLabel],
  );
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const filtriExport: Record<string, string> = {
    Periodo: periodoDisplay,
    "Criterio data": criterioLabel,
    Sede: filters.ufficio_id || "Tutte",
    Produttore: filters.produttore_id || "Tutti",
    Compagnia: filters.compagnia_id || "Tutte",
    "Provv. produttore": filtroPagata === "tutte" ? "Tutte" : filtroPagata === "pagate" ? "Solo incassate" : "Solo non incassate",
  };

  const handleExportXlsx = () => {
    if (!rows.length) return;
    exportPremiProvvigioniXlsx(rows, { periodoLabel: periodoDisplay, periodoBase: periodo, filtri: filtriExport, criterioLabel });
    toast.success("Excel generato");
  };

  const handleExportPdf = async () => {
    if (!rows.length) return;
    try {
      setExportingPdf(true);
      const bytes = await buildPremiProvvigioniPdf(rows, periodoDisplay, criterioLabel, periodo);
      downloadPremiProvvigioniPdf(bytes);
      toast.success("PDF generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const colHeader = (key: (typeof PREVIEW_COLS)[number]) =>
    PREMI_PROVVIGIONI_COLUMNS.find((c) => c.key === key)?.header || key;

  const kpiCards = [
    { label: "Totale Premi", value: fmt(tot.totPremio), icon: TrendingUp, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Incassato", value: fmt(tot.totIncassato), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Provv. Passive", value: fmt(tot.totProvvPassive), icon: DollarSign, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Provv. Attive", value: fmt(tot.totProvvAttive), icon: Percent, color: "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Premi e Provvigioni</h1>
            <p className="text-sm text-muted-foreground">
              Titoli incassati con export Excel (36 colonne + pivot) e report PDF
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

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showProduttore showCompagnia />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={criterioData} onValueChange={(v) => setCriterioData(v as PremiProvvigioniCriterioData)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Criterio data" />
          </SelectTrigger>
          <SelectContent>
            {PREMI_PROVVIGIONI_CRITERIO_DATA.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Il periodo sopra si applica a: <span className="font-medium text-foreground">{criterioLabel}</span>
          {" "}(solo titoli già incassati)
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filtroPagata} onValueChange={setFiltroPagata}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Provv. incassate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte</SelectItem>
            <SelectItem value="pagate">Solo incassate</SelectItem>
            <SelectItem value="non_pagate">Solo non incassate</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                <TableHead key={k} className={k === "premio" || k === "attive" || k === "passive" ? "text-right" : ""}>
                  {colHeader(k)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun dato per il periodo selezionato</TableCell></TableRow>
            ) : rows.slice(0, 100).map((r, i) => (
              <TableRow key={`${r.polizza}-${i}`}>
                <TableCell className="font-medium">{r.nomeCliente}</TableCell>
                <TableCell>{r.nomeCompagnia}</TableCell>
                <TableCell className="font-mono text-sm">{r.polizza}</TableCell>
                <TableCell className="text-right">{fmt(Number(r.premio))}</TableCell>
                <TableCell className="text-right">{fmt(Number(r.attive))}</TableCell>
                <TableCell className="text-right">{fmt(Number(r.passive))}</TableCell>
                <TableCell>
                  <Badge variant={r.pagata === "Incassata" ? "default" : "secondary"}>
                    {r.pagata === "Incassata" ? "Incassata" : "Non incassata"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-muted-foreground">
                  {rows.length > 100 ? `Anteprima 100 di ${rows.length} — export completo in Excel` : `${rows.length} righe`}
                </TableCell>
                <TableCell className="text-right font-bold">{fmt(tot.totPremio)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(tot.totProvvAttive)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(tot.totProvvPassive)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default PremiProvvigioniPage;
