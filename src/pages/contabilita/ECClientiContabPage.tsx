import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Users, TrendingUp, Wallet, Scale, Filter, RotateCcw, FileText, Mail } from "lucide-react";
import { ecClienteTitoloEligible } from "@/lib/ecClienteTitoli";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";

interface Filters {
  cliente_id: string | null;
  ufficio_id: string | null;
  competenza_dal: Date | null;
  competenza_al: Date | null;
  scadenza_dal: Date | null;
  scadenza_al: Date | null;
  non_pagati_al: Date | null;
  situazione: "tutti" | "scoperti" | "garantiti";
  pag_diretto: "tutti" | "si" | "no";
}

const defaultFilters: Filters = {
  cliente_id: null, ufficio_id: null,
  competenza_dal: null, competenza_al: null, scadenza_dal: null, scadenza_al: null,
  non_pagati_al: null, situazione: "tutti", pag_diretto: "tutti",
};

const ECClientiContabPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const set = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  const { data: uffici } = useQuery({
    queryKey: ["uffici-filter-contab"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ec-clienti-contab", filters],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      let query = supabase
        .from("titoli")
        .select("id, premio_lordo, importo_incassato, stato, data_incasso, data_messa_cassa, garanzia_da, ufficio_id, cliente_anagrafica_id, clienti!titoli_cliente_anagrafica_id_fkey(id, cognome, nome, ragione_sociale)")
        .not("cliente_anagrafica_id", "is", null)
        // Dare E/C: solo quietanze (rate), non la polizza madre (evita doppio conteggio)
        .not("sostituisce_polizza", "is", null)
        // E/C Cliente "vivo": titoli generati alla creazione polizza, non ancora messi a cassa
        .is("data_messa_cassa", null)
        // Solo premio in corso: la rata deve essere già decorsa (esclude quietanze future)
        .lte("garanzia_da", today)
        .in("stato", ["attivo", "sospeso"]);

      if (filters.ufficio_id) query = query.eq("ufficio_id", filters.ufficio_id);
      if (filters.cliente_id) query = query.eq("cliente_anagrafica_id", filters.cliente_id);
      if (filters.competenza_dal) query = query.gte("garanzia_da", format(filters.competenza_dal, "yyyy-MM-dd"));
      if (filters.competenza_al) query = query.lte("garanzia_da", format(filters.competenza_al, "yyyy-MM-dd"));
      if (filters.scadenza_dal) query = query.gte("garanzia_da", format(filters.scadenza_dal, "yyyy-MM-dd"));
      if (filters.scadenza_al) query = query.lte("garanzia_da", format(filters.scadenza_al, "yyyy-MM-dd"));


      const { data: titoli, error } = await query;
      if (error) throw error;

      const grouped: Record<string, {
        cliente_id: string;
        label: string;
        titolo_ids: string[];
        totale_premi: number;
        totale_incassato: number;
        saldo: number;
      }> = {};
      for (const t of titoli || []) {
        const cli = t.clienti as any;
        if (!cli) continue;
        const incassato = Number(t.importo_incassato) || 0;
        const premio = Number(t.premio_lordo) || 0;
        if (filters.situazione === "scoperti" && incassato >= premio) continue;
        if (filters.situazione === "garantiti" && incassato < premio) continue;
        if (filters.non_pagati_al && t.data_incasso) {
          if (new Date(t.data_incasso) <= filters.non_pagati_al) continue;
        }
        const key = cli.id;
        if (!grouped[key]) {
          grouped[key] = {
            cliente_id: cli.id,
            label: cli.ragione_sociale || `${cli.cognome || ""} ${cli.nome || ""}`.trim(),
            titolo_ids: [],
            totale_premi: 0,
            totale_incassato: 0,
            saldo: 0,
          };
        }
        if (ecClienteTitoloEligible(t, today)) {
          grouped[key].titolo_ids.push(t.id);
        }
        grouped[key].totale_premi += premio;
        grouped[key].totale_incassato += incassato;
      }

      // Giroconti inter-cliente: pagatore → AVERE (usa acconti per saldare altrui),
      // beneficiario → DARE (quietanza saldata con acconti altrui).
      let gq = (supabase.from("giroconti_cliente") as any)
        .select("cliente_pagatore_id, cliente_beneficiario_id, importo, data");
      if (filters.cliente_id) {
        gq = gq.or(`cliente_pagatore_id.eq.${filters.cliente_id},cliente_beneficiario_id.eq.${filters.cliente_id}`);
      }
      if (filters.competenza_dal) gq = gq.gte("data", format(filters.competenza_dal, "yyyy-MM-dd"));
      if (filters.competenza_al) gq = gq.lte("data", format(filters.competenza_al, "yyyy-MM-dd"));
      const { data: giroconti, error: errGiro } = await gq;
      if (errGiro) throw errGiro;

      const giroImpact: Record<string, { dare: number; avere: number }> = {};
      for (const g of giroconti || []) {
        const imp = Number(g.importo) || 0;
        (giroImpact[g.cliente_beneficiario_id] ||= { dare: 0, avere: 0 }).dare += imp;
        (giroImpact[g.cliente_pagatore_id] ||= { dare: 0, avere: 0 }).avere += imp;
      }

      // Etichette per clienti presenti solo nei giroconti (senza titoli "vivi")
      const missing = Object.keys(giroImpact).filter((id) => !grouped[id]);
      if (missing.length > 0) {
        const { data: cli } = await supabase
          .from("clienti")
          .select("id, cognome, nome, ragione_sociale")
          .in("id", missing);
        for (const c of cli || []) {
          grouped[c.id] = {
            cliente_id: c.id,
            label: c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim(),
            titolo_ids: [],
            totale_premi: 0,
            totale_incassato: 0,
            saldo: 0,
          };
        }
      }

      for (const [id, imp] of Object.entries(giroImpact)) {
        if (!grouped[id]) continue;
        grouped[id].totale_premi += imp.dare;
        grouped[id].totale_incassato += imp.avere;
      }

      for (const g of Object.values(grouped)) g.saldo = g.totale_premi - g.totale_incassato;
      return Object.values(grouped).sort((a, b) => b.saldo - a.saldo);
    },
  });

  const rows = data || [];
  const totPremi = rows.reduce((s, c) => s + c.totale_premi, 0);
  const totIncassato = rows.reduce((s, c) => s + c.totale_incassato, 0);
  const totSaldo = rows.reduce((s, c) => s + c.saldo, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const hasFilters = Object.entries(filters).some(([k, v]) => {
    if (k === "situazione") return v !== "tutti";
    if (k === "pag_diretto") return v !== "tutti";
    return v !== null;
  });

  const exportCSV = () => {
    const header = "Cliente,Totale Premi (Dare),Totale Incassato (Avere),Saldo\n";
    const csv = rows.map((c) => `"${c.label}",${c.totale_premi.toFixed(2)},${c.totale_incassato.toFixed(2)},${c.saldo.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ec_clienti_contab.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: "N. Clienti", value: rows.length.toString(), icon: Users, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" },
    { label: "Totale Dare", value: fmt(totPremi), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Avere", value: fmt(totIncassato), icon: Wallet, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Saldo", value: fmt(totSaldo), icon: Scale, color: totSaldo > 0 ? "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400" : "text-teal-600 bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Clienti</h1>
            <p className="text-sm text-muted-foreground">Estratto conto clienti — Contabilità</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" /> Esporta CSV
        </Button>
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

      <div className="bg-muted/30 border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setFilters({ ...defaultFilters })}>
              <RotateCcw className="h-3 w-3 mr-1" /> Azzera
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <ClienteSearchSelect
            value={filters.cliente_id || ""}
            onValueChange={(v) => set({ cliente_id: v || null })}
            placeholder="Cliente"
            searchPlaceholder="Nome, più nomi, indirizzo…"
            clearable
            clearLabel="Tutti i clienti"
            className="w-[240px]"
          />
          <FilterSearchableSelect value={filters.ufficio_id} onValueChange={(v) => set({ ufficio_id: v })}
            options={(uffici || []).map((u) => ({ value: u.id, label: u.nome_ufficio }))}
            placeholder="Sede" allLabel="Tutte le sedi" className="w-[200px]" />
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Competenza dal</Label><DatePicker value={filters.competenza_dal} onChange={(d) => set({ competenza_dal: d })} placeholder="Dal" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Competenza al</Label><DatePicker value={filters.competenza_al} onChange={(d) => set({ competenza_al: d })} placeholder="Al" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Scadenza dal</Label><DatePicker value={filters.scadenza_dal} onChange={(d) => set({ scadenza_dal: d })} placeholder="Dal" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Scadenza al</Label><DatePicker value={filters.scadenza_al} onChange={(d) => set({ scadenza_al: d })} placeholder="Al" /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Non pagati al</Label><DatePicker value={filters.non_pagati_al} onChange={(d) => set({ non_pagati_al: d })} placeholder="Data" /></div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Situazione</Label>
            <RadioGroup value={filters.situazione} onValueChange={(v) => set({ situazione: v as any })} className="flex gap-4">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="tutti" id="sit-tutti" /><Label htmlFor="sit-tutti" className="text-sm">Tutti</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="scoperti" id="sit-scoperti" /><Label htmlFor="sit-scoperti" className="text-sm">Scoperti</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="garantiti" id="sit-garantiti" /><Label htmlFor="sit-garantiti" className="text-sm">Garantiti</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Pag. diretto Agenzia</Label>
            <RadioGroup value={filters.pag_diretto} onValueChange={(v) => set({ pag_diretto: v as any })} className="flex gap-4">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="tutti" id="pd-tutti" /><Label htmlFor="pd-tutti" className="text-sm">Tutti</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="si" id="pd-si" /><Label htmlFor="pd-si" className="text-sm">Sì</Label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="no" id="pd-no" /><Label htmlFor="pd-no" className="text-sm">No</Label></div>
            </RadioGroup>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Dare (Premi)</TableHead>
              <TableHead className="text-right">Avere (Incassato)</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right w-44">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun dato</TableCell></TableRow>
            ) : rows.map((c) => {
              const qs = new URLSearchParams({ clienteId: c.cliente_id });
              if (c.titolo_ids.length > 0) qs.set("titoliIds", c.titolo_ids.join(","));
              if (filters.competenza_dal) qs.set("periodoDal", format(filters.competenza_dal, "yyyy-MM-dd"));
              if (filters.competenza_al) qs.set("periodoAl", format(filters.competenza_al, "yyyy-MM-dd"));
              const pdfUrl = `/contabilita/ec-cliente/pdf?${qs.toString()}`;
              return (
                <TableRow key={c.cliente_id}>
                  <TableCell className="font-medium cursor-pointer" onClick={() => navigate(`/archivi/clienti/${c.cliente_id}`)}>{c.label}</TableCell>
                  <TableCell className="text-right">{fmt(c.totale_premi)}</TableCell>
                  <TableCell className="text-right">{fmt(c.totale_incassato)}</TableCell>
                  <TableCell className="text-right"><Badge variant={c.saldo > 0 ? "destructive" : "default"}>{fmt(c.saldo)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(pdfUrl); }}>
                        <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`${pdfUrl}&invia=1`); }}>
                        <Mail className="h-3.5 w-3.5 mr-1" /> Mail
                      </Button>
                    </div>
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

export default ECClientiContabPage;
