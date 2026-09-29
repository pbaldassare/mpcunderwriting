import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ScanLine, Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { documentUploadTooLargeMessage, isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

export type DocumentType = "carta_identita" | "tessera_sanitaria" | "visura_camerale" | "copia_polizza" | "perizia" | "referto_medico";

const DOC_LABELS: Record<DocumentType, string> = {
  carta_identita: "Carta d'Identità",
  tessera_sanitaria: "Tessera Sanitaria",
  visura_camerale: "Visura Camerale",
  copia_polizza: "Copia Polizza",
  perizia: "Perizia",
  referto_medico: "Referto Medico",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export interface AiScannerEntityContext {
  entityType: "cliente" | "prospect" | "sinistro" | "polizza" | "compagnia" | "trattativa";
  scopeHint?: string;
  expectedCF?: string | null;
  expectedPIVA?: string | null;
}

interface AiDocumentScannerProps {
  documentType: DocumentType;
  onExtracted: (data: Record<string, unknown>) => void;
  onFileReady?: (file: File, documentType: DocumentType) => void;
  /**
   * Contesto entità per estrazione mirata: l'AI viene istruita a privilegiare
   * dati coerenti con questa entità (CF/P.IVA), ma restituisce comunque ciò
   * che legge dal documento — l'utente conferma poi in un AiPrefilledForm.
   */
  entityContext?: AiScannerEntityContext;
  label?: string;
  className?: string;
}

const AiDocumentScanner = ({ documentType, onExtracted, onFileReady, entityContext, label, className = "" }: AiDocumentScannerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastResult, setLastResult] = useState<"success" | "error" | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato non supportato", { description: "Carica un file JPG, PNG, WEBP o PDF" });
      return;
    }
    if (isDocumentUploadTooLarge(file.size)) {
      toast.error("File troppo grande", { description: documentUploadTooLargeMessage() });
      return;
    }

    setIsProcessing(true);
    setLastResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("extract-document-data", {
        body: {
          file_base64: base64,
          tipo_documento: documentType,
          mime_type: file.type,
          entity_context: entityContext ?? null,
        },
      });

      if (error) throw new Error(error.message || "Errore durante l'elaborazione");
      if (data?.error) throw new Error(data.error);
      if (!data?.data) throw new Error("Nessun dato estratto");

      onExtracted(data.data);
      onFileReady?.(file, documentType);
      setLastResult("success");
      setIsExpanded(false);
      toast.success("Dati estratti con successo", { description: `Documento ${DOC_LABELS[documentType]} elaborato` });
    } catch (err: unknown) {
      setLastResult("error");
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      toast.error("Errore estrazione");
    } finally {
      setIsProcessing(false);
    }
  }, [documentType, onExtracted, onFileReady, entityContext]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const buttonLabel = label || `Scansiona ${DOC_LABELS[documentType]}`;

  if (!isExpanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        disabled={isProcessing}
        className={`gap-2 ${className}`}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : lastResult === "success" ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : (
          <ScanLine className="w-4 h-4" />
        )}
        {isProcessing ? "Elaborazione AI..." : buttonLabel}
      </Button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          ${isProcessing ? "pointer-events-none opacity-70" : ""}
        `}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6"
          onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisi AI in corso...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{buttonLabel}</p>
            <p className="text-xs text-muted-foreground">
              Trascina o clicca per caricare • JPG, PNG, WEBP, PDF (max {MAX_DOCUMENT_UPLOAD_MB} MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiDocumentScanner;
