import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

import { TrendingUp, Users, CreditCard, Briefcase, Receipt, Coins, Check, FileText } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro } from "@/lib/formatCurrency";
import { usePagination } from "@/hooks/usePagination";
import { ProvvigioniKpiCard } from "@/components/provvigioni/ProvvigioniKpiCard";
import { ProvvigioniFiltersBar, defaultFilters, ProvvigioniFilters } from "@/components/provvigioni/ProvvigioniFiltersBar";
import { ProvvigioniBarChart, ProvvigioniLineChart, ProvvigioniPieChart } from "@/components/provvigioni/ProvvigioniCharts";
import { KpiCardSkeleton, ChartSkeleton, TableRowsSkeleton } from "@/components/provvigioni/ProvvigioniSkeletons";
import { useProduttoriLookup } from "@/hooks/useProduttoriLookup";

const pagatoSchema = z.object({
  dataPagamento: z.date({
    required_error: "La data di pagamento è obbligatoria",
  }),
  metodo: z.string().min(1, "Il metodo di pagamento è obbligatorio"),
  note: z.string().optional(),
});

type PagatoFormValues = z.infer<typeof pagatoSchema>;

const tipoBadge = (tipo: string | null) => {
  switch (tipo) {
    case "commerciale": return <Badge className="bg-blue-100 text-blue-800 border-blue-300" variant="outline">Produttore</Badge>;
    case "ae": return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300" variant="outline">Account Executive</Badge>;
    case "admin": return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">Consulbrokers SPA</Badge>;
    case "sede": return <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">Sede</Badge>;
    case "consul": return <Badge className="bg-amber-100 text-amber-800 border-amber-300" variant="outline">Consul (legacy)</Badge>;
    default: return <Badge variant="outline">—</Badge>;
  }
};


// PAGE_SIZE gestita da usePagination (default 25)

