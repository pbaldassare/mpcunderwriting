import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FileDropzone, formatFileSize } from "@/components/shared/FileDropzone";
import { fileBaseNameWithoutExt } from "@/lib/sanitizeFileName";
import {
  documentUploadTooLargeMessage,
  isDocumentUploadTooLarge,
  MAX_DOCUMENT_UPLOAD_MB,
} from "@/lib/uploadLimits";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeId } from "@/lib/safeId";

export type PendingDocStatus = "pending" | "uploading" | "done" | "error";

export interface PendingDocumentFile {
  id: string;
  file: File;
  /** Nome visualizzato senza obbligo di estensione (aggiunta al salvataggio). */
  displayName: string;
  visibileAlCliente: boolean;
  status: PendingDocStatus;
  error?: string;
}

export function createPendingDocumentFiles(
  files: File[],
  opts?: { visibileAlCliente?: boolean },
): PendingDocumentFile[] {
  const visibile = opts?.visibileAlCliente ?? false;
  return files.map((file) => ({
    id: safeId(),
    file,
    displayName: fileBaseNameWithoutExt(file.name),
    visibileAlCliente: visibile,
    status: "pending" as const,
  }));
}

export function defaultDocumentFileValidator(
  file: File,
  allowedMimeTypes?: string[],
): string | null {
  if (isDocumentUploadTooLarge(file.size)) return documentUploadTooLargeMessage();
  if (allowedMimeTypes?.length && file.type && !allowedMimeTypes.includes(file.type)) {
    return "Tipo file non supportato";
  }
  return null;
}

export interface MultiDocumentUploadPanelProps {
  files: PendingDocumentFile[];
  onFilesChange: (files: PendingDocumentFile[]) => void;
  accept?: string;
  allowedMimeTypes?: string[];
  hint?: string;
  disabled?: boolean;
  inputId?: string;
  className?: string;
  emptyLabel?: string;
  /** Mostra controlli "Visibile al cliente" (globale e/o per file). */
  showVisibileAlCliente?: boolean;
  /** Default per i nuovi file selezionati. */
  visibileAlClienteDefault?: boolean;
  /** Validazione custom; ritorna messaggio errore o null. */
  validateFile?: (file: File) => string | null;
  /** Messaggio errore globale sotto la lista. */
  error?: string;
  dropzoneClassName?: string;
}

export function MultiDocumentUploadPanel({
  files,
  onFilesChange,
  accept,
  allowedMimeTypes,
  hint,
  disabled = false,
  inputId,
  className,
  emptyLabel = "Trascina uno o più file qui oppure clicca per selezionare",
  showVisibileAlCliente = false,
  visibileAlClienteDefault = false,
  validateFile,
  error,
  dropzoneClassName,
}: MultiDocumentUploadPanelProps) {
  const busy = disabled || files.some((f) => f.status === "uploading");

  const addFiles = (incoming: File[]) => {
    const next: PendingDocumentFile[] = [];
    for (const file of incoming) {
      const sizeErr = isDocumentUploadTooLarge(file.size) ? documentUploadTooLargeMessage() : null;
      const customErr = sizeErr
        ? null
        : validateFile
          ? validateFile(file)
          : defaultDocumentFileValidator(file, allowedMimeTypes);
      const err = sizeErr ?? customErr;
      if (err) {
        toast.error(`${file.name}: ${err}`);
        continue;
      }
      const dup = files.some(
        (p) =>
          p.file.name === file.name &&
          p.file.size === file.size &&
          p.file.lastModified === file.lastModified,
      );
      if (dup) continue;
      next.push(...createPendingDocumentFiles([file], { visibileAlCliente: visibileAlClienteDefault }));
    }
    if (next.length) onFilesChange([...files, ...next]);
  };

  const updateFile = (id: string, patch: Partial<PendingDocumentFile>) => {
    onFilesChange(files.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const allVisible =
    files.length > 0 && files.every((f) => f.visibileAlCliente);
  const someVisible = files.some((f) => f.visibileAlCliente);

  const setAllVisible = (checked: boolean) => {
    onFilesChange(files.map((f) => ({ ...f, visibileAlCliente: checked })));
  };

  const defaultHint =
    hint ??
    `Puoi selezionare più file — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`;

  return (
    <div className={cn("space-y-4", className)}>
      <FileDropzone
        inputId={inputId}
        accept={accept}
        multiple
        disabled={busy}
        emptyLabel={emptyLabel}
        hint={defaultHint}
        className={dropzoneClassName}
        onFilesSelected={addFiles}
      />

      {showVisibileAlCliente && files.length > 0 && (
        <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
          <div>
            <Label htmlFor="visibile-cliente-batch">Visibile al cliente</Label>
            <p className="text-xs text-muted-foreground">
              Applica a tutti i file del lotto (modificabile anche per singolo file)
            </p>
          </div>
          <Switch
            id="visibile-cliente-batch"
            checked={allVisible}
            // indeterminate feel when mixed
            onCheckedChange={setAllVisible}
            disabled={busy}
            aria-checked={allVisible ? true : someVisible ? "mixed" : false}
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          <p className="text-xs text-muted-foreground">
            {files.length} file selezionat{files.length === 1 ? "o" : "i"} — puoi rinominare ogni documento.
            L&apos;estensione originale viene aggiunta automaticamente al salvataggio.
          </p>
          {files.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-md border p-2.5 space-y-2",
                item.status === "error" && "border-destructive/50 bg-destructive/5",
                item.status === "done" && "border-green-500/40 bg-green-500/5",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate" title={item.file.name}>
                      {item.file.name}
                    </span>
                    <span className="shrink-0">({formatFileSize(item.file.size)})</span>
                    {item.status === "uploading" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
                    )}
                    {item.status === "done" && (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    )}
                    {item.status === "error" && (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`nome-doc-${item.id}`} className="text-xs sr-only">
                      Nome documento
                    </Label>
                    <Input
                      id={`nome-doc-${item.id}`}
                      value={item.displayName}
                      onChange={(e) => updateFile(item.id, { displayName: e.target.value })}
                      placeholder="Nome del documento"
                      disabled={busy || item.status === "done"}
                      className="h-8 text-sm"
                    />
                  </div>
                  {showVisibileAlCliente && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <Switch
                        id={`visibile-${item.id}`}
                        checked={item.visibileAlCliente}
                        onCheckedChange={(c) => updateFile(item.id, { visibileAlCliente: c })}
                        disabled={busy || item.status === "done"}
                      />
                      <Label htmlFor={`visibile-${item.id}`} className="text-xs font-normal">
                        Visibile al cliente
                      </Label>
                    </div>
                  )}
                  {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                </div>
                {item.status !== "uploading" && item.status !== "done" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeFile(item.id)}
                    disabled={busy}
                    title="Rimuovi"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Aggiorna lo stato di un pending file (utile durante upload batch). */
export function patchPendingFile(
  files: PendingDocumentFile[],
  id: string,
  patch: Partial<PendingDocumentFile>,
): PendingDocumentFile[] {
  return files.map((f) => (f.id === id ? { ...f, ...patch } : f));
}
