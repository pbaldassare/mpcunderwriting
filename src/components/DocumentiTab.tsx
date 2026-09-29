import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Upload, Download, Trash2, FileText, Eye, Pencil, Check, X, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAttivita } from "@/lib/logAttivita";
import PdfPreview from "@/components/PdfPreview";
import { ensureFileExtension, fileBaseNameWithoutExt, sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { labelTipoDocumento } from "@/lib/tipiDocumentoCliente";
import { fetchMetadatiInvioMessaCassa, type InvioEmailMessaCassaMeta } from "@/lib/documentiMessaCassa";
import { fetchMetadatiInvioEcCliente, type InvioEmailEcClienteMeta } from "@/lib/documentiEcCliente";
import {
  DOC_CATEGORIA_INVIATO_EMAIL,
  fetchMetadatiInvioDocumentoEmail,
  fetchStoricoInviiPerDocumentoOrigine,
  type InvioEmailDocumentoMeta,
  type StoricoInvioDocumento,
} from "@/lib/documentiInvioEmail";
import { InviaDocumentoEmailDialog } from "@/components/documentale/InviaDocumentoEmailDialog";
import type { AppendicePolizzaRow } from "@/lib/appendiciPolizza";
import UploadDocStaffDialog from "@/components/clienti/UploadDocStaffDialog";
import {
  MultiDocumentUploadPanel,
  patchPendingFile,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

export interface DocumentiAggregateSource {
  /** chiave stabile per il filtro */
  key: string;
  /** etichetta mostrata nella colonna Origine e nel filtro */
  label: string;
  entitaTipo: string;
  ids: string[];
  /** se valorizzato limita alle categorie indicate */
  categorie?: string[];
}

interface DocumentiTabProps {
  entitaTipo: string;
  entitaId: string;
  /** Se valorizzato, la query legge i documenti di TUTTI gli id elencati (catena polizza+quietanze). L'upload viene comunque salvato sul primo id (madre). */
  entitaIds?: string[];
  /** Documenti su titoli collegati (es. avvisi messa a cassa archiviati sulla polizza madre). */
  titoloIdsForExtraDocs?: string[];
  /** Categorie titolo da includere insieme ai documenti dell'entità principale. */
  extraTitoloCategorie?: string[];
  /** Sorgenti aggiuntive (polizze, quietanze, sinistri, trattative...) mostrate nella stessa tabella con filtro Origine. */
  aggregateSources?: DocumentiAggregateSource[];
  /** Etichetta origine per i documenti dell'entità principale. */
  origineLabel?: string;
  /** Allegati appendici (storage appendici_polizza) mostrati nella vista polizza madre. */
  appendiciAllegati?: AppendicePolizzaRow[];
  bucketName?: string;
  readOnly?: boolean;
  /** Upload tipizzato via modale (anagrafica cliente backoffice). */
  typedUpload?: boolean;
  /** Etichetta cliente per titolo modale upload. */
  entitaLabel?: string;
  /** Se false, nasconde anteprima (icona occhio e click su miniatura/nome). */
  showPreview?: boolean;
}



const BUCKET_MAP: Record<string, string> = {
  cliente: "documenti_clienti",
  sinistro: "documenti_sinistri",
  titolo: "documenti_titoli",
  prospect: "documenti_generali",
  trattativa: "documenti_generali",
  rimessa: "documenti_generali",
};

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

function DocumentThumbnail({ bucketName, pathStorage, nomeFile, onClick, clickable }: { bucketName: string; pathStorage: string; nomeFile: string; onClick?: () => void; clickable?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const ext = nomeFile.split(".").pop()?.toLowerCase() || "";
  const isImage = IMAGE_EXTENSIONS.includes(ext);
  const isPdf = ext === "pdf";

  useEffect(() => {
    if (!isImage) return;
    let revoke: string | null = null;
    supabase.storage.from(bucketName).download(pathStorage).then(({ data }) => {
      if (data) {
        const blobUrl = URL.createObjectURL(data);
        revoke = blobUrl;
        setUrl(blobUrl);
      }
    });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [bucketName, pathStorage, isImage]);

  const base = clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : "";

  if (isImage && url) {
    return <img src={url} alt={nomeFile} className={`w-10 h-10 rounded object-cover border border-border ${base}`} onClick={clickable ? onClick : undefined} />;
  }
  if (isPdf) {
    return <FileText className={`h-8 w-8 text-red-500 ${base}`} onClick={clickable ? onClick : undefined} />;
  }
  return <FileText className={`h-8 w-8 text-muted-foreground ${base}`} onClick={clickable ? onClick : undefined} />;
}

export default function DocumentiTab({
  entitaTipo,
  entitaId,
  entitaIds,
  titoloIdsForExtraDocs,
  extraTitoloCategorie,
  aggregateSources,
  origineLabel,
  bucketName,
  readOnly = false,
  typedUpload = false,
  entitaLabel,
  showPreview = true,
  appendiciAllegati,
}: DocumentiTabProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<Uint8Array | null>(null);
  const [invioDoc, setInvioDoc] = useState<any>(null);
  const [filtroOrigine, setFiltroOrigine] = useState("all");
  const [filtroTipologia, setFiltroTipologia] = useState("all");
  const [filtroVisibile, setFiltroVisibile] = useState("all");
  const [ricerca, setRicerca] = useState("");
  const bucket = bucketName || BUCKET_MAP[entitaTipo] || "documenti_generali";
  const canInviaEmail = !readOnly && ["titolo", "cliente", "sinistro"].includes(entitaTipo);

  // Catena di id su cui leggere (es. polizza madre + tutte le quietanze). Fallback: solo entitaId.
  const idsForRead = (entitaIds && entitaIds.length > 0) ? entitaIds : [entitaId];
  // Upload viene sempre attribuito al primo id (per i titoli = madre della catena, stabile).
  const uploadEntitaId = (entitaIds && entitaIds.length > 0) ? entitaIds[0] : entitaId;
  const idsKey = [...idsForRead].sort().join(",");
  const extraTitoloKey = (titoloIdsForExtraDocs ?? []).slice().sort().join(",");
  const extraCatKey = (extraTitoloCategorie ?? []).slice().sort().join(",");
  const sources = useMemo(
    () => (aggregateSources ?? []).filter((s) => s.ids.length > 0),
    [aggregateSources],
  );
  const sourcesKey = sources
    .map((s) => `${s.key}:${[...s.ids].sort().join("|")}:${(s.categorie ?? []).join("|")}`)
    .join(";");
  const origineBase = origineLabel ?? "Scheda";

  const { data: documenti } = useQuery({
    queryKey: ["documenti", entitaTipo, idsKey, extraTitoloKey, extraCatKey, sourcesKey],
    queryFn: async () => {
      const { data: main } = await supabase
        .from("documenti")
        .select("*, profiles:caricato_da(nome, cognome)")
        .eq("entita_tipo", entitaTipo)
        .in("entita_id", idsForRead)
        .order("created_at", { ascending: false });

      let extra: any[] = [];
      if (titoloIdsForExtraDocs?.length && extraTitoloCategorie?.length) {
        const { data: titoloDocs } = await supabase
          .from("documenti")
          .select("*, profiles:caricato_da(nome, cognome)")
          .eq("entita_tipo", "titolo")
          .in("entita_id", titoloIdsForExtraDocs)
          .in("categoria", extraTitoloCategorie)
          .order("created_at", { ascending: false });
        extra = titoloDocs ?? [];
      }

      // Sorgenti aggregate (polizze, quietanze, sinistri, trattative...)
      const aggregated = await Promise.all(
        sources.map(async (s) => {
          let q = supabase
            .from("documenti")
            .select("*, profiles:caricato_da(nome, cognome)")
            .eq("entita_tipo", s.entitaTipo)
            .in("entita_id", s.ids);
          if (s.categorie?.length) q = q.in("categoria", s.categorie);
          const { data } = await q.order("created_at", { ascending: false });
          return (data ?? []).map((d: any) => ({ ...d, _origineKey: s.key, _origineLabel: s.label }));
        }),
      );

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const doc of [
        ...(main ?? []).map((d: any) => ({ ...d, _origineKey: "self", _origineLabel: origineBase })),
        ...extra.map((d: any) => ({ ...d, _origineKey: "self", _origineLabel: origineBase })),
        ...aggregated.flat(),
      ]) {
        const key = doc.path_storage || doc.id;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(doc);
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return merged;
    },
  });

  const tipologieDisponibili = useMemo(() => {
    const set = new Set<string>();
    for (const d of documenti ?? []) if (d.categoria) set.add(d.categoria as string);
    return [...set].sort((a, b) => labelTipoDocumento(a).localeCompare(labelTipoDocumento(b)));
  }, [documenti]);

  const origini = useMemo(() => {
    const list: { key: string; label: string }[] = [{ key: "self", label: origineBase }];
    for (const s of sources) list.push({ key: s.key, label: s.label });
    return list.filter((o) => (documenti ?? []).some((d: any) => d._origineKey === o.key));
  }, [documenti, sources, origineBase]);

  const documentiFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return (documenti ?? []).filter((d: any) => {
      if (filtroOrigine !== "all" && d._origineKey !== filtroOrigine) return false;
      if (filtroTipologia !== "all" && (d.categoria || "__none__") !== filtroTipologia) return false;
      if (filtroVisibile === "si" && !d.visibile_al_cliente) return false;
      if (filtroVisibile === "no" && d.visibile_al_cliente) return false;
      if (q && !String(d.nome_file || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documenti, filtroOrigine, filtroTipologia, filtroVisibile, ricerca]);

  const filtriAttivi =
    filtroOrigine !== "all" || filtroTipologia !== "all" || filtroVisibile !== "all" || ricerca.trim() !== "";


  const avvisoIds = useMemo(
    () => (documenti ?? []).filter((d: any) => d.categoria === "notifica_messa_cassa").map((d: any) => d.id as string),
    [documenti],
  );

  const ecEmailIds = useMemo(
    () => (documenti ?? []).filter((d: any) => d.categoria === "ec_cliente_email").map((d: any) => d.id as string),
    [documenti],
  );

  const docInviatiIds = useMemo(
    () => (documenti ?? []).filter((d: any) => d.categoria === DOC_CATEGORIA_INVIATO_EMAIL).map((d: any) => d.id as string),
    [documenti],
  );

  const allDocIds = useMemo(
    () => (documenti ?? []).map((d: any) => d.id as string).filter(Boolean),
    [documenti],
  );

  const { data: invioEmailByDocId = new Map<string, InvioEmailMessaCassaMeta>() } = useQuery({
    queryKey: ["documenti-invio-email", avvisoIds.join(",")],
    enabled: avvisoIds.length > 0,
    queryFn: () => fetchMetadatiInvioMessaCassa(avvisoIds),
  });

  const { data: invioEcByDocId = new Map<string, InvioEmailEcClienteMeta>() } = useQuery({
    queryKey: ["documenti-invio-ec-cliente", ecEmailIds.join(",")],
    enabled: ecEmailIds.length > 0,
    queryFn: () => fetchMetadatiInvioEcCliente(ecEmailIds),
  });

  const { data: invioDocByDocId = new Map<string, InvioEmailDocumentoMeta>() } = useQuery({
    queryKey: ["documenti-invio-documento-email", docInviatiIds.join(",")],
    enabled: docInviatiIds.length > 0,
    queryFn: () => fetchMetadatiInvioDocumentoEmail(docInviatiIds),
  });

  const { data: storicoInviiByOrigine = new Map<string, StoricoInvioDocumento>() } = useQuery({
    queryKey: ["documenti-storico-invii-origine", allDocIds.join(",")],
    enabled: canInviaEmail && allDocIds.length > 0,
    queryFn: () => fetchStoricoInviiPerDocumentoOrigine(allDocIds),
  });



  const resetUploadDialog = () => {
    setPendingFiles([]);
    setUploadError("");
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    const emptyName = pendingFiles.find((p) => !p.displayName.trim());
    if (emptyName) {
      setUploadError("Inserisci un nome per ogni documento");
      return;
    }
    setUploadError("");
    setUploading(true);
    let ok = 0;
    let fail = 0;
    try {
      const userId = user?.id
        ?? (await supabase.auth.getSession()).data.session?.user?.id
        ?? null;
      if (!userId) {
        toast.error("Sessione scaduta: effettua di nuovo l'accesso");
        return;
      }
      for (const item of pendingFiles) {
        setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "uploading", error: undefined }));
        try {
          const nomeFile = ensureFileExtension(item.displayName.trim(), item.file.name);
          const path = `${entitaTipo}/${uploadEntitaId}/${Date.now()}_${sanitizeStorageFileName(item.file.name)}`;
          const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, item.file);
          if (uploadErr) throw uploadErr;
          const { error: insertErr } = await supabase.from("documenti").insert({
            nome_file: nomeFile,
            path_storage: path,
            bucket_name: bucket,
            entita_tipo: entitaTipo,
            entita_id: uploadEntitaId,
            caricato_da: userId,
            visibile_al_cliente: item.visibileAlCliente,
          });
          if (insertErr) throw insertErr;
          await logAttivita({
            azione: "upload_documento",
            entita_tipo: entitaTipo,
            entita_id: uploadEntitaId,
            dettagli_json: { nome_file: nomeFile, visibile_al_cliente: item.visibileAlCliente },
          });
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "done" }));
          ok += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Errore caricamento";
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "error", error: msg }));
          fail += 1;
        }
      }
      qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
      if (ok > 0 && fail === 0) {
        toast.success(ok === 1 ? "Documento caricato" : `${ok} documenti caricati`);
        resetUploadDialog();
        setUploadDialogOpen(false);
      } else if (ok > 0 && fail > 0) {
        toast.warning(`${ok} caricati, ${fail} con errore`);
        setPendingFiles((prev) => prev.filter((p) => p.status !== "done"));
      } else {
        toast.error("Nessun documento caricato");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRename = async (doc: any) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const nomeFile = ensureFileExtension(trimmed, doc.nome_file);
    const { error } = await supabase.from("documenti").update({ nome_file: nomeFile }).eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Documento rinominato");
    setRenamingId(null);
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
  };

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from(doc.bucket_name).download(doc.path_storage);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome_file;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleVisibilita = async (doc: any) => {
    await supabase.from("documenti").update({ visibile_al_cliente: !doc.visibile_al_cliente }).eq("id", doc.id);
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
  };

  const handleDelete = async (doc: any) => {
    await supabase.storage.from(doc.bucket_name).remove([doc.path_storage]);
    await supabase.from("documenti").delete().eq("id", doc.id);
    toast.success("Documento eliminato");
    qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
  };

  const openPreview = async (doc: any) => {
    const ext = doc.nome_file.split(".").pop()?.toLowerCase() || "";
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const isPdf = ext === "pdf";

    if (!isImage && !isPdf) {
      handleDownload(doc);
      return;
    }

    const { data, error } = await supabase.storage.from(doc.bucket_name).download(doc.path_storage);
    if (error) { toast.error(error.message); return; }
    if (isPdf) {
      const buf = new Uint8Array(await data.arrayBuffer());
      setPreviewPdfData(buf);
      setPreviewUrl(null);
    } else {
      const blobUrl = URL.createObjectURL(data);
      setPreviewUrl(blobUrl);
      setPreviewPdfData(null);
    }
    setPreviewDoc(doc);
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewPdfData(null);
    setPreviewDoc(null);
  };

  const handleDownloadAppendice = async (a: AppendicePolizzaRow) => {
    if (!a.file_path || !a.nome_file) return;
    const { data, error } = await supabase.storage.from("documenti_titoli").download(a.file_path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.nome_file;
    el.click();
    URL.revokeObjectURL(url);
  };

  const openPreviewAppendice = async (a: AppendicePolizzaRow) => {
    if (!a.file_path || !a.nome_file) return;
    const pseudo = {
      id: `appendice-${a.id}`,
      nome_file: a.nome_file,
      bucket_name: "documenti_titoli",
      path_storage: a.file_path,
    };
    await openPreview(pseudo);
  };

  const appendiceRows = appendiciAllegati ?? [];
  const showAppendici = appendiceRows.length > 0 && filtroOrigine === "all" && filtroTipologia === "all";
  const hasRows = documentiFiltrati.length > 0 || (showAppendici && appendiceRows.length > 0);
  const previewExt = previewDoc?.nome_file?.split(".")?.pop()?.toLowerCase() || "";
  const previewIsImage = IMAGE_EXTENSIONS.includes(previewExt);

  const showOrigine = origini.length > 1;
  const showTipologia = typedUpload || documenti?.some((d: any) => d.categoria) || (appendiciAllegati?.length ?? 0) > 0;
  const showInvioEmail =
    canInviaEmail ||
    documenti?.some(
      (d: any) =>
        d.categoria === "notifica_messa_cassa" ||
        d.categoria === "ec_cliente_email" ||
        d.categoria === DOC_CATEGORIA_INVIATO_EMAIL,
    );
  const colSpan = (showOrigine ? 1 : 0) + (showTipologia ? 1 : 0) + (showInvioEmail ? 1 : 0) + 6;


  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          {typedUpload ? (
            <>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> Carica Documento
              </Button>
              <UploadDocStaffDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                clienteId={uploadEntitaId}
                clienteLabel={entitaLabel}
                bucketName={bucket}
                onUploaded={() => qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] })}
              />
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setUploadDialogOpen(true)} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> {uploading ? "Caricamento..." : "Carica Documento"}
              </Button>
              <Dialog
                open={uploadDialogOpen}
                onOpenChange={(open) => {
                  if (!open) resetUploadDialog();
                  setUploadDialogOpen(open);
                }}
              >
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Carica Documento</DialogTitle>
                  </DialogHeader>
                  <MultiDocumentUploadPanel
                    files={pendingFiles}
                    onFilesChange={setPendingFiles}
                    disabled={uploading}
                    showVisibileAlCliente
                    error={uploadError}
                    hint={`Puoi selezionare più file — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
                      Annulla
                    </Button>
                    <Button onClick={() => void handleUpload()} disabled={pendingFiles.length === 0 || uploading}>
                      {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {uploading
                        ? "Caricamento..."
                        : pendingFiles.length > 1
                          ? `Carica ${pendingFiles.length} documenti`
                          : "Carica"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="Cerca per nome file..."
          className="h-9 w-full sm:w-56"
        />
        {showOrigine && (
          <Select value={filtroOrigine} onValueChange={setFiltroOrigine}>
            <SelectTrigger className="h-9 w-full sm:w-48"><SelectValue placeholder="Origine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le sezioni</SelectItem>
              {origini.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tipologieDisponibili.length > 0 && (
          <Select value={filtroTipologia} onValueChange={setFiltroTipologia}>
            <SelectTrigger className="h-9 w-full sm:w-56"><SelectValue placeholder="Tipologia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le tipologie</SelectItem>
              {tipologieDisponibili.map((c) => (
                <SelectItem key={c} value={c}>{labelTipoDocumento(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filtroVisibile} onValueChange={setFiltroVisibile}>
          <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue placeholder="Visibilità" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i documenti</SelectItem>
            <SelectItem value="si">Visibili al cliente</SelectItem>
            <SelectItem value="no">Non visibili</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {documentiFiltrati.length} di {documenti?.length ?? 0} documenti
        </span>
        {filtriAttivi && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFiltroOrigine("all"); setFiltroTipologia("all"); setFiltroVisibile("all"); setRicerca(""); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Azzera filtri
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16"></TableHead>
            <TableHead>Nome File</TableHead>
            {showOrigine && <TableHead>Origine</TableHead>}
            {showTipologia && <TableHead>Tipologia</TableHead>}
            {showInvioEmail && <TableHead>Invio email</TableHead>}
            <TableHead>Caricato da</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Visibile al cliente</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documentiFiltrati.map((doc: any) => (

            <TableRow key={doc.id}>
              <TableCell>
                <DocumentThumbnail
                  bucketName={doc.bucket_name}
                  pathStorage={doc.path_storage}
                  nomeFile={doc.nome_file}
                  clickable={showPreview}
                  onClick={showPreview ? () => openPreview(doc) : undefined}
                />
              </TableCell>
              <TableCell
                className={`font-medium ${showPreview && renamingId !== doc.id ? "cursor-pointer hover:underline" : ""}`}
                onClick={showPreview && renamingId !== doc.id ? () => openPreview(doc) : undefined}
              >
                {renamingId === doc.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleRename(doc);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void handleRename(doc)}>
                      <Check className="h-4 w-4 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenamingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  doc.nome_file
                )}
              </TableCell>
              {showOrigine && (
                <TableCell>
                  <Badge variant="outline" className="font-normal">{doc._origineLabel || origineBase}</Badge>
                </TableCell>
              )}
              {showTipologia && (

                <TableCell>
                  {doc.categoria ? (
                    <Badge variant="secondary" className="font-normal">{labelTipoDocumento(doc.categoria)}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              {showInvioEmail && (
                <TableCell className="text-xs max-w-[260px]">
                  {doc.categoria === "notifica_messa_cassa" ? (() => {
                    const meta = invioEmailByDocId.get(doc.id);
                    if (!meta) return <span className="text-muted-foreground">—</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="truncate" title={meta.destinatario ?? undefined}>
                          <span className="text-muted-foreground">A: </span>{meta.destinatario || "—"}
                        </div>
                        <div className="truncate text-muted-foreground" title={meta.oggetto ?? undefined}>
                          {meta.oggetto || "—"}
                        </div>
                        {meta.inviato_il && (
                          <div className="text-muted-foreground">
                            {format(new Date(meta.inviato_il), "dd/MM/yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })() : doc.categoria === "ec_cliente_email" ? (() => {
                    const meta = invioEcByDocId.get(doc.id);
                    if (!meta) return <span className="text-muted-foreground">—</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="truncate" title={meta.destinatario ?? undefined}>
                          <span className="text-muted-foreground">A: </span>{meta.destinatario || "—"}
                        </div>
                        <div className="truncate text-muted-foreground" title={meta.oggetto ?? undefined}>
                          {meta.oggetto || "—"}
                        </div>
                        {meta.inviato_il && (
                          <div className="text-muted-foreground">
                            {format(new Date(meta.inviato_il), "dd/MM/yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })() : doc.categoria === DOC_CATEGORIA_INVIATO_EMAIL ? (() => {
                    const meta = invioDocByDocId.get(doc.id);
                    if (!meta) return <span className="text-muted-foreground">Inviato</span>;
                    return (
                      <div className="space-y-0.5">
                        <div className="truncate" title={meta.destinatario ?? undefined}>
                          <span className="text-muted-foreground">A: </span>{meta.destinatario || "—"}
                          {meta.destinatario_tipo ? (
                            <span className="text-muted-foreground"> ({meta.destinatario_tipo})</span>
                          ) : null}
                        </div>
                        <div className="truncate text-muted-foreground" title={meta.oggetto ?? undefined}>
                          {meta.oggetto || "—"}
                        </div>
                        {meta.inviato_il && (
                          <div className="text-muted-foreground">
                            {format(new Date(meta.inviato_il), "dd/MM/yyyy HH:mm")}
                          </div>
                        )}
                      </div>
                    );
                  })() : (() => {
                    const st = storicoInviiByOrigine.get(doc.id);
                    if (!st || (!st.cliente && !st.compagnia)) {
                      return <span className="text-muted-foreground">Non inviato</span>;
                    }
                    return (
                      <div className="flex flex-col gap-1">
                        {st.cliente ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="default" className="text-[10px] font-normal bg-teal-700 hover:bg-teal-700">
                              Cliente{st.countCliente > 1 ? ` ×${st.countCliente}` : ""}
                            </Badge>
                            {st.cliente.inviato_il && (
                              <span className="text-[10px] text-muted-foreground" title={st.cliente.destinatario || undefined}>
                                {format(new Date(st.cliente.inviato_il), "dd/MM/yy HH:mm")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Cliente: no</span>
                        )}
                        {st.compagnia ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Compagnia{st.countCompagnia > 1 ? ` ×${st.countCompagnia}` : ""}
                            </Badge>
                            {st.compagnia.inviato_il && (
                              <span className="text-[10px] text-muted-foreground" title={st.compagnia.destinatario || undefined}>
                                {format(new Date(st.compagnia.inviato_il), "dd/MM/yy HH:mm")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Compagnia: no</span>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
              )}
              <TableCell>{doc.profiles ? `${doc.profiles.nome} ${doc.profiles.cognome}` : "—"}</TableCell>
              <TableCell>{format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
              <TableCell>
                <Switch checked={doc.visibile_al_cliente} onCheckedChange={() => toggleVisibilita(doc)} disabled={readOnly} />
              </TableCell>
              <TableCell className="flex gap-1">
                {showPreview && (
                  <Button size="icon" variant="ghost" onClick={() => openPreview(doc)}><Eye className="h-4 w-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                {canInviaEmail && (() => {
                  const st = storicoInviiByOrigine.get(doc.id);
                  const giaInviato = !!(st?.cliente || st?.compagnia);
                  return (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={giaInviato ? "text-teal-700" : undefined}
                    title={
                      giaInviato
                        ? `Già inviato${st?.cliente ? " al cliente" : ""}${st?.cliente && st?.compagnia ? " e" : ""}${st?.compagnia ? " alla compagnia" : ""} — puoi reinviarlo`
                        : "Invia per email"
                    }
                    onClick={() => setInvioDoc(doc)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                  );
                })()}
                {!readOnly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setRenamingId(doc.id);
                      setRenameValue(fileBaseNameWithoutExt(doc.nome_file));
                    }}
                    title="Rinomina"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {!readOnly && <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(doc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
          {showAppendici && appendiceRows.map((a) => (
            <TableRow key={`appendice-${a.id}`}>
              <TableCell>
                <DocumentThumbnail
                  bucketName="documenti_titoli"
                  pathStorage={a.file_path!}
                  nomeFile={a.nome_file!}
                  clickable={showPreview}
                  onClick={showPreview ? () => void openPreviewAppendice(a) : undefined}
                />
              </TableCell>
              <TableCell
                className={`font-medium ${showPreview ? "cursor-pointer hover:underline" : ""}`}
                onClick={showPreview ? () => void openPreviewAppendice(a) : undefined}
              >
                {a.nome_file}
              </TableCell>
              {showOrigine && (
                <TableCell><Badge variant="outline" className="font-normal">Appendici</Badge></TableCell>
              )}
              {showTipologia && (

                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    Appendice {a.numero_appendice}{a.tipo ? ` (${String(a.tipo).toUpperCase()})` : ""}
                  </Badge>
                </TableCell>
              )}
              {showInvioEmail && <TableCell className="text-muted-foreground text-xs">—</TableCell>}
              <TableCell className="text-muted-foreground text-xs">Sistema</TableCell>
              <TableCell>{a.created_at ? format(new Date(a.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
              <TableCell><Switch checked={false} disabled /></TableCell>
              <TableCell className="flex gap-1">
                {showPreview && (
                  <Button size="icon" variant="ghost" onClick={() => void openPreviewAppendice(a)}><Eye className="h-4 w-4" /></Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => void handleDownloadAppendice(a)}><Download className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
          {!hasRows && (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center py-6 text-muted-foreground">
                {filtriAttivi ? "Nessun documento corrisponde ai filtri" : "Nessun documento"}
              </TableCell>
            </TableRow>
          )}

        </TableBody>
      </Table>

      {/* Dialog conferma eliminazione */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deleteTarget?.nome_file}"? L'azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteTarget); setDeleteTarget(null); }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog anteprima documento */}
      {showPreview && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="truncate">{previewDoc?.nome_file}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {previewIsImage && previewUrl && (
                <div className="flex items-center justify-center h-full overflow-auto bg-muted/40 p-3">
                  <img src={previewUrl} alt={previewDoc?.nome_file} className="max-w-full max-h-full object-contain rounded" />
                </div>
              )}
              {!previewIsImage && previewPdfData && (
                <PdfPreview data={previewPdfData} fileName={previewDoc?.nome_file} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <InviaDocumentoEmailDialog
        open={!!invioDoc}
        onOpenChange={(open) => !open && setInvioDoc(null)}
        documento={invioDoc}
        storicoInvii={invioDoc ? storicoInviiByOrigine.get(invioDoc.id) ?? null : null}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["documenti", entitaTipo] });
          qc.invalidateQueries({ queryKey: ["documenti-invio-documento-email"] });
          qc.invalidateQueries({ queryKey: ["documenti-storico-invii-origine"] });
        }}
      />
    </div>
  );
}
