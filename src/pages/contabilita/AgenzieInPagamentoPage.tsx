import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, FileCode2, CheckCircle2, ChevronDown, ChevronRight, Trash2, Ban, Building2, Loader2, AlertCircle, Download, Eye, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { buildRimessaPdf, type RimessaPdfData } from "@/lib/rimessa-pdf";
import { filterContiBancariPerSede } from "@/lib/filterContiBancariPerSede";

const fmt = (n: number) => Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const cleanIban = (s: string) => String(s || "").replace(/\s+/g, "").toUpperCase();
const formatIbanMask = (s: string) =>
  cleanIban(s).replace(/(.{4})/g, "$1 ").trim();

interface Rimessa {
  id: string;
  stato: string;
  totale_importi: number;
  data_messa_in_pagamento: string | null;
  iban_utilizzato: string | null;
  conto_bancario_mittente_id: string | null;
  note: string | null;
  flusso_xml_id: string | null;
  compagnia_id: string;
  compagnie: { nome: string; iban: string | null; codice: string | null; intestato_a: string | null };
  rimessa_dettaglio: { titolo_id: string; importo: number }[];
}

type LastError = {
  kind: "xml" | "pdf" | "conferma";
  message: string;
  retry: () => void;
} | null;

const AgenzieInPagamentoPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assegnaDlg, setAssegnaDlg] = useState<{ open: boolean; rimessa: Rimessa | null; contoId: string | null; iban: string }>({
    open: false, rimessa: null, contoId: null, iban: "",
  });
  const [confermaDlg, setConfermaDlg] = useState<{ open: boolean; rimesseIds: string[]; data: string }>({
    open: false, rimesseIds: [], data: new Date().toISOString().slice(0, 10),
  });
  const [annullaDlg, setAnnullaDlg] = useState<{ open: boolean; rimessaId: string | null }>({ open: false, rimessaId: null });
  const [xmlPreview, setXmlPreview] = useState<{ open: boolean; xml: string; fileUrl: string | null; fileName: string }>({
    open: false, xml: "", fileUrl: null, fileName: "",
  });
  const [pdfPreviewLoadingId, setPdfPreviewLoadingId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<LastError>(null);

  // Filtri
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<string>("all"); // all|in_pagamento|pronta
  const [contoFilter, setContoFilter] = useState<string>("all"); // all|<id>|none

  // Conti mittenti
  const { data: contiMittenteRaw = [] } = useQuery({
    queryKey: ["conti-bancari-generico"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conti_bancari")
        .select("id, etichetta, iban, intestato_a, banca, bic, is_default, tipo, conti_bancari_uffici(ufficio_id)")
        .eq("tipo", "generico")
        .eq("attivo", true)
        .order("is_default", { ascending: false })
        .order("etichetta");
      return (data || []);
    },
  });
  const contiMittente = useMemo(
    () =>
      filterContiBancariPerSede(contiMittenteRaw, {
        ruolo: profile?.ruolo,
        ufficioId: profile?.ufficio_id,
      }),
    [contiMittenteRaw, profile?.ruolo, profile?.ufficio_id],
  );

  // Rimesse in pagamento o pronte
  const { data: rimesse = [], isLoading } = useQuery<Rimessa[]>({
    queryKey: ["agenzie-in-pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rimessa_premi")
        .select("id, stato, totale_importi, data_messa_in_pagamento, iban_utilizzato, conto_bancario_mittente_id, note, flusso_xml_id, compagnia_id, compagnie(nome, iban, codice, intestato_a), rimessa_dettaglio(titolo_id, importo)")
        .in("stato", ["in_pagamento", "pronta"])
        .order("data_messa_in_pagamento", { ascending: false });
      if (error) throw error;
      return (data || []);
    },
  });

  // Titoli per il dettaglio (lazy)
  const allTitoliIds = useMemo(() => {
    const s = new Set<string>();
    rimesse.forEach((r) => r.rimessa_dettaglio?.forEach((d) => s.add(d.titolo_id)));
    return Array.from(s);
  }, [rimesse]);

  const { data: titoliMap = {} } = useQuery({
    queryKey: ["titoli-rimesse-in-pagamento", allTitoliIds],
    enabled: allTitoliIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, premio_lordo, importo_incassato, data_messa_cassa, clienti(ragione_sociale, nome, cognome)")
        .in("id", allTitoliIds);
      const map: Record<string, any> = {};
      (data || []).forEach((t: any) => { map[t.id] = t; });
      return map;
    },
  });

  // Apply filters
  const rimesseFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qIban = cleanIban(search);
    return rimesse.filter((r) => {
      if (statoFilter !== "all" && r.stato !== statoFilter) return false;
      if (contoFilter !== "all") {
        if (contoFilter === "none" && r.conto_bancario_mittente_id) return false;
        if (contoFilter !== "none" && r.conto_bancario_mittente_id !== contoFilter) return false;
      }
      if (q) {
        const compagnia = (r.compagnie?.nome || "").toLowerCase();
        const ibanDest = cleanIban(r.iban_utilizzato || r.compagnie?.iban || "");
        // Cerca anche nei titoli del dettaglio
        const titoliMatch = r.rimessa_dettaglio?.some((d) => {
          const t: any = titoliMap[d.titolo_id];
          if (!t) return false;
          const num = String(t.numero_titolo || "").toLowerCase();
          const c = t.clienti;
          const cli = (c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`).toLowerCase();
          return num.includes(q) || cli.includes(q);
        });
        if (!compagnia.includes(q) && !ibanDest.includes(qIban) && !titoliMatch) return false;
      }
      return true;
    });
  }, [rimesse, search, statoFilter, contoFilter, titoliMap]);

  // Group by conto mittente
  const groups = useMemo(() => {
    const g: Record<string, { contoId: string | null; conto: any; rimesse: Rimessa[]; totale: number }> = {};
    for (const r of rimesseFiltered) {
      const key = r.conto_bancario_mittente_id || "__none__";
      if (!g[key]) {
        const conto = contiMittente.find((c: any) => c.id === r.conto_bancario_mittente_id) || null;
        g[key] = { contoId: r.conto_bancario_mittente_id, conto, rimesse: [], totale: 0 };
      }
      g[key].rimesse.push(r);
      g[key].totale += Number(r.totale_importi) || 0;
    }
    return Object.values(g);
  }, [rimesseFiltered, contiMittente]);

  const toggleExpand = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  };

  const toggleSel = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ============ MUTATIONS ============

  const assegnaMutation = useMutation({
    mutationFn: async ({ rimessaId, contoId, iban }: { rimessaId: string; contoId: string; iban: string }) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "assegna_mittente", rimessa_id: rimessaId, conto_bancario_mittente_id: contoId, iban_utilizzato: iban },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Conto mittente assegnato");
      setAssegnaDlg({ open: false, rimessa: null, contoId: null, iban: "" });
      qc.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rimuoviTitoloMutation = useMutation({
    mutationFn: async ({ rimessaId, titoloId }: { rimessaId: string; titoloId: string }) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "rimuovi_titolo", rimessa_id: rimessaId, titolo_id: titoloId, created_by: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Titolo rimosso dalla rimessa");
      qc.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
      qc.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const annullaMutation = useMutation({
    mutationFn: async (rimessaId: string) => {
      const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
        body: { action: "annulla", rimessa_id: rimessaId, created_by: user?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Rimessa annullata");
      setAnnullaDlg({ open: false, rimessaId: null });
      qc.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
      qc.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runGeneraXml = async (contoId: string, ids: string[]) => {
    const { data, error } = await supabase.functions.invoke("gestione-rimessa", {
      body: { action: "genera_xml_sepa", rimessa_ids: ids, conto_bancario_mittente_id: contoId, created_by: user?.id },
    });
    if (error) {
      const detail = error.context?.body || error.message || "Errore di rete";
      throw new Error(`Generazione XML SEPA fallita: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    }
    if (data?.error) throw new Error(`Generazione XML SEPA: ${data.error}`);
    return data;
  };

  const generaXmlMutation = useMutation({
    mutationFn: ({ contoId, ids }: { contoId: string; ids: string[] }) => runGeneraXml(contoId, ids),
    onSuccess: (data) => {
      toast.success(`Flusso SEPA generato — ${data.msg_id}`);
      setXmlPreview({ open: true, xml: data.xml, fileUrl: data.file_url, fileName: `${data.msg_id}.xml` });
      setSelected(new Set());
      setLastError(null);
      qc.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
    },
    onError: (e: any, vars) => {
      const msg = e.message || "Errore sconosciuto";
      toast.error(msg);
      setLastError({
        kind: "xml",
        message: msg,
        retry: () => generaXmlMutation.mutate(vars),
      });
    },
  });

  // Costruisce dati PDF per una rimessa (riutilizzato da preview e da archiviazione)
  const buildPdfBytesFor = async (rimessa: Rimessa, dataPag: string): Promise<{ bytes: Uint8Array; data: RimessaPdfData }> => {
    const { data: sedeNapoli } = await supabase
      .from("uffici")
      .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
      .or("nome_ufficio.ilike.%napoli%,citta.ilike.%napoli%")
      .eq("attivo", true)
      .limit(1).maybeSingle();
    const { data: compFull } = await supabase
      .from("compagnie")
      .select("nome, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, intestato_a")
      .eq("id", rimessa.compagnia_id).maybeSingle();
    const conto = contiMittente.find((c: any) => c.id === rimessa.conto_bancario_mittente_id);
    const titoliIds = rimessa.rimessa_dettaglio.map((d) => d.titolo_id);
    const titoli = titoliIds.map((tid) => {
      const t: any = titoliMap[tid] || {};
      const c = t.clienti;
      const cliente = c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "—";
      return {
        numero_titolo: t.numero_titolo || "—",
        cliente,
        premio_lordo: Number(t.premio_lordo) || 0,
        importo_incassato: Number(t.importo_incassato) || 0,
        importo_rimessa: Number(t.importo_incassato) || 0,
        data_messa_cassa: t.data_messa_cassa,
      };
    });

    const pdfData: RimessaPdfData = {
      numeroRimessa: rimessa.id.slice(0, 8).toUpperCase(),
      dataDocumento: format(new Date(dataPag), "dd/MM/yyyy"),
      sedeNome: sedeNapoli?.nome_ufficio || "Sede di Napoli",
      sedeIndirizzo: sedeNapoli?.indirizzo || "Via Mergellina, 2",
      sedeCap: sedeNapoli?.cap || "80122",
      sedeCitta: sedeNapoli?.citta || "Napoli",
      sedeProvincia: sedeNapoli?.provincia || "NA",
      sedeEmail: sedeNapoli?.email || undefined,
      sedeTelefono: sedeNapoli?.telefono || undefined,
      contoMittenteEtichetta: conto?.etichetta || "",
      contoMittenteIban: conto?.iban || "",
      contoMittenteIntestatoA: conto?.intestato_a || "",
      contoMittenteBanca: conto?.banca || undefined,
      agenziaNome: compFull?.nome || rimessa.compagnie?.nome || "",
      agenziaIndirizzo: compFull?.indirizzo || undefined,
      agenziaCap: compFull?.cap || undefined,
      agenziaCitta: compFull?.comune || undefined,
      agenziaProvincia: compFull?.provincia || undefined,
      agenziaCF: compFull?.codice_fiscale || undefined,
      agenziaPIVA: compFull?.partita_iva || undefined,
      ibanDestinazione: rimessa.iban_utilizzato || rimessa.compagnie?.iban || undefined,
      intestatoADestinazione: compFull?.intestato_a || undefined,
      titoli,
      importoPagato: Number(rimessa.totale_importi) || 0,
      note: rimessa.note || undefined,
    };
    const bytes = await buildRimessaPdf(pdfData);
    return { bytes, data: pdfData };
  };

  // Anteprima PDF (apre in nuova tab)
  const handleAnteprimaPdf = async (r: Rimessa) => {
    setPdfPreviewLoadingId(r.id);
    try {
      const { bytes } = await buildPdfBytesFor(r, new Date().toISOString().slice(0, 10));
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // revoke dopo un po'
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast.error(`Anteprima PDF fallita: ${err.message || err}`);
    } finally {
      setPdfPreviewLoadingId(null);
    }
  };

  // Archivia PDF su storage + documenti
  const storePdfFor = async (rimessa: Rimessa, dataPag: string) => {
    const { bytes } = await buildPdfBytesFor(rimessa, dataPag);
    const path = `${rimessa.id}.pdf`;
    const upRes = await supabase.storage.from("rimesse-pdf").upload(
      path,
      new Blob([bytes as BlobPart], { type: "application/pdf" }),
      { upsert: true, contentType: "application/pdf" },
    );
    if (upRes.error) throw new Error(`Upload storage: ${upRes.error.message}`);
    const { data: signed, error: signErr } = await supabase.storage.from("rimesse-pdf").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr) throw new Error(`Signed URL: ${signErr.message}`);
    const { error: updErr } = await supabase.from("rimessa_premi").update({ pdf_url: signed?.signedUrl || path } as any).eq("id", rimessa.id);
    if (updErr) throw new Error(`Update rimessa_premi: ${updErr.message}`);

    // Idempotente: se esiste già una riga per (bucket, path), aggiorna; altrimenti inserisci
    const { data: existing } = await supabase
      .from("documenti")
      .select("id")
      .eq("bucket_name", "rimesse-pdf")
      .eq("path_storage", path)
      .maybeSingle();

    if (existing) {
      const { error: updDocErr } = await supabase
        .from("documenti")
        .update({
          caricato_da: user?.id || null,
          entita_tipo: "agenzia",
          visibile_al_cliente: false,
        } as any)
        .eq("id", existing.id);
      if (updDocErr) throw new Error(`Archivio documenti: ${updDocErr.message}`);
    } else {
      const { error: docErr } = await supabase.from("documenti").insert({
        nome_file: `RIM-${rimessa.id.slice(0, 8).toUpperCase()}.pdf`,
        path_storage: path,
        bucket_name: "rimesse-pdf",
        categoria: "EC Agenzia",
        entita_tipo: "agenzia",
        entita_id: rimessa.compagnia_id,
        visibile_al_cliente: false,
        caricato_da: user?.id || null,
      } as any);
      if (docErr) throw new Error(`Archivio documenti: ${docErr.message}`);
    }
  };

  const runConfermaPagamento = async ({ ids, data }: { ids: string[]; data: string }) => {
    const sel = rimesse.filter((r) => ids.includes(r.id));
    const failedPdf: { id: string; nome: string; err: string }[] = [];
    for (const r of sel) {
      try {
        await storePdfFor(r, data);
      } catch (err: any) {
        console.error("[storePdfFor]", r.id, err);
        failedPdf.push({ id: r.id, nome: r.compagnie?.nome || r.id.slice(0, 8), err: err.message || String(err) });
      }
    }
    if (failedPdf.length > 0) {
      const list = failedPdf.map((f) => `• ${f.nome}: ${f.err}`).join("\n");
      throw Object.assign(new Error(`PDF E/C non archiviati per ${failedPdf.length} rimesse:\n${list}`), { failedIds: failedPdf.map((f) => f.id) });
    }

    const { data: res, error } = await supabase.functions.invoke("gestione-rimessa", {
      body: { action: "conferma_pagamento", rimessa_ids: ids, data_valuta: data, created_by: user?.id },
    });
    if (error) throw new Error(`Conferma pagamento: ${error.message || "errore"}`);
    if (res?.error) throw new Error(`Conferma pagamento: ${res.error}`);
    return res;
  };

  const confermaPagamentoMutation = useMutation({
    mutationFn: runConfermaPagamento,
    onSuccess: (res) => {
      toast.success(`Pagamento confermato per ${res.count} rimesse — spostate in Storico`);
      setConfermaDlg({ open: false, rimesseIds: [], data: new Date().toISOString().slice(0, 10) });
      setSelected(new Set());
      setLastError(null);
      qc.invalidateQueries({ queryKey: ["agenzie-in-pagamento"] });
      qc.invalidateQueries({ queryKey: ["storico-rimesse"] });
      qc.invalidateQueries({ queryKey: ["ec-agenzie-storico"] });
    },
    onError: (e: any, vars) => {
      const msg = e.message || "Errore sconosciuto";
      toast.error(msg.split("\n")[0]);
      // Se solo PDF è fallito, retry esegue solo i falliti
      const failedIds: string[] | undefined = e.failedIds;
      const retryVars = failedIds && failedIds.length > 0
        ? { ids: failedIds, data: vars.data }
        : vars;
      setLastError({
        kind: failedIds ? "pdf" : "conferma",
        message: msg,
        retry: () => confermaPagamentoMutation.mutate(retryVars),
      });
    },
  });

  const handleGeneraXml = (group: typeof groups[number]) => {
    if (!group.contoId) {
      toast.error("Assegna prima un conto mittente alle rimesse del gruppo");
      return;
    }
    const eligible = group.rimesse.filter((r) => r.stato === "in_pagamento" && r.iban_utilizzato);
    if (eligible.length === 0) {
      toast.error("Nessuna rimessa eleggibile (servono stato 'in_pagamento' + IBAN destinazione)");
      return;
    }
    generaXmlMutation.mutate({ contoId: group.contoId, ids: eligible.map((r) => r.id) });
  };

  const hasFilters = search || statoFilter !== "all" || contoFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenzie in Pagamento</h1>
          <p className="text-sm text-muted-foreground">Bozze di rimessa pronte per generazione flussi SEPA e conferma pagamento</p>
        </div>
      </div>

      {/* Banner errore con retry */}
      {lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between gap-3">
            <span>
              {lastError.kind === "xml" && "Generazione XML SEPA fallita"}
              {lastError.kind === "pdf" && "Archiviazione PDF E/C fallita"}
              {lastError.kind === "conferma" && "Conferma pagamento fallita"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => lastError.retry()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Riprova
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLastError(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </AlertTitle>
          <AlertDescription>
            <pre className="text-xs whitespace-pre-wrap font-mono mt-2 max-h-40 overflow-auto">{lastError.message}</pre>
          </AlertDescription>
        </Alert>
      )}

      {/* Filtri & ricerca */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[260px] space-y-1">
              <Label className="text-xs">Cerca</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Compagnia, IBAN, n° titolo, cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="w-[260px] space-y-1">
              <Label className="text-xs">Conto mittente</Label>
              <SearchableSelect
                options={[
                  { value: "all", label: "Tutti i conti" },
                  { value: "none", label: "⚠ Non assegnato" },
                  ...contiMittente.map((c: any) => ({ value: c.id, label: c.etichetta, description: c.iban, searchText: c.iban })),
                ]}
                value={contoFilter}
                onValueChange={(v) => setContoFilter(v || "all")}
                placeholder="Tutti"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatoFilter("all"); setContoFilter("all"); }}>
                <X className="h-4 w-4 mr-1" /> Pulisci
              </Button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              {rimesseFiltered.length} / {rimesse.length} rimesse
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Caricamento...</CardContent></Card>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {hasFilters ? "Nessuna rimessa corrisponde ai filtri." : "Nessuna rimessa in pagamento. Crea bozze da E/C Agenzie → \"Metti in pagamento\"."}
        </CardContent></Card>
      ) : (
        groups.map((g) => {
          const groupSel = g.rimesse.filter((r) => selected.has(r.id));
          return (
            <Card key={g.contoId || "__none__"}>
              <CardHeader className="bg-muted/40 py-3">
                <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {g.conto ? (
                      <>
                        <span>{g.conto.etichetta}</span>
                        <Badge variant="outline" className="font-mono text-xs">{formatIbanMask(g.conto.iban || "")}</Badge>
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">⚠ Conto mittente da assegnare</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{g.rimesse.length} rimesse</Badge>
                    <span className="font-bold text-primary">{fmt(g.totale)}</span>
                  </div>
                </CardTitle>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" disabled={!g.contoId || generaXmlMutation.isPending} onClick={() => handleGeneraXml(g)}>
                    {generaXmlMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileCode2 className="h-4 w-4 mr-1.5" />}
                    Genera Flusso SEPA (gruppo)
                  </Button>
                  <Button
                    size="sm"
                    disabled={groupSel.length === 0}
                    onClick={() => setConfermaDlg({ open: true, rimesseIds: groupSel.map((r) => r.id), data: new Date().toISOString().slice(0, 10) })}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Conferma Pagamento ({groupSel.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Agenzia</TableHead>
                      <TableHead>IBAN destinazione</TableHead>
                      <TableHead className="text-right">Totale</TableHead>
                      <TableHead className="text-right">Titoli</TableHead>
                      <TableHead className="w-[340px]">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.rimesse.map((r) => {
                      const isExp = expanded.has(r.id);
                      const ibanDest = r.iban_utilizzato || r.compagnie?.iban;
                      return (
                        <>
                          <TableRow key={r.id} className="hover:bg-muted/30">
                            <TableCell className="px-2">
                              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSel(r.id)} />
                            </TableCell>
                            <TableCell className="px-2 cursor-pointer" onClick={() => toggleExpand(r.id)}>
                              {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="font-medium">{r.compagnie?.nome}</TableCell>
                            <TableCell className="font-mono text-xs">{ibanDest ? formatIbanMask(ibanDest) : <span className="text-destructive">— mancante —</span>}</TableCell>
                            <TableCell className="text-right font-semibold">{fmt(r.totale_importi)}</TableCell>
                            <TableCell className="text-right">{r.rimessa_dettaglio?.length || 0}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  disabled={pdfPreviewLoadingId === r.id}
                                  onClick={() => handleAnteprimaPdf(r)}
                                  title="Anteprima PDF E/C"
                                >
                                  {pdfPreviewLoadingId === r.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                                  Anteprima PDF
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs"
                                  onClick={() => setAssegnaDlg({ open: true, rimessa: r, contoId: r.conto_bancario_mittente_id, iban: formatIbanMask(ibanDest || "") })}
                                >
                                  Assegna mittente
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                  onClick={() => setAnnullaDlg({ open: true, rimessaId: r.id })}
                                >
                                  <Ban className="h-3 w-3 mr-1" /> Annulla
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExp && (
                            <TableRow key={`${r.id}-d`} className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={7} className="py-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="h-8 text-xs">N. Titolo</TableHead>
                                      <TableHead className="h-8 text-xs">Cliente</TableHead>
                                      <TableHead className="h-8 text-xs text-right">Importo</TableHead>
                                      <TableHead className="h-8 text-xs w-[80px]"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {r.rimessa_dettaglio?.map((d) => {
                                      const t: any = titoliMap[d.titolo_id] || {};
                                      const c = t.clienti;
                                      const cliente = c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "—";
                                      return (
                                        <TableRow key={d.titolo_id}>
                                          <TableCell className="py-1 text-sm">{t.numero_titolo || d.titolo_id.slice(0, 8)}</TableCell>
                                          <TableCell className="py-1 text-sm">{cliente}</TableCell>
                                          <TableCell className="py-1 text-sm text-right">{fmt(d.importo)}</TableCell>
                                          <TableCell className="py-1">
                                            {r.stato === "in_pagamento" && (
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                                                onClick={() => rimuoviTitoloMutation.mutate({ rimessaId: r.id, titoloId: d.titolo_id })}
                                                title="Rimuovi titolo"
                                              >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                              </Button>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Dialog Assegna mittente */}
      <Dialog open={assegnaDlg.open} onOpenChange={(o) => !o && setAssegnaDlg({ open: false, rimessa: null, contoId: null, iban: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assegna conto mittente e IBAN destinazione</DialogTitle>
            <DialogDescription>
              {assegnaDlg.rimessa?.compagnie?.nome} — {fmt(assegnaDlg.rimessa?.totale_importi || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conto Consulbrokers (mittente)</Label>
              <SearchableSelect
                options={contiMittente.map((c: any) => ({ value: c.id, label: `${c.etichetta}${c.is_default ? " ⭐" : ""}`, description: c.iban, searchText: c.iban }))}
                value={assegnaDlg.contoId || ""}
                onValueChange={(id) => setAssegnaDlg((p) => ({ ...p, contoId: id || null }))}
                placeholder="— Seleziona conto —"
                searchPlaceholder="Cerca conto o IBAN..."
              />
            </div>
            <div className="space-y-2">
              <Label>IBAN Agenzia (destinazione)</Label>
              <Input value={assegnaDlg.iban} onChange={(e) => setAssegnaDlg((p) => ({ ...p, iban: formatIbanMask(e.target.value) }))} className="font-mono" maxLength={42} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssegnaDlg({ open: false, rimessa: null, contoId: null, iban: "" })}>Annulla</Button>
            <Button
              disabled={!assegnaDlg.contoId || !cleanIban(assegnaDlg.iban) || assegnaMutation.isPending}
              onClick={() => assegnaMutation.mutate({ rimessaId: assegnaDlg.rimessa!.id, contoId: assegnaDlg.contoId!, iban: cleanIban(assegnaDlg.iban) })}
            >
              {assegnaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Conferma pagamento */}
      <Dialog open={confermaDlg.open} onOpenChange={(o) => !o && setConfermaDlg({ open: false, rimesseIds: [], data: new Date().toISOString().slice(0, 10) })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma pagamento ({confermaDlg.rimesseIds.length} rimesse)</DialogTitle>
            <DialogDescription>
              Le rimesse verranno marcate come <strong>pagate</strong>, sposta nello Storico e verrà generato il PDF E/C agenzia per ognuna.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Data valuta</Label>
            <Input type="date" value={confermaDlg.data} onChange={(e) => setConfermaDlg((p) => ({ ...p, data: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfermaDlg({ open: false, rimesseIds: [], data: new Date().toISOString().slice(0, 10) })}>Annulla</Button>
            <Button disabled={confermaPagamentoMutation.isPending} onClick={() => confermaPagamentoMutation.mutate({ ids: confermaDlg.rimesseIds, data: confermaDlg.data })}>
              {confermaPagamentoMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Conferma in corso...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Conferma pagamento</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Annulla */}
      <AlertDialog open={annullaDlg.open} onOpenChange={(o) => !o && setAnnullaDlg({ open: false, rimessaId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la rimessa?</AlertDialogTitle>
            <AlertDialogDescription>I titoli torneranno disponibili in E/C Agenzie.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Indietro</AlertDialogCancel>
            <AlertDialogAction onClick={() => annullaDlg.rimessaId && annullaMutation.mutate(annullaDlg.rimessaId)}>Annulla rimessa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* XML preview */}
      <Dialog open={xmlPreview.open} onOpenChange={(o) => !o && setXmlPreview({ open: false, xml: "", fileUrl: null, fileName: "" })}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Flusso SEPA generato</DialogTitle>
            <DialogDescription>{xmlPreview.fileName} — pain.001.001.03</DialogDescription>
          </DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded max-h-[400px] overflow-auto font-mono">{xmlPreview.xml}</pre>
          <DialogFooter>
            {xmlPreview.fileUrl && (
              <Button asChild variant="outline">
                <a href={xmlPreview.fileUrl} download={xmlPreview.fileName}><Download className="h-4 w-4 mr-2" /> Scarica XML</a>
              </Button>
            )}
            <Button onClick={() => setXmlPreview({ open: false, xml: "", fileUrl: null, fileName: "" })}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgenzieInPagamentoPage;
