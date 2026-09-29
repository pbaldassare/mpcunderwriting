import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Send, Filter, RotateCcw, ChevronDown, ChevronRight, CreditCard, Building2, Undo2, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Filters {
  compagnia_id: string | null;
  periodo_dal: Date | null;
  periodo_al: Date | null;
}

const defaultFilters: Filters = { compagnia_id: null, periodo_dal: null, periodo_al: null };

const StoricoRimessePage = () => {
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [annullaTarget, setAnnullaTarget] = useState<any>(null);
  const pageSize = 25;
  const set = (partial: Partial<Filters>) => { setFilters((f) => ({ ...f, ...partial })); setPage(0); };
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie-storico-rimesse"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["storico-rimesse", filters, page],
    queryFn: async () => {
      let query = supabase
        .from("rimessa_premi")
        .select("*, agenzie(nome, codice), conti_bancari!conto_bancario_mittente_id(etichetta, banca, iban, intestato_a)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters.compagnia_id) query = query.eq("compagnia_id", filters.compagnia_id);
      if (filters.periodo_dal) query = query.gte("data_pagamento_rimessa", format(filters.periodo_dal, "yyyy-MM-dd"));
      if (filters.periodo_al) query = query.lte("data_pagamento_rimessa", format(filters.periodo_al, "yyyy-MM-dd"));

      const { data: rimesse, error, count } = await query;
      if (error) throw error;
      return { rimesse: rimesse || [], count: count || 0 };
    },
  });

  const { data: dettagliMap } = useQuery({
    queryKey: ["storico-rimesse-dettagli", data?.rimesse?.map((r: any) => r.id)],
    enabled: !!data?.rimesse?.length && expandedRows.size > 0,
    queryFn: async () => {
      const ids = Array.from(expandedRows);
      const { data: dettagli } = await supabase
        .from("rimessa_dettaglio")
        .select("*, titoli(numero_titolo, premio_lordo, importo_incassato)")
        .in("rimessa_id", ids);
      const map: Record<string, any[]> = {};
      for (const d of dettagli || []) {
        if (!map[d.rimessa_id]) map[d.rimessa_id] = [];
        map[d.rimessa_id].push(d);
      }
      return map;
    },
  });

  const annullaMutation = useMutation({
    mutationFn: async (rimessa_id: string) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "annulla", rimessa_id, created_by: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storico-rimesse"] });
      queryClient.invalidateQueries({ queryKey: ["storico-rimesse-dettagli"] });
      toast.success("Rimessa annullata. I titoli sono di nuovo disponibili.");
      setAnnullaTarget(null);
    },
    onError: (err: any) => { toast.error(err.message || "Errore nell'annullamento"); setAnnullaTarget(null); },
  });

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rimesse = data?.rimesse || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const hasFilters = filters.compagnia_id || filters.periodo_dal || filters.periodo_al;

  const totPagato = rimesse.reduce((s: number, r: any) => s + (Number(r.importo_pagato) || 0), 0);
  const totImporti = rimesse.reduce((s: number, r: any) => s + (Number(r.totale_importi) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Send className="w-5 h-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Storico Rimesse Agenzie</h1>
          <p className="text-sm text-muted-foreground">Elenco di tutti i pagamenti alle agenzie</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"><CreditCard className="w-5 h-5" /></div>
          <div><p className="text-xs text-muted-foreground">N. Rimesse</p><p className="text-lg font-bold">{totalCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400"><Building2 className="w-5 h-5" /></div>
          <div><p className="text-xs text-muted-foreground">Totale Importi</p><p className="text-lg font-bold">{isLoading ? "..." : fmt(totImporti)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400"><Send className="w-5 h-5" /></div>
          <div><p className="text-xs text-muted-foreground">Totale Pagato</p><p className="text-lg font-bold">{isLoading ? "..." : fmt(totPagato)}</p></div>
        </CardContent></Card>
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}><RotateCcw className="h-3 w-3 mr-1" /> Azzera</Button>}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <FilterSearchableSelect value={filters.compagnia_id} onValueChange={(v) => set({ compagnia_id: v })} options={(compagnie || []).map((c) => ({ value: c.id, label: c.nome }))} placeholder="Agenzia" allLabel="Tutte le agenzie" className="w-[240px]" />
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Dal</Label><DatePicker value={filters.periodo_dal} onChange={(d) => set({ periodo_dal: d })} placeholder="Dal" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Al</Label><DatePicker value={filters.periodo_al} onChange={(d) => set({ periodo_al: d })} placeholder="Al" /></div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Agenzia</TableHead>
            <TableHead>Data Pagamento</TableHead>
            <TableHead>Conto Mittente</TableHead>
            <TableHead>IBAN Destinazione</TableHead>
            <TableHead className="text-right">Totale</TableHead>
            <TableHead className="text-right">Pagato</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Note</TableHead>
            <TableHead className="w-[110px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rimesse.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nessuna rimessa trovata</TableCell></TableRow>
            ) : rimesse.map((r: any) => {
              const isExpanded = expandedRows.has(r.id);
              const dettagli = dettagliMap?.[r.id] || [];
              const isParziale = Number(r.importo_pagato) < Number(r.totale_importi);
              const isAnnullata = r.stato === "annullata";
              const conto = r.conti_bancari;
              return (
                <>
                  <TableRow key={r.id} className={cn("cursor-pointer", isAnnullata && "opacity-60")} onClick={() => toggleExpand(r.id)}>
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-medium">{r.compagnie?.nome || "N/D"}</TableCell>
                    <TableCell>{r.data_pagamento_rimessa ? format(new Date(r.data_pagamento_rimessa), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {conto ? (
                        <div>
                          <div className="font-medium">{conto.etichetta}</div>
                          {conto.banca && <div className="text-muted-foreground">{conto.banca}</div>}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.iban_utilizzato || "—"}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.totale_importi) || 0)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", isParziale ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400")}>
                      {fmt(Number(r.importo_pagato) || 0)}
                    </TableCell>
                    <TableCell>
                      {isAnnullata ? (
                        <Badge variant="destructive">Annullata</Badge>
                      ) : (
                        <Badge variant={r.stato === "pagata" ? "default" : "secondary"} className={cn(isParziale && "bg-amber-500")}>
                          {isParziale ? "Parziale" : r.stato || "bozza"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.note || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {r.pdf_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(r.pdf_url, "_blank")}
                            title="Scarica PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                        {!isAnnullata && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setAnnullaTarget(r)}
                            title="Annulla rimessa"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${r.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell></TableCell>
                      <TableCell colSpan={9}>
                        <div className="py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">{dettagli.length} titoli inclusi</p>
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-8 text-xs">N. Titolo</TableHead>
                                <TableHead className="h-8 text-xs text-right">Premio Lordo</TableHead>
                                <TableHead className="h-8 text-xs text-right">Importo Incassato</TableHead>
                                <TableHead className="h-8 text-xs text-right">Importo Rimessa</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dettagli.map((d: any) => (
                                <TableRow key={d.id} className="hover:bg-muted/50">
                                  <TableCell className="py-1 text-sm">{d.titoli?.numero_titolo || "—"}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(Number(d.titoli?.premio_lordo) || 0)}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(Number(d.titoli?.importo_incassato) || 0)}</TableCell>
                                  <TableCell className="py-1 text-sm text-right">{fmt(Number(d.importo) || 0)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Pagina {page + 1} di {totalPages} ({totalCount} rimesse)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Precedente</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Successiva</Button>
          </div>
        </div>
      )}

      {/* AlertDialog annullamento */}
      <AlertDialog open={!!annullaTarget} onOpenChange={(open) => !open && setAnnullaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare questa rimessa?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per annullare la rimessa per <strong>{annullaTarget?.compagnie?.nome}</strong> di{" "}
              <strong>{annullaTarget ? fmt(Number(annullaTarget.totale_importi) || 0) : ""}</strong>.
              <br /><br />
              I titoli inclusi torneranno disponibili per una nuova rimessa in E/C Agenzie. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => annullaTarget && annullaMutation.mutate(annullaTarget.id)}
              disabled={annullaMutation.isPending}
            >
              {annullaMutation.isPending ? "Annullamento..." : "Conferma Annullamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoricoRimessePage;
