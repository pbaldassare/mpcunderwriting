import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ArrowLeft, Building2, FileText, TrendingUp, Wallet, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";
import { buildEstrazionePdf, downloadEstrazionePdf } from "@/lib/estrazioni/exportPdf";
import { aggregatePivot } from "@/lib/estrazioni/pivot";
import { periodoLabel } from "@/lib/estrazioni/utils";
import { toast } from "sonner";

interface CompagniaPortafoglio {
  compagnia: string;
  num_polizze: number;
  totale_premi: number;
  totale_incassato: number;
}

const PortafoglioPerCompagniaPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [exportingPdf, setExportingPdf] = useState(false);
  const periodo = periodoLabel(filters.dateFrom, filters.dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["portafoglio-per-agenzia", filters],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, ufficio_id, produttore_id, prodotti!inner(nome_prodotto, compagnia_id, compagnie!inner(nome))")
        .is("sostituisce_polizza", null);

      if (filters.dateFrom) query = query.gte("data_incasso", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) query = query.lte("data_incasso", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.produttore_id) query = query.eq("produttore_id", filters.produttore_id);

      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, CompagniaPortafoglio> = {};
      for (const t of titoli || []) {
        const comp = t.prodotti?.compagnie?.nome || "Sconosciuta";
        if (!grouped[comp]) {
          grouped[comp] = { compagnia: comp, num_polizze: 0, totale_premi: 0, totale_incassato: 0 };
        }
        grouped[comp].num_polizze++;
        grouped[comp].totale_premi += Number(t.premio_lordo) || 0;
        grouped[comp].totale_incassato += Number(t.importo_incassato) || 0;
      }
      return Object.values(grouped).sort((a, b) => b.totale_premi - a.totale_premi);
    },
  });

  const rows = data || [];
  const totPremi = rows.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = rows.reduce((s, c) => s + c.totale_incassato, 0);
  const totPolizze = rows.reduce((s, c) => s + c.num_polizze, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const pivotCompagnia = useMemo(
    () =>
      aggregatePivot(
        rows,
        (c) => c.compagnia,
        (c) => ({ premio: c.totale_premi, incassato: c.totale_incassato }),
      ),
    [rows],
  );

  const commentary = useMemo(() => {
    if (!rows.length) return `Nessun dato nel periodo ${periodo}.`;
    const top = rows[0];
    return [
      `Portafoglio per agenzia — periodo ${periodo}.`,
      `${rows.length} agenzie, ${totPolizze} polizze, ${fmt(totPremi)} di premi.`,
      top ? `Agenzia principale: ${top.compagnia} (${fmt(top.totale_premi)}).` : "",
    ].join("\n");
  }, [rows, periodo, totPolizze, totPremi, fmt]);

  const exportExcel = () => {
    exportEstrazioneWorkbook({
      title: "Portafoglio per Agenzia — Consulnet",
      subtitle: `Periodo: ${periodo}`,
      metaRows: [
        [],
        ["N. agenzie", rows.length],
        ["N. polizze", totPolizze],
        ["Totale premi (€)", Number(totPremi.toFixed(2))],
        ["Totale incassato (€)", Number(totIncassato.toFixed(2))],
      ],
      commentary,
      dettaglio: {
        name: "Riepilogo Agenzie",
        rows: rows.map((c) => ({
          Agenzia: c.compagnia,
          "N. Polizze": c.num_polizze,
          "Totale Premi (€)": Number(c.totale_premi.toFixed(2)),
          "Totale Incassato (€)": Number(c.totale_incassato.toFixed(2)),
        })),
      },
      pivots: [{ dimensione: "Compagnia", rows: pivotCompagnia }],
      fileName: `portafoglio_per_agenzia_${format(new Date(), "yyyyMMdd")}.xlsx`,
    });
    toast.success("Excel generato");
  };

  const exportPdf = async () => {
    try {
      setExportingPdf(true);
      const bytes = await buildEstrazionePdf({
        title: "Portafoglio per Agenzia",
        subtitle: `Periodo: ${periodo}`,
        kpis: [
          { label: "Agenzie", value: String(rows.length) },
          { label: "Polizze", value: String(totPolizze) },
          { label: "Premi", value: fmt(totPremi) },
          { label: "Incassato", value: fmt(totIncassato) },
        ],
        commentary,
        pivotTables: [{ title: "Pivot per Compagnia", rows: pivotCompagnia }],
      });
      downloadEstrazionePdf(bytes, `portafoglio_per_agenzia_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const kpiCards = [
    { label: "N. Agenzie", value: rows.length.toString(), icon: Building2, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
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
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portafoglio per Agenzia</h1>
            <p className="text-sm text-muted-foreground">Estrazione portafoglio raggruppato per agenzia — Excel pivot e PDF</p>
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

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showProduttore />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agenzia</TableHead>
              <TableHead className="text-right">N. Polizze</TableHead>
              <TableHead className="text-right">Totale Premi</TableHead>
              <TableHead className="text-right">Totale Incassato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((c) => (
              <TableRow key={c.compagnia}>
                <TableCell className="font-medium">{c.compagnia}</TableCell>
                <TableCell className="text-right">{c.num_polizze}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Totale</TableCell>
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default PortafoglioPerCompagniaPage;
