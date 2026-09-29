import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone, formatFileSize } from "@/components/shared/FileDropzone";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import {
  CB_BOT_DOC_ACCEPT,
  CB_BOT_DOC_BUCKET,
  CB_BOT_DOC_MAX_FILES,
  buildStoragePath,
  fileToBase64,
  titoloFromFileName,
  validateCbBotDocFiles,
} from "@/lib/cbBotDocumenti";
import {
  deleteDocumentoConsultazione,
  insertConfrontoConsultazione,
  insertDocumentoConsultazione,
  listConfrontiConsultazione,
  listDocumentiConsultazione,
} from "@/lib/cbBotDocumentiConsultazione";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { Files, GitCompare, Loader2, Save, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export const CB_BOT_DOCUMENTI_QUERY_KEY = ["cb-bot-documenti"];
export const CB_BOT_CONFRONTI_QUERY_KEY = ["cb-bot-confronti"];

type DocRow = {
  id: string;
  titolo: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  analisi: string | null;
  created_at: string;
};

type ConfrontoRow = {
  id: string;
  titolo: string;
  documento_ids: string[];
  risultato: string;
  created_at: string;
};

type AnalisiPreview = {
  titolo: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  testo_estratto: string;
  analisi: string;
};

const tbl = (name: string) => supabase.from(name as never);

type Props = {
  consultazioneMode?: boolean;
};

export default function CbBotDocumentiPanel({ consultazioneMode = false }: Props) {
  const { user } = useAuth();
  const { email: consultazioneEmail } = useConsultazione();
  const qc = useQueryClient();
  const email = consultazioneMode ? consultazioneEmail : null;
  const isConsultazione = consultazioneMode && !!email;
  const canUse = isConsultazione || !!user?.id;
  const queryScope = isConsultazione ? email : user?.id ?? "anon";
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AnalisiPreview[]>([]);
  const [confronto, setConfronto] = useState<string | null>(null);
  const [confrontoTitolo, setConfrontoTitolo] = useState("");
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: [...CB_BOT_DOCUMENTI_QUERY_KEY, queryScope],
    enabled: canUse,
    queryFn: async () => {
      if (isConsultazione) return listDocumentiConsultazione(email!);
      const { data, error } = await tbl("cb_bot_documenti")
        .select("id, titolo, file_name, storage_path, mime_type, size_bytes, analisi, created_at")
        .is("created_by_email", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const { data: confronti = [] } = useQuery({
    queryKey: [...CB_BOT_CONFRONTI_QUERY_KEY, queryScope],
    enabled: canUse,
    queryFn: async () => {
      if (isConsultazione) return listConfrontiConsultazione(email!);
      const { data, error } = await tbl("cb_bot_confronti")
        .select("id, titolo, documento_ids, risultato, created_at")
        .is("created_by_email", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ConfrontoRow[];
    },
  });

  const openDoc = useMemo(() => docs.find((d) => d.id === openDocId) ?? null, [docs, openDocId]);

  const uploadFiles = async (toUpload: File[]) => {
    if (!user?.id) throw new Error("Devi essere autenticato");
    const check = validateCbBotDocFiles(toUpload);
    if (!check.ok) throw new Error(check.reason);
    const refs: { file: File; path: string }[] = [];
    for (const file of toUpload) {
      const path = buildStoragePath(user.id, file.name);
      const { error } = await supabase.storage.from(CB_BOT_DOC_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) throw new Error(`${file.name}: ${error.message}`);
      refs.push({ file, path });
    }
    return refs;
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!canUse) throw new Error("Devi accedere all'area consultazione o al gestionale");
      const check = validateCbBotDocFiles(files);
      if (!check.ok) throw new Error(check.reason);

      const body: Record<string, unknown> = {
        mode: files.length > 1 ? "compare" : "analyze",
      };
      if (isConsultazione) {
        body.email = email;
        body.files = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            mime: file.type,
            content_base64: await fileToBase64(file),
          })),
        );
      } else {
        const refs = await uploadFiles(files);
        body.storage_paths = refs.map((r) => ({
          path: r.path,
          name: r.file.name,
          mime: r.file.type,
        }));
      }

      const { data, error } = await supabase.functions.invoke("cb-bot-analizza-documenti", {
        body,
      });
      const fnError = edgeFunctionErrorMessage(data, error);
      if (fnError) throw new Error(fnError);
      const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]));
      const docsOut = (data?.documenti ?? []) as {
        titolo?: string;
        storage_path?: string;
        testo_estratto?: string;
        analisi?: string;
      }[];
      const previews: AnalisiPreview[] = docsOut.map((d, i) => {
        const file =
          (d.titolo ? byName.get(d.titolo.toLowerCase()) : undefined) ??
          files[i];
        return {
          titolo: titoloFromFileName(file?.name ?? d.titolo ?? "Documento"),
          file_name: file?.name ?? d.titolo ?? "documento.pdf",
          storage_path: d.storage_path ?? "",
          mime_type: file?.type ?? "application/pdf",
          size_bytes: file?.size ?? 0,
          testo_estratto: d.testo_estratto ?? "",
          analisi: d.analisi ?? "",
        };
      });
      return {
        previews,
        confronto: typeof data?.confronto === "string" ? data.confronto : null,
      };
    },
    onSuccess: (res) => {
      setPreview(res.previews);
      setConfronto(res.confronto);
      if (res.confronto) {
        setConfrontoTitolo(res.previews.map((p) => p.titolo).join(" · ").slice(0, 120));
      }
      toast.success(res.confronto ? "Confronto pronto" : "Analisi pronta — salvala in libreria");
    },
    onError: (e: Error) => toast.error(e.message || "Analisi non riuscita"),
  });

  const compareLibraryMutation = useMutation({
    mutationFn: async () => {
      if (selected.length < 2) throw new Error("Seleziona almeno due documenti in libreria");
      const { data, error } = await supabase.functions.invoke("cb-bot-analizza-documenti", {
        body: {
          mode: "compare",
          documento_ids: selected.slice(0, CB_BOT_DOC_MAX_FILES),
          ...(isConsultazione ? { email } : {}),
        },
      });
      const fnError = edgeFunctionErrorMessage(data, error);
      if (fnError) throw new Error(fnError);
      const titles = docs.filter((d) => selected.includes(d.id)).map((d) => d.titolo);
      return {
        confronto: String(data?.confronto ?? ""),
        titolo: titles.join(" · ").slice(0, 120),
      };
    },
    onSuccess: (res) => {
      setConfronto(res.confronto);
      setConfrontoTitolo(res.titolo);
      toast.success("Confronto pronto");
    },
    onError: (e: Error) => toast.error(e.message || "Confronto non riuscito"),
  });

  const saveLibraryMutation = useMutation({
    mutationFn: async () => {
      if (preview.length === 0) throw new Error("Nessuna analisi da salvare");
      if (isConsultazione) {
        for (const p of preview) {
          await insertDocumentoConsultazione(email!, {
            titolo: p.titolo,
            file_name: p.file_name,
            storage_path: p.storage_path,
            mime_type: p.mime_type,
            size_bytes: p.size_bytes,
            testo_estratto: p.testo_estratto,
            analisi: p.analisi || "",
          });
        }
        return;
      }
      if (!user?.id) throw new Error("Devi essere autenticato");
      for (const p of preview) {
        const { error } = await tbl("cb_bot_documenti").insert({
          titolo: p.titolo,
          file_name: p.file_name,
          storage_path: p.storage_path,
          mime_type: p.mime_type,
          size_bytes: p.size_bytes,
          testo_estratto: p.testo_estratto,
          analisi: p.analisi || null,
          created_by: user.id,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(preview.length === 1 ? "Documento salvato in libreria" : "Documenti salvati in libreria");
      setFiles([]);
      qc.invalidateQueries({ queryKey: CB_BOT_DOCUMENTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile salvare in libreria"),
  });

  const saveConfrontoMutation = useMutation({
    mutationFn: async () => {
      if (!confronto?.trim()) throw new Error("Nessun confronto da salvare");
      const titolo = confrontoTitolo.trim() || "Confronto documenti";
      if (isConsultazione) {
        await insertConfrontoConsultazione(email!, titolo, selected, confronto);
        return;
      }
      if (!user?.id) throw new Error("Devi essere autenticato");
      const { error } = await tbl("cb_bot_confronti").insert({
        titolo,
        documento_ids: selected,
        risultato: confronto,
        created_by: user.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Confronto salvato in libreria");
      qc.invalidateQueries({ queryKey: CB_BOT_CONFRONTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile salvare il confronto"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (row: DocRow) => {
      if (isConsultazione) {
        await deleteDocumentoConsultazione(email!, row.id);
        return;
      }
      const { error } = await tbl("cb_bot_documenti").delete().eq("id", row.id);
      if (error) throw error;
      await supabase.storage.from(CB_BOT_DOC_BUCKET).remove([row.storage_path]);
    },
    onSuccess: () => {
      toast.success("Documento rimosso dalla libreria");
      setSelected([]);
      qc.invalidateQueries({ queryKey: CB_BOT_DOCUMENTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile eliminare"),
  });

  const busy = analyzeMutation.isPending || compareLibraryMutation.isPending;
  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, CB_BOT_DOC_MAX_FILES)));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Carica e analizza</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Carica fino a {CB_BOT_DOC_MAX_FILES} PDF o file di testo. Un file viene analizzato;
          due o più vengono confrontati insieme. Poi salvali in libreria.
        </p>
      </div>

      <FileDropzone
        multiple
        accept={CB_BOT_DOC_ACCEPT}
        selectedFiles={files}
        disabled={busy}
        hint="PDF, TXT o Markdown · max 12 MB ciascuno"
        emptyLabel="Trascina qui i documenti oppure clicca per selezionarli"
        onFilesSelected={(next) => {
          const check = validateCbBotDocFiles(next);
          if (!check.ok) {
            toast.error(check.reason);
            return;
          }
          setFiles(next);
          setPreview([]);
          setConfronto(null);
        }}
      />

      {files.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {files.map((f) => (
            <li key={f.name}>
              {f.name} · {formatFileSize(f.size)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={files.length === 0 || busy}
          onClick={() => analyzeMutation.mutate()}
        >
          {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Files className="h-4 w-4 mr-1" />}
          {files.length > 1 ? "Analizza e confronta" : "Analizza"}
        </Button>
        {preview.length > 0 && (
          <Button size="sm" variant="secondary" disabled={saveLibraryMutation.isPending} onClick={() => saveLibraryMutation.mutate()}>
            <Save className="h-4 w-4 mr-1" /> Salva in libreria
          </Button>
        )}
      </div>

      {preview.length > 0 && (
        <div className="space-y-3">
          {preview.map((p) => (
            <div key={p.storage_path || p.file_name} className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">{p.titolo}</p>
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-72 overflow-auto">
                {p.analisi || "Analisi inclusa nel confronto sotto."}
              </pre>
            </div>
          ))}
        </div>
      )}

      {confronto && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-sm font-medium flex-1">Confronto</p>
            <Input
              value={confrontoTitolo}
              onChange={(e) => setConfrontoTitolo(e.target.value)}
              className="h-8 text-sm sm:max-w-sm"
              placeholder="Titolo del confronto"
            />
            <Button size="sm" variant="outline" disabled={saveConfrontoMutation.isPending} onClick={() => saveConfrontoMutation.mutate()}>
              <Save className="h-4 w-4 mr-1" /> Salva confronto
            </Button>
          </div>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-96 overflow-auto">{confronto}</pre>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <div>
          <h3 className="text-sm font-semibold">Libreria documenti</h3>
          <p className="text-xs text-muted-foreground">Seleziona due o più file per confrontarli.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={selected.length < 2 || busy}
          onClick={() => compareLibraryMutation.mutate()}
        >
          {compareLibraryMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <GitCompare className="h-4 w-4 mr-1" />}
          Confronta selezionati ({selected.length})
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nessun documento in libreria. Analizza un file e salvalo.
        </p>
      ) : (
        <TableScrollArea className="rounded-lg border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-2 w-8" />
                <th className="text-left p-2">Titolo</th>
                <th className="text-left p-2">File</th>
                <th className="text-left p-2">Data</th>
                <th className="p-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-2">
                    <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => toggle(d.id)} />
                  </td>
                  <td className="p-2 font-medium">{d.titolo}</td>
                  <td className="p-2 text-muted-foreground">{d.file_name}</td>
                  <td className="p-2 text-muted-foreground">
                    {format(new Date(d.created_at), "dd MMM yyyy", { locale: it })}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setOpenDocId(openDocId === d.id ? null : d.id)}>
                      {openDocId === d.id ? "Chiudi" : "Apri"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm(`Rimuovere «${d.titolo}» dalla libreria?`)) deleteDocMutation.mutate(d);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollArea>
      )}

      {openDoc?.analisi && (
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-sm font-medium">{openDoc.titolo}</p>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground max-h-80 overflow-auto">{openDoc.analisi}</pre>
        </div>
      )}

      {confronti.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Confronti salvati</h3>
          {confronti.map((c) => (
            <details key={c.id} className="rounded-lg border p-3">
              <summary className="text-sm font-medium cursor-pointer">
                {c.titolo} · {format(new Date(c.created_at), "dd MMM yyyy", { locale: it })}
              </summary>
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground mt-2 max-h-64 overflow-auto">{c.risultato}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