const ProvvigioniMaturatePage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProvvigioniFilters>(defaultFilters());
  
  // Stati per azioni bulk
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalePagamentoOpen, setModalePagamentoOpen] = useState(false);
  const [generandoDistinta, setGenerandoDistinta] = useState(false);

  // Form per modale pagamento
  const form = useForm<PagatoFormValues>({
    resolver: zodResolver(pagatoSchema),
    defaultValues: {
      dataPagamento: new Date(),
      metodo: "bonifico",
      note: "",
    },
  });
  

  // Lookups
  const { data: rami = [], isLoading: lkRami } = useQuery({
    queryKey: ["lookup-rami"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });
  const { data: produttori = [], isLoading: lkProd } = useProduttoriLookup();
  

  const { data: provvigioni = [], isLoading } = useQuery({
    queryKey: ["provvigioni-maturate", filters],
    queryFn: async () => {
      let q = supabase
        .from("provvigioni_generate")
        .select(`
          id, percentuale, importo_provvigione, calcolata_il, pagata, tipo_destinatario, solo_statistico, user_id,
          titoli!inner(
            id, numero_titolo, premio_lordo, data_messa_cassa, stato, produttore_nome, ramo_id, compagnia_id, cliente_id, anagrafica_commerciale_id,
            compagnie!titoli_compagnia_id_fkey(nome),
            rami!titoli_ramo_id_fkey(codice, descrizione),
            clienti:clienti!titoli_cliente_anagrafica_id_fkey(id, nome, cognome, ragione_sociale),
            anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, nome, cognome, ragione_sociale)
          ),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .eq("solo_statistico", false)
        .gte("titoli.data_messa_cassa", filters.da)
        .lte("titoli.data_messa_cassa", filters.a);
      if (filters.ramoId) q = q.eq("titoli.ramo_id", filters.ramoId);
      if (filters.produttoreId) q = q.eq("titoli.anagrafica_commerciale_id", filters.produttoreId);
      if (filters.tipoDestinatario) q = q.eq("tipo_destinatario", filters.tipoDestinatario);
      const { data } = await q.order("calcolata_il", { ascending: false }).limit(1000);
      return data || [];
    },
  });

  // Trend 12 mesi (independent)
  const { data: trend12 = [] } = useQuery({
    queryKey: ["provvigioni-maturate-trend", filters.produttoreId, filters.ramoId, filters.tipoDestinatario],
    queryFn: async () => {
      const da = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      let q = supabase
        .from("provvigioni_generate")
        .select("importo_provvigione, titoli!inner(data_messa_cassa, ramo_id, anagrafica_commerciale_id), tipo_destinatario, user_id")
        .eq("solo_statistico", false)
        .gte("titoli.data_messa_cassa", da);
      if (filters.ramoId) q = q.eq("titoli.ramo_id", filters.ramoId);
      if (filters.produttoreId) q = q.eq("titoli.anagrafica_commerciale_id", filters.produttoreId);
      if (filters.tipoDestinatario) q = q.eq("tipo_destinatario", filters.tipoDestinatario);
      const { data } = await q.limit(5000);
      const buckets = new Map<string, number>();
      for (const p of (data) || []) {
        const d = p.titoli?.data_messa_cassa;
        if (!d) continue;
        const k = d.slice(0, 7);
        buckets.set(k, (buckets.get(k) || 0) + (p.importo_provvigione || 0));
      }
      return [...buckets.entries()].sort().map(([mese, value]) => ({
        mese: format(new Date(mese + "-01"), "MMM yy", { locale: it }),
        value,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!filters.search.trim()) return provvigioni;
    const s = filters.search.toLowerCase();
    return provvigioni.filter((p: any) => {
      const cli = (p.titoli?.clienti?.ragione_sociale || `${p.titoli?.clienti?.cognome || ""} ${p.titoli?.clienti?.nome || ""}`).toLowerCase();
      return (p.titoli?.numero_titolo || "").toLowerCase().includes(s) || cli.includes(s);
    });
  }, [provvigioni, filters.search]);

  const totals = useMemo(() => {
    const t = filtered.reduce((acc: any, p: any) => {
      acc.maturato += p.importo_provvigione || 0;
      acc.premio += p.titoli?.premio_lordo || 0;
      if (p.profiles) acc.dest.add(`${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim());
      else if (p.titoli?.produttore_nome) acc.dest.add(p.titoli.produttore_nome);
      return acc;
    }, { maturato: 0, premio: 0, dest: new Set<string>() });
    return { maturato: t.maturato, premio: t.premio, destinatari: t.dest.size, count: filtered.length, medio: filtered.length ? t.maturato / filtered.length : 0 };
  }, [filtered]);

  const aggBy = (keyFn: (p: any) => string | null, labelFn: (p: any) => string) => {
    const m = new Map<string, { name: string; value: number }>();
    for (const p of filtered) {
      const k = keyFn(p);
      if (!k) continue;
      const cur = m.get(k) || { name: labelFn(p), value: 0 };
      cur.value += p.importo_provvigione || 0;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  };

  const labelAnag = (a: any) =>
    (a?.ragione_sociale && a.ragione_sociale.trim()) ||
    `${a?.cognome || ""} ${a?.nome || ""}`.trim();
  const byProduttore = useMemo(() => aggBy(
    (p) => p.titoli?.anagrafica_commerciale_id || (p.titoli?.produttore_nome ? `n:${p.titoli.produttore_nome}` : null),
    (p) => labelAnag(p.titoli?.anagrafica_commerciale) || (p.titoli?.produttore_nome || "—"),
  ), [filtered]);
  const byRamo = useMemo(() => aggBy((p) => p.titoli?.ramo_id, (p) => p.titoli?.rami?.descrizione || "—"), [filtered]);
  const byTipo = useMemo(() => aggBy((p) => p.tipo_destinatario, (p) => {
    const map: any = { admin: "Consulbrokers SPA", commerciale: "Produttore", ae: "Account Executive", sede: "Sede", consul: "Consul (legacy)" };
    return map[p.tipo_destinatario] || p.tipo_destinatario || "—";
  }), [filtered]);


  const provvigioniSelezionateDettaglio = useMemo(() => {
    return provvigioni.filter((p: any) => selectedIds.includes(p.id));
  }, [provvigioni, selectedIds]);

  const totaleSelezionato = useMemo(() => {
    return provvigioniSelezionateDettaglio.reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);
  }, [provvigioniSelezionateDettaglio]);

  const pagamentoMutation = useMutation({
    mutationFn: async (values: PagatoFormValues) => {
      if (selectedIds.length === 0) throw new Error("Nessuna provvigione selezionata");

      const provsToPay = provvigioni.filter((p: any) => selectedIds.includes(p.id));
      
      const groups: Record<string, typeof provsToPay> = {};
      for (const p of provsToPay) {
        const uId = p.user_id;
        if (!uId) continue;
        if (!groups[uId]) groups[uId] = [];
        groups[uId].push(p);
      }

      const userIds = Object.keys(groups);
      if (userIds.length === 0) {
        throw new Error("Nessun utente valido associato alle provvigioni selezionate");
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Utente non autenticato");

      const { data: userProfiles } = await supabase
        .from("profiles")
        .select("id, ufficio_id")
        .in("id", userIds);

      const ufficioMap: Record<string, string | null> = {};
      if (userProfiles) {
        for (const up of userProfiles) {
          ufficioMap[up.id] = up.ufficio_id;
        }
      }

      for (const uId of userIds) {
        const groupProvs = groups[uId];
        const totale = groupProvs.reduce((sum, p) => sum + (p.importo_provvigione || 0), 0);
        
        const dates = groupProvs.map(p => p.calcolata_il).filter(Boolean).map(d => new Date(d));
        const minDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : new Date();
        const maxDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();

        const { data: distinta, error: errTestata } = await supabase
          .from("pagamenti_provvigioni")
          .insert({
            pagato_a_user_id: uId,
            ufficio_id: ufficioMap[uId] || null,
            periodo_da: format(minDate, "yyyy-MM-dd"),
            periodo_a: format(maxDate, "yyyy-MM-dd"),
            totale_importo: totale,
            metodo: values.metodo,
            note: values.note || null,
            creato_da: currentUser.id,
            created_at: format(values.dataPagamento, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
          })
          .select()
          .single();

        if (errTestata) throw errTestata;

        const righe = groupProvs.map(p => ({
          pagamento_id: distinta.id,
          provvigione_id: p.id,
          importo: p.importo_provvigione || 0,
          created_at: format(values.dataPagamento, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
        }));

        const { error: errRighe } = await supabase
          .from("pagamenti_provvigioni_righe")
          .insert(righe);
        
        if (errRighe) throw errRighe;

        const groupIds = groupProvs.map(p => p.id);
        const { error: errUpdate } = await supabase
          .from("provvigioni_generate")
          .update({ pagata: true })
          .in("id", groupIds);

        if (errUpdate) throw errUpdate;

        await logAttivita({
          azione: "creazione_distinta_provvigioni_bulk",
          entita_tipo: "pagamenti_provvigioni",
          entita_id: distinta.id,
          dettagli_json: { righe: groupIds.length, totale },
        });
      }

      return true;
    },
    onSuccess: () => {
      toast.success("Pagamenti provvigioni registrati con successo");
      queryClient.invalidateQueries({ queryKey: ["provvigioni-maturate"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni-maturate-trend"] });
      setSelectedIds([]);
      setModalePagamentoOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Errore durante la registrazione dei pagamenti: " + err.message);
    }
  });

  const onConfermaPagamento = (values: PagatoFormValues) => {
    pagamentoMutation.mutate(values);
  };

  const handleGeneraDistintaPDF = async () => {
    if (selectedIds.length === 0) return;
    try {
      setGenerandoDistinta(true);
      toast.loading("Generazione distinta PDF in corso...");

      const { data, error } = await supabase.functions.invoke("genera-distinta-pdf", {
        body: {
          provvigioni_ids: selectedIds
        }
      });

      if (error || data?.error) throw new Error(error?.message || data?.error || "Errore sconosciuto");

      const base64Data = data.content;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `distinta_provvigioni_${format(new Date(), "yyyyMMdd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Distinta PDF scaricata con successo");
    } catch (err: any) {
      console.error(err);
      toast.dismiss();
      toast.error("Errore durante la generazione della distinta PDF: " + err.message);
    } finally {
      setGenerandoDistinta(false);
    }
  };

  const { page, setPage, pages, pageRows, resetPage } = usePagination(filtered);

  const selectableRows = useMemo(() => {
    return pageRows.filter((p: any) => !p.pagata);
  }, [pageRows]);

  const isAllSelected = useMemo(() => {
    return selectableRows.length > 0 && selectableRows.every(p => selectedIds.includes(p.id));
  }, [selectableRows, selectedIds]);

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !selectableRows.some(r => r.id === id)));
    } else {
      const idsToAdd = selectableRows.map(p => p.id).filter(id => !selectedIds.includes(id));
      setSelectedIds(prev => [...prev, ...idsToAdd]);
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const labelDa = format(new Date(filters.da), "dd/MM/yyyy");
  const labelA = format(new Date(filters.a), "dd/MM/yyyy");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Provvigioni Maturate</h1>
          <p className="text-sm text-muted-foreground">Provvigioni dei produttori · {labelDa} → {labelA}</p>
        </div>
      </div>

      <ProvvigioniFiltersBar
        filters={filters}
        onChange={(f) => { setFilters(f); resetPage(); }}
        rami={rami} produttori={produttori} showTipo
        loadingRami={lkRami} loadingProduttori={lkProd}
      />

      {isLoading ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ProvvigioniKpiCard icon={TrendingUp} label="Totale Maturato" value={fmtEuro(totals.maturato)} accent="primary" />
            <ProvvigioniKpiCard icon={CreditCard} label="N. Provvigioni" value={String(totals.count)} />
            <ProvvigioniKpiCard icon={Users} label="Destinatari" value={String(totals.destinatari)} />
            <ProvvigioniKpiCard icon={Briefcase} label="Premio Incassato" value={fmtEuro(totals.premio)} />
            <ProvvigioniKpiCard icon={Receipt} label="Importo medio" value={fmtEuro(totals.medio)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProvvigioniBarChart title="Top Produttori" data={byProduttore.slice(0, 10)} />
            <ProvvigioniBarChart title="Per Ramo" data={byRamo.slice(0, 10)} />
            <ProvvigioniPieChart title="Per Tipo Destinatario" data={byTipo} />
            <ProvvigioniLineChart title="Trend ultimi 12 mesi" data={trend12} />
          </div>
        </>
      )}

      {/* Barra Azioni Bulk */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/10 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {selectedIds.length} {selectedIds.length === 1 ? "provvigione selezionata" : "provvigioni selezionate"} (Totale: {fmtEuro(totaleSelezionato)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setModalePagamentoOpen(true)}
            >
              <Check className="w-4 h-4 mr-1.5" /> Segna come pagato
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-200 hover:bg-blue-50 text-blue-700 hover:text-blue-800 dark:border-blue-900/50 dark:hover:bg-blue-950/20"
              onClick={handleGeneraDistintaPDF}
              disabled={generandoDistinta}
            >
              <FileText className="w-4 h-4 mr-1.5" /> Genera distinta PDF
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedIds([])}
            >
              Deseleziona tutto
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleAll}
                  />
                </TableHead>
                <TableHead>Polizza</TableHead>
                <TableHead>Compagnia</TableHead>
                <TableHead>Garanzia</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Premio</TableHead>
                <TableHead>Messa a cassa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatario</TableHead>
                <TableHead className="text-right">Provvigione</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="p-0"><TableRowsSkeleton rows={8} cellTypes={["checkbox","short","text","text","text","num","short","badge","text","num","badge"]} /></TableCell></TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nessuna provvigione per i filtri selezionati</TableCell></TableRow>
              ) : (
                pageRows.map((p: any, i: number) => {
                  const cli = p.titoli?.clienti?.ragione_sociale || `${p.titoli?.clienti?.cognome || ""} ${p.titoli?.clienti?.nome || ""}`.trim();
                  return (
                    <TableRow key={p.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(p.id)}
                          onCheckedChange={() => handleToggleRow(p.id)}
                          disabled={p.pagata}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{p.titoli?.numero_titolo || "—"}</TableCell>
                      <TableCell>{p.titoli?.compagnie?.nome || "—"}</TableCell>
                      <TableCell>{p.titoli?.rami?.descrizione || "—"}</TableCell>
                      <TableCell className="text-xs">{cli || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums font-sans">{fmtEuro(p.titoli?.premio_lordo)}</TableCell>
                      <TableCell>{p.titoli?.data_messa_cassa ? format(new Date(p.titoli.data_messa_cassa), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{tipoBadge(p.tipo_destinatario)}</TableCell>
                      <TableCell>{p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : (p.titoli?.produttore_nome || "—")}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold font-sans">{fmtEuro(p.importo_provvigione)}</TableCell>
                      <TableCell>
                        {p.pagata ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">Pagata</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Da pagare</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <span className="text-xs text-muted-foreground">Pagina {page + 1} di {pages} · {filtered.length} righe</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prec</Button>
                <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>Succ</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modale Conferma Pagamento */}
      <Dialog open={modalePagamentoOpen} onOpenChange={setModalePagamentoOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-600" /> Conferma Pagamento Provvigioni
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="text-sm text-muted-foreground">
              Stai per registrare il pagamento per <strong>{selectedIds.length}</strong> provvigioni per un importo totale di <strong className="text-foreground text-base">{fmtEuro(totaleSelezionato)}</strong>.
            </div>
            
            {/* Lista provvigioni selezionate */}
            <div className="border rounded-md max-h-40 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Polizza</TableHead>
                    <TableHead>Destinatario</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provvigioniSelezionateDettaglio.map((p: any) => {
                    const destName = p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : (p.titoli?.produttore_nome || "—");
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.titoli?.numero_titolo || "—"}</TableCell>
                        <TableCell className="text-xs">{destName}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-xs">{fmtEuro(p.importo_provvigione)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <form onSubmit={form.handleSubmit(onConfermaPagamento)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Pagamento</Label>
                  <DatePicker
                    value={form.watch("dataPagamento")}
                    onChange={(d) => form.setValue("dataPagamento", d || new Date())}
                    placeholder="Seleziona data"
                  />
                  {form.formState.errors.dataPagamento && (
                    <p className="text-xs text-rose-500">{form.formState.errors.dataPagamento.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metodo">Metodo Pagamento</Label>
                  <Select
                    value={form.watch("metodo")}
                    onValueChange={(v) => form.setValue("metodo", v)}
                  >
                    <SelectTrigger id="metodo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bonifico">Bonifico</SelectItem>
                      <SelectItem value="contanti">Contanti</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  placeholder="Note opzionali..."
                  {...form.register("note")}
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setModalePagamentoOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={pagamentoMutation.isPending}>
                  {pagamentoMutation.isPending ? "Registrazione..." : "Conferma Pagamento"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProvvigioniMaturatePage;
