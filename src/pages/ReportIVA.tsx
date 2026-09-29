import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Receipt, Calculator, Euro } from "lucide-react";
import { format } from "date-fns";

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

const ReportIVA = () => {
  const { profile, isAdmin } = useAuth();
  const isCfoOrAdmin = isAdmin || profile?.ruolo === "cfo" || profile?.ruolo === "contabilita";

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedUfficio, setSelectedUfficio] = useState<string>("all");

  const periodo = `${selectedYear}-${selectedMonth}`;

  // Fetch uffici for filter
  const { data: uffici } = useQuery({
    queryKey: ["uffici-iva"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  // Fetch movimenti con IVA per il periodo
  const { data: movimenti, isLoading } = useQuery({
    queryKey: ["movimenti-iva", periodo, selectedUfficio],
    queryFn: async () => {
      let q = supabase
        .from("movimenti_contabili")
        .select("*")
        .not("iva_importo", "is", null)
        .gte("data_movimento", `${selectedYear}-${selectedMonth}-01`)
        .lt("data_movimento", selectedMonth === "12"
          ? `${Number(selectedYear) + 1}-01-01`
          : `${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, "0")}-01`
        )
        .order("data_movimento", { ascending: false });

      if (selectedUfficio !== "all") {
        q = q.eq("ufficio_id", selectedUfficio);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch registri IVA salvati
  const { data: registri } = useQuery({
    queryKey: ["iva-registri", periodo, selectedUfficio],
    queryFn: async () => {
      let q = supabase.from("iva_registri").select("*").eq("periodo", periodo);
      if (selectedUfficio !== "all") q = q.eq("ufficio_id", selectedUfficio);
      const { data } = await q;
      return data || [];
    },
  });

  // KPI calcolati dai movimenti
  const kpi = useMemo(() => {
    if (!movimenti) return { imponibile: 0, iva: 0, totale: 0 };
    const imponibile = movimenti.reduce((s, m) => s + Number(m.iva_imponibile || 0), 0);
    const iva = movimenti.reduce((s, m) => s + Number(m.iva_importo || 0), 0);
    return { imponibile, iva, totale: imponibile + iva };
  }, [movimenti]);

  const handleExportCSV = () => {
    if (!movimenti?.length) return;

    logAttivita({ azione: "generazione_report_iva", entita_tipo: "iva", entita_id: periodo, dettagli_json: { periodo, ufficio: selectedUfficio } });

    const headers = ["Data", "Descrizione", "Tipo", "Importo", "Aliquota IVA %", "Imponibile", "IVA", "Categoria"];
    const rows = movimenti.map((m) => [
      m.data_movimento,
      m.descrizione || "",
      m.tipo,
      m.importo,
      m.iva_aliquota || "",
      m.iva_imponibile || "",
      m.iva_importo || "",
      m.categoria || "",
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_iva_${periodo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report IVA</h1>
          <p className="text-sm text-muted-foreground">Riepilogo IVA per periodo e ufficio</p>
        </div>
        <Button onClick={handleExportCSV} disabled={!movimenti?.length} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Esporta CSV
        </Button>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESI.map((m, i) => (
              <SelectItem key={i} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isCfoOrAdmin && (
          <Select value={selectedUfficio} onValueChange={setSelectedUfficio}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tutte le sedi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le sedi</SelectItem>
              {uffici?.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totale Imponibile</CardTitle>
            <Calculator className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">€ {kpi.imponibile.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totale IVA</CardTitle>
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">€ {kpi.iva.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Totale</CardTitle>
            <Euro className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">€ {kpi.totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella movimenti con IVA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimenti con IVA — {MESI[Number(selectedMonth) - 1]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Caricamento…</p>
          ) : !movimenti?.length ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nessun movimento con IVA per questo periodo</p>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="text-right">Aliquota</TableHead>
                    <TableHead className="text-right">Imponibile</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimenti.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(m.data_movimento), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.descrizione || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.tipo === "entrata" ? "default" : "destructive"} className="text-xs">
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">€ {Number(m.importo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{m.iva_aliquota ? `${m.iva_aliquota}%` : "—"}</TableCell>
                      <TableCell className="text-right">€ {Number(m.iva_imponibile || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">€ {Number(m.iva_importo || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{m.categoria || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportIVA;
