import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Wallet, Plus, RefreshCw, Search, Trash2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAnticipiGlobale, type StatoFiltro } from "@/hooks/useAnticipiGlobale";
import { useEliminaAnticipo, statoAnticipo } from "@/hooks/useAnticipiCliente";
import NuovoAnticipoDialog from "@/components/clienti/NuovoAnticipoDialog";
import AnticipoUtilizziDrawer from "@/components/clienti/AnticipoUtilizziDrawer";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { fmtEuro } from "@/lib/formatCurrency";

const fmtDate = (s: string | null) => {
  if (!s) return "—";
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return s; }
};

const STATI: { value: StatoFiltro; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "disponibili", label: "Disponibili" },
  { value: "parziali", label: "Parziali" },
  { value: "esauriti", label: "Esauriti" },
];

export default function RiepilogoAnticipiPage() {
  const navigate = useNavigate();

  const [ufficioId, setUfficioId] = useState<string | null>(null);
  const [contoId, setContoId] = useState<string | null>(null);
  const [stato, setStato] = useState<StatoFiltro>("tutti");
  const [dataDa, setDataDa] = useState<Date | null>(null);
  const [dataAl, setDataAl] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [searchDeb, setSearchDeb] = useState("");
  const [openNuovo, setOpenNuovo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setSearchDeb(search), 350);
    return () => clearTimeout(h);
  }, [search]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["lookup-uffici-anticipi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data.map((u) => ({ value: u.id, label: u.nome_ufficio }));
    },
  });

  const { data: rows = [], isLoading, refetch, isFetching } = useAnticipiGlobale({
    ufficioId,
    contoId,
    stato,
    dataDa: dataDa ? format(dataDa, "yyyy-MM-dd") : null,
    dataAl: dataAl ? format(dataAl, "yyyy-MM-dd") : null,
    search: searchDeb,
  });

  const elimina = useEliminaAnticipo("");

  const kpi = useMemo(() => {
    const crediti = rows.filter((r) => r.segno !== "-");
    const totDisp = crediti
      .filter((r) => !r.rimborsato_il && Number(r.importo_residuo || 0) > 0)
      .reduce((s, r) => s + Number(r.importo_residuo || 0), 0);
    const totVers = crediti.reduce((s, r) => s + Number(r.importo || 0), 0);
    const attivi = crediti.filter((r) => !r.rimborsato_il && r.importo_residuo > 0).length;
    return { totDisp, totVers, attivi };
  }, [rows]);

  const handleReset = () => {
    setUfficioId(null); setContoId(null); setStato("tutti");
    setDataDa(null); setDataAl(null); setSearch("");
  };

  const labelCliente = (c: any) => {
    if (!c) return "—";
    if (c.tipo_cliente === "azienda" || c.tipo_cliente === "ente") return c.ragione_sociale || "—";
    return `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
  };

  const StatoBadge = ({ r }: { r: any }) => {
    if (r.segno === "-") return <Badge variant="outline" className="border-red-300 text-red-700">Debito</Badge>;
    const s = statoAnticipo(r);
    if (s === "rimborsato") return <Badge className="bg-slate-600 hover:bg-slate-700">Rimborsato</Badge>;
    if (s === "disponibile") return <Badge className="bg-green-600 hover:bg-green-700">Disponibile</Badge>;
    if (s === "parziale") return <Badge className="bg-amber-500 hover:bg-amber-600">Parziale</Badge>;
    return <Badge variant="secondary">Esaurito</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" /> Acconti
            </h1>
            <p className="text-sm text-muted-foreground">
              Partite cliente collegate a causale contabile — credito utilizzabile in messa a cassa
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Aggiorna
          </Button>
          <Button onClick={() => setOpenNuovo(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuovo
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2"><CardDescription>Totale Disponibile</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold text-primary">{fmtEuro(kpi.totDisp)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Totale Versato (filtri attivi)</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold">{fmtEuro(kpi.totVers)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Partite attive (credito)</CardDescription></CardHeader>
          <CardContent className="text-2xl font-semibold">{kpi.attivi}</CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filtri di ricerca</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-xs">Sede</Label>
            <FilterSearchableSelect
              value={ufficioId || ""}
              onValueChange={(v) => setUfficioId(v || null)}
              options={uffici}
              placeholder="Tutte le sedi"
              allLabel="Tutte le sedi"
            />
          </div>
          <div>
            <Label className="text-xs">Conto Bancario</Label>
            <ContoBancarioSelect
              value={contoId}
              onChange={setContoId}
              tipi={["incasso_clienti", "generico"]}
              placeholder="Tutti i conti"
              showPreview={false}
            />
          </div>
          <div>
            <Label className="text-xs">Stato</Label>
            <FilterSearchableSelect
              value={stato}
              onValueChange={(v) => setStato((v as StatoFiltro) || "tutti")}
              options={STATI}
              placeholder="Tutti"
              allLabel="Tutti"
            />
          </div>
          <div>
            <Label className="text-xs">Versato da</Label>
            <DatePicker value={dataDa} onChange={setDataDa} placeholder="Da..." />
          </div>
          <div>
            <Label className="text-xs">Versato al</Label>
            <DatePicker value={dataAl} onChange={setDataAl} placeholder="Al..." />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs">Cerca</Label>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente o note..."
              />
            </div>
          </div>
          <div className="md:col-span-3 lg:col-span-6 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleReset}>Reset filtri</Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabella */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Partite ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Caricamento...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed rounded-md">
              Nessuna partita trovata con i filtri correnti
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Causale</TableHead>
                  <TableHead>Segno</TableHead>
                  <TableHead>Conto</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead className="text-right">Residuo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="max-w-[200px]">Note</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <TableCell className="text-sm">{fmtDate(r.data_anticipo)}</TableCell>
                    <TableCell
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.cliente?.id) navigate(`/clienti/${r.cliente.id}`);
                      }}
                    >
                      {labelCliente(r.cliente)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs">{r.causale?.codice || "—"}</span>
                    </TableCell>
                    <TableCell className={`text-sm font-mono font-bold ${r.segno === "-" ? "text-red-600" : "text-green-600"}`}>
                      {r.segno || "+"}
                    </TableCell>
                    <TableCell className="text-sm">{r.conto?.etichetta || "—"}</TableCell>
                    <TableCell className="text-sm text-right">{fmtEuro(r.importo)}</TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {r.segno === "-" ? "—" : fmtEuro(r.importo_residuo)}
                    </TableCell>
                    <TableCell><StatoBadge r={r} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{r.note || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(r.segno === "-" || r.importo_residuo === r.importo) && !r.rimborsato_il && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            if (confirm("Eliminare questa partita?")) elimina.mutate(r.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NuovoAnticipoDialog open={openNuovo} onOpenChange={setOpenNuovo} />
      <AnticipoUtilizziDrawer anticipoId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
