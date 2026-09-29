import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { insertCbBotFonte } from "@/lib/cbBotFontiDb";
import type { CbBotFonte } from "@/lib/cbBotFonti";
import { Bookmark, ExternalLink, Plus, Trash2 } from "lucide-react";

export const CB_BOT_FONTI_QUERY_KEY = ["cb-bot-fonti"];

export default function CbBotFontiSalvatePanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [titolo, setTitolo] = useState("");
  const [url, setUrl] = useState("");
  const [toDelete, setToDelete] = useState<CbBotFonte | null>(null);

  const { data: fonti = [], isLoading } = useQuery({
    queryKey: CB_BOT_FONTI_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_bot_fonti")
        .select(
          "id, titolo, url, snippet, dominio, origine, conversazione_id, messaggio_id, note, tags, attiva, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CbBotFonte[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await insertCbBotFonte({
        hit: { title: titolo.trim() || undefined, url: url.trim() },
        userId: user?.id ?? null,
        origine: "manuale",
      });
      if (res === "duplicata") throw new Error("Questa pagina è già tra le fonti salvate.");
    },
    onSuccess: () => {
      toast.success("Fonte aggiunta alla libreria");
      setTitolo("");
      setUrl("");
      qc.invalidateQueries({ queryKey: CB_BOT_FONTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile salvare la fonte"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("cb_bot_fonti").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CB_BOT_FONTI_QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message || "Impossibile aggiornare la fonte"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cb_bot_fonti").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fonte rimossa");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: CB_BOT_FONTI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile eliminare la fonte"),
  });

  const attive = fonti.filter((f) => f.attiva).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Bookmark className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">Fonti salvate</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Pagine pinate dalle ricerche (o aggiunte a mano). L&apos;Assistente Web le riusa come
            fonti interne, oltre alla ricerca sui siti autorizzati.
            {attive > 0 && (
              <>
                {" "}
                Attive: <span className="font-medium text-foreground">{attive}</span>.
              </>
            )}
          </p>
        </div>
      </div>

      <form
        className="flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-md border bg-muted/30"
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
      >
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Titolo</Label>
          <Input
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Es. Provvedimento IVASS 128/2023"
            className="h-8"
          />
        </div>
        <div className="flex-[2] space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">URL della pagina</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.ivass.it/..."
            className="h-8"
          />
        </div>
        <Button type="submit" size="sm" className="h-8 shrink-0" disabled={addMutation.isPending || !url.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Aggiungi
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : fonti.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-md p-4">
          Nessuna fonte salvata. Dalla chat, usa il segnalibro accanto a una fonte oppure metti in
          evidenza una ricerca.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Dominio</TableHead>
                <TableHead className="w-[90px]">Attiva</TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fonti.map((f) => (
                <TableRow key={f.id} className={f.attiva ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {f.titolo}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                    {f.snippet && (
                      <div className="text-[11px] text-muted-foreground font-normal line-clamp-2">
                        {f.snippet}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.dominio}</TableCell>
                  <TableCell>
                    <Switch
                      checked={f.attiva}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: f.id, attiva: v })}
                      aria-label={`Attiva ${f.titolo}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setToDelete(f)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere questa fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              CB Bot non la userà più come fonte interna. L&apos;URL resta raggiungibile sul web.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
