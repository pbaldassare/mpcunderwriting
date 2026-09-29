import { useState, useMemo, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, Upload, Search, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ServerPagination from "@/components/ServerPagination";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
const ESITI = [
  { value: "vinta", label: "Vinta", color: "bg-green-100 text-green-800" },
  { value: "persa", label: "Persa", color: "bg-red-100 text-red-800" },
  { value: "non_partecipato", label: "Non partecipato", color: "bg-gray-100 text-gray-700" },
  { value: "annullata", label: "Annullata", color: "bg-orange-100 text-orange-800" },
  { value: "in_corso", label: "In corso", color: "bg-blue-100 text-blue-800" },
  { value: "non_classificato", label: "Non classificato", color: "bg-slate-100 text-slate-700" },
];

const TIPOLOGIE = [
  { value: "manifestazione", label: "Manifestazione" },
  { value: "gara", label: "Gara" },
  { value: "affidamento_diretto", label: "Affidamento diretto" },
  { value: "altro", label: "Altro" },
];

const CATEGORIE_ENTE = [
  { value: "comune", label: "Comune" },
  { value: "provincia", label: "Provincia" },
  { value: "regione", label: "Regione" },
  { value: "azienda_sanitaria", label: "Azienda sanitaria" },
  { value: "universita", label: "Università" },
  { value: "consorzio", label: "Consorzio" },
  { value: "societa_partecipata", label: "Società partecipata" },
  { value: "altro_ente", label: "Altro ente" },
];

const STATI_MANDATO = [
  { value: "attivo", label: "Attivo", color: "bg-green-100 text-green-800" },
  { value: "in_scadenza_12m", label: "In scadenza (12m)", color: "bg-yellow-100 text-yellow-800" },
  { value: "scaduto", label: "Scaduto", color: "bg-gray-100 text-gray-700" },
  { value: "sconosciuto", label: "Sconosciuto", color: "bg-slate-100 text-slate-600" },
];

export default function StoricoGarePage() {
  const { profile } = useAuth();
  const isAdmin = !!profile && profile.ruolo !== "cliente" && profile.ruolo !== "prospect";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroProvincia, setFiltroProvincia] = useState("tutti");
  const [filtroTipologia, setFiltroTipologia] = useState("tutti");
  const [filtroEsito, setFiltroEsito] = useState("tutti");
  const [filtroBroker, setFiltroBroker] = useState("tutti");
  const [filtroCategoria, setFiltroCategoria] = useState("tutti");
  const [filtroStatoMandato, setFiltroStatoMandato] = useState("tutti");
  const [filtroSoloIntermedia, setFiltroSoloIntermedia] = useState(false);
  const [flagCauzione, setFlagCauzione] = useState(false);
  const [flagReferenze, setFlagReferenze] = useState(false);
  const [flagAccesso, setFlagAccesso] = useState(false);
  const [flagOfferta, setFlagOfferta] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Carica valori distinti per dropdown
  const { page, setPage, pageSize, range } = useServerPagination(25, [search, filtroAnno, filtroProvincia, filtroTipologia, filtroEsito, filtroBroker, filtroCategoria, filtroStatoMandato, filtroSoloIntermedia, flagCauzione, flagReferenze, flagAccesso, flagOfferta]);

  const { data: lookupData } = useQuery({
    queryKey: ["storico_gare_lookups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_storico_gare")
        .select("anno_riferimento, provincia, broker_incumbent")
        .limit(5000);
      const anni = [...new Set((data ?? []).map(r => r.anno_riferimento).filter(Boolean))].sort((a, b) => b - a);
      const province = [...new Set((data ?? []).map(r => r.provincia).filter(Boolean))].sort();
      const brokers = [...new Set((data ?? []).map(r => r.broker_incumbent).filter(Boolean))].sort();
      return { anni, province, brokers };
    },
  });

  // KPI
  const { data: kpi } = useQuery({
    queryKey: ["storico_gare_kpi"],
    queryFn: async () => {
      const { count: totale } = await supabase.from("storico_gare").select("id", { count: "exact", head: true });
      const { count: scadenza } = await supabase.from("v_storico_gare").select("id", { count: "exact", head: true }).eq("stato_mandato", "in_scadenza_12m");
      return { totale: totale ?? 0, scadenza: scadenza ?? 0 };
    },
  });

  // Lista paginata
  const filtersKey = [search, filtroAnno, filtroProvincia, filtroTipologia, filtroEsito, filtroBroker, filtroCategoria, filtroStatoMandato, filtroSoloIntermedia, flagCauzione, flagReferenze, flagAccesso, flagOfferta] as const;

  const applyFilters = (q: any) => {
    if (search.trim()) q = q.ilike("ente_nome", `%${search.trim().toUpperCase()}%`);
    if (filtroAnno !== "tutti") q = q.eq("anno_riferimento", parseInt(filtroAnno));
    if (filtroProvincia !== "tutti") q = q.eq("provincia", filtroProvincia);
    if (filtroTipologia !== "tutti") q = q.eq("tipologia", filtroTipologia);
    if (filtroEsito !== "tutti") q = q.eq("esito", filtroEsito);
    if (filtroBroker !== "tutti") q = q.eq("broker_incumbent", filtroBroker);
    if (filtroCategoria !== "tutti") q = q.eq("categoria_ente", filtroCategoria);
    if (filtroStatoMandato !== "tutti") q = q.eq("stato_mandato", filtroStatoMandato);
    if (filtroSoloIntermedia) q = q.eq("broker_incumbent", "INTERMEDIA");
    if (flagCauzione) q = q.eq("flag_cauzione", true);
    if (flagReferenze) q = q.eq("flag_referenze_bancarie", true);
    if (flagAccesso) q = q.eq("flag_accesso_atti", true);
    if (flagOfferta) q = q.eq("flag_offerta_tecnica", true);
    return q;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["storico_gare", page, ...filtersKey],
    queryFn: async () => {
      let q = supabase.from("v_storico_gare").select("*", { count: "exact" });
      q = applyFilters(q);
      q = q.order("anno_riferimento", { ascending: false }).order("data_consegna", { ascending: false, nullsFirst: false });
      q = q.range(range.from, range.to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data) ?? [], total: count ?? 0 };
    },
  });

  // Aggregati per i grafici (rispettano i filtri tranne la paginazione)
  const { data: chartData } = useQuery({
    queryKey: ["storico_gare_charts", ...filtersKey],
    queryFn: async () => {
      let q = supabase.from("v_storico_gare").select("anno_riferimento, broker_incumbent, categoria_ente").limit(10000);
      q = applyFilters(q);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data) ?? [];

      // Trend per anno (ultimi 13 anni)
      const annoMap = new Map<number, number>();
      rows.forEach(r => {
        if (r.anno_riferimento) annoMap.set(r.anno_riferimento, (annoMap.get(r.anno_riferimento) ?? 0) + 1);
      });
      const trendAnno = Array.from(annoMap.entries())
        .sort((a, b) => a[0] - b[0])
        .slice(-13)
        .map(([anno, count]) => ({ anno: String(anno), count }));

      // Top 8 broker
      const brokerMap = new Map<string, number>();
      rows.forEach(r => {
        const b = r.broker_incumbent || "Sconosciuto";
        brokerMap.set(b, (brokerMap.get(b) ?? 0) + 1);
      });
      const topBroker = Array.from(brokerMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([broker, count]) => ({ broker: broker.length > 18 ? broker.slice(0, 18) + "…" : broker, count }));

      // Distribuzione categoria
      const catMap = new Map<string, number>();
      rows.forEach(r => {
        const c = r.categoria_ente || "altro_ente";
        catMap.set(c, (catMap.get(c) ?? 0) + 1);
      });
      const catDist = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => {
          const lbl = CATEGORIE_ENTE.find(x => x.value === cat)?.label ?? cat;
          return { name: lbl, value: count };
        });

      return { trendAnno, topBroker, catDist };
    },
  });

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await importFile.arrayBuffer();
      const base64 = btoa(new Uint8Array(buf).reduce((acc, b) => acc + String.fromCharCode(b), ""));
      const { data: res, error } = await supabase.functions.invoke("import-storico-gare", {
        body: { fileBase64: base64, fileName: importFile.name, replace: false },
      });
      if (error) throw error;
      setImportResult(res);
      toast.success(`Importate ${res.inserted} righe`);
      queryClient.invalidateQueries({ queryKey: ["storico_gare"] });
      queryClient.invalidateQueries({ queryKey: ["storico_gare_kpi"] });
      queryClient.invalidateQueries({ queryKey: ["storico_gare_lookups"] });
    } catch (e: any) {
      toast.error("Errore import: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const total = data?.total ?? 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Storico Gare Pubbliche
          </h1>
          <p className="text-sm text-muted-foreground">
            Intelligence di mercato: gare e manifestazioni d'interesse storiche
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importa Excel
          </Button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{kpi?.totale ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Gare totali archiviate</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div>
              <div className="text-2xl font-bold">{kpi?.scadenza ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Mandati in scadenza (12m)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Trend gare per anno</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData?.trendAnno ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="anno" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Top broker incumbent</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData?.topBroker ?? []} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="broker" tick={{ fontSize: 10 }} width={110} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--accent-foreground))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Categoria ente</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData?.catDist ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} label={(e: any) => `${e.value}`} labelLine={false}>
                {(chartData?.catDist ?? []).map((_, i) => (
                  <Cell key={i} fill={[
                    "hsl(var(--primary))",
                    "hsl(var(--chart-2, 173 58% 39%))",
                    "hsl(var(--chart-3, 43 74% 49%))",
                    "hsl(var(--chart-4, 12 76% 61%))",
                    "hsl(var(--chart-5, 280 65% 60%))",
                    "hsl(var(--muted-foreground))",
                    "hsl(var(--accent-foreground))",
                    "hsl(var(--secondary-foreground))",
                  ][i % 8]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filtri */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca ente…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={filtroAnno} onValueChange={(v) => { setFiltroAnno(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Anno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli anni</SelectItem>
              {lookupData?.anni.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroProvincia} onValueChange={(v) => { setFiltroProvincia(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Provincia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte province</SelectItem>
              {lookupData?.province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Select value={filtroTipologia} onValueChange={(v) => { setFiltroTipologia(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Tipologia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte</SelectItem>
              {TIPOLOGIE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroEsito} onValueChange={(v) => { setFiltroEsito(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Esito" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti esiti</SelectItem>
              {ESITI.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroBroker} onValueChange={(v) => { setFiltroBroker(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Broker" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti broker</SelectItem>
              {lookupData?.brokers.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Categoria ente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte categorie</SelectItem>
              {CATEGORIE_ENTE.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatoMandato} onValueChange={(v) => { setFiltroStatoMandato(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Stato mandato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti stati</SelectItem>
              {STATI_MANDATO.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-4 pt-2 border-t">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={filtroSoloIntermedia} onCheckedChange={(v) => { setFiltroSoloIntermedia(!!v); setPage(1); }} />
            Solo Intermedia
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={flagCauzione} onCheckedChange={(v) => { setFlagCauzione(!!v); setPage(1); }} />
            Con cauzione
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={flagReferenze} onCheckedChange={(v) => { setFlagReferenze(!!v); setPage(1); }} />
            Con referenze bancarie
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={flagAccesso} onCheckedChange={(v) => { setFlagAccesso(!!v); setPage(1); }} />
            Con accesso atti
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={flagOfferta} onCheckedChange={(v) => { setFlagOfferta(!!v); setPage(1); }} />
            Con offerta tecnica
          </label>
        </div>
      </Card>

      {/* Tabella */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anno</TableHead>
              <TableHead>Ente</TableHead>
              <TableHead>PV</TableHead>
              <TableHead>Tipologia</TableHead>
              <TableHead>Broker</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Esito</TableHead>
              <TableHead>Fine Mandato</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : data?.rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                Nessuna gara trovata. {isAdmin && "Importa lo storico Excel per iniziare."}
              </TableCell></TableRow>
            ) : (
              data?.rows.map((r: any) => {
                const esito = ESITI.find(e => e.value === r.esito);
                const sm = STATI_MANDATO.find(s => s.value === r.stato_mandato);
                const cat = CATEGORIE_ENTE.find(c => c.value === r.categoria_ente);
                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{r.anno_riferimento}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate" title={r.ente_nome}>{r.ente_nome}</TableCell>
                    <TableCell>{r.provincia ?? "—"}</TableCell>
                    <TableCell className="text-xs">{TIPOLOGIE.find(t => t.value === r.tipologia)?.label ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.broker_incumbent ?? "—"}</TableCell>
                    <TableCell className="text-xs">{cat?.label ?? "—"}</TableCell>
                    <TableCell>
                      {esito ? <Badge variant="secondary" className={esito.color}>{esito.label}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{r.data_fine_mandato ?? "—"}</TableCell>
                    <TableCell>
                      {sm ? <Badge variant="secondary" className={sm.color}>{sm.label}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      {r.cliente_id ? (
                        <a href={`/archivi/clienti/${r.cliente_id}`} className="text-primary hover:underline text-xs flex items-center gap-1">
                          {r.cliente_display?.slice(0, 25) ?? "Cliente"} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="p-3 border-t">
          <ServerPagination page={page} pageSize={pageSize} totalCount={total} onPageChange={setPage} />
        </div>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importa storico gare da Excel</DialogTitle>
            <DialogDescription>
              Carica il file <code>ELENCO GARE GENERALE</code>. Verranno importati tutti i fogli annuali, normalizzando broker, categoria ente, esito e stato mandato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>File Excel (.xlsx)</Label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
            </div>
            {importResult && (
              <div className="text-xs space-y-1 bg-muted p-3 rounded">
                <div>✅ Inserite: <b>{importResult.inserted}</b></div>
                <div>📋 Fogli elaborati: {importResult.sheets_processed}</div>
                <div>🔗 Auto-link clienti: {importResult.auto_linked_clients}</div>
                <div>⏭️ Saltate (vuote): {importResult.skipped_empty}</div>
                <div>⏭️ Saltate (riepilogo): {importResult.skipped_riepilogo}</div>
                <div>⚠️ Errori parse date: {importResult.parse_errors_dates}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportResult(null); setImportFile(null); }}>
              Chiudi
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing ? "Import in corso…" : "Importa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
