import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, ArrowRightLeft, CheckCircle, Clock, Download, Link2,
  RefreshCw, Search, ShieldAlert, TrendingDown, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { fmtEuro as fmt } from "@/lib/formatCurrency";

interface MatchResult {
  titolo: any;
  estratto: any | null;
  score: number;
  differenza: number;
  giorniRitardo: number;
  status: "matched" | "ritardo" | "in_scadenza" | "nessun_match";
}

const TOLERANCE_EUR = 1.0; // tolleranza matching importo
const MATCH_WINDOW_DAYS = 15; // finestra temporale matching

function computeMatches(titoli: any[], estratti: any[]): MatchResult[] {
  const oggi = new Date();
  const usedEstrattiIds = new Set<string>();
  const results: MatchResult[] = [];

  // Sort titoli by scadenza asc (prioritize oldest)
  const sorted = [...titoli].sort((a, b) => {
    const da = a.data_scadenza ? new Date(a.data_scadenza).getTime() : Infinity;
    const db = b.data_scadenza ? new Date(b.data_scadenza).getTime() : Infinity;
    return da - db;
  });

  for (const t of sorted) {
    const premioAtteso = t.premio_lordo || 0;
    const scadenza = t.data_scadenza ? new Date(t.data_scadenza) : null;
    const giorniRitardo = scadenza ? Math.max(0, Math.floor((oggi.getTime() - scadenza.getTime()) / 86400000)) : 0;

    // Find best match among unused estratti
    let bestMatch: any = null;
    let bestScore = 0;
    let bestDiff = 0;

    for (const e of estratti) {
      if (usedEstrattiIds.has(e.id)) continue;
      if (e.importo <= 0) continue;

      const diff = Math.abs(e.importo - premioAtteso);
      if (diff > TOLERANCE_EUR) continue;

      // Score: importo match (0-60) + date proximity (0-40)
      const importoScore = Math.max(0, 60 - (diff / premioAtteso) * 60 * 100);

      let dateScore = 20; // default if no scadenza
      if (scadenza) {
        const eDate = new Date(e.data_operazione);
        const daysDiff = Math.abs(Math.floor((eDate.getTime() - scadenza.getTime()) / 86400000));
        dateScore = daysDiff <= MATCH_WINDOW_DAYS ? Math.max(0, 40 - (daysDiff / MATCH_WINDOW_DAYS) * 40) : 0;
      }

      const score = importoScore + dateScore;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = e;
        bestDiff = e.importo - premioAtteso;
      }
    }

    if (bestMatch) {
      usedEstrattiIds.add(bestMatch.id);
      results.push({
        titolo: t,
        estratto: bestMatch,
        score: Math.round(bestScore),
        differenza: bestDiff,
        giorniRitardo,
        status: "matched",
      });
    } else {
      results.push({
        titolo: t,
        estratto: null,
        score: 0,
        differenza: 0,
        giorniRitardo,
        status: giorniRitardo > 0 ? "ritardo" : "in_scadenza",
      });
    }
  }

  return results;
}

