import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  MultiDocumentUploadPanel,
  patchPendingFile,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ensureFileExtension } from "@/lib/sanitizeFileName";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { Loader2 } from "lucide-react";
import { safeId } from "@/lib/safeId";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const TIPI_DOCUMENTO = [
  "Quietanza", "Appendice", "Comunicazione compagnia", "Documento identità",
  "Libretto di circolazione", "Verbale", "Perizia", "Visura", "Privacy/GDPR", "Altro",
];

const ENTITA_OPTIONS = [
  { value: "cliente", label: "Generale (anagrafica ente)" },
  { value: "titolo", label: "Su una polizza" },
  { value: "sinistro", label: "Su un sinistro" },
];

const BUCKET_BY_ENTITA: Record<string, string> = {
  cliente: "documenti_clienti",
  titolo: "documenti_titoli",
  sinistro: "documenti_sinistri",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** opzionale: se passato, blocca su questa entità */
  fixedEntita?: { tipo: "cliente" | "titolo" | "sinistro"; id: string };
  /** sempre richiesto: id anagrafica cliente per costruire path */
  clienteAnagraficaId: string;
  onUploaded?: () => void;
}

export default function UploadDocClienteDialog({ open, onOpenChange, fixedEntita, clienteAnagraficaId, onUploaded }: Props) {
  const { user } = useAuth();
  const [entitaTipo, setEntitaTipo] = useState<string>(fixedEntita?.tipo ?? "cliente");
  const [entitaId, setEntitaId] = useState<string>(fixedEntita?.id ?? clienteAnagraficaId);
  const [polizze, setPolizze] = useState<any[]>([]);
  const [sinistri, setSinistri] = useState<any[]>([]);
  const [tipo, setTipo] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setPendingFiles([]);
    setTipo("");
    setErr("");
    if (!fixedEntita) {
      setEntitaTipo("cliente");
      setEntitaId(clienteAnagraficaId);
    }
  };

  useEffect(() => {
    if (!open || fixedEntita) return;
    supabase.from("titoli").select("id, numero_titolo, compagnie(nome)").eq("cliente_anagrafica_id", clienteAnagraficaId).order("created_at", { ascending: false }).then(({ data }) => setPolizze(data ?? []));
    supabase.from("sinistri").select("id, numero_sinistro").eq("cliente_anagrafica_id", clienteAnagraficaId).neq("stato", "archiviato").order("created_at", { ascending: false }).then(({ data }) => setSinistri(data ?? []));
  }, [open, clienteAnagraficaId, fixedEntita]);

  useEffect(() => {
    if (fixedEntita) return;
    if (entitaTipo === "cliente") setEntitaId(clienteAnagraficaId);
    else setEntitaId("");
  }, [entitaTipo, clienteAnagraficaId, fixedEntita]);

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || !user || !entitaId) return;
    if (!tipo) { setErr("Seleziona la tipologia documento"); return; }
    const emptyName = pendingFiles.find((p) => !p.displayName.trim());
    if (emptyName) { setErr("Inserisci un nome per ogni documento"); return; }
    setErr("");
    setBusy(true);
    const bucket = BUCKET_BY_ENTITA[entitaTipo];
    let ok = 0;
    let fail = 0;
    try {
      for (const item of pendingFiles) {
        setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "uploading", error: undefined }));
        try {
          const nomeFile = ensureFileExtension(item.displayName.trim(), item.file.name);
          const safe = item.file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${clienteAnagraficaId}/${entitaTipo}/${entitaId}/${safeId()}-${safe}`;
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, item.file, { contentType: item.file.type, upsert: false });
          if (upErr) throw upErr;

          const { error: insErr } = await supabase.from("documenti").insert({
            nome_file: nomeFile,
            path_storage: path,
            bucket_name: bucket,
            entita_tipo: entitaTipo,
            entita_id: entitaId,
            caricato_da: user.id,
            caricato_da_cliente: true,
            visibile_al_cliente: true,
            categoria: tipo,
          });
          if (insErr) {
            await supabase.storage.from(bucket).remove([path]);
            throw insErr;
          }
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "done" }));
          ok += 1;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Errore caricamento";
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "error", error: msg }));
          fail += 1;
        }
      }
      if (ok > 0) onUploaded?.();
      if (ok > 0 && fail === 0) {
        toast.success(ok === 1 ? "Documento caricato" : `${ok} documenti caricati`);
        reset();
        onOpenChange(false);
      } else if (ok > 0 && fail > 0) {
        toast.warning(`${ok} caricati, ${fail} con errore`);
        setPendingFiles((prev) => prev.filter((p) => p.status !== "done"));
      } else {
        toast.error("Nessun documento caricato");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Carica documento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!fixedEntita && (
            <>
              <div>
                <Label>Collega a *</Label>
                <SearchableSelect options={ENTITA_OPTIONS} value={entitaTipo} onValueChange={setEntitaTipo} placeholder="Seleziona" />
              </div>
              {entitaTipo === "titolo" && (
                <div>
                  <Label>Polizza *</Label>
                  <SearchableSelect
                    options={polizze.map(p => ({ value: p.id, label: `${p.numero_titolo ?? "—"} · ${(p.compagnie as any)?.nome ?? ""}` }))}
                    value={entitaId}
                    onValueChange={setEntitaId}
                    placeholder="Seleziona polizza"
                  />
                </div>
              )}
              {entitaTipo === "sinistro" && (
                <div>
                  <Label>Sinistro *</Label>
                  <SearchableSelect
                    options={sinistri.map(s => ({ value: s.id, label: s.numero_sinistro ?? s.id }))}
                    value={entitaId}
                    onValueChange={setEntitaId}
                    placeholder="Seleziona sinistro"
                  />
                </div>
              )}
            </>
          )}
          <div>
            <Label>Tipologia documento *</Label>
            <SearchableSelect
              options={TIPI_DOCUMENTO.map(t => ({ value: t, label: t }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Seleziona tipologia"
            />
          </div>
          <MultiDocumentUploadPanel
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            inputId="up-doc-cli"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            allowedMimeTypes={ALLOWED}
            disabled={busy}
            visibileAlClienteDefault
            hint={`PDF, JPG, PNG — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`}
            dropzoneClassName="hover:border-teal-500"
            error={err}
            validateFile={(f) => {
              if (!ALLOWED.includes(f.type)) return "Tipo non supportato. Usa PDF, JPG, PNG.";
              return null;
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button
            onClick={() => void handleUpload()}
            disabled={pendingFiles.length === 0 || !tipo || !entitaId || busy}
            className="bg-teal-700 hover:bg-teal-800"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy
              ? "Caricamento..."
              : pendingFiles.length > 1
                ? `Carica ${pendingFiles.length} documenti`
                : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
