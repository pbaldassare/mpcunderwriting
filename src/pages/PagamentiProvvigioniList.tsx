import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/usePagination";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, FileText, DollarSign, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro } from "@/lib/formatCurrency";
import { ProvvigioniKpiCard } from "@/components/provvigioni/ProvvigioniKpiCard";
import { ProvvigioniBarChart, ProvvigioniPieChart } from "@/components/provvigioni/ProvvigioniCharts";
import { KpiCardSkeleton, ChartSkeleton, TableRowsSkeleton } from "@/components/provvigioni/ProvvigioniSkeletons";

// PAGE_SIZE gestita da usePagination (default 25)

const PagamentiProvvigioniList = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [periodoDa, setPeriodoDa] = useState("");
  const [periodoA, setPeriodoA] = useState("");
  const [metodo, setMetodo] = useState("bonifico");
  const [riferimento, setRiferimento] = useState("");
  const [note, setNote] = useState("");
  const [selectedProvvigioni, setSelectedProvvigioni] = useState<string[]>([]);
  const [filterBeneficiario, setFilterBeneficiario] = useState<string>("");
  const [filterMetodo, setFilterMetodo] = useState<string>("");
  const [filterDa, setFilterDa] = useState<string>("");
  const [filterA, setFilterA] = useState<string>("");
  

  // Fetch distinte
  const { data: distinte = [], isLoading } = useQuery({
    queryKey: ["pagamenti_provvigioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamenti_provvigioni")
        .select("*, pagato_a:profiles!pagamenti_provvigioni_pagato_a_user_id_fkey(nome, cognome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filtri + paginazione (sollevati al top per l'hook usePagination)
  const filteredDistinte = useMemo(() => {
    return (distinte).filter((d: any) => {
      if (filterBeneficiario && d.pagato_a_user_id !== filterBeneficiario) return false;
      if (filterMetodo && d.metodo !== filterMetodo) return false;
      if (filterDa && d.created_at < filterDa) return false;
      if (filterA && d.created_at > filterA + "T23:59:59") return false;
      return true;
    });
  }, [distinte, filterBeneficiario, filterMetodo, filterDa, filterA]);

  const { page: safePage, setPage, pages, pageRows, resetPage } = usePagination(filteredDistinte);

  // Fetch users with unpaid commissions
  const { data: utenti = [], isLoading: utentiLoading } = useQuery({
    queryKey: ["utenti_provvigioni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cognome")
        .eq("attivo", true)
        .order("cognome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch unpaid commissions for selected user + period
  const { data: provvigioniNonPagate = [] } = useQuery({
    queryKey: ["provvigioni_non_pagate", selectedUser, periodoDa, periodoA],
    enabled: !!selectedUser && !!periodoDa && !!periodoA,
    queryFn: async () => {
      let q = supabase
        .from("provvigioni_generate")
        .select("*, titolo:titoli(numero_titolo, premio_lordo, data_incasso, prodotto:prodotti(nome_prodotto))")
        .eq("user_id", selectedUser)
        .eq("pagata", false);
      if (periodoDa) q = q.gte("calcolata_il", periodoDa);
      if (periodoA) q = q.lte("calcolata_il", periodoA + "T23:59:59");
      const { data, error } = await q.order("calcolata_il", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createDistinta = useMutation({
    mutationFn: async () => {
      if (selectedProvvigioni.length === 0) throw new Error("Seleziona almeno una provvigione");
      const righeSelezionate = provvigioniNonPagate.filter((p: any) => selectedProvvigioni.includes(p.id));
      const totale = righeSelezionate.reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Get user's ufficio
      const { data: profile } = await supabase.from("profiles").select("ufficio_id").eq("id", selectedUser).single();

      const { data: distinta, error: e1 } = await supabase
        .from("pagamenti_provvigioni")
        .insert({
          pagato_a_user_id: selectedUser,
          ufficio_id: profile?.ufficio_id || null,
          periodo_da: periodoDa,
          periodo_a: periodoA,
          totale_importo: totale,
          metodo,
          riferimento: riferimento || null,
          note: note || null,
          creato_da: user.id,
        })
        .select()
        .single();
      if (e1) throw e1;

      // Insert rows
      const righe = righeSelezionate.map((p: any) => ({
        pagamento_id: distinta.id,
        provvigione_id: p.id,
        importo: p.importo_provvigione || 0,
      }));
      const { error: e2 } = await supabase.from("pagamenti_provvigioni_righe").insert(righe);
      if (e2) throw e2;

      // Mark as paid
      const { error: e3 } = await supabase
        .from("provvigioni_generate")
        .update({ pagata: true })
        .in("id", selectedProvvigioni);
      if (e3) throw e3;

      await logAttivita({
        azione: "creazione_distinta_provvigioni",
        entita_tipo: "pagamenti_provvigioni",
        entita_id: distinta.id,
        dettagli_json: { righe: selectedProvvigioni.length, totale },
      });

      return distinta;
    },
    onSuccess: (distinta) => {
      toast.success("Distinta creata con successo");
      queryClient.invalidateQueries({ queryKey: ["pagamenti_provvigioni"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni_non_pagate"] });
      setDialogOpen(false);
      resetForm();
      navigate(`/pagamenti-provvigioni/${distinta.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setSelectedUser("");
    setPeriodoDa("");
    setPeriodoA("");
    setMetodo("bonifico");
    setRiferimento("");
    setNote("");
    setSelectedProvvigioni([]);
  };

  const toggleAll = () => {
    if (selectedProvvigioni.length === provvigioniNonPagate.length) {
      setSelectedProvvigioni([]);
    } else {
      setSelectedProvvigioni(provvigioniNonPagate.map((p: any) => p.id));
    }
  };

  const totaleSelezionato = provvigioniNonPagate
    .filter((p: any) => selectedProvvigioni.includes(p.id))
    .reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

  const totaleDistinte = distinte.reduce((s: number, d: any) => s + (d.totale_importo || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagamenti Provvigioni</h1>
          <p className="text-muted-foreground text-sm">Gestione distinte pagamento provvigioni</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Distinta</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crea Distinta Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Utente</Label>
                  <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setSelectedProvvigioni([]); }}>
                    <SelectTrigger><SelectValue placeholder="Seleziona utente" /></SelectTrigger>
                    <SelectContent>
                      {utenti.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Metodo</Label>
                  <Select value={metodo} onValueChange={setMetodo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bonifico">Bonifico</SelectItem>
                      <SelectItem value="contanti">Contanti</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Periodo Da</Label>
                  <Input type="date" value={periodoDa} onChange={(e) => setPeriodoDa(e.target.value)} />
                </div>
                <div>
                  <Label>Periodo A</Label>
                  <Input type="date" value={periodoA} onChange={(e) => setPeriodoA(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Riferimento (CRO/TRN)</Label>
                  <Input value={riferimento} onChange={(e) => setRiferimento(e.target.value)} placeholder="Opzionale" />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
                </div>
              </div>

              {selectedUser && periodoDa && periodoA && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Provvigioni non pagate ({provvigioniNonPagate.length})</h3>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Totale selezionato: {fmtEuro(totaleSelezionato)}</span>
                      <Button variant="outline" size="sm" onClick={toggleAll}>
                        {selectedProvvigioni.length === provvigioniNonPagate.length ? "Deseleziona tutte" : "Seleziona tutte"}
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Titolo</TableHead>
                          <TableHead>Prodotto</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead className="text-right">Importo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {provvigioniNonPagate.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedProvvigioni.includes(p.id)}
                                onCheckedChange={(c) =>
                                  setSelectedProvvigioni(c ? [...selectedProvvigioni, p.id] : selectedProvvigioni.filter((x) => x !== p.id))
                                }
                              />
                            </TableCell>
                            <TableCell>{p.titolo?.numero_titolo || "-"}</TableCell>
                            <TableCell>{p.titolo?.prodotto?.nome_prodotto || "-"}</TableCell>
                            <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy") : "-"}</TableCell>
                            <TableCell className="text-right">{p.percentuale}%</TableCell>
                            <TableCell className="text-right tabular-nums font-medium font-sans">{fmtEuro(p.importo_provvigione)}</TableCell>
                          </TableRow>
                        ))}
                        {provvigioniNonPagate.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessuna provvigione non pagata nel periodo</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button onClick={() => createDistinta.mutate()} disabled={selectedProvvigioni.length === 0 || createDistinta.isPending}>
                  {createDistinta.isPending ? "Creazione..." : `Crea Distinta (${fmtEuro(totaleSelezionato)})`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtri */}
      <div className="rounded-lg border bg-card p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Da</Label>
          <Input type="date" value={filterDa} onChange={(e) => { setFilterDa(e.target.value); resetPage(); }} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">A</Label>
          <Input type="date" value={filterA} onChange={(e) => { setFilterA(e.target.value); resetPage(); }} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Beneficiario</Label>
          <Select value={filterBeneficiario || "__all__"} onValueChange={(v) => { setFilterBeneficiario(v === "__all__" ? "" : v); resetPage(); }} disabled={utentiLoading}>
            <SelectTrigger className="h-9 w-[200px]">
              {utentiLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground/70"><Loader2 className="h-4 w-4 animate-spin" /> Caricamento...</span>
              ) : (
                <SelectValue placeholder="Tutti" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {utenti.map((u: any) => (
                <SelectItem key={u.id} value={u.id}>{u.cognome} {u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Metodo</Label>
          <Select value={filterMetodo || "__all__"} onValueChange={(v) => { setFilterMetodo(v === "__all__" ? "" : v); resetPage(); }}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Tutti" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              <SelectItem value="bonifico">Bonifico</SelectItem>
              <SelectItem value="contanti">Contanti</SelectItem>
              <SelectItem value="altro">Altro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(filterDa || filterA || filterBeneficiario || filterMetodo) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setFilterDa(""); setFilterA(""); setFilterBeneficiario(""); setFilterMetodo(""); resetPage(); }}>Reset</Button>
        )}
      </div>

      {(() => {
        // filteredDistinte / paginazione gestiti dall'hook usePagination al top del componente
        const totFiltered = filteredDistinte.reduce((s: number, d: any) => s + (d.totale_importo || 0), 0);

        // Aggregations for charts (on full filtered set, not paginated)
        const byMese = new Map<string, number>();
        const byMetodo = new Map<string, number>();
        for (const d of filteredDistinte) {
          const k = (d.created_at || "").slice(0, 7);
          if (k) byMese.set(k, (byMese.get(k) || 0) + (d.totale_importo || 0));
          const m = d.metodo || "altro";
          byMetodo.set(m, (byMetodo.get(m) || 0) + (d.totale_importo || 0));
        }
        const trendData = [...byMese.entries()].sort().map(([k, v]) => ({
          mese: format(new Date(k + "-01"), "MMM yy", { locale: it }),
          name: format(new Date(k + "-01"), "MMM yy", { locale: it }),
          value: v,
        }));
        const metodoData = [...byMetodo.entries()].map(([name, value]) => ({ name, value }));

        if (isLoading) {
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartSkeleton /><ChartSkeleton />
              </div>
              <Card><CardContent className="p-0"><TableRowsSkeleton rows={8} cellTypes={["short","text","text","badge","short","num"]} /></CardContent></Card>
            </>
          );
        }

        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ProvvigioniKpiCard icon={FileText} label="Distinte" value={String(filteredDistinte.length)} />
              <ProvvigioniKpiCard icon={DollarSign} label="Totale Pagato" value={fmtEuro(totFiltered)} accent="primary" />
              <ProvvigioniKpiCard icon={Users} label="Beneficiari" value={String(new Set(filteredDistinte.map((d: any) => d.pagato_a_user_id)).size)} />
              <ProvvigioniKpiCard icon={DollarSign} label="Importo medio" value={fmtEuro(filteredDistinte.length ? totFiltered / filteredDistinte.length : 0)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProvvigioniBarChart title="Pagamenti per mese" data={trendData} />
              <ProvvigioniPieChart title="Per Metodo" data={metodoData} />
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Beneficiario</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Riferimento</TableHead>
                      <TableHead className="text-right">Importo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((d: any, i: number) => (
                      <TableRow
                        key={d.id}
                        className={`cursor-pointer hover:bg-muted/50 ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                        onClick={() => navigate(`/pagamenti-provvigioni/${d.id}`)}
                      >
                        <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{d.pagato_a?.cognome} {d.pagato_a?.nome}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(d.periodo_da), "dd/MM/yy")} - {format(new Date(d.periodo_a), "dd/MM/yy")}
                        </TableCell>
                        <TableCell><Badge variant="outline">{d.metodo}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.riferimento || "-"}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold font-sans">{fmtEuro(d.totale_importo)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredDistinte.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessuna distinta per i filtri selezionati</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {pages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t">
                    <span className="text-xs text-muted-foreground">Pagina {safePage + 1} di {pages} · {filteredDistinte.length} distinte</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prec</Button>
                      <Button size="sm" variant="outline" disabled={safePage + 1 >= pages} onClick={() => setPage(p => p + 1)}>Succ</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
};

export default PagamentiProvvigioniList;
