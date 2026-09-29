import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2 } from "lucide-react";
import PdfPreview from "@/components/PdfPreview";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: { nome_file: string; bucket_name: string; path_storage: string } | null;
}

export default function DocPreviewDialog({ open, onOpenChange, doc }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !doc) { setUrl(null); return; }
    setLoading(true);
    supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300).then(({ data }) => {
      setUrl(data?.signedUrl ?? null);
      setLoading(false);
    });
  }, [open, doc]);

  const ext = doc?.nome_file.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc?.nome_file}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-muted rounded-md flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : !url ? (
            <p className="text-sm text-muted-foreground">Anteprima non disponibile</p>
          ) : isPdf ? (
            <PdfPreview url={url} fileName={doc?.nome_file} />
          ) : isImage ? (
            <img src={url} alt={doc?.nome_file} className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="text-center space-y-3 p-6">
              <p className="text-sm text-muted-foreground">Anteprima non supportata per questo formato.</p>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button className="bg-teal-700 hover:bg-teal-800 gap-1.5"><Download className="h-4 w-4" />Scarica file</Button>
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
