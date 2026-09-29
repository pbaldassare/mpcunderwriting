import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_SOMMARIO_LAYOUT,
  SOMMARIO_STORAGE_BUCKET,
  VARESE_TEMPLATE_FILENAME,
  VARESE_TEMPLATE_MIME,
  VARESE_TEMPLATE_PUBLIC_PATH,
  defaultLayoutKeyForCliente,
  parseSommarioLayoutJson,
  sommarioStoragePath,
  type ClienteTemplateSommarioRow,
  type SommarioLayoutKey,
} from "@/lib/sommarioPolizze";

const ACCEPT = ".docx,.doc,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf";

type Props = {
  clienteId: string;
  ragioneSociale?: string | null;
  partitaIva?: string | null;
  readOnly?: boolean;
};

const table = () => (supabase as any).from("clienti_template_sommario");

async function fetchOrCreateTemplate(opts: {
  clienteId: string;
  ragioneSociale?: string | null;
  partitaIva?: string | null;
}): Promise<ClienteTemplateSommarioRow> {
  const { data, error } = await table()
    .select("*")
    .eq("cliente_id", opts.clienteId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return { ...data, layout_json: parseSommarioLayoutJson(data.layout_json) };
  }
  const layout_key = defaultLayoutKeyForCliente(opts);
  const { data: created, error: insErr } = await table()
    .insert({
      cliente_id: opts.clienteId,
      layout_key,
      layout_json: DEFAULT_SOMMARIO_LAYOUT,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return { ...created, layout_json: parseSommarioLayoutJson(created.layout_json) };
}

export default function ClienteTemplateSommario({
  clienteId,
  ragioneSociale,
  partitaIva,
  readOnly,
}: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "download" | "seed" | "delete" | null>(null);

  const qk = ["cliente-template-sommario", clienteId];
  const { data: row, isLoading } = useQuery({
    queryKey: qk,
    enabled: !!clienteId,
    queryFn: () => fetchOrCreateTemplate({ clienteId, ragioneSociale, partitaIva }),
  });

  const layoutKey: SommarioLayoutKey = row?.layout_key || defaultLayoutKeyForCliente({
    id: clienteId,
    ragione_sociale: ragioneSociale,
    partita_iva: partitaIva,
  });
  const seedOnce = useRef(false);

  useEffect(() => {
    if (isLoading || !row || seedOnce.current) return;
    if (layoutKey !== "varese" || row.storage_path) return;
    seedOnce.current = true;
    void seedVarese();
    // seedVarese è definito sotto; l'auto-allegato Varese parte una sola volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, row, layoutKey]);

  const persistFile = async (file: File, nextLayout: SommarioLayoutKey) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (row?.storage_path) {
      await supabase.storage.from(row.storage_bucket || SOMMARIO_STORAGE_BUCKET).remove([row.storage_path]);
    }
    const path = sommarioStoragePath(clienteId, file.name);
    const { error: upErr } = await supabase.storage.from(SOMMARIO_STORAGE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || VARESE_TEMPLATE_MIME,
    });
    if (upErr) throw upErr;
    const payload = {
      cliente_id: clienteId,
      layout_key: nextLayout,
      nome_file: file.name,
      storage_bucket: SOMMARIO_STORAGE_BUCKET,
      storage_path: path,
      mime_type: file.type || VARESE_TEMPLATE_MIME,
      file_size: file.size,
      layout_json: row?.layout_json || DEFAULT_SOMMARIO_LAYOUT,
      updated_by: user?.id ?? null,
    };
    const { error } = await table().upsert(payload, { onConflict: "cliente_id" });
    if (error) throw error;
  };

  const uploadMut = useMutation({
    mutationFn: async (file: File) => persistFile(file, layoutKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Template sommario salvato");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Errore salvataggio template"),
    onSettled: () => setBusy(null),
  });

  const seedVarese = async () => {
    try {
      setBusy("seed");
      const res = await fetch(VARESE_TEMPLATE_PUBLIC_PATH);
      if (!res.ok) throw new Error("Modello Varese non trovato nel bundle");
      const blob = await res.blob();
      const file = new File([blob], VARESE_TEMPLATE_FILENAME, { type: VARESE_TEMPLATE_MIME });
      await persistFile(file, "varese");
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Modello Word del Comune di Varese allegato");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore allegato modello Varese");
    } finally {
      setBusy(null);
    }
  };

  const downloadFile = async () => {
    if (!row?.storage_path) return;
    try {
      setBusy("download");
      const { data, error } = await supabase.storage
        .from(row.storage_bucket || SOMMARIO_STORAGE_BUCKET)
        .download(row.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = row.nome_file || "sommario_template.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore download");
    } finally {
      setBusy(null);
    }
  };

  const removeFile = async () => {
    if (!row?.storage_path) return;
    try {
      setBusy("delete");
      await supabase.storage.from(row.storage_bucket || SOMMARIO_STORAGE_BUCKET).remove([row.storage_path]);
      const { error } = await table()
        .update({
          nome_file: null,
          storage_bucket: null,
          storage_path: null,
          mime_type: null,
          file_size: null,
        })
        .eq("cliente_id", clienteId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("File template rimosso");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore rimozione");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="col-span-2 md:col-span-4 rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Template sommario polizze</p>
          <p className="text-xs text-muted-foreground">
            Ogni cliente ha un modello proprio. La stampa da Portafoglio per cliente usa questo layout
            (colonne Compagnia, Prodotto, N° polizza, Scadenza, Frazionamento, Premio).
          </p>
        </div>
        <Badge variant={layoutKey === "varese" ? "default" : "secondary"}>
          {layoutKey === "varese" ? "Layout Comune di Varese" : "Layout standard"}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Caricamento template…
        </p>
      ) : row?.storage_path ? (
        <p className="text-sm">
          File: <span className="font-medium">{row.nome_file}</span>
          {row.updated_at ? (
            <span className="text-xs text-muted-foreground"> · aggiornato {new Date(row.updated_at).toLocaleDateString("it-IT")}</span>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nessun file Word allegato. La stampa usa comunque il layout
          {layoutKey === "varese" ? " Varese" : " standard"}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy("upload");
            uploadMut.mutate(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly || !!busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
          {row?.storage_path ? "Sostituisci file" : "Carica Word"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!row?.storage_path || !!busy}
          onClick={downloadFile}
        >
          {busy === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Scarica modello
        </Button>
        {layoutKey === "varese" && !row?.storage_path && !readOnly && (
          <Button type="button" size="sm" disabled={!!busy} onClick={seedVarese}>
            {busy === "seed" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
            Allega modello Varese
          </Button>
        )}
        {row?.storage_path && !readOnly && (
          <Button type="button" size="sm" variant="ghost" disabled={!!busy} onClick={removeFile}>
            {busy === "delete" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Rimuovi file
          </Button>
        )}
      </div>
    </div>
  );
}
