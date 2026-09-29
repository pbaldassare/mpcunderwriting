import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ElaborazioniSommarioPanel from "@/components/estrazioni/ElaborazioniSommarioPanel";
import { ELAB_TIPO_SINGOLA } from "@/lib/elaborazioni/sommarioBatch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildElaborazionePdf,
  downloadPdf,
  formatValore,
  renderTemplate,
  type CampoCatalogo,
  type ValoriCampi,
} from "@/lib/elaborazioni/render";
import { useGruppiRamo } from "@/hooks/useRamiLookup";
import {
  catalogoOrFilter,
  filterTitoliByGruppiRamo,
  gruppoRamoIdOfTitolo,
  mergeValoriCampi,
  toggleId,
} from "@/lib/elaborazioni/selezione";

interface ClienteRow {
  id: string;
  ragione_sociale: string | null;
  nome: string | null;
  cognome: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
}

interface TitoloRow {
  id: string;
  numero_titolo: string | null;
  prodotto_nome: string | null;
  ramo_id: string | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  ramo?: {
    id: string;
    descrizione: string | null;
    gruppo_ramo_id: string | null;
    gruppo_ramo?: { id: string; descrizione: string | null } | null;
  } | null;
}

interface DocumentoRow {
  id: string;
  nome_file: string;
  bucket_name: string;
  path_storage: string;
  categoria: string | null;
  entita_id: string;
  created_at: string;
}

const nomeCliente = (c: ClienteRow) =>
  (c.ragione_sociale?.trim() || `${c.cognome ?? ""} ${c.nome ?? ""}`.trim() || "Cliente");

const CORPO_DEFAULT = `RIEPILOGO POLIZZA

Contraente: {{contraente}}
Numero polizza: {{numero_titolo}}
Compagnia: {{compagnia}}
Decorrenza: {{data_effetto}}   Scadenza: {{data_scadenza}}

Garanzie prestate:
{{garanzie}}

Massimale: {{massimale}}   Franchigia: {{franchigia}}
Premio lordo annuo: {{premio_lordo}}

Note: {{note}}`;

const ElaborazioniPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth() as { profile?: { id?: string; ufficio_id?: string | null } | null };

  const [clienteId, setClienteId] = useState("");
  const [gruppoRamoIds, setGruppoRamoIds] = useState<string[]>([]);
  const [titoloIds, setTitoloIds] = useState<string[]>([]);
  const [documentoIds, setDocumentoIds] = useState<string[]>([]);
  const [campiSelezionati, setCampiSelezionati] = useState<string[]>([]);
  const [valori, setValori] = useState<ValoriCampi>({});
  const [noteAi, setNoteAi] = useState<string | null>(null);
  const [analizzando, setAnalizzando] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [corpo, setCorpo] = useState(CORPO_DEFAULT);
  const [nomeTemplate, setNomeTemplate] = useState("");
  const [salvando, setSalvando] = useState(false);

  /* ------------------------------------------------------------------ dati */

  const { data: titoli = [], isLoading: loadingTitoli } = useQuery({
    queryKey: ["elab-titoli", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, prodotto_nome, ramo_id, garanzia_da, garanzia_a, ramo:rami!titoli_ramo_id_fkey(id, descrizione, gruppo_ramo_id, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, descrizione))")
        .or(`cliente_id.eq.${clienteId},cliente_anagrafica_id.eq.${clienteId}`)
        .order("garanzia_a", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as TitoloRow[];
    },
  });

  const allTitoloIds = useMemo(() => titoli.map((t) => t.id), [titoli]);

  const { data: documenti = [], isLoading: loadingDoc } = useQuery({
    queryKey: ["elab-documenti", allTitoloIds],
    enabled: allTitoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documenti")
        .select("id, nome_file, bucket_name, path_storage, categoria, entita_id, created_at")
        .eq("entita_tipo", "titolo")
        .in("entita_id", allTitoloIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocumentoRow[];
    },
  });

  const { data: gruppiRamo = [] } = useGruppiRamo();

  const { data: rami = [] } = useQuery({
    queryKey: ["elab-rami"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rami").select("id, gruppo_ramo_id, descrizione");
      if (error) throw error;
      return (data ?? []) as { id: string; gruppo_ramo_id: string | null; descrizione: string | null }[];
    },
  });

  const ramiById = useMemo(
    () => new Map(rami.map((r) => [r.id, r.gruppo_ramo_id])),
    [rami],
  );

  const titoliConDocumenti = useMemo(() => {
    const conDoc = new Set(documenti.map((d) => d.entita_id));
    return filterTitoliByGruppiRamo(
      titoli.filter((t) => conDoc.has(t.id)),
      gruppoRamoIds,
      ramiById,
    );
  }, [titoli, documenti, gruppoRamoIds, ramiById]);

  const titoliSelezionati = useMemo(
    () => titoli.filter((t) => titoloIds.includes(t.id)),
    [titoli, titoloIds],
  );

  const titoloSel = titoliSelezionati[0] ?? null;
  const gruppoRamoId = gruppoRamoIds[0] ?? gruppoRamoIdOfTitolo(titoloSel ?? { id: "" }, ramiById);

  const { data: catalogo = [], isLoading: loadingCampi } = useQuery({
    queryKey: ["elab-catalogo", gruppoRamoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elaborazioni_campi_catalogo")
        .select("id, chiave, etichetta, tipo, descrizione_ai, gruppo_ramo_id, ordine")
        .eq("attivo", true)
        .or(catalogoOrFilter(gruppoRamoIds))
        .order("ordine");
      if (error) throw error;
      return (data ?? []) as CampoCatalogo[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["elab-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elaborazioni_template")
        .select("id, nome, descrizione, gruppo_ramo_id, campi, corpo")
        .eq("attivo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as {
        id: string; nome: string; descrizione: string | null;
        gruppo_ramo_id: string | null; campi: unknown; corpo: string;
      }[];
    },
  });

  const { data: storico = [] } = useQuery({
    queryKey: ["elab-storico", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elaborazioni")
        .select("id, titolo, created_at, stato, titolo_id, contenuto, campi_estratti, tipo, titolo_ids")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as {
        id: string; titolo: string | null; created_at: string; stato: string;
        titolo_id: string | null; contenuto: string | null; campi_estratti: ValoriCampi;
        tipo?: string | null; titolo_ids?: string[] | null;
      }[];
    },
  });

  /* --------------------------------------------------------------- effetti */

  // Preseleziona tutti i campi disponibili quando cambia il catalogo
  useEffect(() => {
    setCampiSelezionati(catalogo.map((c) => c.chiave));
  }, [catalogo]);

  useEffect(() => {
    setGruppoRamoIds([]);
    setTitoloIds([]);
    setDocumentoIds([]);
    setValori({});
    setNoteAi(null);
  }, [clienteId]);

  useEffect(() => {
    setTitoloIds((prev) => {
      const next = prev.filter((id) => titoliConDocumenti.some((t) => t.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [titoliConDocumenti]);

  useEffect(() => {
    setDocumentoIds((prev) => {
      const next = prev.filter((id) => {
        const doc = documenti.find((d) => d.id === id);
        return !!doc && titoloIds.includes(doc.entita_id);
      });
      return next.length === prev.length ? prev : next;
    });
  }, [titoloIds, documenti]);

  const documentiPolizze = useMemo(
    () => documenti.filter((d) => titoloIds.includes(d.entita_id)),
    [documenti, titoloIds],
  );

  const { data: clienteById } = useQuery({
    queryKey: ["elab-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clienti")
        .select("id, ragione_sociale, nome, cognome, codice_fiscale, partita_iva")
        .eq("id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as ClienteRow | null;
    },
  });

  const clienteSel = clienteById ?? null;
  const campiScelti = useMemo(
    () => catalogo.filter((c) => campiSelezionati.includes(c.chiave)),
    [catalogo, campiSelezionati],
  );

  const anteprima = useMemo(() => renderTemplate(corpo, valori, catalogo), [corpo, valori, catalogo]);

  /* ---------------------------------------------------------------- azioni */

  const toggleCampo = (chiave: string) =>
    setCampiSelezionati((prev) =>
      prev.includes(chiave) ? prev.filter((c) => c !== chiave) : [...prev, chiave],
    );

  const applicaTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setCorpo(t.corpo || CORPO_DEFAULT);
    setNomeTemplate(t.nome);
    const campiT = Array.isArray(t.campi) ? (t.campi as string[]) : [];
    if (campiT.length) setCampiSelezionati(campiT);
  };

  const analizzaDocumento = async (doc: DocumentoRow, contesto: string) => {
    const { data: file, error: dlErr } = await supabase.storage
      .from(doc.bucket_name)
      .download(doc.path_storage);
    if (dlErr || !file) {
      throw new Error(
        `Documento non scaricabile dall'archivio (${doc.bucket_name}): ${dlErr?.message ?? "file assente"}`,
      );
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length === 0) throw new Error(`Il documento ${doc.nome_file} risulta vuoto`);
    if (buf.length > 18 * 1024 * 1024) {
      throw new Error(`Documento troppo grande (max 18 MB): ${doc.nome_file}`);
    }
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const fileBase64 = btoa(binary);
    const nome = doc.nome_file.toLowerCase();
    const mimeType =
      nome.endsWith(".pdf") ? "application/pdf"
      : nome.endsWith(".png") ? "image/png"
      : nome.endsWith(".jpg") || nome.endsWith(".jpeg") ? "image/jpeg"
      : file.type || "application/pdf";

    const { data, error } = await supabase.functions.invoke("elabora-documento-polizza", {
      body: {
        fileBase64,
        mimeType,
        contesto,
        campi: campiScelti.map((c) => ({
          chiave: c.chiave,
          etichetta: c.etichetta,
          tipo: c.tipo,
          descrizione_ai: c.descrizione_ai,
        })),
      },
    });
    if (error) {
      throw new Error(formatEdgeFunctionError(error, data as { error?: string } | null));
    }
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as { campi?: ValoriCampi; note?: string | null };
  };

  const analizza = async () => {
    const docs = documenti.filter((d) => documentoIds.includes(d.id));
    if (docs.length === 0 || campiScelti.length === 0) return;
    setAnalizzando(true);
    setNoteAi(null);
    try {
      const polizzeCtx = titoliSelezionati
        .map((t) => [t.numero_titolo, t.prodotto_nome, t.ramo?.gruppo_ramo?.descrizione || t.ramo?.descrizione]
          .filter(Boolean).join(" · "))
        .filter(Boolean)
        .join("; ");
      const ramiCtx = gruppiRamo
        .filter((g) => gruppoRamoIds.includes(g.value))
        .map((g) => g.label)
        .join(", ");
      const contesto = [
        clienteSel ? `Contraente atteso: ${nomeCliente(clienteSel)}` : null,
        polizzeCtx ? `Polizze: ${polizzeCtx}` : null,
        ramiCtx ? `Rami da considerare: ${ramiCtx}` : null,
      ].filter(Boolean).join("\n");

      let merged: ValoriCampi = {};
      const note: string[] = [];
      for (const doc of docs) {
        const data = await analizzaDocumento(doc, `${contesto}\nDocumento: ${doc.nome_file}`);
        merged = mergeValoriCampi(merged, (data.campi ?? {}) as ValoriCampi);
        if (data.note) note.push(`${doc.nome_file}: ${data.note}`);
      }
      setValori(merged);
      setNoteAi(note.length ? note.join(" · ") : null);
      const trovati = Object.values(merged).filter((v) => v !== null && v !== "").length;
      toast.success(
        docs.length > 1
          ? `Analisi di ${docs.length} documenti: ${trovati} campi estratti su ${campiScelti.length}`
          : `Analisi completata: ${trovati} campi estratti su ${campiScelti.length}`,
      );
    } catch (e) {
      toast.error((e as Error).message || "Errore durante l'analisi del documento");
    } finally {
      setAnalizzando(false);
    }
  };

  const salvaTemplate = async () => {
    if (!nomeTemplate.trim()) {
      toast.error("Indica un nome per il template");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: nomeTemplate.trim(),
        gruppo_ramo_id: gruppoRamoId,
        campi: campiSelezionati,
        corpo,
        created_by: profile?.id ?? null,
        ufficio_id: profile?.ufficio_id ?? null,
      };
      if (templateId) {
        const { error } = await supabase
          .from("elaborazioni_template")
          .update({ nome: payload.nome, campi: payload.campi, corpo: payload.corpo, gruppo_ramo_id: payload.gruppo_ramo_id })
          .eq("id", templateId);
        if (error) throw error;
        toast.success("Template aggiornato");
      } else {
        const { data, error } = await supabase
          .from("elaborazioni_template")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setTemplateId(data.id);
        toast.success("Template salvato");
      }
      queryClient.invalidateQueries({ queryKey: ["elab-templates"] });
    } catch (e) {
      toast.error((e as Error).message || "Errore salvataggio template");
    } finally {
      setSalvando(false);
    }
  };

  const salvaElaborazione = async () => {
    if (!clienteId) return;
    const numeri = titoliSelezionati.map((t) => t.numero_titolo).filter(Boolean).join(", ");
    const titolo = `${nomeTemplate.trim() || "Elaborazione"}${numeri ? ` — ${numeri}` : ""}`;
    const { error } = await supabase.from("elaborazioni").insert({
      cliente_id: clienteId,
      titolo_id: titoloSel?.id || null,
      documento_id: documentoIds[0] || null,
      template_id: templateId || null,
      gruppo_ramo_id: gruppoRamoId,
      titolo,
      campi_estratti: valori as never,
      contenuto: anteprima,
      stato: "generata",
      created_by: profile?.id ?? null,
      ufficio_id: profile?.ufficio_id ?? null,
      tipo: ELAB_TIPO_SINGOLA,
      titolo_ids: titoloIds,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Elaborazione salvata nello storico");
    queryClient.invalidateQueries({ queryKey: ["elab-storico", clienteId] });
  };

  const generaPdf = async () => {
    try {
      const bytes = await buildElaborazionePdf(anteprima, {
        titolo: nomeTemplate.trim() || "Elaborazione polizza",
        cliente: clienteSel ? nomeCliente(clienteSel) : null,
        polizza: titoliSelezionati.map((t) => t.numero_titolo).filter(Boolean).join(", ") || null,
      });
      downloadPdf(bytes, `elaborazione-${titoloSel?.numero_titolo ?? "polizze"}.pdf`);
      await salvaElaborazione();
    } catch (e) {
      toast.error((e as Error).message || "Errore generazione PDF");
    }
  };

  /* ------------------------------------------------------------------- UI */

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elaborazioni</h1>
          <p className="text-sm text-muted-foreground">
            Sommario di più polizze sul template del cliente, oppure elaborazione singola da documento
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-primary" /> Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-xl">
            <Label>Cliente</Label>
            <ClienteSearchSelect
              value={clienteId}
              onValueChange={setClienteId}
              placeholder="Seleziona cliente..."
              searchPlaceholder="Nome, più nomi, indirizzo, CF…"
            />
          </div>
          {clienteId && clienteSel && (
            <ElaborazioniSommarioPanel
              clienteId={clienteId}
              clienteLabel={nomeCliente(clienteSel)}
              partitaIva={clienteSel.partita_iva}
              codiceFiscale={clienteSel.codice_fiscale}
            />
          )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem value="singola" className="border rounded-lg px-4">
          <AccordionTrigger>
            <span className="text-sm font-semibold">Elaborazione da documenti (più rami e polizze + template)</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-4">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Selezione */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-primary" /> 1. Rami, polizze e documenti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Rami da analizzare</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={gruppiRamo.length === 0}
                  onClick={() =>
                    setGruppoRamoIds(
                      gruppoRamoIds.length === gruppiRamo.length ? [] : gruppiRamo.map((g) => g.value),
                    )
                  }
                >
                  {gruppoRamoIds.length === gruppiRamo.length && gruppiRamo.length > 0
                    ? "Deseleziona tutti"
                    : "Seleziona tutti"}
                </Button>
              </div>
              <ScrollArea className="h-36 rounded-md border border-border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {gruppiRamo.map((g) => (
                    <label
                      key={g.value}
                      className="flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={gruppoRamoIds.includes(g.value)}
                        onCheckedChange={() => setGruppoRamoIds((prev) => toggleId(prev, g.value))}
                        className="mt-0.5"
                      />
                      <span>{g.label}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {gruppoRamoIds.length === 0
                  ? "Senza rami restano solo i campi generici. Seleziona i rami prima dell'analisi."
                  : `${gruppoRamoIds.length} ram${gruppoRamoIds.length === 1 ? "o" : "i"} · i campi catalogo e le polizze si adattano alla scelta.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Polizze con documenti{" "}
                  <span className="text-muted-foreground font-normal">
                    ({titoloIds.length}/{titoliConDocumenti.length})
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!clienteId || titoliConDocumenti.length === 0}
                  onClick={() =>
                    setTitoloIds(
                      titoloIds.length === titoliConDocumenti.length
                        ? []
                        : titoliConDocumenti.map((t) => t.id),
                    )
                  }
                >
                  {titoloIds.length === titoliConDocumenti.length && titoliConDocumenti.length > 0
                    ? "Deseleziona tutte"
                    : "Seleziona tutte"}
                </Button>
              </div>
              {loadingTitoli || loadingDoc ? (
                <Skeleton className="h-28 w-full" />
              ) : (
                <ScrollArea className="h-40 rounded-md border border-border p-3">
                  {!clienteId ? (
                    <p className="text-sm text-muted-foreground">Seleziona prima un cliente.</p>
                  ) : titoliConDocumenti.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {gruppoRamoIds.length
                        ? "Nessuna polizza con documenti per i rami scelti."
                        : "Nessuna polizza con documenti."}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {titoliConDocumenti.map((t) => {
                        const ramoLabel =
                          t.ramo?.gruppo_ramo?.descrizione || t.ramo?.descrizione || null;
                        const nDoc = documenti.filter((d) => d.entita_id === t.id).length;
                        return (
                          <label
                            key={t.id}
                            className="flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent/40"
                          >
                            <Checkbox
                              checked={titoloIds.includes(t.id)}
                              onCheckedChange={() => setTitoloIds((prev) => toggleId(prev, t.id))}
                              className="mt-0.5"
                            />
                            <span>
                              {t.numero_titolo ?? "—"}
                              {t.prodotto_nome ? ` · ${t.prodotto_nome}` : ""}
                              <span className="block text-xs text-muted-foreground">
                                {[ramoLabel, `${nDoc} document${nDoc === 1 ? "o" : "i"}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Documenti da analizzare{" "}
                  <span className="text-muted-foreground font-normal">
                    ({documentoIds.length}/{documentiPolizze.length})
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={documentiPolizze.length === 0}
                  onClick={() =>
                    setDocumentoIds(
                      documentoIds.length === documentiPolizze.length
                        ? []
                        : documentiPolizze.map((d) => d.id),
                    )
                  }
                >
                  {documentoIds.length === documentiPolizze.length && documentiPolizze.length > 0
                    ? "Deseleziona tutti"
                    : "Seleziona tutti"}
                </Button>
              </div>
              <ScrollArea className="h-36 rounded-md border border-border p-3">
                {titoloIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Seleziona almeno una polizza.</p>
                ) : documentiPolizze.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun documento sulle polizze scelte.</p>
                ) : (
                  <div className="space-y-1.5">
                    {documentiPolizze.map((d) => {
                      const polizza = titoli.find((t) => t.id === d.entita_id);
                      return (
                        <label
                          key={d.id}
                          className="flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent/40"
                        >
                          <Checkbox
                            checked={documentoIds.includes(d.id)}
                            onCheckedChange={() => setDocumentoIds((prev) => toggleId(prev, d.id))}
                            className="mt-0.5"
                          />
                          <span>
                            {d.nome_file}
                            <span className="block text-xs text-muted-foreground">
                              {[
                                polizza?.numero_titolo,
                                d.categoria,
                                new Date(d.created_at).toLocaleDateString("it-IT"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label className="text-sm">
                Campi da estrarre{" "}
                <span className="text-muted-foreground font-normal">
                  ({campiSelezionati.length}/{catalogo.length})
                </span>
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCampiSelezionati(
                    campiSelezionati.length === catalogo.length ? [] : catalogo.map((c) => c.chiave),
                  )
                }
              >
                {campiSelezionati.length === catalogo.length ? "Deseleziona tutti" : "Seleziona tutti"}
              </Button>
            </div>

            {loadingCampi ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ScrollArea className="h-52 rounded-md border border-border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalogo.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent/40"
                    >
                      <Checkbox
                        checked={campiSelezionati.includes(c.chiave)}
                        onCheckedChange={() => toggleCampo(c.chiave)}
                        className="mt-0.5"
                      />
                      <span>
                        {c.etichetta}
                        {c.gruppo_ramo_id && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                            ramo
                          </Badge>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button
              onClick={analizza}
              disabled={documentoIds.length === 0 || campiScelti.length === 0 || analizzando}
              className="w-full"
            >
              {analizzando ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisi in corso…</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {documentoIds.length > 1
                    ? `Analizza ${documentoIds.length} documenti con IA`
                    : "Analizza documento con IA"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. Campi estratti */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> 2. Campi estratti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {noteAi && <p className="text-xs text-muted-foreground italic">{noteAi}</p>}
            {Object.keys(valori).length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nessun campo estratto. Seleziona rami, polizze e documenti, poi avvia l'analisi IA.
              </p>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-3">
                  {campiScelti.map((c) => (
                    <div key={c.chiave} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {c.etichetta} <code className="ml-1">{`{{${c.chiave}}}`}</code>
                      </Label>
                      <Input
                        value={formatValore(valori[c.chiave], c.tipo)}
                        onChange={(e) =>
                          setValori((prev) => ({ ...prev, [c.chiave]: e.target.value }))
                        }
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> 3. Template e documento generato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Template esistente</Label>
              <SearchableSelect
                options={templates.map((t) => ({ value: t.id, label: t.nome, description: t.descrizione ?? undefined }))}
                value={templateId}
                onValueChange={applicaTemplate}
                clearable
                clearLabel="— Nuovo template —"
                placeholder="Nuovo template"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome template</Label>
              <Input
                value={nomeTemplate}
                onChange={(e) => setNomeTemplate(e.target.value)}
                placeholder="Es. Riepilogo polizza RCA"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={salvaTemplate} disabled={salvando} className="flex-1">
                {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva template
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Corpo del template (usa i segnaposto {`{{campo}}`})</Label>
              <Textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={18}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {campiScelti.map((c) => (
                  <button
                    key={c.chiave}
                    type="button"
                    onClick={() => setCorpo((p) => `${p}{{${c.chiave}}}`)}
                    className="text-[11px] rounded border border-border px-1.5 py-0.5 hover:bg-accent"
                  >
                    {`{{${c.chiave}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Anteprima</Label>
              <div className="rounded-md border border-border bg-card p-4 h-[430px] overflow-auto whitespace-pre-wrap text-sm">
                {anteprima}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={salvaElaborazione} disabled={!clienteId}>
              <Save className="w-4 h-4 mr-2" /> Salva elaborazione
            </Button>
            <Button onClick={generaPdf} disabled={!clienteId}>
              <FileText className="w-4 h-4 mr-2" /> Genera PDF
            </Button>
          </div>
        </CardContent>
      </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Storico */}
      {clienteId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storico elaborazioni del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            {storico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nessuna elaborazione salvata per questo cliente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storico.map((s, i) => (
                    <TableRow key={s.id} className={i % 2 ? "bg-muted/30" : undefined}>
                      <TableCell>{new Date(s.created_at).toLocaleString("it-IT")}</TableCell>
                      <TableCell>{s.titolo ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.tipo === "sommario_portafoglio"
                            ? `Sommario (${(s.titolo_ids || []).length || "più"} polizze)`
                            : "Singola"}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{s.stato}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCorpo(s.contenuto ?? "");
                            setValori(s.campi_estratti ?? {});
                            toast.info("Elaborazione caricata nell'editor");
                          }}
                        >
                          Riapri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ElaborazioniPage;
