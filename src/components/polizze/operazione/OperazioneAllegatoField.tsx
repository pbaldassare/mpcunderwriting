import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { documentUploadTooLargeMessage, isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

interface Props {
  file: File | null;
  displayName: string;
  onFileChange: (file: File | null, displayName: string) => void;
  onDisplayNameChange: (name: string) => void;
  label?: string;
  id?: string;
}

export function OperazioneAllegatoField({
  file,
  displayName,
  onFileChange,
  onDisplayNameChange,
  label = "Documento allegato (opzionale)",
  id = "operazione-allegato",
}: Props) {
  const handleFilesSelected = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (isDocumentUploadTooLarge(f.size)) {
      toast.error(documentUploadTooLargeMessage());
      return;
    }
    onFileChange(f, f.name);
  };

  const removeFile = () => {
    onFileChange(null, "");
  };

  return (
    <div className="space-y-1.5 border-t pt-3">
      <Label htmlFor={id}>{label}</Label>
      {!file ? (
        <FileDropzone
          inputId={id}
          size="sm"
          icon={Paperclip}
          onFilesSelected={handleFilesSelected}
          hint={`Max ${MAX_DOCUMENT_UPLOAD_MB} MB. Il nome è modificabile; l'estensione viene preservata.`}
        />
      ) : (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Nome del documento"
            className="h-8 text-sm"
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={removeFile} title="Rimuovi">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export const ensureAllegatoExt = (displayName: string, originalName: string) => {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
};
