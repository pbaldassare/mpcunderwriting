import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  MultiDocumentUploadPanel,
  patchPendingFile,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, Download, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ensureFileExtension } from "@/lib/sanitizeFileName";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

interface Props {
  trattativaId: string;
  onEvento: (tipo: string, desc: string, dettagli?: any) => void;
}

export const TrattativaDocumentiTab = ({ trattativaId, onEvento }: Props) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("altro");
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);

  const { data: documenti = [], isLoading } = useQuery({
    queryKey: ["trattativa_documenti", trattativaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattativa_documenti")
        .select("*, autore:uploaded_by(nome, cognome)")
        .eq("trattativa_id", trattativaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
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
          const path = `trattative/${trattativaId}/${Date.now()}_${item.file.name}`;
          const { error: upErr } = await supabase.storage.from("documenti_generali").upload(path, item.file);
          if (upErr) throw upErr;

          const { error: dbErr } = await supabase.from("trattativa_documenti").insert({
            trattativa_id: trattativaId,
            nome_file: nomeFile,
            file_path: path,
            tipo_documento: tipoDoc,
            uploaded_by: profile?.id,
          });
          if (dbErr) throw dbErr;

          onEvento("documento", `Documento caricato: ${nomeFile}`, { tipo: tipoDoc });
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "done" }));
          ok += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Errore caricamento";
          setPendingFiles((prev) => patchPendingFile(prev, item.id, { status: "error", error: msg }));
          fail += 1;
        }
      }
      if (ok > 0) queryClient.invalidateQueries({ queryKey: ["trattativa_documenti", trattativaId] });
      if (ok > 0 && fail === 0) {
        toast.success(ok === 1 ? "Documento caricato" : `${ok} documenti caricati`);
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

  const handleDownload = async (doc: any) => {
    const { data, error } = await supabase.storage.from("documenti_generali").createSignedUrl(doc.file_path, 300);
    if (error) { toast.error("Errore download"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteMut = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("documenti_generali").remove([doc.file_path]);
      const { error } = await supabase.from("trattativa_documenti").delete().eq("id", doc.id);
      if (error) throw error;
      onEvento("documento", `Documento eliminato: ${doc.nome_file}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattativa_documenti", trattativaId] });
      toast.success("Documento eliminato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground">Documenti ({documenti.length})</h3>
        <Select value={tipoDoc} onValueChange={setTipoDoc}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="preventivo">Preventivo</SelectItem>
            <SelectItem value="proposta">Proposta</SelectItem>
            <SelectItem value="contratto">Contratto</SelectItem>
            <SelectItem value="allegato">Allegato</SelectItem>
            <SelectItem value="altro">Altro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <MultiDocumentUploadPanel
        files={pendingFiles}
        onFilesChange={setPendingFiles}
        disabled={uploading}
        hint={`Trascina uno o più documenti — max ${MAX_DOCUMENT_UPLOAD_MB} MB ciascuno`}
      />

      {pendingFiles.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void handleUpload()} disabled={uploading} className="gap-1">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading
              ? "Caricamento..."
              : pendingFiles.length > 1
                ? `Carica ${pendingFiles.length} documenti`
                : "Carica"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : documenti.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nessun documento caricato.</p>
      ) : (
        <div className="space-y-2">
          {documenti.map((doc: any) => (
            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.nome_file}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.tipo_documento} • {doc.autore ? `${doc.autore.cognome || ""} ${doc.autore.nome || ""}`.trim() : "—"} • {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: it })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(doc)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
