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
import { parseCbBotSitoInput, type CbBotSito } from "@/lib/cbBotSiti";
import { missingCatalogoSiti } from "@/lib/cbBotSitiCatalogo";
import { ExternalLink, Library, Plus, ShieldCheck, Trash2 } from "lucide-react";

const QUERY_KEY = ["cb-bot-siti-autorizzati"];

export default function CbBotSitiAutorizzatiPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [toDelete, setToDelete] = useState<CbBotSito | null>(null);

  const { data: siti = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_bot_siti_autorizzati")
        .select("id, nome, url, dominio, note, attivo, created_at, updated_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as CbBotSito[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseCbBotSitoInput(url);
      if (!parsed.ok) throw new Error(parsed.error);
      const label = nome.trim() || parsed.dominio;
      const { error } = await supabase.from("cb_bot_siti_autorizzati").insert({
        nome: label,
        url: parsed.url,
        dominio: parsed.dominio,
        created_by: user?.id ?? null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Questo dominio è già in elenco.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Sito autorizzato aggiunto");
      setNome("");
      setUrl("");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile aggiungere il sito"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("cb_bot_siti_autorizzati").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message || "Impossibile aggiornare il sito"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cb_bot_siti_autorizzati").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sito rimosso");
      setToDelete(null);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile eliminare il sito"),
  });

  const importCatalogoMutation = useMutation({
    mutationFn: async () => {
      const missing = missingCatalogoSiti(siti.map((s) => s.dominio));
      if (missing.length === 0) return 0;
      const { error } = await supabase.from("cb_bot_siti_autorizzati").insert(
        missing.map((s) => ({
          nome: s.nome,
          url: s.url,
          dominio: s.dominio,
          note: s.note,
          created_by: user?.id ?? null,
        })),
      );
      if (error) throw error;
      return missing.length;
    },
    onSuccess: (n) => {
      toast.success(n > 0 ? `Aggiunti ${n} siti di settore e compagnie` : "Elenco già completo");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile importare il catalogo"),
  });

  const attivi = siti.filter((s) => s.attivo).length;
  const catalogoMancanti = missingCatalogoSiti(siti.map((s) => s.dominio)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold">Siti autorizzati</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            L&apos;Assistente Web interroga <strong>solo</strong> questi siti (insieme alla Libreria CGA per le
            condizioni di polizza). Senza siti attivi il bot non cerca sul web aperto.
            {attivi > 0 && (
              <>
                {" "}
                Attivi: <span className="font-medium text-foreground">{attivi}</span>.
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
          <Label className="text-[10px] uppercase text-muted-foreground">Nome</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. IVASS"
            className="h-8"
          />
        </div>
        <div className="flex-[2] space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">URL o dominio</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ivass.it oppure https://www.ivass.it"
            className="h-8"
          />
        </div>
        <Button type="submit" size="sm" className="h-8 shrink-0" disabled={addMutation.isPending || !url.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Aggiungi
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          disabled={importCatalogoMutation.isPending || catalogoMancanti === 0}
          onClick={() => importCatalogoMutation.mutate()}
        >
          <Library className="h-4 w-4 mr-1" />
          {catalogoMancanti > 0 ? `Settore e compagnie (${catalogoMancanti})` : "Catalogo già caricato"}
        </Button>
      </form>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : siti.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-md p-4">
          Nessun sito in elenco. Aggiungi i portali da cui CB Bot può cercare (es. IVASS, ANIA).
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Dominio</TableHead>
                <TableHead className="w-[90px]">Attivo</TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {siti.map((s) => (
                <TableRow key={s.id} className={s.attivo ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {s.nome}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                    {s.note && <div className="text-[11px] text-muted-foreground font-normal">{s.note}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.dominio}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.attivo}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, attivo: v })}
                      aria-label={`Attiva ${s.nome}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setToDelete(s)}
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
            <AlertDialogTitle>Rimuovere {toDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              CB Bot non interrogherà più {toDelete?.dominio}. Puoi riaggiungerlo in seguito.
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
