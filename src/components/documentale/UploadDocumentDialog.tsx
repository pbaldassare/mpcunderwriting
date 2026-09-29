import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MultiDocumentUploadPanel,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { Loader2 } from "lucide-react";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[], description: string, tags: string[]) => void | Promise<void>;
  loading?: boolean;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function UploadDocumentDialog({ open, onOpenChange, onUpload, loading }: UploadDocumentDialogProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const reset = () => {
    setPendingFiles([]);
    setDescription("");
    setTagsInput("");
  };

  const handleSubmit = async () => {
    if (pendingFiles.length === 0) return;
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    await onUpload(pendingFiles.map((p) => p.file), description.trim(), tags);
    reset();
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
        <DialogHeader><DialogTitle>Carica Documento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <MultiDocumentUploadPanel
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            inputId="file-upload"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            allowedMimeTypes={ALLOWED_TYPES}
            disabled={loading}
            hint={`PDF, Word, Excel, Immagini — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`}
            validateFile={(f) => {
              if (f.type && !ALLOWED_TYPES.includes(f.type)) {
                return "Tipo file non supportato. Usa PDF, Word, Excel o immagini.";
              }
              return null;
            }}
          />
          <div>
            <Label>Descrizione</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrizione comune per i documenti del lotto"
              maxLength={500}
              disabled={loading}
            />
          </div>
          <div>
            <Label>Tag (separati da virgola)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="CGA, auto, vita"
              maxLength={200}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button onClick={() => void handleSubmit()} disabled={pendingFiles.length === 0 || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading
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
