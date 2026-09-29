import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import { ensureFileExtension, sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import {
  MultiDocumentUploadPanel,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroTitolo?: string | null;
  onUploaded?: () => void;
}

export function CaricaDocDialog({ open, onOpenChange, titoloId, numeroTitolo, onUploaded }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState<PendingDocumentFile[]>([]);

  useEffect(() => { if (open) setPendingFiles([]); }, [open]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo non specificato");
      if (pendingFiles.length === 0) throw new Error("Seleziona almeno un file");
      const emptyName = pendingFiles.find((p) => !p.displayName.trim());
      if (emptyName) throw new Error("Inserisci un nome per ogni documento");

      let ok = 0;
      for (const item of pendingFiles) {
        const nomeFile = ensureFileExtension(item.displayName.trim(), item.file.name);
        const path = `titolo/${titoloId}/${Date.now()}_${sanitizeStorageFileName(item.file.name)}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, item.file);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("documenti").insert({
          nome_file: nomeFile,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: titoloId,
          caricato_da: user?.id || null,
          visibile_al_cliente: item.visibileAlCliente,
        });
        if (insErr) throw insErr;
        await logAttivita({
          azione: "upload_documento",
          entita_tipo: "titolo",
          entita_id: titoloId,
          dettagli_json: { nome_file: nomeFile, visibile_al_cliente: item.visibileAlCliente },
        });
        ok += 1;
      }
      return ok;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Documento caricato" : `${n} documenti caricati`);
      qc.invalidateQueries({ queryKey: ["documenti", "titolo"] });
      qc.invalidateQueries({ queryKey: ["gestione-polizze"] });
      onUploaded?.();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Errore upload"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carica documenti — Polizza {numeroTitolo || ""}</DialogTitle>
          <DialogDescription>I file vengono salvati nel bucket <code>documenti_titoli</code> e collegati alla polizza.</DialogDescription>
        </DialogHeader>

        <MultiDocumentUploadPanel
          files={pendingFiles}
          onFilesChange={setPendingFiles}
          disabled={mut.isPending}
          showVisibileAlCliente
          hint={`Max ${MAX_DOCUMENT_UPLOAD_MB} MB per file. Puoi selezionare più file.`}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Annulla</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !titoloId || pendingFiles.length === 0}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mut.isPending
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
