import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertTriangle, ShieldCheck, Clock, DollarSign, ChevronDown, ChevronRight, MapPin, User, FileText, Plus, ExternalLink, Filter, Download, X, CalendarIcon, Check, FileDown, Building2, Truck } from "lucide-react";

// MultiSelect filter: array of values, "all" when empty
function MultiSelectFilter({ label, values, options, onChange, formatOption }: {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  formatOption?: (v: string) => string;
}) {
  const display = values.length === 0
    ? label
    : values.length === 1
      ? (formatOption?.(values[0]) ?? values[0])
      : `${values.length} selezionati`;
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className={cn("truncate", values.length === 0 && "text-muted-foreground")}>{display}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1 w-[var(--radix-popover-trigger-width)] max-h-72 overflow-auto" align="start">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Nessuna opzione</div>
        ) : (
          <>
            {values.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent rounded">
                ✕ Pulisci selezione
              </button>
            )}
            {options.map((opt) => (
              <button key={opt} type="button" onClick={() => toggle(opt)} className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded">
                <div className={cn("h-4 w-4 border rounded flex items-center justify-center", values.includes(opt) && "bg-primary border-primary")}>
                  {values.includes(opt) && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="truncate">{formatOption?.(opt) ?? opt}</span>
              </button>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
import { format } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import NuovaDenunciaSinistroDialog from "@/components/cliente/NuovaDenunciaSinistroDialog";
import SinistroDocumentiCliente from "@/components/cliente/SinistroDocumentiCliente";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";
import { exportSinistriXlsx } from "@/lib/exportSinistriXlsx";
import { buildSinistriEnteReportPdf } from "@/lib/sinistri-ente-report-pdf";
import {
  aggregateSinPerRamo,
  buildEnteInfoFromCliente,
  buildFilterSummary,
  buildReportFilename,
  captureElementAsPng,
  computeKpis,
  fetchStaticMapImage,
  mapSinistriToPdfRows,
} from "@/lib/sinistriEnteReportData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import InfoHint from "@/components/cliente/InfoHint";
import SinistriMap from "@/components/cliente/SinistriMap";
import SinistriPerRepartoChart from "@/components/cliente/SinistriPerRepartoChart";
import { isClienteSanitario, resolveReparto } from "@/lib/sinistriReparto";
import { aggregateSinPerTipo, aggregateSinPerVeicolo } from "@/lib/sinistriClienteCharts";
import { badgeClassStatoSinistro, isStatoChiusuraArchivio, labelStatoSinistro } from "@/lib/sinistriStati";

const COLORS_OPEN = ["#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];
const COLORS_CLOSED = ["#93c5fd", "#fdba74", "#d8b4fe", "#fca5a5", "#5eead4", "#fde047"];



export default function ClienteSinistri() {
  const { user, profile } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const repartoChartRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openNuovo, setOpenNuovo] = useState(false);

  // Filtri (multi-select)
  const [fSearch, setFSearch] = useState("");
  const [fStati, setFStati] = useState<string[]>([]);
  const [fRami, setFRami] = useState<string[]>([]);
  const [fCompagnie, setFCompagnie] = useState<string[]>([]);
  const [fPolizze, setFPolizze] = useState<string[]>([]);
  const [fCitta, setFCitta] = useState<string[]>([]);
  const [fReparti, setFReparti] = useState<string[]>([]);
  const [fDataDa, setFDataDa] = useState<Date | undefined>();
  const [fDataA, setFDataA] = useState<Date | undefined>();

  // Selezione
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const { data: cliente } = useQuery({
    queryKey: ["cliente-ente-profile", user?.id],
    queryFn: async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return null;
      const id = typeof clienteIds[0] === "string" ? clienteIds[0] : (clienteIds[0] as any)?.id;
      const { data, error } = await supabase
        .from("clienti")
        .select("tipo_cliente, ragione_sociale, nome, cognome, partita_iva, codice_fiscale, codice_fiscale_azienda, indirizzo_sede, cap_sede, citta_sede, provincia_sede, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, email, pec, telefono, spec_sx_sanita, settore, codice_ricerca, azienda_ssn_sx")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isEnte = cliente?.tipo_cliente === "ente";
  const isSanitario = isClienteSanitario(cliente);

  const { data: sinistri = [], refetch } = useQuery({
    queryKey: ["cliente-sinistri", user?.id],
    queryFn: async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return [];
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, compagnie(nome), titoli(id, numero_titolo), anagrafiche_professionali!sinistri_perito_id_fkey(nome, cognome, ragione_sociale)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .neq("stato", "archiviato")
        .order("data_apertura", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Opzioni filtri (uniche dal dataset)
  const distinct = (key: (s: any) => string | undefined | null) =>
    Array.from(new Set(sinistri.map(key).filter(Boolean))) as string[];
  const optStati = distinct((s) => s.stato);
  const optRami = distinct((s) => s.ramo_sinistro);
  const optCompagnie = distinct((s) => s.compagnie?.nome);
  const optPolizze = distinct((s) => s.titoli?.numero_titolo);
  const optCitta = distinct((s) => s.citta_sinistro);
  const optReparti = Array.from(new Set(sinistri.map((s: any) => resolveReparto(s)).filter((r) => r !== "Non specificato"))).sort((a, b) => a.localeCompare(b, "it"));

  const filteredSinistri = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    return sinistri.filter((s: any) => {
      if (fStati.length && !fStati.includes(s.stato)) return false;
      if (fRami.length && !fRami.includes(s.ramo_sinistro)) return false;
      if (fCompagnie.length && !fCompagnie.includes(s.compagnie?.nome)) return false;
      if (fPolizze.length && !fPolizze.includes(s.titoli?.numero_titolo)) return false;
      if (fCitta.length && !fCitta.includes(s.citta_sinistro)) return false;
      if (fReparti.length && !fReparti.includes(resolveReparto(s))) return false;
      if (fDataDa && (!s.data_evento || new Date(s.data_evento) < fDataDa)) return false;
      if (fDataA && (!s.data_evento || new Date(s.data_evento) > fDataA)) return false;
      if (q) {
        const hay = [s.numero_sinistro, s.numero_sinistro_compagnia, s.controparte, s.targa_veicolo, s.citta_sinistro, s.dinamica]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sinistri, fSearch, fStati, fRami, fCompagnie, fPolizze, fCitta, fReparti, fDataDa, fDataA]);

  const resetFilters = () => {
    setFSearch(""); setFStati([]); setFRami([]); setFCompagnie([]);
    setFPolizze([]); setFCitta([]); setFReparti([]);
    setFDataDa(undefined); setFDataA(undefined);
  };


  const aperti = filteredSinistri.filter((s: any) => !isStatoChiusuraArchivio(s.stato)).length;
  const chiusi = filteredSinistri.length - aperti;
  const riserve = filteredSinistri.reduce((s: number, x: any) => s + (x.importo_riserva || 0), 0);
  const liquidato = filteredSinistri.reduce((s: number, x: any) => s + (x.importo_liquidato || 0), 0);

  const sinPerTipo = useMemo(() => aggregateSinPerTipo(filteredSinistri), [filteredSinistri]);
  const sinPerVeicolo = useMemo(() => aggregateSinPerVeicolo(filteredSinistri, 8), [filteredSinistri]);
  const veicoloChartH = Math.min(360, Math.max(240, sinPerVeicolo.length * 36 + 56));

  // Bar data riserve vs liquidato
  const barData = filteredSinistri.map((s: any) => ({
    name: s.numero_sinistro?.replace("SIN-VA-", "") || "—",
    riserva: s.importo_riserva || 0,
    liquidato: s.importo_liquidato || 0,
  }));

  const kpis = [
    { label: "Totale", value: filteredSinistri.length, icon: AlertTriangle, color: "text-blue-600", bg: "bg-blue-100", border: "#2563eb", hint: "Numero totale di sinistri visibili con i filtri attualmente applicati." },
    { label: "Aperti", value: aperti, icon: Clock, color: "text-orange-600", bg: "bg-orange-100", border: "#ea580c", hint: "Sinistri non ancora chiusi o respinti: in valutazione, lavorazione, attesa documenti o liquidazione." },
    { label: "Chiusi", value: chiusi, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-100", border: "#059669", hint: "Sinistri definiti: stato 'chiuso' (liquidato o senza seguito) o 'respinto' dalla compagnia." },
    { label: "Riserve Totali", value: fmt(riserve), icon: DollarSign, color: "text-red-600", bg: "bg-red-100", border: "#dc2626", hint: "Somma stimata che la compagnia ha accantonato per i sinistri in corso. È una stima, non un pagato." },
    { label: "Liquidato", value: fmt(liquidato), icon: DollarSign, color: "text-teal-600", bg: "bg-teal-100", border: "#0d9488", hint: "Somma effettivamente pagata dalla compagnia ai beneficiari per i sinistri filtrati." },
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allFilteredSelected = filteredSinistri.length > 0 && filteredSinistri.every((s: any) => selectedIds.has(s.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredSinistri.forEach((s: any) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      filteredSinistri.forEach((s: any) => next.add(s.id));
      return next;
    });
  };

  const handleExport = async (mode: "selected" | "filtered") => {
    const list = mode === "selected"
      ? filteredSinistri.filter((s: any) => selectedIds.has(s.id))
      : filteredSinistri;
    if (!list.length) { toast.error("Nessun sinistro da esportare"); return; }
    setExporting(true);
    try {
      await exportSinistriXlsx(list);
      toast.success(`Esportati ${list.length} sinistri`);
    } catch (e: any) {
      toast.error("Errore export: " + (e?.message || e));
    } finally {
      setExporting(false);
    }
  };

  const handleGeneratePdf = async (mode: "selected" | "filtered") => {
    const list = mode === "selected"
      ? filteredSinistri.filter((s: any) => selectedIds.has(s.id))
      : filteredSinistri;
    if (!list.length) {
      toast.error("Nessun sinistro da includere nel report");
      return;
    }
    if (!cliente) {
      toast.error("Dati ente non disponibili");
      return;
    }

    setGeneratingPdf(true);
    toast.info("Generazione report PDF in corso…");
    try {
      const [chartImageBytes, staticMapBytes, repartoChartBytes] = await Promise.all([
        captureElementAsPng(chartRef.current),
        isSanitario ? Promise.resolve(null) : fetchStaticMapImage(list),
        isSanitario ? captureElementAsPng(repartoChartRef.current) : Promise.resolve(null),
      ]);
      let mapImageBytes = isSanitario ? repartoChartBytes : staticMapBytes;
      if (!mapImageBytes) {
        mapImageBytes = await captureElementAsPng(isSanitario ? repartoChartRef.current : mapRef.current);
      }

      const ente = buildEnteInfoFromCliente(cliente);
      const generatedBy = profile ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() || profile.email || "" : "";
      const filterLines = buildFilterSummary(
        { search: fSearch, stati: fStati, rami: fRami, compagnie: fCompagnie, polizze: fPolizze, citta: fCitta, reparti: fReparti, dataDa: fDataDa, dataA: fDataA },
        filteredSinistri.length,
        sinistri.length,
      );
      if (mode === "selected") {
        filterLines.push(`Report su selezione: ${list.length} sinistri`);
      }

      const bytes = await buildSinistriEnteReportPdf({
        ente,
        titolo: `Report Sinistri — ${ente.ragioneSociale}`,
        generatedAt: format(new Date(), "dd/MM/yyyy HH:mm"),
        generatedBy,
        filterLines,
        kpis: computeKpis(list),
        sinPerRamo: aggregateSinPerRamo(list),
        sinistri: mapSinistriToPdfRows(list, { includeReparto: isSanitario }),
        chartImageBytes,
        mapImageBytes,
        secondaryChartTitle: isSanitario ? "Sinistri per reparto" : undefined,
        includeRepartoColumn: isSanitario,
      });

      const filename = buildReportFilename(ente.ragioneSociale);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success(`Report PDF generato (${list.length} sinistri)`);
    } catch (e: any) {
      toast.error("Errore generazione PDF: " + (e?.message || e));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div data-tour="cl-sin-page" className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">I Miei Sinistri</h1>
            <p className="text-sm text-muted-foreground">
              {filteredSinistri.length === sinistri.length
                ? `${sinistri.length} sinistri registrati`
                : `${filteredSinistri.length} di ${sinistri.length} sinistri`}
            </p>
          </div>
        </div>
        <Button onClick={() => setOpenNuovo(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Apri nuovo sinistro
        </Button>
      </div>

      <NuovaDenunciaSinistroDialog open={openNuovo} onOpenChange={setOpenNuovo} onCreated={() => refetch()} />


      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border-l-4" style={{ borderLeftColor: k.border }}>
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full ${k.bg} flex items-center justify-center`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {k.label}
                    {k.hint && <InfoHint text={k.hint} size="xs" />}
                  </p>
                  <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {sinistri.length > 0 && (
        <div className="space-y-6">
          <Card ref={isSanitario ? repartoChartRef : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {isSanitario ? (
                  <><Building2 className="h-4 w-4 text-teal-700" /> Sinistri per Reparto</>
                ) : (
                  <><MapPin className="h-4 w-4 text-teal-700" /> Mappa sinistri — area Reggio Calabria</>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent ref={isSanitario ? undefined : mapRef}>
              {isSanitario ? (
                <SinistriPerRepartoChart sinistri={filteredSinistri} />
              ) : (
                <SinistriMap sinistri={filteredSinistri} />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card ref={chartRef}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Sinistri per tipo (Aperti vs Chiusi)</CardTitle>
              </CardHeader>
              <CardContent>
                {sinPerTipo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Nessun dato con i filtri attuali</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={sinPerTipo} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-22} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="aperti" name="Aperti" stackId="a" fill="#ea580c" />
                      <Bar dataKey="chiusi" name="Chiusi" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4 text-teal-700" />
                  Sinistri per veicolo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sinPerVeicolo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Nessuna targa nei filtri attuali</p>
                ) : (
                  <ResponsiveContainer width="100%" height={veicoloChartH}>
                    <BarChart data={sinPerVeicolo} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }} />
                      <Tooltip
                        formatter={(value: number, key: string) =>
                          key === "riserve" ? fmt(value) : value
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sinistri" name="N° sinistri" fill="#0d9488" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Filtri */}
      <Card data-tour="cl-sin-filters">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtri
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder="Cerca: n°, controparte, targa…" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
            <MultiSelectFilter label="Tutti gli stati" values={fStati} options={optStati} onChange={setFStati} formatOption={labelStatoSinistro} />
            <MultiSelectFilter label="Tutte le garanzie" values={fRami} options={optRami} onChange={setFRami} />
            <MultiSelectFilter label="Tutte le compagnie" values={fCompagnie} options={optCompagnie} onChange={setFCompagnie} />
            <MultiSelectFilter label="Tutte le polizze" values={fPolizze} options={optPolizze} onChange={setFPolizze} />
            {isSanitario ? (
              <MultiSelectFilter label="Tutti i reparti" values={fReparti} options={optReparti} onChange={setFReparti} />
            ) : (
              <MultiSelectFilter label="Tutte le città" values={fCitta} options={optCitta} onChange={setFCitta} />
            )}

            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !fDataDa && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fDataDa ? format(fDataDa, "dd/MM/yy") : "Da"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fDataDa} onSelect={setFDataDa} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !fDataA && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fDataA ? format(fDataA, "dd/MM/yy") : "A"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fDataA} onSelect={setFDataA} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={resetFilters} className="gap-1">
              <X className="h-3 w-3" /> Reset filtri
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Elenco Sinistri</CardTitle>
          <div className="flex items-center gap-2 flex-wrap" data-tour="cl-sin-export">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selezionati</span>
            {isEnte && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedIds.size || generatingPdf || exporting}
                  onClick={() => handleGeneratePdf("selected")}
                  className="gap-1.5"
                >
                  <FileDown className="h-4 w-4" /> PDF selezionati
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!filteredSinistri.length || generatingPdf || exporting}
                  onClick={() => handleGeneratePdf("filtered")}
                  className="gap-1.5"
                >
                  <FileDown className="h-4 w-4" /> PDF tutti ({filteredSinistri.length})
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" disabled={!selectedIds.size || exporting || generatingPdf} onClick={() => handleExport("selected")} className="gap-1.5">
              <Download className="h-4 w-4" /> Esporta selezionati
            </Button>
            <Button size="sm" disabled={!filteredSinistri.length || exporting || generatingPdf} onClick={() => handleExport("filtered")} className="gap-1.5">
              <Download className="h-4 w-4" /> Esporta tutti ({filteredSinistri.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSinistri.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nessun sinistro corrisponde ai filtri</p>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8 px-2">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Seleziona tutti" />
                    </TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>N. Sinistro</TableHead>
                    <TableHead>Garanzia</TableHead>
                    <TableHead>Polizza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>{isSanitario ? "Reparto" : "Luogo"}</TableHead>
                    <TableHead className="text-right">Riserva</TableHead>
                    <TableHead className="text-right">Liquidato</TableHead>
                    <TableHead>Data Evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSinistri.map((s: any) => (
                    <>
                      <TableRow
                        key={s.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleExpand(s.id)}
                      >
                        <TableCell className="w-8 px-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} aria-label="Seleziona" />
                        </TableCell>
                        <TableCell className="w-8 px-2">
                          {expandedId === s.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{s.numero_sinistro || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-normal">{s.ramo_sinistro || "—"}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {s.titoli?.id ? (
                            <Link to={`/cliente/polizze/${s.titoli.id}`} className="text-teal-700 hover:underline inline-flex items-center gap-1">
                              {s.titoli.numero_titolo}<ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge className={badgeClassStatoSinistro(s.stato)}>{labelStatoSinistro(s.stato)}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {isSanitario ? resolveReparto(s) : (s.citta_sinistro || s.luogo_sinistro || "—")}
                        </TableCell>
                        <TableCell className="text-right font-medium">{s.importo_riserva ? fmt(s.importo_riserva) : "—"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{s.importo_liquidato ? fmt(s.importo_liquidato) : "—"}</TableCell>
                        <TableCell>{s.data_evento ? format(new Date(s.data_evento), "dd/MM/yyyy") : "—"}</TableCell>
                      </TableRow>

                      {/* Expanded Detail Panel */}
                      {expandedId === s.id && (
                        <TableRow key={`${s.id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-0">
                            <div className="p-4 space-y-4">
                              {/* Dinamica */}
                              {s.dinamica && (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dinamica del sinistro</p>
                                  <p className="text-sm">{s.dinamica}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Reparto / Luogo */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    {isSanitario ? <><Building2 className="h-3 w-3" /> Reparto</> : <><MapPin className="h-3 w-3" /> Luogo sinistro</>}
                                  </p>
                                  <div className="text-sm space-y-0.5">
                                    {isSanitario && (
                                      <p><span className="text-muted-foreground">Reparto:</span> {resolveReparto(s)}</p>
                                    )}
                                    {s.luogo_sinistro && <p>{s.luogo_sinistro}</p>}
                                    {!isSanitario && s.indirizzo_sinistro && <p>{s.indirizzo_sinistro}</p>}
                                    <p>{[s.cap_sinistro, s.citta_sinistro, s.provincia_sinistro ? `(${s.provincia_sinistro})` : null].filter(Boolean).join(" ") || (!isSanitario ? s.luogo_sinistro : null) || "—"}</p>
                                  </div>
                                </div>

                                {/* Persone coinvolte */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><User className="h-3 w-3" /> Soggetti coinvolti</p>
                                  <div className="text-sm space-y-1">
                                    {s.controparte && <p><span className="text-muted-foreground">Controparte:</span> {s.controparte}</p>}
                                    {s.medico_legale && <p><span className="text-muted-foreground">Medico legale:</span> {s.medico_legale}</p>}
                                    {s.anagrafiche_professionali && (
                                      <p><span className="text-muted-foreground">Perito:</span> {s.anagrafiche_professionali.cognome} {s.anagrafiche_professionali.nome}</p>
                                    )}
                                    {s.targa_veicolo && <p><span className="text-muted-foreground">Targa:</span> {s.targa_veicolo}</p>}
                                  </div>
                                </div>

                                {/* Importi e dati */}
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><FileText className="h-3 w-3" /> Dettaglio economico</p>
                                  <div className="text-sm space-y-1">
                                    {s.numero_sinistro_compagnia && <p><span className="text-muted-foreground">N° Compagnia:</span> {s.numero_sinistro_compagnia}</p>}
                                    {s.data_denuncia && <p><span className="text-muted-foreground">Data denuncia:</span> {format(new Date(s.data_denuncia), "dd/MM/yyyy")}</p>}
                                    {s.franchigia != null && s.franchigia > 0 && <p><span className="text-muted-foreground">Franchigia:</span> {fmt(s.franchigia)}</p>}
                                    {s.costo_preventivato != null && <p><span className="text-muted-foreground">Costo preventivato:</span> {fmt(s.costo_preventivato)}</p>}
                                    {s.costo_effettivo != null && <p><span className="text-muted-foreground">Costo effettivo:</span> {fmt(s.costo_effettivo)}</p>}
                                  </div>
                                </div>
                              </div>

                              {/* Note perito */}
                              {s.note_perito && (
                                <div className="border-t pt-3">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Note del perito</p>
                                  <p className="text-sm italic">{s.note_perito}</p>
                                </div>
                              )}

                              {/* Documenti del sinistro */}
                              <SinistroDocumentiCliente sinistroId={s.id} />

                              <div className="flex justify-end pt-2 border-t">
                                <Link to={`/cliente/sinistri/${s.id}`}>
                                  <Button size="sm" variant="outline" className="gap-1.5">
                                    Apri dettaglio completo <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
