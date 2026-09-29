import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, FileOutput, Loader2, Plus, Trash2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { clienteSearchLabel, type ClienteSearchRow } from "@/lib/clienteSearch";
import {
  chunkIds,
  clientiOrFilter,
  filenameDistintaRestituzione,
  groupRestituzioneByCompagnia,
  agenzieDaTitoliClienti,
  CATEGORIA_DISTINTA_RESTITUZIONE,
  gruppiPerDistinta,
  labelTipoTitoloRestituzione,
  tipoTitoloRestituzione,
  type RestituzioneDocRiga,
} from "@/lib/restituzioneOriginali";
import { buildDistintaRestituzionePdf } from "@/lib/restituzioneOriginaliPdf";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ClienteChip = { id: string; label: string };
type VistaFiltro = "tutti" | "da_restituire" | "inviati";
type TabKey = "prepara" | "storico";

type TitoloLite = {
  id: string;
  numero_titolo: string | null;
  compagnia_id: string | null;
  compagnia_nome: string | null;
  cliente_nome_display: string | null;
  cliente_id: string | null;
  cliente_anagrafica_id: string | null;
  sostituisce_polizza: string | null;
  is_regolazione: boolean | null;
};

type DistintaSalvata = {
  id: string;
  compagnia_nome: string;
  num_documenti: number;
  num_titoli: number;
  pdf_path: string | null;
  bucket_name: string | null;
  created_at: string;
  data_invio: string | null;
  note: string | null;
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

function downloadBytes(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const RestituzioneOriginaliPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabKey>("prepara");
  const [clienti, setClienti] = useState<ClienteChip[]>([]);
  const [clientePick, setClientePick] = useState("");
  const [vista, setVista] = useState<VistaFiltro>("da_restituire");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const clienteIds = useMemo(() => clienti.map((c) => c.id), [clienti]);

  const addCliente = (id: string, row: ClienteSearchRow | null) => {
    if (!id) return;
    const label = clienteSearchLabel(row) || id.slice(0, 8);
    setClienti((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, { id, label }]));
    setClientePick("");
  };

  const { data: restituzioneData, isFetching } = useQuery({
    queryKey: ["restituzione-originali-docs", clienteIds],
    enabled: clienteIds.length > 0,
    queryFn: async (): Promise<{ rows: RestituzioneDocRiga[]; titoli: TitoloLite[] }> => {
      const { data: titoli, error: tErr } = await supabase
        .from("v_portafoglio_titoli")
        .select(
          "id, numero_titolo, compagnia_id, compagnia_nome, cliente_nome_display, cliente_id, cliente_anagrafica_id, sostituisce_polizza, is_regolazione",
        )
        .or(clientiOrFilter(clienteIds))
        .limit(1000);
      if (tErr) throw tErr;
      const titoloRows = (titoli || []) as TitoloLite[];
      if (titoloRows.length === 0) return { rows: [], titoli: [] };

      const titoloById = new Map(titoloRows.map((t) => [t.id, t]));
      const titoloIds = titoloRows.map((t) => t.id);
      const documenti: Array<{
        id: string;
        nome_file: string;
        entita_id: string;
        created_at: string | null;
      }> = [];
      for (const chunk of chunkIds(titoloIds, 200)) {
        const { data, error } = await supabase
          .from("documenti")
          .select("id, nome_file, entita_id, created_at")
          .eq("entita_tipo", "titolo")
          .in("entita_id", chunk)
          .order("created_at", { ascending: false });
        if (error) throw error;
        documenti.push(...((data || []) as typeof documenti));
      }

      const inviato = new Set<string>();
      const docIds = documenti.map((d) => d.id);
      for (const chunk of chunkIds(docIds, 200)) {
        const { data, error } = await (supabase.from("distinte_restituzione_originali_righe") as any)
          .select("documento_id")
          .in("documento_id", chunk);
        if (error) throw error;
        for (const r of data || []) {
          if (r.documento_id) inviato.add(r.documento_id);
        }
      }

      const rows = documenti.map((d) => {
        const t = titoloById.get(d.entita_id);
        return {
          documentoId: d.id,
          nomeFile: d.nome_file,
          createdAt: d.created_at,
          titoloId: d.entita_id,
          numeroTitolo: t?.numero_titolo || d.entita_id.slice(0, 8),
          tipoTitolo: tipoTitoloRestituzione(t || {}),
          clienteId: t?.cliente_anagrafica_id || t?.cliente_id || null,
          clienteNome: t?.cliente_nome_display || "—",
          compagniaId: t?.compagnia_id || null,
          compagniaNome: t?.compagnia_nome || "",
          inviato: inviato.has(d.id),
        };
      });
      return { rows, titoli: titoloRows };
    },
  });
  const rawRows = restituzioneData?.rows ?? [];
  const titoliClienti = restituzioneData?.titoli ?? [];
  const agenzieCliente = useMemo(() => agenzieDaTitoliClienti(titoliClienti), [titoliClienti]);

  const { data: storico = [], isFetching: loadingStorico } = useQuery({
    queryKey: ["distinte-restituzione-originali"],
    enabled: tab === "storico",
    queryFn: async (): Promise<DistintaSalvata[]> => {
      const { data, error } = await (supabase.from("distinte_restituzione_originali") as any)
        .select("id, compagnia_nome, num_documenti, num_titoli, pdf_path, bucket_name, created_at, data_invio, note")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as DistintaSalvata[];
    },
  });

  const visibili = useMemo(() => {
    if (vista === "inviati") return rawRows.filter((r) => r.inviato);
    if (vista === "da_restituire") return rawRows.filter((r) => !r.inviato);
    return rawRows;
  }, [rawRows, vista]);

  const selezionabili = visibili.filter((r) => !r.inviato);
  const allSelected = selezionabili.length > 0 && selezionabili.every((r) => selectedIds.has(r.documentoId));

  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) selezionabili.forEach((r) => next.add(r.documentoId));
    else selezionabili.forEach((r) => next.delete(r.documentoId));
    setSelectedIds(next);
  };

  const toggleOne = (row: RestituzioneDocRiga, checked: boolean) => {
    if (row.inviato) return;
    const next = new Set(selectedIds);
    if (checked) next.add(row.documentoId);
    else next.delete(row.documentoId);
    setSelectedIds(next);
  };

  const picked = useMemo(
    () => rawRows.filter((r) => selectedIds.has(r.documentoId) && !r.inviato),
    [rawRows, selectedIds],
  );
  const gruppiPreview = useMemo(() => groupRestituzioneByCompagnia(picked), [picked]);

  const clientiLabel = clienti.map((c) => c.label).filter(Boolean).join(", ");

  const apriNoteDialog = () => {
    setNoteDialogOpen(true);
  };

  const generaESalva = async () => {
    const note = noteText.trim();
    if (clienti.length === 0) {
      toast.error("Aggiungi almeno un cliente");
      return;
    }
    if (picked.length === 0 && !note) {
      toast.error("Scrivi le note oppure seleziona almeno un documento");
      return;
    }
    const gruppi = gruppiPerDistinta(picked, agenzieCliente);
    if (gruppi.length === 0) {
      toast.error("Nessuna agenzia sulle polizze del cliente");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;
      const now = new Date();
      const dataInvio = now.toISOString();
      for (const gruppo of gruppi) {
        const bytes = await buildDistintaRestituzionePdf(gruppo, now, {
          note: note || undefined,
          clientiLabel: clientiLabel || undefined,
        });
        const name = filenameDistintaRestituzione(gruppo.compagniaNome, now);
        const path = `distinte-restituzione/${now.getFullYear()}/${gruppo.compagniaId || "senza"}/${Date.now()}_${name}`;
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;

        const agenziaMatch =
          agenzieCliente.find(
            (a) =>
              (gruppo.compagniaId && a.compagniaId === gruppo.compagniaId) ||
              a.compagniaNome === gruppo.compagniaNome,
          ) ?? agenzieCliente[0] ?? null;
        const titoloIdPdf = gruppo.rows[0]?.titoloId || agenziaMatch?.titoloId || titoliClienti[0]?.id || null;
        const clienteIdPdf = gruppo.rows[0]?.clienteId || agenziaMatch?.clienteId || clienti[0]?.id || null;
        const clienteNomePdf = gruppo.rows[0]?.clienteNome || agenziaMatch?.clienteNome || clienti[0]?.label || "—";
        const numeroTitoloPdf =
          gruppo.rows[0]?.numeroTitolo || agenziaMatch?.numeroTitolo || titoliClienti[0]?.numero_titolo || null;

        const titoliUnici = new Set(
          [...gruppo.rows.map((r) => r.titoloId), titoloIdPdf].filter(Boolean) as string[],
        );
        const { data: header, error: hErr } = await (supabase.from("distinte_restituzione_originali") as any)
          .insert({
            compagnia_id: gruppo.compagniaId,
            compagnia_nome: gruppo.compagniaNome,
            num_documenti: gruppo.rows.length + 1,
            num_titoli: titoliUnici.size,
            pdf_path: path,
            bucket_name: "documenti_generali",
            stato: "salvata",
            note: note || null,
            data_invio: dataInvio,
            created_by: userId,
            ufficio_id: profile?.ufficio_id || null,
          })
          .select("id")
          .single();
        if (hErr || !header?.id) throw hErr || new Error("Salvataggio distinta fallito");

        let pdfDocId: string | null = null;
        if (titoloIdPdf || clienteIdPdf) {
          const { data: pdfDoc, error: dErr } = await supabase
            .from("documenti")
            .insert({
              nome_file: name,
              path_storage: path,
              bucket_name: "documenti_generali",
              entita_tipo: titoloIdPdf ? "titolo" : "cliente",
              entita_id: titoloIdPdf || clienteIdPdf!,
              caricato_da: userId,
              categoria: CATEGORIA_DISTINTA_RESTITUZIONE,
              visibile_al_cliente: false,
            })
            .select("id")
            .single();
          if (dErr) throw dErr;
          pdfDocId = pdfDoc?.id ?? null;
        }

        const righe = [
          ...gruppo.rows.map((r) => ({
            distinta_id: header.id,
            documento_id: r.documentoId,
            titolo_id: r.titoloId,
            cliente_id: r.clienteId,
            cliente_nome: r.clienteNome,
            numero_titolo: r.numeroTitolo,
            tipo_titolo: r.tipoTitolo,
            nome_file: r.nomeFile,
          })),
          ...(pdfDocId
            ? [
                {
                  distinta_id: header.id,
                  documento_id: pdfDocId,
                  titolo_id: titoloIdPdf,
                  cliente_id: clienteIdPdf,
                  cliente_nome: clienteNomePdf,
                  numero_titolo: numeroTitoloPdf,
                  tipo_titolo: "polizza",
                  nome_file: name,
                },
              ]
            : []),
        ];
        if (righe.length > 0) {
          const { error: rErr } = await (supabase.from("distinte_restituzione_originali_righe") as any).insert(righe);
          if (rErr) throw rErr;
        }

        await logAttivita({
          azione: "distinta_restituzione_originali",
          entita_tipo: "compagnia",
          entita_id: gruppo.compagniaId || header.id,
          dettagli_json: { distinta_id: header.id, documenti: gruppo.rows.length },
        });
        downloadBytes(bytes, name);
      }
      toast.success(
        gruppi.length === 1
          ? "PDF salvato negli inviati"
          : `${gruppi.length} PDF salvati negli inviati`,
      );
      setSelectedIds(new Set());
      setNoteText("");
      setNoteDialogOpen(false);
      setVista("inviati");
      queryClient.invalidateQueries({ queryKey: ["restituzione-originali-docs"] });
      queryClient.invalidateQueries({ queryKey: ["distinte-restituzione-originali"] });
    } catch (e: any) {
      toast.error("Errore generazione distinte: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const scaricaStorico = async (d: DistintaSalvata) => {
    if (!d.pdf_path) {
      toast.error("PDF non archiviato");
      return;
    }
    const { data, error } = await supabase.storage
      .from(d.bucket_name || "documenti_generali")
      .createSignedUrl(d.pdf_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Download non disponibile");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/portafoglio/estrazioni-stampe")}
            aria-label="Torna a Estrazioni e Stampe"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Restituzione originali</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cerca i clienti, opzionalmente seleziona i documenti da restituire, scrivi le note nel popup e genera il
              PDF. Ogni distinta viene salvata con data e invio.
            </p>
          </div>
        </div>
        <ToggleGroup type="single" value={tab} onValueChange={(v) => v && setTab(v as TabKey)}>
          <ToggleGroupItem value="prepara">Prepara</ToggleGroupItem>
          <ToggleGroupItem value="storico">Distinte salvate</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tab === "prepara" && (
        <>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aggiungi cliente</p>
                  <ClienteSearchSelect
                    value={clientePick}
                    onValueChange={(id) => {
                      setClientePick(id);
                    }}
                    onSelectCliente={(row) => {
                      if (row?.id) addCliente(row.id, row);
                    }}
                    placeholder="Cerca cliente…"
                    clearable
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!clientePick}
                    onClick={() => addCliente(clientePick, null)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Aggiungi
                  </Button>
                </div>
              </div>
              {clienti.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {clienti.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                      {c.label}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted"
                        aria-label={`Rimuovi ${c.label}`}
                        onClick={() => {
                          setClienti((prev) => prev.filter((x) => x.id !== c.id));
                          setSelectedIds(new Set());
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <ToggleGroup type="single" value={vista} onValueChange={(v) => v && setVista(v as VistaFiltro)}>
                <ToggleGroupItem value="da_restituire">Da restituire</ToggleGroupItem>
                <ToggleGroupItem value="inviati">Già inviati</ToggleGroupItem>
                <ToggleGroupItem value="tutti">Tutti</ToggleGroupItem>
              </ToggleGroup>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {clienti.length === 0
                ? "Aggiungi almeno un cliente per vedere i documenti."
                : `${visibili.length} documenti · ${picked.length} da spedire · ${gruppiPreview.length} compagnie`}
            </p>
            <Button size="sm" onClick={apriNoteDialog} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileOutput className="h-4 w-4 mr-1" />}
              Genera PDF{picked.length > 0 ? ` (${picked.length})` : ""}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => toggleAll(v === true)}
                        disabled={selezionabili.length === 0}
                        aria-label="Seleziona tutti"
                      />
                    </TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>N. titolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Agenzia</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFetching && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  )}
                  {!isFetching && clienti.length > 0 && visibili.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-sm text-muted-foreground">
                        Nessun documento per i clienti selezionati.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isFetching &&
                    visibili.map((r) => (
                      <TableRow key={r.documentoId} className={r.inviato ? "opacity-70" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(r.documentoId) || r.inviato}
                            disabled={r.inviato}
                            onCheckedChange={(v) => toggleOne(r, v === true)}
                            aria-label={`Restituisci ${r.nomeFile}`}
                          />
                        </TableCell>
                        <TableCell className="text-xs">{r.nomeFile}</TableCell>
                        <TableCell>{r.clienteNome}</TableCell>
                        <TableCell className="font-mono text-xs">{r.numeroTitolo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {labelTipoTitoloRestituzione(r.tipoTitolo)}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.compagniaNome || "—"}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.createdAt)}</TableCell>
                        <TableCell>
                          {r.inviato ? (
                            <Badge className="bg-teal-100 text-teal-800 border-teal-300 text-[10px]">Inviato</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Da restituire</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "storico" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Invio</TableHead>
                  <TableHead>Agenzia / compagnia</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Documenti</TableHead>
                  <TableHead>Titoli</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingStorico && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Caricamento...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingStorico && storico.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">
                      Nessuna distinta salvata.
                    </TableCell>
                  </TableRow>
                )}
                {storico.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{fmtDate(d.created_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(d.data_invio || d.created_at)}</TableCell>
                    <TableCell>{d.compagnia_nome}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={d.note || ""}>
                      {d.note?.trim() || "—"}
                    </TableCell>
                    <TableCell>{d.num_documenti}</TableCell>
                    <TableCell>{d.num_titoli}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => scaricaStorico(d)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Apri
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Note della distinta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {picked.length > 0
                ? `Le note diventano parte del PDF (${picked.length} documenti). L'agenzia è quella delle polizze del cliente.`
                : "Nessun documento selezionato: il PDF conterrà le note. L'agenzia è presa dalle polizze del cliente."}
            </p>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Agenzia dal cliente</p>
              <p className="font-medium">
                {agenzieCliente.length > 0
                  ? agenzieCliente.map((a) => a.compagniaNome).join(" · ")
                  : clienti.length === 0
                    ? "Aggiungi un cliente"
                    : "Nessuna agenzia sulle polizze del cliente"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restituzione-note">Note</Label>
              <Textarea
                id="restituzione-note"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Testo da includere nel PDF (destinatario, riferimenti, istruzioni di restituzione…)"
                rows={7}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)} disabled={saving}>
              Annulla
            </Button>
            <Button onClick={() => void generaESalva()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileOutput className="h-4 w-4 mr-1" />}
              Genera e salva PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RestituzioneOriginaliPage;
