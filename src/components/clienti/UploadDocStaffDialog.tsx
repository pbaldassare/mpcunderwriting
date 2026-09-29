import { useState } from "react";
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
import { logAttivita } from "@/lib/logAttivita";
import { TIPI_DOCUMENTO_CLIENTE_STAFF } from "@/lib/tipiDocumentoCliente";
import { ensureFileExtension } from "@/lib/sanitizeFileName";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { Loader2 } from "lucide-react";
import { safeId } from "@/lib/safeId";

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteId: string;
  clienteLabel?: string;
  bucketName?: string;
  onUploaded?: () => void;
}

export default function UploadDocStaffDialog({
  open,
  onOpenChange,
  clienteId,
  clienteLabel,
  bucketName = "documenti_clienti",
  onUploaded,
}: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setPendingFiles([]);
    setTipo("");
    setErr("");
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || !user || !clienteId) return;
    if (!tipo) {
      setErr("Seleziona la tipologia documento");
      return;
    }
    const emptyName = pendingFiles.find((p) => !p.displayName.trim());
    if (emptyName) {
      setErr("Inserisci un nome per ogni documento");
      return;
    }
    setErr("");
    setBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const item of pendingFiles) {
        setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "uploading", error: undefined }));
        try {
          const nomeFile = ensureFileExtension(item.displayName.trim(), item.file.name);
          const safe = item.file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${clienteId}/cliente/${clienteId}/${safeId()}-${safe}`;
          const { error: upErr } = await supabase.storage
            .from(bucketName)
            .upload(path, item.file, { contentType: item.file.type, upsert: false });
          if (upErr) throw upErr;

          const { error: insErr } = await supabase.from("documenti").insert({
            nome_file: nomeFile,
            path_storage: path,
            bucket_name: bucketName,
            entita_tipo: "cliente",
            entita_id: clienteId,
            caricato_da: user.id,
            caricato_da_cliente: false,
            visibile_al_cliente: item.visibileAlCliente,
            categoria: tipo,
          });
          if (insErr) {
            await supabase.storage.from(bucketName).remove([path]);
            throw insErr;
          }

          await logAttivita({
            azione: "upload_documento",
            entita_tipo: "cliente",
            entita_id: clienteId,
            dettagli_json: { nome_file: nomeFile, categoria: tipo, visibile_al_cliente: item.visibileAlCliente },
          });
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
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Carica documento{clienteLabel ? ` — ${clienteLabel}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipologia documento *</Label>
            <SearchableSelect
              options={TIPI_DOCUMENTO_CLIENTE_STAFF.map((t) => ({ value: t.value, label: t.label }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Seleziona tipologia"
            />
            <p className="text-xs text-muted-foreground mt-1">
              La stessa tipologia viene applicata a tutti i file del lotto.
            </p>
          </div>
          <MultiDocumentUploadPanel
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            inputId="up-doc-staff"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            allowedMimeTypes={ALLOWED}
            disabled={busy}
            showVisibileAlCliente
            hint={`PDF, JPG, PNG — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`}
            error={err}
            validateFile={(f) => {
              if (!ALLOWED.includes(f.type)) return "Tipo non supportato. Usa PDF, JPG, PNG.";
              return null;
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annulla
          </Button>
          <Button onClick={() => void handleUpload()} disabled={pendingFiles.length === 0 || !tipo || busy}>
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
