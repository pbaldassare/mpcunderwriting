import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, TrendingUp, Percent, Filter, Printer, CheckCircle2, Loader2, HandCoins, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { toast } from "sonner";
import { buildECProduttorePdf, type ECProduttoreData, type ECProduttoreRow, type ECProduttoreTrattenutaRow } from "@/lib/ec-produttore-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import {
  defaultDataLimiteIncasso,
  EC_PRODUTTORI_PERIODO_DA,
  isDefaultDataLimiteIncasso,
} from "@/lib/contabilita/defaultDataLimiteIncasso";
import { defaultDataEstrattoContoFormatted } from "@/lib/contabilita/defaultDataEstrattoConto";
import { prossimoRiferimentoEc } from "@/lib/contabilita/ecProgressivo";

type ConfermaDlg = {
  open: boolean;
  prodId: string | null;
  nome: string;
  provvigioni: number;
  note: string;
};

const ECProduttoriContabPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dataLimiteIncasso, setDataLimiteIncasso] = useState<Date>(() => defaultDataLimiteIncasso());
  const [produttoreId, setProduttoreId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confermaDlg, setConfermaDlg] = useState<ConfermaDlg>({
    open: false,
    prodId: null,
    nome: "",
    provvigioni: 0,
    note: "",
  });

  const toIso = format(dataLimiteIncasso, "yyyy-MM-dd");
  const fromIso = EC_PRODUTTORI_PERIODO_DA;
  const periodoLabel = `Data limite incasso ${format(dataLimiteIncasso, "dd/MM/yyyy")}`;

  const { data: anagrafiche } = useQuery({
    queryKey: ["anagrafiche-produttori-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, ragione_sociale, citta, fax, email, indirizzo, cap, provincia, percentuale_ra, tipo, codice_fiscale, partita_iva, iban, intestatario_cc")
        .in("tipo", ["account_executive", "corrispondente"])
        .eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  const { data: provvAll, isLoading } = useQuery({
    queryKey: ["ec-produttori-mese", toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("user_id, anagrafica_commerciale_id, importo_provvigione, tipo_destinatario, solo_statistico, pagata, titolo_id, titoli!provvigioni_generate_titolo_id_fkey(id, numero_titolo, riga, appendice, sostituisce_polizza, premio_lordo, data_messa_cassa, garanzia_da, garanzia_a, durata_da, durata_a, ramo_id, cliente_anagrafica_id, produttore_id, anagrafica_commerciale_id, rami:ramo_id(descrizione, codice), clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale))")
        .in("tipo_destinatario", ["commerciale", "ae"])
        .eq("solo_statistico", false)
        .eq("pagata", false);
      if (error) throw error;
      return (data || []).filter((p: any) => {
        const t = p.titoli;
        if (!t || !t.data_messa_cassa) return false;
        return t.data_messa_cassa <= toIso;
      });
    },
  });

  const { data: trattenuteAll = [] } = useQuery({
    queryKey: ["ec-produttori-trattenute", toIso],
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_modalita_incasso") as any)
        .select(
          "id, titolo_id, anagrafica_commerciale_id, importo_provvigione_lorda, importo_ra, importo_trattenuto_netto, titoli!inner(id, numero_titolo, riga, data_messa_cassa, cliente_anagrafica_id, clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale))",
        )
        .eq("stato", "attiva")
        .eq("modalita", "produttore_trattiene_provv")
        .lte("titoli.data_messa_cassa", toIso);
      if (error) throw error;
      return data || [];
    },
  });

  const aggregati = useMemo(() => {
    const prods = anagrafiche || [];
    const grouped: Record<string, { id: string; codice: string; nome: string; citta: string; fax: string; email: string; lordo: number; provvigioni: number }> = {};
    for (const a of prods) {
      grouped[a.id] = { id: a.id, codice: a.codice || "", nome: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(), citta: a.citta || "", fax: a.fax || "", email: a.email || "", lordo: 0, provvigioni: 0 };
    }
    for (const p of provvAll || []) {
      const t = p.titoli;
      const anagId = p.anagrafica_commerciale_id || t?.anagrafica_commerciale_id || null;
      const key = (anagId && grouped[anagId]) ? anagId : (p.user_id && grouped[p.user_id]) ? p.user_id : null;
      if (key) {
        grouped[key].lordo += Number(t?.premio_lordo) || 0;
        grouped[key].provvigioni += Number(p.importo_provvigione) || 0;
      }
    }
    let rows = Object.values(grouped).filter(r => r.lordo > 0 || r.provvigioni > 0);
    if (produttoreId) rows = rows.filter(r => r.id === produttoreId);
    return rows.sort((a, b) => b.lordo - a.lordo);
  }, [anagrafiche, provvAll, produttoreId]);

  const totLordo = aggregati.reduce((s, r) => s + r.lordo, 0);
  const totProvv = aggregati.reduce((s, r) => s + r.provvigioni, 0);
  const totTrattenute = (trattenuteAll as any[]).reduce(
    (s, r) => s + (Number(r.importo_trattenuto_netto) || 0),
    0,
  );
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const hasFiltriAttivi = produttoreId !== null || !isDefaultDataLimiteIncasso(dataLimiteIncasso);

  const exportCSV = () => {
    const header = "Codice,Produttore,Località,Email,Lordo,Provvigioni\n";
    const csv = aggregati.map((r) => `"${r.codice}","${r.nome}","${r.citta}","${r.email}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ec_produttori_limite_${toIso}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const { data: sede } = useQuery({
    queryKey: ["ec-prod-sede", profile?.ufficio_id],
    enabled: !!profile?.ufficio_id,
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("id", profile!.ufficio_id!).maybeSingle();
      return data as any;
    },
  });

  const buildPdfFor = async (prodId: string): Promise<{ bytes: Uint8Array; filename: string; prodCodice: string }> => {
    const prod = (anagrafiche || []).find((a: any) => a.id === prodId) as any;
    if (!prod) throw new Error("Produttore non trovato");

    const righeProv = (provvAll || []).filter((p: any) => {
      const anagId = p.anagrafica_commerciale_id || p.titoli?.anagrafica_commerciale_id || null;
      const key = anagId || p.user_id;
      return key === prodId;
    });

    const righeTrattenute: ECProduttoreTrattenutaRow[] = (trattenuteAll as any[])
      .filter((r) => r.anagrafica_commerciale_id === prodId)
      .map((r) => {
        const t = r.titoli;
        const cli = t?.clienti_anagrafica;
        const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
        const dataRow = t?.data_messa_cassa;
        return {
          data: dataRow ? format(new Date(dataRow), "dd/MM/yy") : "",
          polizza: `${t?.numero_titolo || ""}${t?.riga ? " - " + t.riga : ""}`,
          cliente,
          provvigioneLorda: Number(r.importo_provvigione_lorda) || 0,
          ritenutaAcconto: Number(r.importo_ra) || 0,
          nettoTrattenuto: Number(r.importo_trattenuto_netto) || 0,
        };
      });

    const righe: ECProduttoreRow[] = righeProv.map((p: any) => {
      const t = p.titoli;
      const cli = t?.clienti_anagrafica;
      const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
      const ramo = t?.rami?.descrizione || t?.rami?.codice || "";
      const dFrom = t?.garanzia_da || t?.durata_da;
      const dTo = t?.garanzia_a || t?.durata_a;
      const periodo = (dFrom || dTo) ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : ""} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim() : "";
      const polRiga = `${t?.numero_titolo || ""}${t?.riga ? " - " + t.riga : ""}`;
      const tp = t?.appendice ? "AM" : (t?.sostituisce_polizza ? "PQ" : "PI");
      const dataRow = t?.data_messa_cassa;
      return {
        data: dataRow ? format(new Date(dataRow), "dd/MM/yy") : "",
        polizza: polRiga, cliente, ramo, periodo, tp,
        premio: Number(t?.premio_lordo) || 0,
        provvigioni: Number(p.importo_provvigione) || 0,
        altreOper: 0,
      };
    }).sort((a, b) => {
      const px = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(2000 + (y || 0), (m || 1) - 1, d || 1).getTime(); };
      return px(a.data) - px(b.data);
    });

    const totalePremio = righe.reduce((s, r) => s + r.premio, 0);
    const totaleProvvigioni = righe.reduce((s, r) => s + r.provvigioni, 0);
    const totaleTrattenute = righeTrattenute.reduce((s, r) => s + r.nettoTrattenuto, 0);
    const percRA = Number(prod.percentuale_ra) || 0;
    const codiceProd = prod.codice || prod.cognome || prod.ragione_sociale || "PROD";
    const progRes = await prossimoRiferimentoEc("produttore", prodId, codiceProd);
    if (!progRes.ok || progRes.numero == null) {
      throw new Error(progRes.error || "Impossibile generare il numero rendiconto progressivo");
    }
    const nomeProd = prod.ragione_sociale || `${prod.cognome || ""} ${prod.nome || ""}`.trim() || "";

    const data: ECProduttoreData = {
      sedeNome: sede?.nome_ufficio || "",
      sedeIndirizzo: sede?.indirizzo || "", sedeCap: sede?.cap || "", sedeCitta: sede?.citta || "",
      sedeProvincia: sede?.provincia || "", sedeEmail: sede?.email || "", sedeTelefono: sede?.telefono || "",
      numeroRendiconto: String(progRes.numero),
      dataRendiconto: defaultDataEstrattoContoFormatted(),
      periodoTesto: periodoLabel,
      produttoreIntestazione: "Spettabile",
      produttoreNome: nomeProd,
      produttoreIndirizzo: prod.indirizzo || "", produttoreCap: prod.cap || "",
      produttoreCitta: prod.citta || "", produttoreProvincia: prod.provincia || "",
      produttoreCF: prod.codice_fiscale || undefined,
      produttorePIVA: prod.partita_iva || undefined,
      iban: prod.iban || undefined,
      intestatoA: prod.intestatario_cc || nomeProd || undefined,
      modalitaPagamento: "Bonifico",
      righe, righeTrattenute, totalePremio, totaleProvvigioni, totaleTrattenute, totaleAltreOper: 0,
      ritenutaAcconto: percRA * totaleProvvigioni / 100,
    };
    const bytes = await buildECProduttorePdf(data);
    const codice = (prod.codice || prod.cognome || prod.ragione_sociale || "produttore").toString().replace(/\s+/g, "_");
    const filename = `EC_Produttore_${codice}_limite_${toIso}.pdf`;
    return { bytes, filename, prodCodice: codice };
  };

  const withObjectUrl = (bytes: Uint8Array, fn: (url: string) => void) => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    try { fn(url); } finally { setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 5000); }
  };

  const handleStampa = async (prodId: string) => {
    try {
      setBusy(true);
      const { bytes } = await buildPdfFor(prodId);
      withObjectUrl(bytes, (url) => {
        const w = window.open(url, "_blank");
        if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
      });
    } catch (e: any) { toast.error("Errore stampa: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const openConfermaDlg = (row: { id: string; nome: string; provvigioni: number }) => {
    setConfermaDlg({
      open: true,
      prodId: row.id,
      nome: row.nome,
      provvigioni: row.provvigioni,
      note: "",
    });
  };

  const closeConfermaDlg = () => {
    setConfermaDlg({ open: false, prodId: null, nome: "", provvigioni: 0, note: "" });
  };

  const confermaPagamentoMutation = useMutation({
    mutationFn: async ({ prodId, note }: { prodId: string; note: string }) => {
      const { bytes, filename } = await buildPdfFor(prodId);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const path = `${prodId}/ec_produttore/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage.from("documenti_generali")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw new Error(`Archivio PDF: ${upErr.message}`);

      const { data: u } = await supabase.auth.getUser();
      const { data: doc, error: dbErr } = await supabase.from("documenti").insert({
        nome_file: filename,
        path_storage: path,
        bucket_name: "documenti_generali",
        entita_tipo: "anagrafica_professionale",
        entita_id: prodId,
        categoria: "EC Produttore",
        visibile_al_cliente: false,
        caricato_da: u?.user?.id ?? null,
      } as any).select("id").single();
      if (dbErr) throw new Error(`Registro documento: ${dbErr.message}`);

      const { data: res, error: rpcErr } = await supabase.rpc("segna_ec_produttore_pagato", {
        p_anagrafica_id: prodId,
        p_periodo_da: fromIso,
        p_periodo_a: toIso,
        p_documento_id: doc.id,
        p_note: note.trim() || null,
      });
      if (rpcErr) throw new Error(`Conferma pagamento: ${rpcErr.message}`);
      const result = res as { ok?: boolean; error?: string; count?: number };
      if (!result?.ok) throw new Error(result?.error || "Conferma pagamento fallita");

      await logAttivita({
        azione: "conferma_pagamento_ec_produttore",
        entita_tipo: "anagrafica_professionale",
        entita_id: prodId,
        dettagli_json: {
          periodo: periodoLabel,
          data_limite_incasso: toIso,
          documento_id: doc.id,
          provvigioni_count: result.count,
          note: note.trim() || null,
        },
      });

      return result;
    },
    onSuccess: (res) => {
      toast.success(`Pagamento confermato — ${res.count} provvigioni archiviate nello storico`);
      closeConfermaDlg();
      queryClient.invalidateQueries({ queryKey: ["ec-produttori-mese"] });
      queryClient.invalidateQueries({ queryKey: ["ec-produttori-trattenute"] });
      queryClient.invalidateQueries({ queryKey: ["ec-prod-storico"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni-maturate"] });
      navigate("/contabilita/ec-produttore/storico");
    },
    onError: (e: any) => {
      toast.error("Errore conferma pagamento: " + (e?.message || e));
    },
  });

  const kpiCards = [
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Provvigioni da liquidare", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
    { label: "Trattenute in incasso", value: fmt(totTrattenute), icon: HandCoins, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400" },
  ];

  const isConfermaBusy = busy || confermaPagamentoMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Percent className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Produttori</h1>
            <p className="text-sm text-muted-foreground">Estratto conto produttori — titoli messi a cassa entro la data limite incasso</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!aggregati.length}><Download className="mr-2 h-4 w-4" /> Esporta CSV</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}><kpi.icon className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
          {hasFiltriAttivi && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              onClick={() => {
                setDataLimiteIncasso(defaultDataLimiteIncasso());
                setProduttoreId(null);
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Azzera
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data limite incasso</Label>
            <DatePicker
              value={dataLimiteIncasso}
              onChange={(d) => d && setDataLimiteIncasso(d)}
              placeholder="Data limite"
            />
          </div>
          <FilterSearchableSelect
            value={produttoreId}
            onValueChange={setProduttoreId}
            options={(anagrafiche || []).map((a: any) => ({ value: a.id, label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim() }))}
            placeholder="Produttore" allLabel="Tutti i produttori" className="w-[260px]"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Codice</TableHead><TableHead>Produttore</TableHead><TableHead>Località</TableHead><TableHead>Email</TableHead>
            <TableHead className="text-right">Lordo</TableHead><TableHead className="text-right">Provvigioni</TableHead>
            <TableHead className="text-right w-[260px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : aggregati.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun produttore con provvigioni da pagare entro la data limite selezionata</TableCell></TableRow>
            ) : aggregati.map((r, i) => (
              <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell>{r.codice}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.citta}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" disabled={isConfermaBusy} onClick={() => handleStampa(r.id)}><Printer className="h-3.5 w-3.5 mr-1" />Stampa</Button>
                    <Button size="sm" disabled={isConfermaBusy} onClick={() => openConfermaDlg(r)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Conferma pagamento
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {aggregati.length > 0 && <TableFooter><TableRow>
            <TableCell colSpan={4} className="font-bold">Totale</TableCell>
            <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell>
            <TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
            <TableCell />
          </TableRow></TableFooter>}
        </Table>
      </div>

      <Dialog open={confermaDlg.open} onOpenChange={(o) => !o && closeConfermaDlg()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma pagamento</DialogTitle>
            <DialogDescription>
              Verrà generato e archiviato il PDF E/C, e le provvigioni di <strong>{confermaDlg.nome}</strong> saranno marcate come pagate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Data limite incasso:</span> {format(dataLimiteIncasso, "dd/MM/yyyy")}</p>
              <p><span className="text-muted-foreground">Totale provvigioni:</span> <strong>{fmt(confermaDlg.provvigioni)}</strong></p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec-prod-note">Note (opzionale)</Label>
              <Textarea
                id="ec-prod-note"
                value={confermaDlg.note}
                onChange={(e) => setConfermaDlg((p) => ({ ...p, note: e.target.value }))}
                placeholder="Riferimento bonifico, note interne..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeConfermaDlg} disabled={confermaPagamentoMutation.isPending}>Annulla</Button>
            <Button
              disabled={!confermaDlg.prodId || confermaPagamentoMutation.isPending}
              onClick={() => confermaDlg.prodId && confermaPagamentoMutation.mutate({ prodId: confermaDlg.prodId, note: confermaDlg.note })}
            >
              {confermaPagamentoMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Conferma in corso...</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" /> Conferma pagamento</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECProduttoriContabPage;
