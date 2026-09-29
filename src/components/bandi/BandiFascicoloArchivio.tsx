import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FileText, Download, Trash2, Loader2, FileDown, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TIPI_DOCUMENTO_BANDO,
  documentiVisibili,
  groupDocumentiByTipo,
  labelTipoDocumentoBando,
  type BandoDocumentoRow,
} from "@/lib/bandiDocumenti";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bando: { id: string; titolo?: string | null; oggetto?: string | null; ente?: string | null } | null;
  documenti: BandoDocumentoRow[];
  downloading?: boolean;
  onScaricaTutti?: () => void;
  onRefresh: () => void;
};

async function signedUrl(doc: BandoDocumentoRow): Promise<string | null> {
  if (doc.storage_path) {
    const { data } = await supabase.storage
      .from("documenti_generali")
      .createSignedUrl(doc.storage_path, 3600);
    return data?.signedUrl || null;
  }
  return doc.url_origine;
}

export function BandiFascicoloArchivio({
  open,
  onOpenChange,
  bando,
  documenti,
  downloading,
  onScaricaTutti,
  onRefresh,
}: Props) {
  const visibili = useMemo(() => documentiVisibili(documenti), [documenti]);
  const gruppi = useMemo(() => groupDocumentiByTipo(visibili), [visibili]);
  const [nomi, setNomi] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNomi(Object.fromEntries(visibili.map((d) => [d.id, d.nome || ""])));
  }, [open, visibili]);

  const updateDoc = async (id: string, patch: Partial<BandoDocumentoRow>, ok = "Documento aggiornato") => {
    setBusyId(id);
    try {
      const { error } = await (supabase as any)
        .from("bandi_documenti")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      toast.success(ok);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Impossibile aggiornare il documento");
    } finally {
      setBusyId(null);
    }
  };

  const apri = async (doc: BandoDocumentoRow) => {
    const url = await signedUrl(doc);
    if (!url) {
      toast.error("Documento non disponibile");
      return;
    }
    window.open(url, "_blank");
  };

  const scarica = async (doc: BandoDocumentoRow) => {
    const url = await signedUrl(doc);
    if (!url) {
      toast.error("Documento non disponibile");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.nome || "documento.pdf";
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  const rimuovi = async (doc: BandoDocumentoRow) => {
    if (!window.confirm(`Rimuovere «${doc.nome || "documento"}» dall'archivio?`)) return;
    await updateDoc(doc.id, { stato: "rimosso" }, "Documento rimosso");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Archivio documenti
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {bando?.ente ? `${bando.ente} · ` : ""}
            {bando?.titolo || bando?.oggetto || "Bando"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {visibili.length} document{visibili.length === 1 ? "o" : "i"}
          </span>
          {onScaricaTutti && (
            <Button size="sm" className="gap-1" disabled={downloading} onClick={onScaricaTutti}>
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Scarica dal portale
            </Button>
          )}
        </div>

        <div className="overflow-y-auto min-h-0 flex-1 space-y-5 pr-1">
          {visibili.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nessun documento in archivio. Usa «Scarica dal portale».
            </p>
          )}
          {gruppi.map((group) => (
            <section key={group.tipo} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <Badge variant="secondary">{group.docs.length}</Badge>
              </div>
              <div className="rounded-md border divide-y">
                {group.docs.map((doc) => (
                  <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                    <FileText className="h-4 w-4 text-red-500 shrink-0 hidden sm:block" />
                    <Input
                      value={nomi[doc.id] ?? doc.nome ?? ""}
                      onChange={(e) => setNomi((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                      onBlur={() => {
                        const next = (nomi[doc.id] || "").trim();
                        if (next && next !== (doc.nome || "")) void updateDoc(doc.id, { nome: next });
                      }}
                      className="h-8 sm:flex-1"
                    />
                    <Select
                      value={doc.tipo}
                      onValueChange={(v) => void updateDoc(doc.id, { tipo: v })}
                    >
                      <SelectTrigger className="h-8 w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPI_DOCUMENTO_BANDO.map((t) => (
                          <SelectItem key={t} value={t}>{labelTipoDocumentoBando(t)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void apri(doc)}>
                        <ExternalLink className="h-3.5 w-3.5" /> Apri
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void scarica(doc)}>
                        <Download className="h-3.5 w-3.5" /> Scarica
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive"
                        disabled={busyId === doc.id}
                        onClick={() => void rimuovi(doc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