const QuadraturePremi = () => {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const uffId = profile?.ufficio_id;
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [searchText, setSearchText] = useState("");
  const [giorniSoglia, setGiorniSoglia] = useState("5");

  // Titoli in attesa di incasso
  const { data: titoliAttesa = [], isLoading, refetch } = useQuery({
    queryKey: ["quadratura_titoli_attesa", uffId],
    queryFn: async () => {
      const q = supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnia_id, compagnie(nome))")
        .in("stato", ["emesso", "in_lavorazione", "da_incassare", "in_attesa"])
        .order("data_scadenza", { ascending: true });
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Estratti conto recenti (entrate) per matching
  const { data: estrattiEntrata = [] } = useQuery({
    queryKey: ["quadratura_estratti_entrata", uffId],
    queryFn: async () => {
      const sessantaGgFa = new Date();
      sessantaGgFa.setDate(sessantaGgFa.getDate() - 60);
      const q = supabase
        .from("estratti_conto")
        .select("*")
        .gte("importo", 0)
        .gte("data_operazione", sessantaGgFa.toISOString().split("T")[0])
        .eq("stato", "nuovo");
      if (uffId) q.eq("ufficio_id", uffId);
      const { data, error } = await q.order("data_operazione", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Compute matches
  const matchResults = useMemo(
    () => computeMatches(titoliAttesa, estrattiEntrata),
    [titoliAttesa, estrattiEntrata]
  );

  const soglia = parseInt(giorniSoglia) || 5;
  const matched = matchResults.filter((r) => r.status === "matched");
  const inRitardo = matchResults.filter((r) => r.status === "ritardo" && r.giorniRitardo >= soglia);
  const inScadenza = matchResults.filter((r) => r.status === "in_scadenza" || (r.status === "ritardo" && r.giorniRitardo < soglia));
  const estrattiOrfani = estrattiEntrata.filter(
    (e) => !matched.some((m) => m.estratto?.id === e.id)
  );

  const totAtteso = titoliAttesa.reduce((s, t: any) => s + (t.premio_lordo || 0), 0);
  const totMatchato = matched.reduce((s, m) => s + (m.estratto?.importo || 0), 0);
  const percCopertura = totAtteso > 0 ? Math.round((totMatchato / totAtteso) * 100) : 0;

  // Segna come incassato
  const segnaIncassatoMut = useMutation({
    mutationFn: async ({ titoloId, importo, estrattoId }: { titoloId: string; importo: number; estrattoId?: string }) => {
      const { error } = await supabase
        .from("titoli")
        .update({
          stato: "incassato",
          importo_incassato: importo,
          data_incasso: new Date().toISOString().split("T")[0],
        })
        .eq("id", titoloId);
      if (error) throw error;

      // Mark estratto as matched
      if (estrattoId) {
        await supabase.from("estratti_conto").update({ stato: "ok" }).eq("id", estrattoId);
      }
    },
    onSuccess: () => {
      toast.success("Titolo segnato come incassato");
      qc.invalidateQueries({ queryKey: ["quadratura_titoli_attesa"] });
      qc.invalidateQueries({ queryKey: ["quadratura_estratti_entrata"] });
    },
    onError: (e: any) => {
      toast.error("Errore");
    },
  });

  // Filter results
  const filtered = matchResults.filter((r) => {
    if (filtroStato === "matched" && r.status !== "matched") return false;
    if (filtroStato === "ritardo" && !(r.status === "ritardo" && r.giorniRitardo >= soglia)) return false;
    if (filtroStato === "no_match" && r.status === "matched") return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        r.titolo.numero_titolo?.toLowerCase().includes(s) ||
        r.titolo.prodotti?.nome_prodotto?.toLowerCase().includes(s) ||
        r.titolo.prodotti?.compagnie?.nome?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Export CSV
  const exportCSV = () => {
    const BOM = "\uFEFF";
    const header = "Titolo;Prodotto;Agenzia;Premio Atteso;Scadenza;Gg Ritardo;Match Importo;Match Data;Score\n";
    const rows = matchResults
      .map((r) => {
        const prod = r.titolo.prodotti?.nome_prodotto || "";
        const comp = r.titolo.prodotti?.compagnie?.nome || "";
        return `${r.titolo.numero_titolo || ""};${prod};${comp};${r.titolo.premio_lordo || 0};${r.titolo.data_scadenza || ""};${r.giorniRitardo};${r.estratto?.importo || ""};${r.estratto?.data_operazione || ""};${r.score}`;
      })
      .join("\n");
    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quadratura_premi_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quadratura Premi</h1>
          <p className="text-sm text-muted-foreground">
            Incrocio automatico tra premi attesi e movimenti bancari
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Titoli in Attesa</CardDescription>
            <CardTitle className="text-xl">{titoliAttesa.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{fmt(totAtteso)} attesi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <CheckCircle className="w-3.5 h-3.5" /> Con Match
            </CardDescription>
            <CardTitle className="text-xl text-green-600">{matched.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{fmt(totMatchato)} trovati</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs">
              <ShieldAlert className="w-3.5 h-3.5" /> In Ritardo (&gt;{soglia}gg)
            </CardDescription>
            <CardTitle className="text-xl text-destructive">{inRitardo.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {fmt(inRitardo.reduce((s, r) => s + (r.titolo.premio_lordo || 0), 0))} non pervenuti
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">In Scadenza</CardDescription>
            <CardTitle className="text-xl">{inScadenza.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">entro soglia</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Mov. Bancari Orfani</CardDescription>
            <CardTitle className="text-xl">{estrattiOrfani.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">senza titolo associato</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress copertura */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Copertura Premi</CardTitle>
            <span className="text-sm font-mono text-muted-foreground">
              {fmt(totMatchato)} / {fmt(totAtteso)} ({percCopertura}%)
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percCopertura} className="h-2.5" />
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca titolo, prodotto, agenzia..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="matched">Con match</SelectItem>
            <SelectItem value="ritardo">In ritardo</SelectItem>
            <SelectItem value="no_match">Senza match</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Soglia gg:</span>
          <Input
            type="number"
            value={giorniSoglia}
            onChange={(e) => setGiorniSoglia(e.target.value)}
            className="w-16 h-9"
            min={1}
            max={90}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="titoli">
        <TabsList>
          <TabsTrigger value="titoli">Titoli ({filtered.length})</TabsTrigger>
          <TabsTrigger value="orfani">Mov. Orfani ({estrattiOrfani.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="titoli" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <p className="text-muted-foreground py-8 text-center">Caricamento...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Prodotto / Agenzia</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead className="text-right">Premio Atteso</TableHead>
                      <TableHead>Ritardo</TableHead>
                      <TableHead>Match Bancario</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((r) => (
                      <TableRow key={r.titolo.id} className={r.giorniRitardo > parseInt(giorniSoglia) ? "bg-destructive/5" : r.status === "matched" ? "bg-green-50/50 dark:bg-green-950/10" : ""}>
                        <TableCell className="font-medium font-mono text-sm">
                          {r.titolo.numero_titolo || r.titolo.id?.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{r.titolo.prodotti?.nome_prodotto || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.titolo.prodotti?.compagnie?.nome || ""}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.titolo.data_scadenza || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(r.titolo.premio_lordo || 0)}</TableCell>
                        <TableCell>
                          {r.giorniRitardo > 0 ? (
                            <Badge variant={r.giorniRitardo > parseInt(giorniSoglia) ? "destructive" : "secondary"} className="text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />{r.giorniRitardo}gg
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.estratto ? (
                            <div className="space-y-0.5">
                              <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">
                                <ArrowRightLeft className="w-3 h-3 mr-1" />
                                {fmt(r.estratto.importo)} • {r.estratto.data_operazione}
                              </Badge>
                              {Math.abs(r.differenza) > 0.01 && (
                                <div className="text-[10px] text-amber-600 font-mono">Δ {fmt(r.differenza)}</div>
                              )}
                              <div className="text-[10px] text-muted-foreground">Score: {r.score}%</div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              <XCircle className="w-3 h-3 mr-1" /> Nessun match
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.estratto && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              disabled={segnaIncassatoMut.isPending}
                              onClick={() =>
                                segnaIncassatoMut.mutate({
                                  titoloId: r.titolo.id,
                                  importo: r.estratto.importo,
                                  estrattoId: r.estratto.id,
                                })
                              }
                            >
                              <Link2 className="w-3 h-3 mr-1" /> Incassa
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nessun titolo trovato
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">Mostrati 50 di {filtered.length} risultati</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orfani" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimenti Bancari senza Titolo Associato</CardTitle>
              <CardDescription>Entrate bancarie recenti che non corrispondono a nessun premio atteso</CardDescription>
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
                  {estrattiOrfani.slice(0, 30).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.data_operazione}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{e.descrizione || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{fmt(e.importo)}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{e.stato}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {estrattiOrfani.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Tutti i movimenti sono stati associati
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuadraturePremi;
