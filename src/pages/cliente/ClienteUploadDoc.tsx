import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MultiDocumentUploadPanel,
  patchPendingFile,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { Upload, CheckCircle, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensureFileExtension, sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

const ClienteUploadDoc = () => {
  const { user } = useAuth();
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [areaType, setAreaType] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("clienti")
      .select("id, area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setClienteId(data?.id ?? null);
        setAreaType(data?.area_riservata_tipo ?? null);
      });
  }, [user]);

  if (areaType && areaType !== "completa") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Accesso non disponibile
        </h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Il caricamento documenti non è abilitato per il tuo account.<br />
            Contatta la tua agenzia per maggiori informazioni.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || !clienteId || !user) return;
    const emptyName = pendingFiles.find((p) => !p.displayName.trim());
    if (emptyName) {
      toast.error("Inserisci un nome per ogni documento");
      return;
    }
    setUploading(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const item of pendingFiles) {
        setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "uploading", error: undefined }));
        try {
          const nomeFile = ensureFileExtension(item.displayName.trim(), item.file.name);
          const path = `${clienteId}/${Date.now()}_${sanitizeStorageFileName(item.file.name)}`;
          const { error: storageErr } = await supabase.storage
            .from("documenti_clienti")
            .upload(path, item.file);
          if (storageErr) throw storageErr;

          const { error: dbErr } = await supabase.from("documenti").insert({
            entita_tipo: "cliente",
            entita_id: clienteId,
            nome_file: nomeFile,
            path_storage: path,
            bucket_name: "documenti_clienti",
            caricato_da: user.id,
            caricato_da_cliente: true,
            visibile_al_cliente: true,
            categoria: "documento_cliente",
          });
          if (dbErr) throw dbErr;
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "done" }));
          ok += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Errore durante il caricamento";
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "error", error: msg }));
          fail += 1;
        }
      }
      if (ok > 0 && fail === 0) {
        toast.success(ok === 1 ? "Documento caricato con successo!" : `${ok} documenti caricati`);
        setPendingFiles([]);
      } else if (ok > 0) {
        toast.warning(`${ok} caricati, ${fail} con errore`);
        setPendingFiles((prev) => prev.filter((p) => p.status !== "done"));
      } else {
        toast.error("Nessun documento caricato");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Upload className="h-5 w-5 text-primary" /> Carica Documento
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invia documenti all&apos;agenzia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultiDocumentUploadPanel
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            disabled={uploading}
            visibileAlClienteDefault
            hint={`Max ${MAX_DOCUMENT_UPLOAD_MB} MB per file — puoi selezionare più file`}
          />
          <Button
            onClick={() => void handleUpload()}
            disabled={pendingFiles.length === 0 || uploading || !clienteId}
            className="gap-2"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Caricamento…</>
            ) : (
              <><CheckCircle className="h-4 w-4" />{pendingFiles.length > 1 ? `Carica ${pendingFiles.length} documenti` : "Carica"}</>
            )}
          </Button>
          {!clienteId && (
            <p className="text-xs text-muted-foreground">
              Il tuo profilo cliente non è ancora collegato. Contatta l&apos;agenzia.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteUploadDoc;
