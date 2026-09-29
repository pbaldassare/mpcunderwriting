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
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ensureFileExtension } from "@/lib/sanitizeFileName";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

const ProspectUploadDoc = () => {
  const { user } = useAuth();
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("prospect")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProspectId(data.id);
      });
  }, [user]);

  const handleUpload = async () => {
    if (pendingFiles.length === 0 || !prospectId || !user) return;
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
          const path = `prospect/${prospectId}/${Date.now()}_${item.file.name}`;
          const { error: storageError } = await supabase.storage
            .from("documenti_clienti")
            .upload(path, item.file);
          if (storageError) throw storageError;

          const { error: dbError } = await supabase.from("documenti").insert({
            entita_tipo: "prospect",
            entita_id: prospectId,
            nome_file: nomeFile,
            path_storage: path,
            bucket_name: "documenti_clienti",
            caricato_da: user.id,
            visibile_al_cliente: true,
            categoria: "documento_prospect",
          });
          if (dbError) throw dbError;
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "done" }));
          ok += 1;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Errore nel caricamento";
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "error", error: msg }));
          fail += 1;
        }
      }
      if (ok > 0 && fail === 0) {
        toast.success(ok === 1 ? "Documento caricato con successo" : `${ok} documenti caricati`);
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

  if (!prospectId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Carica Documenti</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Profilo prospect non collegato. Contatta l&apos;agenzia.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Carica Documenti</h1>
        <p className="text-sm text-muted-foreground mt-1">Carica qui i documenti richiesti dall&apos;agenzia.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm">Seleziona uno o più file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MultiDocumentUploadPanel
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            inputId="file"
            disabled={uploading}
            visibileAlClienteDefault
            hint={`Max ${MAX_DOCUMENT_UPLOAD_MB} MB per file`}
          />
          <Button
            onClick={() => void handleUpload()}
            disabled={pendingFiles.length === 0 || uploading}
            className="w-full gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading
              ? "Caricamento..."
              : pendingFiles.length > 1
                ? `Carica ${pendingFiles.length} documenti`
                : "Carica"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProspectUploadDoc;
