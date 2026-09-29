import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ArrowLeft, FileSpreadsheet, Users, TrendingUp, Wallet, Scale, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import EstrazioniFilters, { EstrazioniFiltersState, defaultFilters } from "@/components/estrazioni/EstrazioniFilters";
import { format } from "date-fns";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";
import { buildEstrazionePdf, downloadEstrazionePdf } from "@/lib/estrazioni/exportPdf";
import { aggregatePivot } from "@/lib/estrazioni/pivot";
import { periodoLabel } from "@/lib/estrazioni/utils";
import { toast } from "sonner";

interface ECCliente {
  cliente_id: string;
  label: string;
  totale_premi: number;
  totale_incassato: number;
  saldo: number;
}

const ECClientiPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EstrazioniFiltersState>({ ...defaultFilters });
  const [exportingPdf, setExportingPdf] = useState(false);
  const periodo = periodoLabel(filters.dateFrom, filters.dateTo);

  const { data, isLoading } = useQuery({
    queryKey: ["ec-clienti", filters],
    queryFn: async () => {
      let query = supabase
        .from("titoli")
        .select("premio_lordo, importo_incassato, ufficio_id, data_incasso, cliente_anagrafica_id, clienti!titoli_cliente_anagrafica_id_fkey(id, cognome, nome, ragione_sociale)")
        .not("cliente_anagrafica_id", "is", null)
        // Dare E/C: solo quietanze (rate), non la polizza madre (evita doppio conteggio)
        .not("sostituisce_polizza", "is", null);

      if (filters.dateFrom) query = query.gte("data_incasso", format(filters.dateFrom, "yyyy-MM-dd"));
      if (filters.dateTo) query = query.lte("data_incasso", format(filters.dateTo, "yyyy-MM-dd"));
      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.cliente_id) query = query.eq("cliente_anagrafica_id", filters.cliente_id);

      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, ECCliente> = {};
      for (const t of titoli || []) {
        const cli = t.clienti as any;
        if (!cli) continue;
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            label: cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim(),
            totale_premi: 0,
            totale_incassato: 0,
            saldo: 0,
          };
        }
        grouped[key].totale_premi += Number(t.premio_lordo) || 0;
        grouped[key].totale_incassato += Number(t.importo_incassato) || 0;
      }
      for (const g of Object.values(grouped)) {
        g.saldo = g.totale_premi - g.totale_incassato;
      }
      return Object.values(grouped).sort((a, b) => b.saldo - a.saldo);
    },
  });

  const rows = data || [];
  const totPremi = rows.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = rows.reduce((s, c) => s + c.totale_incassato, 0);
  const totSaldo = rows.reduce((s, c) => s + c.saldo, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const pivotClienti = useMemo(
    () =>
      aggregatePivot(
        rows,
        (c) => c.label,
        (c) => ({ premio: c.totale_premi, incassato: c.totale_incassato }),
      ),
    [rows],
  );

  const commentary = useMemo(() => {
    if (!rows.length) return `Nessun dato nel periodo ${periodo}.`;
    const conSaldo = rows.filter((c) => c.saldo > 0).length;
    return [
      `Estratto conto clienti — periodo ${periodo}.`,
      `${rows.length} clienti: Dare ${fmt(totPremi)}, Avere ${fmt(totIncassato)}, Saldo ${fmt(totSaldo)}.`,
      `${conSaldo} clienti con saldo da incassare.`,
    ].join("\n");
  }, [rows, periodo, totPremi, totIncassato, totSaldo, fmt]);

  const exportExcel = () => {
    exportEstrazioneWorkbook({
      title: "E/C Clienti — Consulnet",
      subtitle: `Periodo: ${periodo}`,
      metaRows: [
        [],
        ["N. clienti", rows.length],
        ["Totale Dare (€)", Number(totPremi.toFixed(2))],
        ["Totale Avere (€)", Number(totIncassato.toFixed(2))],
        ["Saldo complessivo (€)", Number(totSaldo.toFixed(2))],
      ],
      commentary,
      dettaglio: {
        name: "Estratto Conto",
        rows: rows.map((c) => ({
          Cliente: c.label,
          "Totale Premi Dare (€)": Number(c.totale_premi.toFixed(2)),
          "Totale Incassato Avere (€)": Number(c.totale_incassato.toFixed(2)),
          "Saldo (€)": Number(c.saldo.toFixed(2)),
        })),
      },
      pivots: [{ dimensione: "Cliente", rows: pivotClienti }],
      fileName: `ec_clienti_${format(new Date(), "yyyyMMdd")}.xlsx`,
    });
    toast.success("Excel generato");
  };

  const exportPdfReport = async () => {
    try {
      setExportingPdf(true);
      const bytes = await buildEstrazionePdf({
        title: "Estratto Conto Clienti",
        subtitle: `Periodo: ${periodo}`,
        kpis: [
          { label: "Clienti", value: String(rows.length) },
          { label: "Dare", value: fmt(totPremi) },
          { label: "Avere", value: fmt(totIncassato) },
          { label: "Saldo", value: fmt(totSaldo) },
        ],
        commentary,
        pivotTables: [{ title: "Pivot per Cliente (top 12)", rows: pivotClienti }],
      });
      downloadEstrazionePdf(bytes, `report_ec_clienti_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore generazione PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const kpiCards = [
    { label: "N. Clienti", value: rows.length.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Dare", value: fmt(totPremi), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Avere", value: fmt(totIncassato), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Saldo Complessivo", value: fmt(totSaldo), icon: Scale, color: totSaldo > 0 ? "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" : "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Clienti</h1>
            <p className="text-sm text-muted-foreground">Estratto conto clienti — Dare / Avere / Saldo con Excel pivot e report PDF</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel} disabled={!rows.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-700" /> Esporta Excel
          </Button>
          <Button variant="outline" onClick={exportPdfReport} disabled={!rows.length || exportingPdf}>
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

      <EstrazioniFilters filters={filters} onChange={setFilters} showUfficio showCliente />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Dare (Premi)</TableHead>
              <TableHead className="text-right">Avere (Incassato)</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right w-32">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((c) => {
              const qs = new URLSearchParams({ clienteId: c.cliente_id });
              if (filters.dateFrom) qs.set("periodoDal", format(filters.dateFrom, "yyyy-MM-dd"));
              if (filters.dateTo) qs.set("periodoAl", format(filters.dateTo, "yyyy-MM-dd"));
              return (
                <TableRow key={c.cliente_id}>
                  <TableCell className="font-medium cursor-pointer" onClick={() => navigate(`/archivi/clienti/${c.cliente_id}`)}>{c.label}</TableCell>
                  <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                  <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={c.saldo > 0 ? "destructive" : "default"}>{fmt(c.saldo)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/contabilita/ec-cliente/pdf?${qs.toString()}`); }}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">Totale</TableCell>
                <TableCell className="text-right font-bold">{fmt(totPremi)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totIncassato)}</TableCell>
                <TableCell className="text-right font-bold">{fmt(totSaldo)}</TableCell>
                <TableCell />
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

export default ECClientiPage;
