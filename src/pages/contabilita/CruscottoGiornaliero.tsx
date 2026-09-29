import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarIcon, CheckCircle, Clock,
  FileWarning, GitCompare, Receipt, RefreshCw, Scale, TrendingDown, TrendingUp, Filter, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CruscottoGiornaliero = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const uffId = profile?.ufficio_id;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dataStr = format(selectedDate, "yyyy-MM-dd");
  const ieriStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
  const fra7ggStr = format(new Date(selectedDate.getTime() + 7 * 86400000), "yyyy-MM-dd");

  // --- Filtri pannello "Movimenti Registrati" ---
  const [filtroDataDa, setFiltroDataDa] = useState<string>(dataStr);
  const [filtroDataA, setFiltroDataA] = useState<string>(dataStr);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("__tutte__");
  const [filtroCausaleId, setFiltroCausaleId] = useState<string>("__tutte__");

  // Sincronizza il periodo del pannello quando l'utente cambia la data del cruscotto
  useEffect(() => {
    setFiltroDataDa(dataStr);
    setFiltroDataA(dataStr);
  }, [dataStr]);

  const fmt = fmtEuro;

  // --- QUERIES ---

  // Movimenti del giorno selezionato
  const { data: movOggi = [], isLoading: loadMov, refetch: refetchMov } = useQuery({
    queryKey: ["cruscotto_mov", uffId, dataStr],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("*").eq("data_movimento", dataStr);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Movimenti giorno precedente (per saldo iniziale quadratura)
  const { data: movIeri = [] } = useQuery({
    queryKey: ["cruscotto_mov_ieri", uffId, ieriStr],
    queryFn: async () => {
      const q = supabase.from("movimenti_contabili").select("tipo, importo").lte("data_movimento", ieriStr);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Estratti non riconciliati nel periodo filtrato (coerente con filtro principale)
  const { data: nonRiconciliati = [], refetch: refetchNR } = useQuery({
    queryKey: ["cruscotto_non_riconciliati", uffId, filtroDataDa, filtroDataA],
    queryFn: async () => {
      const q = supabase.from("estratti_conto").select("*")
        .eq("stato", "nuovo")
        .gte("data_operazione", filtroDataDa)
        .lte("data_operazione", filtroDataA);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_operazione", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Estratti totali per progress (riconciliati + non) nel periodo filtrato
  const { data: estrattiTotali = [] } = useQuery({
    queryKey: ["cruscotto_estratti_totali", uffId, filtroDataDa, filtroDataA],
    queryFn: async () => {
      const q = supabase.from("estratti_conto").select("stato")
        .gte("data_operazione", filtroDataDa)
        .lte("data_operazione", filtroDataA);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Incroci KO aperti
  const { data: incrociKO = [], refetch: refetchKO } = useQuery({
    queryKey: ["cruscotto_incroci_ko"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incroci_bancari")
        .select("*, estratti_conto(*), movimenti_contabili(*)")
        .eq("esito", "ko")
        .eq("verificato", false)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Scadenze fornitore nel periodo filtrato (default: prossimi 7 giorni dalla data selezionata)
  const { data: scadenzeFornitori = [], refetch: refetchSF } = useQuery({
    queryKey: ["cruscotto_scadenze_fornitori", uffId, filtroDataDa, filtroDataA, fra7ggStr],
    queryFn: async () => {
      const dal = filtroDataDa || dataStr;
      // Se il periodo filtrato è esteso usa quello, altrimenti default a +7gg
      const al = (filtroDataA && filtroDataA !== dataStr) ? filtroDataA : fra7ggStr;
      const q = supabase
        .from("primanota_generale")
        .select("*, fornitori(nome)")
        .lte("data_documento", al)
        .gte("data_documento", dal)
        .eq("stato", "aperta");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_documento").limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Incassi da verificare: titoli non ancora incassati
  const { data: titoliDaVerificare = [], refetch: refetchTV } = useQuery({
    queryKey: ["cruscotto_titoli_da_verificare", uffId],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, stato, data_scadenza")
        .in("stato", ["emesso", "in_lavorazione", "da_incassare"]);
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Titoli in scadenza oggi + 7gg
  const { data: titoliInScadenza = [] } = useQuery({
    queryKey: ["cruscotto_titoli_scadenza", uffId, dataStr],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, stato, data_scadenza")
        .gte("data_scadenza", dataStr)
        .lte("data_scadenza", fra7ggStr)
        .neq("stato", "incassato");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_scadenza").limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Causali compensazione (per filtro)
  const { data: causaliCompFiltro = [] } = useQuery({
    queryKey: ["causali-compensazione-filtro"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("causali_contabili") as any)
        .select("id, codice, descrizione")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .order("codice");
      if (error) throw error;
      return (data || []) as Array<{ id: string; codice: string; descrizione: string }>;
    },
  });

  // Movimenti filtrati per il pannello in fondo (periodo + categoria + causale)
  const { data: movFiltrati = [], isLoading: loadMovF, refetch: refetchMovF } = useQuery({
    queryKey: ["cruscotto_mov_filtrati", uffId, filtroDataDa, filtroDataA, filtroCategoria, filtroCausaleId, causaliCompFiltro.length],
    queryFn: async () => {
      let q: any = supabase.from("movimenti_contabili").select("*")
        .gte("data_movimento", filtroDataDa)
        .lte("data_movimento", filtroDataA);
      if (uffId) q = q.eq("ufficio_id", uffId);
      if (filtroCategoria !== "__tutte__") q = q.eq("categoria", filtroCategoria);
      if (filtroCategoria === "compensazione_titolo" && filtroCausaleId !== "__tutte__") {
        const causale = causaliCompFiltro.find((c) => c.id === filtroCausaleId);
        if (causale) q = q.ilike("descrizione", `${causale.codice}%`);
      }
      const { data, error } = await q.order("data_movimento", { ascending: false }).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Riepilogo compensazioni del periodo filtrato (aggregato per causale)
  const { data: riepilogoComp = { righe: [], totaleNetto: 0, totalePositivo: 0, totaleNegativo: 0, count: 0 } } = useQuery({
    queryKey: ["cruscotto_riepilogo_comp", filtroDataDa, filtroDataA],
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select("causale_codice, causale_descrizione, segno, importo, created_at")
        .gte("created_at", `${filtroDataDa}T00:00:00`)
        .lte("created_at", `${filtroDataA}T23:59:59`);
      if (error) throw error;
      const map = new Map<string, { codice: string; descrizione: string; count: number; totalePos: number; totaleNeg: number; netto: number }>();
      for (const r of (data || []) as Array<{ causale_codice: string; causale_descrizione: string; segno: "+" | "-"; importo: number }>) {
        const key = r.causale_codice || "?";
        const cur = map.get(key) || { codice: key, descrizione: r.causale_descrizione || "", count: 0, totalePos: 0, totaleNeg: 0, netto: 0 };
        const imp = Number(r.importo) || 0;
        cur.count += 1;
        if (r.segno === "+") { cur.totalePos += imp; cur.netto -= imp; }
        else { cur.totaleNeg += imp; cur.netto += imp; }
        map.set(key, cur);
      }
      const righe = Array.from(map.values()).sort((a, b) => Math.abs(b.netto) - Math.abs(a.netto));
      const totalePositivo = righe.reduce((s, r) => s + r.totalePos, 0);
      const totaleNegativo = righe.reduce((s, r) => s + r.totaleNeg, 0);
      const totaleNetto = righe.reduce((s, r) => s + r.netto, 0);
      const count = righe.reduce((s, r) => s + r.count, 0);
      return { righe, totaleNetto, totalePositivo, totaleNegativo, count };
    },
  });

  // --- CALCULATIONS ---

  // KPI giornaliere (mantengono il giorno selezionato)
  const totEntrate = movOggi.filter(m => m.tipo === "entrata").reduce((s, m) => s + (m.importo || 0), 0);
  const totUscite = movOggi.filter(m => m.tipo === "uscita").reduce((s, m) => s + (m.importo || 0), 0);
  const saldoGiorno = totEntrate - totUscite;

  // Quadratura cassa
  const saldoPrecedente = movIeri.reduce((s, m: any) => {
    return s + (m.tipo === "entrata" ? (m.importo || 0) : -(m.importo || 0));
  }, 0);
  const saldoAtteso = saldoPrecedente + saldoGiorno;
  // For now, differenza is 0 since we don't have a separate "saldo effettivo" field
  // In a real scenario, this would compare with the actual cash register value
  const differenzaCassa = 0;

  // Incassi da verificare totals
  const totIncassiDaVerificare = titoliDaVerificare.reduce((s, t: any) => s + (t.premio_lordo || 0), 0);

  // Reconciliation progress
  const estrattiRiconciliati = estrattiTotali.filter((e: any) => e.stato === "ok" || e.stato === "matchato").length;
  const estrattiTotCount = estrattiTotali.length;
  const percRiconciliazione = estrattiTotCount > 0 ? Math.round((estrattiRiconciliati / estrattiTotCount) * 100) : 100;

  const refreshAll = () => {
    refetchMov();
    refetchNR();
    refetchKO();
    refetchSF();
    refetchTV();
  };

  return (
    <div className="space-y-6">
      {/* Header con filtro data */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cruscotto del Giorno</h1>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate, "EEEE d MMMM yyyy", { locale: it })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && "border-primary text-primary")}>
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            Oggi
          </Button>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Entrate
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{fmt(totEntrate)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "entrata").length} mov.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="w-3.5 h-3.5" /> Uscite
            </CardDescription>
            <CardTitle className="text-xl text-red-600">{fmt(totUscite)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.filter(m => m.tipo === "uscita").length} mov.</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${saldoGiorno >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              {saldoGiorno >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Saldo Giornata
            </CardDescription>
            <CardTitle className={`text-xl ${saldoGiorno >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {fmt(saldoGiorno)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{movOggi.length} mov. totali</p>
          </CardContent>
        </Card>

        {/* Incassi da Verificare */}
        <Card className={`border-l-4 ${titoliDaVerificare.length > 0 ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Receipt className="w-3.5 h-3.5" /> Incassi da Verificare
            </CardDescription>
            <CardTitle className="text-xl">{titoliDaVerificare.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{fmt(totIncassiDaVerificare)} attesi</p>
          </CardContent>
        </Card>

        {/* Da Riconciliare */}
        <Card className={`border-l-4 ${nonRiconciliati.length > 0 ? "border-l-amber-500" : "border-l-green-500"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <GitCompare className="w-3.5 h-3.5" /> Da Riconciliare
            </CardDescription>
            <CardTitle className="text-xl">{nonRiconciliati.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">mov. bancari non matchati</p>
          </CardContent>
        </Card>

        {/* Quadratura Cassa */}
        <Card className={`border-l-4 ${differenzaCassa === 0 ? "border-l-green-500" : "border-l-destructive"}`}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <Scale className="w-3.5 h-3.5" /> Quadratura Cassa
            </CardDescription>
            <CardTitle className={`text-xl ${differenzaCassa === 0 ? "text-green-600" : "text-destructive"}`}>
              {differenzaCassa === 0 ? "OK" : fmt(differenzaCassa)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Atteso: {fmt(saldoAtteso)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar riconciliazione */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Riconciliazione del giorno</CardTitle>
            <span className="text-sm font-mono text-muted-foreground">
              {estrattiRiconciliati}/{estrattiTotCount} ({percRiconciliazione}%)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percRiconciliazione} className="h-2.5" />
          <p className="text-xs text-muted-foreground mt-2">
            {percRiconciliazione === 100
              ? "✓ Tutti i movimenti bancari del giorno sono stati riconciliati"
              : `${estrattiTotCount - estrattiRiconciliati} movimenti ancora da riconciliare`}
          </p>
        </CardContent>
      </Card>

      {/* Titoli in Scadenza + Anomalie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Titoli in Scadenza */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-500" />
              Titoli in Scadenza (7gg) ({titoliInScadenza.length})
            </CardTitle>
            <CardDescription>Premi attesi nei prossimi 7 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            {titoliInScadenza.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle className="w-4 h-4 text-green-500" /> Nessun titolo in scadenza
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {titoliInScadenza.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm border-b pb-1.5">
                    <div className="truncate flex-1">
                      <span className="font-medium">{t.numero_titolo || "—"}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{t.stato}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs">{fmt(t.premio_lordo || 0)}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.data_scadenza}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {titoliInScadenza.length > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/titoli")}>
                Vedi tutti i titoli →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Anomalie Bancarie */}
        <Card className={`${incrociKO.length > 0 ? "border-destructive/50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Anomalie Bancarie ({incrociKO.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incrociKO.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CheckCircle className="w-4 h-4 text-green-500" /> Nessuna anomalia aperta
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {incrociKO.map((ib: any) => (
                  <div key={ib.id} className="flex items-center justify-between text-sm border-b pb-1">
                    <div className="truncate flex-1">
                      <span className="font-medium">{ib.note || "Incrocio KO"}</span>
                      {ib.differenza && (
                        <span className="ml-2 text-destructive font-mono text-xs">Δ {fmt(ib.differenza)}</span>
                      )}
                    </div>
                    <Badge variant="destructive" className="text-[10px]">KO</Badge>
                  </div>
                ))}
              </div>
            )}
            {incrociKO.length > 0 && (
              <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/anomalie-ko")}>
                Vedi tutte →
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scadenze fornitori */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Scadenze Fornitori (7gg) ({scadenzeFornitori.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scadenzeFornitori.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle className="w-4 h-4 text-green-500" /> Nessuna scadenza prossima
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {scadenzeFornitori.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b pb-1">
                  <div className="truncate flex-1">
                    <span className="font-medium">{s.fornitori?.nome || s.descrizione || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{fmt(s.totale || 0)}</span>
                    <Badge variant="outline" className="text-[10px]">{s.data_documento}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {scadenzeFornitori.length > 0 && (
            <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => navigate("/contabilita")}>
              Vai a Contabilità →
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Movimenti non riconciliati */}
      {nonRiconciliati.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimenti Bancari da Riconciliare</CardTitle>
            <CardDescription>Estratti conto importati non ancora matchati con movimenti contabili</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nonRiconciliati.slice(0, 10).map((ec: any) => (
                  <TableRow key={ec.id}>
                    <TableCell className="font-mono text-xs">{ec.data_operazione}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{ec.descrizione || "—"}</TableCell>
                    <TableCell className={`text-right font-mono ${ec.importo >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(ec.importo)}
                    </TableCell>
                    <TableCell><Badge variant="secondary">Nuovo</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {nonRiconciliati.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                ...e altri {nonRiconciliati.length - 10} movimenti
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Riepilogo Compensazioni Contabili — totali per causale nel periodo filtrato */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4 text-teal-600" /> Riepilogo Compensazioni
              </CardTitle>
              <CardDescription>
                {filtroDataDa === filtroDataA
                  ? format(new Date(filtroDataDa), "d MMMM yyyy", { locale: it })
                  : `Dal ${format(new Date(filtroDataDa), "d MMM yyyy", { locale: it })} al ${format(new Date(filtroDataA), "d MMM yyyy", { locale: it })}`}
                {" · "}{riepilogoComp.count} compensazioni su {riepilogoComp.righe.length} causal{riepilogoComp.righe.length === 1 ? "e" : "i"}
              </CardDescription>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-emerald-600 font-medium">A favore cliente: {fmt(riepilogoComp.totalePositivo)}</span>
              <span className="text-red-600 font-medium">A carico cliente: {fmt(riepilogoComp.totaleNegativo)}</span>
              <span className={`font-semibold ${riepilogoComp.totaleNetto >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                Netto: {fmt(riepilogoComp.totaleNetto)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {riepilogoComp.righe.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna compensazione registrata nel periodo selezionato.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Causale</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">N.</TableHead>
                  <TableHead className="text-right text-emerald-700">A favore (€)</TableHead>
                  <TableHead className="text-right text-red-700">A carico (€)</TableHead>
                  <TableHead className="text-right">Netto (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riepilogoComp.righe.map((r: any, i: number) => (
                  <TableRow key={r.codice} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="font-mono text-xs">{r.codice}</TableCell>
                    <TableCell className="text-sm">{r.descrizione || "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.count}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-700">{r.totalePos > 0 ? fmt(r.totalePos) : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-red-700">{r.totaleNeg > 0 ? fmt(r.totaleNeg) : "—"}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-semibold ${r.netto >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {fmt(r.netto)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Movimenti Registrati - con filtri periodo/categoria/causale */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" /> Movimenti Registrati
              </CardTitle>
              <CardDescription>
                {filtroDataDa === filtroDataA
                  ? format(new Date(filtroDataDa), "d MMMM yyyy", { locale: it })
                  : `Dal ${format(new Date(filtroDataDa), "d MMM yyyy", { locale: it })} al ${format(new Date(filtroDataA), "d MMM yyyy", { locale: it })}`}
                {" · "}{movFiltrati.length} righe
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchMovF()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Aggiorna
            </Button>
          </div>

          {/* Filter bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Dal</Label>
              <Input type="date" value={filtroDataDa} onChange={(e) => setFiltroDataDa(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Al</Label>
              <Input type="date" value={filtroDataA} onChange={(e) => setFiltroDataA(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="lg:col-span-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Categoria</Label>
              <Select value={filtroCategoria} onValueChange={(v) => { setFiltroCategoria(v); if (v !== "compensazione_titolo") setFiltroCausaleId("__tutte__"); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__tutte__">Tutte</SelectItem>
                  <SelectItem value="compensazione_titolo">Compensazioni</SelectItem>
                  <SelectItem value="utilizzo_anticipo">Utilizzo acconto</SelectItem>
                  <SelectItem value="incasso_premio">Incasso premio</SelectItem>
                  <SelectItem value="rimessa">Rimessa</SelectItem>
                  <SelectItem value="provvigione">Provvigione</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Causale comp.</Label>
              <Select value={filtroCausaleId} onValueChange={setFiltroCausaleId} disabled={filtroCategoria !== "compensazione_titolo"}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__tutte__">Tutte le causali</SelectItem>
                  {causaliCompFiltro.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.codice} — {c.descrizione}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline" size="sm" className="h-8 text-xs w-full"
                onClick={() => { setFiltroDataDa(dataStr); setFiltroDataA(dataStr); setFiltroCategoria("__tutte__"); setFiltroCausaleId("__tutte__"); }}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            </div>
          </div>

          {/* Totali filtrati */}
          {movFiltrati.length > 0 && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-green-600 font-medium">
                Entrate: {fmt(movFiltrati.filter((m: any) => m.tipo === "entrata").reduce((s: number, m: any) => s + (m.importo || 0), 0))}
              </span>
              <span className="text-red-600 font-medium">
                Uscite: {fmt(movFiltrati.filter((m: any) => m.tipo === "uscita").reduce((s: number, m: any) => s + (m.importo || 0), 0))}
              </span>
              <span className="font-semibold">
                Saldo: {fmt(movFiltrati.reduce((s: number, m: any) => s + (m.tipo === "entrata" ? (m.importo || 0) : -(m.importo || 0)), 0))}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadMovF ? (
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          ) : movFiltrati.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nessun movimento per i filtri selezionati.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movFiltrati.map((m: any, i: number) => (
                  <TableRow key={m.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                    <TableCell className="font-mono text-xs">{m.data_movimento}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "entrata" ? "default" : "destructive"} className="text-[10px]">
                        {m.tipo === "entrata" ? "↓ Entrata" : "↑ Uscita"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px] font-normal">{m.categoria || "—"}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm">{m.descrizione || "—"}</TableCell>
                    <TableCell className={`text-right font-mono ${m.tipo === "entrata" ? "text-green-600" : "text-red-600"}`}>
                      {fmt(m.importo)}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{m.stato}</Badge></TableCell>
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

export default CruscottoGiornaliero;
