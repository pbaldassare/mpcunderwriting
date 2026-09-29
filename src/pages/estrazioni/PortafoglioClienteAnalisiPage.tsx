import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildPdfElaboratoCliente,
  buildPdfSinteticoCliente,
  downloadPdfBytes,
  exportAnalisiClienteExcel,
  isDocumentoCgaHint,
  resolveAnalisiCgaUiStatus,
  type AnalisiCgaDettaglio,
  type AnalisiCgaStato,
  type AnalisiClienteAssegnazioni,
  type AnalisiDocCgaHint,
  type AnalisiGaranziaRow,
  type AnalisiPolizzaRow,
} from "@/lib/portafoglioClienteAnalisi";
import {
  buildPdfSommarioCliente,
  parseSommarioLayoutJson,
  type ClienteTemplateSommarioRow,
  type SommarioPolizzaRow,
} from "@/lib/sommarioPolizze";
import { toast } from "sonner";

const fmtEur = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

const labelAnagrafica = (a: {
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
} | null | undefined) => {
  if (!a) return null;
  const rs = (a.ragione_sociale || "").trim();
  if (rs) return rs;
  const nome = `${a.cognome || ""} ${a.nome || ""}`.trim();
  return nome || null;
};

const PortafoglioClienteAnalisiPage = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"excel" | "sintetico" | "elaborato" | "sommario" | null>(null);

  const { data: cliente, isLoading: loadingCli } = useQuery({
    queryKey: ["analisi-cliente-anagrafica", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clienti")
        .select(
          "id, ragione_sociale, nome, cognome, tipo_cliente, codice_fiscale, partita_iva, ufficio_id, uffici(nome_ufficio)",
        )
        .eq("id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        ragione_sociale: string | null;
        nome: string | null;
        cognome: string | null;
        tipo_cliente: string | null;
        codice_fiscale: string | null;
        partita_iva: string | null;
        ufficio_id: string | null;
        uffici: { nome_ufficio: string | null } | null;
      } | null;
    },
  });

  const clienteLabel =
    cliente?.ragione_sociale ||
    `${cliente?.cognome || ""} ${cliente?.nome || ""}`.trim() ||
    "Cliente";

  const { data: produttoreClienteLabel } = useQuery({
    queryKey: ["analisi-cliente-produttore", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<string | null> => {
      const { data: intermediari, error: intErr } = await (supabase as any)
        .from("clienti_intermediari_default")
        .select("anagrafica_commerciale_id, ordine")
        .eq("cliente_id", clienteId!)
        .eq("tipo", "produttore")
        .order("ordine", { ascending: true })
        .limit(1);
      if (intErr) throw intErr;
      const anagId =
        (intermediari || [])[0]?.anagrafica_commerciale_id ||
        (
          await supabase
            .from("codici_commerciali_cliente")
            .select("anagrafica_id")
            .eq("cliente_id", clienteId!)
            .eq("ruolo", "Produttore Sede")
            .limit(1)
            .maybeSingle()
        ).data?.anagrafica_id;
      if (!anagId) return null;
      const { data: anag, error: anagErr } = await supabase
        .from("anagrafiche_professionali")
        .select("ragione_sociale, nome, cognome")
        .eq("id", anagId)
        .maybeSingle();
      if (anagErr) throw anagErr;
      return labelAnagrafica(anag);
    },
  });

  const { data: polizze = [], isLoading: loadingPolizze } = useQuery({
    queryKey: ["analisi-cliente-polizze", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<SommarioPolizzaRow[]> => {
      const { data, error } = await supabase
        .from("v_portafoglio_titoli")
        .select(
          "id, numero_titolo, stato, ramo_nome, compagnia_nome, premio_lordo, garanzia_da, garanzia_a, data_scadenza, tacito_rinnovo, prodotto_nome, produttore_nome, nome_ufficio, ufficio_id, periodicita, disdetta_giorni, mora_giorni, limite_mora, descrizione_polizza, is_regolazione",
        )
        .eq("cliente_anagrafica_id", clienteId!)
        .is("sostituisce_polizza", null)
        .in("stato", ["attivo", "sospeso", "incassato", "scaduto"])
        .order("garanzia_a", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        numero_titolo: r.numero_titolo,
        stato: r.stato,
        ramo_nome: r.ramo_nome,
        compagnia_nome: r.compagnia_nome,
        premio_lordo: r.premio_lordo,
        garanzia_da: r.garanzia_da,
        garanzia_a: r.garanzia_a,
        data_scadenza: r.data_scadenza,
        tacito_rinnovo: r.tacito_rinnovo,
        prodotto_nome: r.prodotto_nome,
        produttore_nome: r.produttore_nome || null,
        nome_ufficio: r.nome_ufficio || null,
        ufficio_id: r.ufficio_id || null,
        periodicita: r.periodicita || null,
        disdetta_giorni: r.disdetta_giorni ?? null,
        mora_giorni: r.mora_giorni ?? null,
        limite_mora: r.limite_mora || null,
        descrizione_polizza: r.descrizione_polizza || null,
        is_regolazione: r.is_regolazione ?? null,
      }));
    },
  });

  const titoloIds = useMemo(() => polizze.map((p) => p.id), [polizze]);

  const { data: extraTitoli = [] } = useQuery({
    queryKey: ["analisi-cliente-titoli-sommario", titoloIds.join(",")],
    enabled: titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, frazionamento, regolazione, regolazione_fattore, regolazione_note")
        .in("id", titoloIds);
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        frazionamento: string | null;
        regolazione: boolean | null;
        regolazione_fattore: string | null;
        regolazione_note: string | null;
      }>;
    },
  });

  const polizzeSommario = useMemo<SommarioPolizzaRow[]>(() => {
    const extra = new Map(extraTitoli.map((t) => [t.id, t]));
    return polizze.map((p) => {
      const e = extra.get(p.id);
      return {
        ...p,
        frazionamento: e?.frazionamento ?? p.frazionamento ?? null,
        regolazione: e?.regolazione ?? null,
        regolazione_fattore: e?.regolazione_fattore ?? null,
        regolazione_note: e?.regolazione_note ?? null,
      };
    });
  }, [polizze, extraTitoli]);

  const { data: templateSommario } = useQuery({
    queryKey: ["cliente-template-sommario", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<ClienteTemplateSommarioRow | null> => {
      const { data, error } = await (supabase as any)
        .from("clienti_template_sommario")
        .select("*")
        .eq("cliente_id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, layout_json: parseSommarioLayoutJson(data.layout_json) };
    },
  });

  const assegnazioni = useMemo((): AnalisiClienteAssegnazioni => {
    const ufficioFromPolizze = [...new Set(polizze.map((p) => p.nome_ufficio).filter(Boolean))] as string[];
    const prodFromPolizze = [...new Set(polizze.map((p) => p.produttore_nome).filter(Boolean))] as string[];
    return {
      ufficioLabel:
        cliente?.uffici?.nome_ufficio ||
        (ufficioFromPolizze.length === 1 ? ufficioFromPolizze[0] : ufficioFromPolizze[0] || null) ||
        null,
      produttoreLabel:
        produttoreClienteLabel ||
        (prodFromPolizze.length === 1 ? prodFromPolizze[0] : prodFromPolizze[0] || null) ||
        null,
    };
  }, [cliente, produttoreClienteLabel, polizze]);

  const showColProduttore = useMemo(() => {
    const vals = new Set(polizze.map((p) => (p.produttore_nome || "").trim()).filter(Boolean));
    return vals.size > 1;
  }, [polizze]);

  const showColSede = useMemo(() => {
    const vals = new Set(polizze.map((p) => (p.nome_ufficio || "").trim()).filter(Boolean));
    return vals.size > 1;
  }, [polizze]);

  const { data: garanzie = [] } = useQuery({
    queryKey: ["analisi-cliente-garanzie", clienteId, titoloIds.join(",")],
    enabled: titoloIds.length > 0,
    queryFn: async (): Promise<AnalisiGaranziaRow[]> => {
      const { data, error } = await supabase
        .from("premi_garanzia_polizza")
        .select("titolo_id, garanzia, capitale, firma, rata, tipo_premio")
        .in("titolo_id", titoloIds)
        .order("ordine", { ascending: true });
      if (error) throw error;
      const byTitolo = new Map(polizze.map((p) => [p.id, p.numero_titolo]));
      return ((data || []) as any[]).map((g) => ({
        titolo_id: g.titolo_id,
        numero_polizza: byTitolo.get(g.titolo_id) || null,
        garanzia: g.garanzia,
        capitale: g.capitale,
        firma: g.firma,
        rata: g.rata,
        tipo_premio: g.tipo_premio,
      }));
    },
  });

  const { data: cgaRows = [] } = useQuery({
    queryKey: ["analisi-cliente-cga", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<AnalisiCgaStato[]> => {
      const { data, error } = await supabase
        .from("polizza_cga")
        .select(
          "id, stato, titolo_id, numero_polizza, prodotto:prodotto_id(nome_prodotto, compagnia)",
        )
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        titolo_id: r.titolo_id,
        polizza_cga_id: r.id,
        stato: r.stato,
        numero_polizza: r.numero_polizza,
        prodotto_nome: r.prodotto?.nome_prodotto || null,
        compagnia: r.prodotto?.compagnia || null,
      }));
    },
  });

  const { data: docCgaHints = [] } = useQuery({
    queryKey: ["analisi-cliente-doc-cga", clienteId, titoloIds.join(",")],
    enabled: !!clienteId && titoloIds.length > 0,
    queryFn: async (): Promise<AnalisiDocCgaHint[]> => {
      const { data: docsTitolo, error } = await supabase
        .from("documenti")
        .select("id, entita_id, categoria, nome_file")
        .eq("entita_tipo", "titolo")
        .in("entita_id", titoloIds);
      if (error) throw error;

      const hints: AnalisiDocCgaHint[] = [];
      for (const d of (docsTitolo || []) as any[]) {
        if (!isDocumentoCgaHint(d.categoria, d.nome_file)) continue;
        hints.push({
          titolo_id: d.entita_id,
          documento_id: d.id,
          nome_file: d.nome_file || null,
        });
      }
      return hints;
    },
  });

  const { data: cgaDettagli = [], isLoading: loadingCgaDet } = useQuery({
    queryKey: ["analisi-cliente-cga-dettaglio", clienteId, cgaRows.map((c) => c.polizza_cga_id).join(",")],
    enabled: cgaRows.length > 0,
    queryFn: async (): Promise<AnalisiCgaDettaglio[]> => {
      const ids = cgaRows.map((c) => c.polizza_cga_id);
      const { data: pcs, error: pcErr } = await supabase
        .from("polizza_cga")
        .select(
          "id, titolo_id, numero_polizza, sommario_personalizzato, prodotto:prodotto_id(id, nome_prodotto, compagnia, massimale_aggregato_annuo, sommario_ai)",
        )
        .in("id", ids);
      if (pcErr) throw pcErr;

      const prodottoIds = [
        ...new Set(((pcs || []) as any[]).map((p) => p.prodotto?.id).filter(Boolean)),
      ] as string[];

      const [{ data: gpPers }, { data: gpProd }, { data: condizioni }] = await Promise.all([
        supabase
          .from("polizza_garanzie_personali")
          .select(
            "polizza_cga_id, massimale_personalizzato, franchigia_personalizzata, scoperto_personalizzato, note_personali, prodotto_garanzia:prodotto_garanzia_id(garanzia, massimale_standard, franchigia_standard, scoperto_percentuale, note)",
          )
          .in("polizza_cga_id", ids),
        prodottoIds.length
          ? supabase
              .from("prodotti_garanzie")
              .select(
                "prodotto_id, garanzia, massimale_standard, franchigia_standard, scoperto_percentuale, note",
              )
              .in("prodotto_id", prodottoIds)
          : Promise.resolve({ data: [] as any[] }),
        prodottoIds.length
          ? supabase
              .from("prodotti_condizioni")
              .select("prodotto_id, tipo, titolo, testo")
              .in("prodotto_id", prodottoIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const gpPersByCga = new Map<string, any[]>();
      for (const g of (gpPers || []) as any[]) {
        (gpPersByCga.get(g.polizza_cga_id) || gpPersByCga.set(g.polizza_cga_id, []).get(g.polizza_cga_id)!).push(g);
      }
      const gpProdByProd = new Map<string, any[]>();
      for (const g of (gpProd || []) as any[]) {
        (gpProdByProd.get(g.prodotto_id) || gpProdByProd.set(g.prodotto_id, []).get(g.prodotto_id)!).push(g);
      }
      const condByProd = new Map<string, any[]>();
      for (const c of (condizioni || []) as any[]) {
        (condByProd.get(c.prodotto_id) || condByProd.set(c.prodotto_id, []).get(c.prodotto_id)!).push(c);
      }

      return ((pcs || []) as any[]).map((pc) => {
        const prodottoId = pc.prodotto?.id as string | undefined;
        const personali = gpPersByCga.get(pc.id) || [];
        const garanzie =
          personali.length > 0
            ? personali.map((g) => ({
                garanzia: g.prodotto_garanzia?.garanzia || "Garanzia",
                massimale: g.massimale_personalizzato ?? g.prodotto_garanzia?.massimale_standard ?? null,
                franchigia: g.franchigia_personalizzata ?? g.prodotto_garanzia?.franchigia_standard ?? null,
                scoperto: g.scoperto_personalizzato ?? g.prodotto_garanzia?.scoperto_percentuale ?? null,
                note: g.note_personali || g.prodotto_garanzia?.note || null,
              }))
            : (gpProdByProd.get(prodottoId || "") || []).map((g) => ({
                garanzia: g.garanzia,
                massimale: g.massimale_standard ?? null,
                franchigia: g.franchigia_standard ?? null,
                scoperto: g.scoperto_percentuale ?? null,
                note: g.note || null,
              }));

        return {
          polizza_cga_id: pc.id,
          titolo_id: pc.titolo_id,
          numero_polizza: pc.numero_polizza,
          prodotto_nome: pc.prodotto?.nome_prodotto || null,
          compagnia: pc.prodotto?.compagnia || null,
          sommario: pc.sommario_personalizzato || pc.prodotto?.sommario_ai || null,
          massimale_aggregato: pc.prodotto?.massimale_aggregato_annuo ?? null,
          garanzie,
          condizioni: (condByProd.get(prodottoId || "") || []).map((c) => ({
            tipo: c.tipo,
            titolo: c.titolo,
            testo: c.testo,
          })),
        } satisfies AnalisiCgaDettaglio;
      });
    },
  });

  const cgaByTitolo = useMemo(() => {
    const m = new Map<string, AnalisiCgaStato>();
    for (const c of cgaRows) {
      if (c.titolo_id && !m.has(c.titolo_id)) m.set(c.titolo_id, c);
    }
    return m;
  }, [cgaRows]);

  const cgaByNumero = useMemo(() => {
    const m = new Map<string, AnalisiCgaStato>();
    for (const c of cgaRows) {
      const k = (c.numero_polizza || "").trim().toUpperCase();
      if (k && !m.has(k)) m.set(k, c);
    }
    return m;
  }, [cgaRows]);

  const docCgaByTitolo = useMemo(() => {
    const m = new Map<string, AnalisiDocCgaHint>();
    for (const d of docCgaHints) {
      if (!m.has(d.titolo_id)) m.set(d.titolo_id, d);
    }
    return m;
  }, [docCgaHints]);

  const resolveCga = (p: AnalisiPolizzaRow) =>
    cgaByTitolo.get(p.id) || cgaByNumero.get((p.numero_titolo || "").trim().toUpperCase()) || null;

  const resolveCgaUi = (p: AnalisiPolizzaRow) =>
    resolveAnalisiCgaUiStatus(resolveCga(p), docCgaByTitolo.get(p.id));

  const senzaCgaElaborata = polizze.filter((p) => !resolveCga(p));
  const conDocumentoCga = polizze.filter((p) => resolveCgaUi(p).kind === "documento").length;
  const totPremi = polizze.reduce((s, p) => s + (Number(p.premio_lordo) || 0), 0);
  const garanzieByTitolo = useMemo(() => {
    const m = new Map<string, AnalisiGaranziaRow[]>();
    for (const g of garanzie) {
      (m.get(g.titolo_id) || m.set(g.titolo_id, []).get(g.titolo_id)!).push(g);
    }
    return m;
  }, [garanzie]);

  const colCount = 8 + (showColProduttore ? 1 : 0) + (showColSede ? 1 : 0);

  const runExcel = () => {
    try {
      setBusy("excel");
      exportAnalisiClienteExcel({
        clienteLabel,
        assegnazioni,
        polizze,
        garanzie,
        cgaDettagli,
      });
      toast.success("Excel generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore Excel");
    } finally {
      setBusy(null);
    }
  };

  const pdfMeta = useMemo(
    () => ({
      codiceFiscale: cliente?.codice_fiscale ?? null,
      partitaIva: cliente?.partita_iva ?? null,
    }),
    [cliente?.codice_fiscale, cliente?.partita_iva],
  );

  const runSintetico = async () => {
    try {
      setBusy("sintetico");
      const bytes = await buildPdfSinteticoCliente({
        clienteLabel,
        assegnazioni,
        polizze,
        meta: pdfMeta,
      });
      const safe = clienteLabel.replace(/[^\w\-]+/g, "_").slice(0, 40);
      downloadPdfBytes(bytes, `sintetico_${safe}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("PDF sintetico generato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore PDF");
    } finally {
      setBusy(null);
    }
  };

  const runSommario = async () => {
    try {
      setBusy("sommario");
      const bytes = await buildPdfSommarioCliente({
        clienteLabel,
        polizze: polizzeSommario,
        garanzie,
        cgaDettagli,
        layout: templateSommario?.layout_json,
        meta: pdfMeta,
      });
      const safe = clienteLabel.replace(/[^\w\-]+/g, "_").slice(0, 40);
      downloadPdfBytes(bytes, `sommario_polizze_${safe}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success(
        templateSommario?.layout_key === "varese"
          ? "Sommario polizze generato (layout Comune di Varese)"
          : "Sommario polizze generato dal template cliente",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore sommario");
    } finally {
      setBusy(null);
    }
  };

  const runElaborato = async () => {
    try {
      setBusy("elaborato");
      const bytes = await buildPdfElaboratoCliente({
        clienteLabel,
        assegnazioni,
        polizze,
        cgaDettagli,
        meta: pdfMeta,
      });
      const safe = clienteLabel.replace(/[^\w\-]+/g, "_").slice(0, 40);
      downloadPdfBytes(bytes, `elaborato_${safe}_${format(new Date(), "yyyyMMdd")}.pdf`);
      if (!cgaDettagli.length) {
        toast.message("PDF elaborato generato", {
          description:
            "Nessuna CGA strutturata: il report include lo stato vuoto e l'elenco polizze. L'analisi AI si esegue dal dettaglio polizza o dal documentale.",
        });
      } else {
        toast.success("PDF elaborato generato");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore PDF elaborato");
    } finally {
      setBusy(null);
    }
  };

  if (!clienteId) {
    return <div className="p-6 text-sm text-muted-foreground">Cliente non specificato</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/portafoglio/estrazioni/per-cliente")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analisi portafoglio cliente</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loadingCli ? "…" : clienteLabel}
              {cliente?.partita_iva ? ` · P.IVA ${cliente.partita_iva}` : ""}
              {cliente?.codice_fiscale ? ` · CF ${cliente.codice_fiscale}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Produttore:</span>
                <span className="font-medium text-foreground">{assegnazioni.produttoreLabel || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Sede:</span>
                <span className="font-medium text-foreground">{assegnazioni.ufficioLabel || "—"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/archivi/clienti/${clienteId}`)}>
            Anagrafica
          </Button>
          <Button variant="outline" size="sm" onClick={runExcel} disabled={!polizze.length || !!busy}>
            {busy === "excel" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1 text-green-700" />}
            Excel
          </Button>
          <Button size="sm" onClick={runSommario} disabled={!polizze.length || !!busy || loadingCgaDet}>
            {busy === "sommario" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            Sommario polizze
            {templateSommario?.layout_key === "varese" ? " (Varese)" : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={runSintetico} disabled={!polizze.length || !!busy}>
            {busy === "sintetico" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            PDF sintetico
          </Button>
          <Button variant="outline" size="sm" onClick={runElaborato} disabled={!polizze.length || !!busy || loadingCgaDet}>
            {busy === "elaborato" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1 text-primary" />}
            PDF elaborato
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Polizze</p>
            <p className="text-xl font-bold">{loadingPolizze ? "…" : polizze.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Premi</p>
            <p className="text-xl font-bold">{fmtEur(totPremi)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">CGA elaborate</p>
            <p className="text-xl font-bold">{cgaRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Senza CGA elaborata</p>
            <p className="text-xl font-bold">{senzaCgaElaborata.length}</p>
            {conDocumentoCga > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                di cui {conDocumentoCga} con documento CGA in archivio
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Polizze e stato CGA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Stato CGA rilevato automaticamente da <strong>polizza_cga</strong> (match per titolo / numero) e, in
            assenza, da documenti già archiviati sul titolo (categoria / nome file CGA o capitolato). Non è
            possibile caricare o analizzare PDF da questa schermata: usa il dettaglio polizza o il documentale.
          </p>
        </CardContent>
      </Card>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="text-xs">Polizza</TableHead>
              <TableHead className="text-xs">Ramo / Prodotto</TableHead>
              <TableHead className="text-xs">Agenzia</TableHead>
              {showColProduttore && <TableHead className="text-xs">Produttore</TableHead>}
              {showColSede && <TableHead className="text-xs">Sede</TableHead>}
              <TableHead className="text-xs text-right">Premio</TableHead>
              <TableHead className="text-xs">Scadenza</TableHead>
              <TableHead className="text-xs">Tacito</TableHead>
              <TableHead className="text-xs">Garanzie</TableHead>
              <TableHead className="text-xs">CGA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingPolizze ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : polizze.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground text-sm">
                  Nessuna polizza per questo cliente
                </TableCell>
              </TableRow>
            ) : (
              polizze.map((p) => {
                const ui = resolveCgaUi(p);
                const gCount = (garanzieByTitolo.get(p.id) || []).length;
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/titoli/${p.id}`)}
                  >
                    <TableCell className="text-xs font-mono">{p.numero_titolo || "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div>{p.ramo_nome || "—"}</div>
                      <div className="text-muted-foreground">{p.prodotto_nome || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs">{p.compagnia_nome || "—"}</TableCell>
                    {showColProduttore && (
                      <TableCell className="text-xs">{p.produttore_nome || "—"}</TableCell>
                    )}
                    {showColSede && (
                      <TableCell className="text-xs">{p.nome_ufficio || "—"}</TableCell>
                    )}
                    <TableCell className="text-xs text-right tabular-nums">{fmtEur(p.premio_lordo)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(p.garanzia_a || p.data_scadenza)}</TableCell>
                    <TableCell className="text-xs">
                      {p.tacito_rinnovo == null ? "—" : p.tacito_rinnovo ? "Sì" : "No"}
                    </TableCell>
                    <TableCell className="text-xs">{gCount}</TableCell>
                    <TableCell className="text-xs">
                      {ui.kind === "elaborata" ? (
                        <Badge variant="default" className="gap-1">
                          <BadgeCheck className="h-3 w-3" />
                          {ui.stato}
                        </Badge>
                      ) : ui.kind === "documento" ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-teal-300 text-teal-800 bg-teal-50"
                          title={ui.nome_file || undefined}
                        >
                          <FileText className="h-3 w-3" />
                          Documento presente
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Assente</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {garanzie.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dettaglio garanzie gestionali</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Polizza</TableHead>
                  <TableHead className="text-xs">Garanzia</TableHead>
                  <TableHead className="text-xs text-right">Capitale</TableHead>
                  <TableHead className="text-xs text-right">Firma</TableHead>
                  <TableHead className="text-xs text-right">Rata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garanzie.slice(0, 200).map((g, i) => (
                  <TableRow key={`${g.titolo_id}-${g.garanzia}-${i}`}>
                    <TableCell className="text-xs font-mono">{g.numero_polizza || "—"}</TableCell>
                    <TableCell className="text-xs">{g.garanzia}</TableCell>
                    <TableCell className="text-xs text-right">{g.capitale != null ? fmtEur(g.capitale) : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{g.firma != null ? fmtEur(g.firma) : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{g.rata != null ? fmtEur(g.rata) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {garanzie.length > 200 && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrate 200 di {garanzie.length} — il resto è nell&apos;Excel.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PortafoglioClienteAnalisiPage;
