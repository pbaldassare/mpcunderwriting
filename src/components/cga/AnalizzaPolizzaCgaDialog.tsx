import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import EstrazioneTecnicaPreview from "@/components/cga/EstrazioneTecnicaPreview";
import { persistEstrazioneTecnica, type EstrazioneTecnicaExtracted } from "@/lib/polizzaEstrazioneTecnica";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

type Props = {
  clienteId: string;
  trigger?: React.ReactNode;
};

type PremioRow = {
  garanzia: string;
  tipo_rata: "sottoscrizione" | "successiva";
  imponibile?: number;
  imposte?: number;
  lordo?: number;
};

type ExtractedData = {
  prodotto: {
    nome_prodotto: string;
    compagnia?: string;
    ramo?: string;
    edizione?: string;
    codice_modello?: string;
    compagnia_email_servizio_clienti?: string;
    compagnia_url_area_personale?: string;
    compagnia_ivass_albo?: string;
    compagnia_gruppo_ivass?: string;
    compagnia_pec?: string;
    compagnia_telefono?: string;
    compagnia_sede_legale?: string;
    compagnia_sede_operativa?: string;
    forma_copertura?: string;
    periodo_retroattivita_mesi?: number;
    massimale_aggregato_annuo?: number;
    oggetto_assicurazione?: string;
    ambito_territoriale?: string;
    termine_prescrizione_mesi?: number;
    termini_pagamento_premio_giorni?: number;
    diritto_recesso_descrizione?: string;
    foro_competente?: string;
    regime_fiscale?: string;
    limiti_eta_assicurato_min?: number;
    limiti_eta_assicurato_max?: number;
    clausola_broker?: string;
    note_legali?: string;
    sommario_ai?: string;
  };
  garanzie_prodotto?: Array<{
    garanzia: string;
    massimale_standard?: number;
    franchigia_standard?: number;
    scoperto_percentuale?: number;
    sottolimite?: number;
    franchigia_temporale_giorni?: number;
    aggregato_annuo?: number;
    ambito_territoriale?: string;
    note?: string;
  }>;
  condizioni_prodotto?: Array<{
    tipo: string;
    titolo?: string;
    testo: string;
    rilevante_sinistri?: boolean;
  }>;
  definizioni_prodotto?: Array<{ termine: string; definizione: string }>;
  articoli_prodotto?: Array<{ sezione?: string; numero?: string; titolo?: string; testo: string; ordine?: number }>;
  riferimenti_normativi?: Array<{ riferimento: string; contesto?: string }>;
  dati_personali?: {
    sommario_personalizzato?: string;
    numero_polizza?: string;
    contraente_ragione_sociale?: string;
    contraente_piva?: string;
    contraente_cf?: string;
    contraente_indirizzo?: string;
    contraente_cap?: string;
    contraente_comune?: string;
    contraente_provincia?: string;
    contraente_email?: string;
    assicurato_descrizione?: string;
    data_decorrenza?: string;
    data_scadenza?: string;
    data_emissione?: string;
    tacito_rinnovo?: boolean;
    cig?: string;
    cup?: string;
    frazionamento?: string;
    intermediario_nome?: string;
    intermediario_indirizzo?: string;
    intermediario_telefono?: string;
    intermediario_email?: string;
    premio_imponibile_totale?: number;
    premio_imposte_totale?: number;
    premio_lordo_totale?: number;
    premio_rata_sottoscrizione_lordo?: number;
    premio_rate_successive_lordo?: number;
    forma_copertura?: string;
    forma_copertura_note?: string;
  };
  partite?: EstrazioneTecnicaExtracted["partite"];
  beni_esclusi?: EstrazioneTecnicaExtracted["beni_esclusi"];
  esclusioni_polizza?: EstrazioneTecnicaExtracted["esclusioni_polizza"];
  sottolimiti?: EstrazioneTecnicaExtracted["sottolimiti"];
  premio_calcolo?: EstrazioneTecnicaExtracted["premio_calcolo"];
  garanzie_personali?: Array<{
    garanzia: string;
    massimale_personalizzato?: number;
    franchigia_personalizzata?: number;
    scoperto_personalizzato?: number;
    note_personali?: string;
  }>;
  premio_per_garanzia?: PremioRow[];
  testo_completo?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const fmtEur = (n?: number) =>
  typeof n === "number" ? n.toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : "—";

export default function AnalizzaPolizzaCgaDialog({ clienteId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [esiste, setEsiste] = useState<{ id: string } | null>(null);
  const qc = useQueryClient();

  const reset = () => {
    setFile(null);
    setExtracted(null);
    setEsiste(null);
    setExtracting(false);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-cga", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      const ed = data?.data as ExtractedData;
      if (!ed?.prodotto?.nome_prodotto) throw new Error("AI non ha riconosciuto il prodotto");
      setExtracted(ed);

      const { data: existing } = await supabase
        .from("prodotti_cga")
        .select("id")
        .eq("nome_prodotto", ed.prodotto.nome_prodotto)
        .eq("compagnia", ed.prodotto.compagnia ?? "")
        .eq("edizione", ed.prodotto.edizione ?? "")
        .maybeSingle();
      setEsiste(existing ?? null);
    } catch (e: any) {
      toast.error("Errore estrazione AI: " + (e?.message ?? "sconosciuto"));
    } finally {
      setExtracting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (stato: "approvato" | "bozza") => {
      if (!extracted || !file) throw new Error("Dati mancanti");
      const { data: { user } } = await supabase.auth.getUser();
      const p = extracted.prodotto;
      const dp = extracted.dati_personali ?? {};

      // 1. Upload PDF
      const path = `cliente/${clienteId}/cga/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documenti_clienti").upload(path, file);
      if (upErr) throw upErr;
      const { data: docRow, error: docErr } = await supabase.from("documenti").insert({
        nome_file: file.name, path_storage: path, bucket_name: "documenti_clienti",
        entita_tipo: "cliente", entita_id: clienteId, caricato_da: user?.id, categoria: "cga_polizza",
      }).select("id").single();
      if (docErr) throw docErr;

      // 2. Trova o crea prodotto + dati generici
      let prodottoId = esiste?.id;
      if (!prodottoId) {
        const { data: newProd, error: prodErr } = await supabase.from("prodotti_cga").insert({
          nome_prodotto: p.nome_prodotto,
          compagnia: p.compagnia ?? null,
          ramo: p.ramo ?? null,
          edizione: p.edizione ?? null,
          codice_modello: p.codice_modello ?? null,
          compagnia_email_servizio_clienti: p.compagnia_email_servizio_clienti ?? null,
          compagnia_url_area_personale: p.compagnia_url_area_personale ?? null,
          compagnia_ivass_albo: p.compagnia_ivass_albo ?? null,
          compagnia_gruppo_ivass: p.compagnia_gruppo_ivass ?? null,
          compagnia_pec: p.compagnia_pec ?? null,
          compagnia_telefono: p.compagnia_telefono ?? null,
          compagnia_sede_legale: p.compagnia_sede_legale ?? null,
          compagnia_sede_operativa: p.compagnia_sede_operativa ?? null,
          forma_copertura: p.forma_copertura ?? null,
          periodo_retroattivita_mesi: p.periodo_retroattivita_mesi ?? null,
          massimale_aggregato_annuo: p.massimale_aggregato_annuo ?? null,
          oggetto_assicurazione: p.oggetto_assicurazione ?? null,
          ambito_territoriale: p.ambito_territoriale ?? null,
          termine_prescrizione_mesi: p.termine_prescrizione_mesi ?? null,
          termini_pagamento_premio_giorni: p.termini_pagamento_premio_giorni ?? null,
          diritto_recesso_descrizione: p.diritto_recesso_descrizione ?? null,
          foro_competente: p.foro_competente ?? null,
          regime_fiscale: p.regime_fiscale ?? null,
          limiti_eta_assicurato_min: p.limiti_eta_assicurato_min ?? null,
          limiti_eta_assicurato_max: p.limiti_eta_assicurato_max ?? null,
          clausola_broker: p.clausola_broker ?? null,
          note_legali: p.note_legali ?? null,
          sommario_ai: p.sommario_ai ?? null,
          testo_completo: extracted.testo_completo ?? null,
          created_by: user?.id,
        } as any).select("id").single();
        if (prodErr) throw prodErr;
        prodottoId = newProd.id;

        if (extracted.garanzie_prodotto?.length) {
          await supabase.from("prodotti_garanzie").insert(
            extracted.garanzie_prodotto.map(g => ({
              prodotto_id: prodottoId,
              garanzia: g.garanzia,
              massimale_standard: g.massimale_standard ?? null,
              franchigia_standard: g.franchigia_standard ?? null,
              scoperto_percentuale: g.scoperto_percentuale ?? null,
              sottolimite: g.sottolimite ?? null,
              franchigia_temporale_giorni: g.franchigia_temporale_giorni ?? null,
              aggregato_annuo: g.aggregato_annuo ?? null,
              ambito_territoriale: g.ambito_territoriale ?? null,
              note: g.note ?? null,
            })) as any
          );
        }
        if (extracted.condizioni_prodotto?.length) {
          await supabase.from("prodotti_condizioni").insert(
            extracted.condizioni_prodotto.map(c => ({
              prodotto_id: prodottoId,
              tipo: c.tipo,
              titolo: c.titolo ?? null,
              testo: c.testo,
              rilevante_sinistri: c.rilevante_sinistri ?? true,
            }))
          );
        }
        if (extracted.definizioni_prodotto?.length) {
          await supabase.from("prodotti_definizioni" as any).insert(
            extracted.definizioni_prodotto.map(d => ({
              prodotto_id: prodottoId,
              termine: d.termine,
              definizione: d.definizione,
            }))
          );
        }
        if (extracted.articoli_prodotto?.length) {
          await supabase.from("prodotti_articoli" as any).insert(
            extracted.articoli_prodotto.map((a, i) => ({
              prodotto_id: prodottoId,
              sezione: a.sezione ?? null,
              numero: a.numero ?? null,
              titolo: a.titolo ?? null,
              testo: a.testo,
              ordine: a.ordine ?? i,
            }))
          );
        }
        if (extracted.riferimenti_normativi?.length) {
          await supabase.from("prodotti_riferimenti_normativi" as any).insert(
            extracted.riferimenti_normativi.map(r => ({
              prodotto_id: prodottoId,
              riferimento: r.riferimento,
              contesto: r.contesto ?? null,
            }))
          );
        }
      }

      // Collega titolo se numero polizza già in portafoglio del cliente
      let titoloId: string | null = null;
      const numPol = (dp.numero_polizza || "").trim();
      if (numPol) {
        const { data: titoloMatch } = await supabase
          .from("titoli")
          .select("id")
          .eq("cliente_id", clienteId)
          .eq("numero_titolo", numPol)
          .is("sostituisce_polizza", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        titoloId = titoloMatch?.id ?? null;
      }

      // 3. Crea polizza_cga con tutti i dati personali
      const { data: pc, error: pcErr } = await supabase.from("polizza_cga").insert({
        cliente_id: clienteId,
        prodotto_id: prodottoId,
        documento_id: docRow.id,
        titolo_id: titoloId,
        sommario_personalizzato: dp.sommario_personalizzato ?? null,
        numero_polizza: dp.numero_polizza ?? null,
        contraente_ragione_sociale: dp.contraente_ragione_sociale ?? null,
        contraente_piva: dp.contraente_piva ?? null,
        contraente_cf: dp.contraente_cf ?? null,
        contraente_indirizzo: dp.contraente_indirizzo ?? null,
        contraente_cap: dp.contraente_cap ?? null,
        contraente_comune: dp.contraente_comune ?? null,
        contraente_provincia: dp.contraente_provincia ?? null,
        contraente_email: dp.contraente_email ?? null,
        assicurato_descrizione: dp.assicurato_descrizione ?? null,
        data_decorrenza: dp.data_decorrenza ?? null,
        data_scadenza: dp.data_scadenza ?? null,
        data_emissione: dp.data_emissione ?? null,
        tacito_rinnovo: dp.tacito_rinnovo ?? null,
        cig: dp.cig ?? null,
        cup: dp.cup ?? null,
        frazionamento: dp.frazionamento ?? null,
        intermediario_nome: dp.intermediario_nome ?? null,
        intermediario_indirizzo: dp.intermediario_indirizzo ?? null,
        intermediario_telefono: dp.intermediario_telefono ?? null,
        intermediario_email: dp.intermediario_email ?? null,
        premio_imponibile_totale: dp.premio_imponibile_totale ?? null,
        premio_imposte_totale: dp.premio_imposte_totale ?? null,
        premio_lordo_totale: dp.premio_lordo_totale ?? null,
        premio_rata_sottoscrizione_lordo: dp.premio_rata_sottoscrizione_lordo ?? null,
        premio_rate_successive_lordo: dp.premio_rate_successive_lordo ?? null,
        forma_copertura: dp.forma_copertura ?? p.forma_copertura ?? null,
        forma_copertura_note: dp.forma_copertura_note ?? null,
        stato,
        approvato_da: stato === "approvato" ? user?.id : null,
        approvato_at: stato === "approvato" ? new Date().toISOString() : null,
        created_by: user?.id,
      } as any).select("id").single();
      if (pcErr) throw pcErr;

      // 4. Override personali per garanzia
      if (extracted.garanzie_personali?.length) {
        const { data: gp } = await supabase.from("prodotti_garanzie").select("id, garanzia").eq("prodotto_id", prodottoId);
        const byName = new Map((gp ?? []).map((x: any) => [x.garanzia.toLowerCase(), x.id]));
        await supabase.from("polizza_garanzie_personali").insert(
          extracted.garanzie_personali.map(g => ({
            polizza_cga_id: pc.id,
            prodotto_garanzia_id: byName.get(g.garanzia.toLowerCase()) ?? null,
            massimale_personalizzato: g.massimale_personalizzato ?? null,
            franchigia_personalizzata: g.franchigia_personalizzata ?? null,
            scoperto_personalizzato: g.scoperto_personalizzato ?? null,
            note_personali: g.note_personali ?? null,
          }))
        );
      }

      // 5. Composizione premio per garanzia
      if (extracted.premio_per_garanzia?.length) {
        await supabase.from("polizza_cga_premio_garanzia" as any).insert(
          extracted.premio_per_garanzia.map(r => ({
            polizza_cga_id: pc.id,
            garanzia: r.garanzia,
            tipo_rata: r.tipo_rata,
            imponibile: r.imponibile ?? null,
            imposte: r.imposte ?? null,
            lordo: r.lordo ?? null,
          }))
        );
      }

      await persistEstrazioneTecnica(supabase as never, pc.id, extracted);
    },
    onSuccess: () => {
      toast.success("Polizza CGA salvata");
      qc.invalidateQueries({ queryKey: ["polizze-cga", clienteId] });
      qc.invalidateQueries({ queryKey: ["analisi-cliente-cga", clienteId] });
      qc.invalidateQueries({ queryKey: ["analisi-cliente-cga-dettaglio", clienteId] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error("Errore salvataggio: " + e.message),
  });

  const dp = extracted?.dati_personali ?? {};
  const premioSott = extracted?.premio_per_garanzia?.filter(r => r.tipo_rata === "sottoscrizione") ?? [];
  const premioSucc = extracted?.premio_per_garanzia?.filter(r => r.tipo_rata === "successiva") ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analizza Polizza CGA
          </Button>
        )}
      </div>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Analizza Polizza CGA
          </DialogTitle>
          <DialogDescription>
            Carica il PDF della polizza/CGA. L&apos;AI estrae prodotto, anagrafica, partite, somme assicurate, esclusioni, beni esclusi, sottolimiti e calcolo premio.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          {!extracted ? (
            <div className="space-y-3 py-2">
              <Label>PDF della polizza</Label>
              <FileDropzone
                accept="application/pdf,image/*"
                selectedFiles={file ? [file] : undefined}
                onFilesSelected={(files) => setFile(files[0] ?? null)}
                hint="PDF o immagine"
              />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Prodotto */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Dati del Prodotto (generici)</CardTitle>
                    {esiste ? (
                      <Badge className="bg-green-600">Prodotto già in libreria</Badge>
                    ) : (
                      <Badge className="bg-blue-600">Nuovo prodotto</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Nome:</span> <b>{extracted.prodotto.nome_prodotto}</b></div>
                    <div><span className="text-muted-foreground">Compagnia:</span> {extracted.prodotto.compagnia ?? "—"}</div>
                    <div><span className="text-muted-foreground">Ramo:</span> {extracted.prodotto.ramo ?? "—"}</div>
                    <div><span className="text-muted-foreground">Edizione:</span> {extracted.prodotto.edizione ?? "—"}</div>
                    <div><span className="text-muted-foreground">Modello:</span> {extracted.prodotto.codice_modello ?? "—"}</div>
                    <div><span className="text-muted-foreground">Forma copertura:</span> {extracted.prodotto.forma_copertura ?? "—"}</div>
                    {extracted.prodotto.periodo_retroattivita_mesi != null && (
                      <div><span className="text-muted-foreground">Retroattività:</span> {extracted.prodotto.periodo_retroattivita_mesi} mesi</div>
                    )}
                    {extracted.prodotto.massimale_aggregato_annuo != null && (
                      <div><span className="text-muted-foreground">Massimale annuo:</span> {fmtEur(extracted.prodotto.massimale_aggregato_annuo)}</div>
                    )}
                  </div>
                  {extracted.prodotto.sommario_ai && (
                    <p className="text-muted-foreground text-xs italic">{extracted.prodotto.sommario_ai}</p>
                  )}
                  {!!extracted.garanzie_prodotto?.length && (
                    <div>
                      <div className="font-medium mb-1">Garanzie standard</div>
                      <TableScrollArea>
                      <table className="w-full min-w-max text-xs">
                        <thead><tr className="text-left text-muted-foreground">
                          <th>Garanzia</th><th>Massimale</th><th>Franchigia</th><th>Scop.%</th>
                        </tr></thead>
                        <tbody>
                          {extracted.garanzie_prodotto.map((g, i) => (
                            <tr key={i} className="odd:bg-muted/30">
                              <td>{g.garanzia}</td>
                              <td>{g.massimale_standard ?? "—"}</td>
                              <td>{g.franchigia_standard ?? "—"}</td>
                              <td>{g.scoperto_percentuale ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </TableScrollArea>
                    </div>
                  )}
                  {!!extracted.condizioni_prodotto?.length && (
                    <div className="text-xs">
                      <span className="font-medium">Condizioni:</span> {extracted.condizioni_prodotto.length} voci
                    </div>
                  )}
                  {!!extracted.definizioni_prodotto?.length && (
                    <div className="text-xs">
                      <span className="font-medium">Definizioni glossario:</span> {extracted.definizioni_prodotto.length}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Anagrafica polizza */}
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader className="pb-3"><CardTitle className="text-base">Anagrafica Polizza (personale)</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">N° polizza:</span> <b>{dp.numero_polizza ?? "—"}</b></div>
                    <div><span className="text-muted-foreground">CIG:</span> {dp.cig ?? "—"}</div>
                    <div><span className="text-muted-foreground">Decorrenza:</span> {dp.data_decorrenza ?? "—"}</div>
                    <div><span className="text-muted-foreground">Scadenza:</span> {dp.data_scadenza ?? "—"}</div>
                    <div><span className="text-muted-foreground">Emissione:</span> {dp.data_emissione ?? "—"}</div>
                    <div><span className="text-muted-foreground">Tacito rinnovo:</span> {dp.tacito_rinnovo == null ? "—" : dp.tacito_rinnovo ? "Sì" : "No"}</div>
                    <div><span className="text-muted-foreground">Frazionamento:</span> {dp.frazionamento ?? "—"}</div>
                    <div><span className="text-muted-foreground">CUP:</span> {dp.cup ?? "—"}</div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="font-medium text-xs mb-1">Contraente</div>
                    <div className="text-xs">
                      <div>{dp.contraente_ragione_sociale ?? "—"} {dp.contraente_piva && `· P.IVA ${dp.contraente_piva}`}</div>
                      <div className="text-muted-foreground">
                        {[dp.contraente_indirizzo, dp.contraente_cap, dp.contraente_comune, dp.contraente_provincia].filter(Boolean).join(" · ")}
                      </div>
                      {dp.contraente_email && <div className="text-muted-foreground">{dp.contraente_email}</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Intermediario */}
              {(dp.intermediario_nome || dp.intermediario_email) && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Intermediario</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>{dp.intermediario_nome ?? "—"}</div>
                    <div className="text-muted-foreground text-xs">{dp.intermediario_indirizzo ?? ""}</div>
                    <div className="text-muted-foreground text-xs">
                      {[dp.intermediario_telefono, dp.intermediario_email].filter(Boolean).join(" · ")}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Composizione premio */}
              {(premioSott.length > 0 || premioSucc.length > 0 || dp.premio_lordo_totale != null) && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Composizione Premio</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Imponibile:</span> <b>{fmtEur(dp.premio_imponibile_totale)}</b></div>
                      <div><span className="text-muted-foreground">Imposte:</span> <b>{fmtEur(dp.premio_imposte_totale)}</b></div>
                      <div><span className="text-muted-foreground">Lordo:</span> <b>{fmtEur(dp.premio_lordo_totale)}</b></div>
                    </div>
                    {premioSott.length > 0 && (
                      <div>
                        <div className="font-medium text-xs mb-1">Rata alla sottoscrizione</div>
                        <TableScrollArea>
                        <table className="w-full min-w-max text-xs">
                          <thead><tr className="text-left text-muted-foreground">
                            <th>Garanzia</th><th>Imponibile</th><th>Imposte</th><th>Lordo</th>
                          </tr></thead>
                          <tbody>
                            {premioSott.map((r, i) => (
                              <tr key={i} className="odd:bg-muted/30">
                                <td>{r.garanzia}</td><td>{fmtEur(r.imponibile)}</td><td>{fmtEur(r.imposte)}</td><td>{fmtEur(r.lordo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </TableScrollArea>
                      </div>
                    )}
                    {premioSucc.length > 0 && (
                      <div>
                        <div className="font-medium text-xs mb-1">Rate successive</div>
                        <TableScrollArea>
                        <table className="w-full min-w-max text-xs">
                          <thead><tr className="text-left text-muted-foreground">
                            <th>Garanzia</th><th>Imponibile</th><th>Imposte</th><th>Lordo</th>
                          </tr></thead>
                          <tbody>
                            {premioSucc.map((r, i) => (
                              <tr key={i} className="odd:bg-muted/30">
                                <td>{r.garanzia}</td><td>{fmtEur(r.imponibile)}</td><td>{fmtEur(r.imposte)}</td><td>{fmtEur(r.lordo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </TableScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <EstrazioneTecnicaPreview extracted={extracted} />

              {/* Override garanzie personali */}
              {!!extracted.garanzie_personali?.length && (
                <Card className="border-primary/40 bg-primary/5">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Override garanzie personali</CardTitle></CardHeader>
                  <CardContent className="text-sm">
                    <TableScrollArea>
                    <table className="w-full min-w-max text-xs">
                      <thead><tr className="text-left text-muted-foreground">
                        <th>Garanzia</th><th>Massimale</th><th>Franchigia</th><th>Scop.%</th><th>Note</th>
                      </tr></thead>
                      <tbody>
                        {extracted.garanzie_personali.map((g, i) => (
                          <tr key={i} className="odd:bg-muted/30">
                            <td>{g.garanzia}</td>
                            <td>{g.massimale_personalizzato ?? "—"}</td>
                            <td>{g.franchigia_personalizzata ?? "—"}</td>
                            <td>{g.scoperto_personalizzato ?? "—"}</td>
                            <td>{g.note_personali ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </TableScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!extracted ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={handleExtract} disabled={!file || extracting} className="gap-2">
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Avvia Analisi AI
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={reset}>Scarta</Button>
              <Button variant="outline" onClick={() => saveMutation.mutate("bozza")} disabled={saveMutation.isPending}>
                Salva come Bozza
              </Button>
              <Button onClick={() => saveMutation.mutate("approvato")} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Approva e Salva
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
