import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, Trash2 } from "lucide-react";

export const CB_BOT_KNOW_HOW_QUERY_KEY = ["cb-bot-know-how"];

type Row = {
  id: string;
  tipo: string;
  domanda: string;
  risposta: string;
  attiva: boolean;
  hit_count: number;
  updated_at: string;
};

export default function CbBotKnowHowPanel() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: CB_BOT_KNOW_HOW_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_bot_know_how" as never)
        .select("id, tipo, domanda, risposta, attiva, hit_count, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("cb_bot_know_how" as never).update({ attiva } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CB_BOT_KNOW_HOW_QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message || "Impossibile aggiornare"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cb_bot_know_how" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Know-how rimosso");
      qc.invalidateQueries({ queryKey: CB_BOT_KNOW_HOW_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Impossibile eliminare"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500" />
        <div>
          <h3 className="text-sm font-semibold">Know-how</h3>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Risposte salvate dalla stella sulle ricerche. Se la domanda torna, CB Bot
            risponde da qui senza una nuova ricerca.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nessun know-how. Dalla chat, clicca la stella su una ricerca pertinente.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domanda</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead className="w-16">Usi</TableHead>
              <TableHead className="w-20">Attiva</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="text-sm font-medium line-clamp-2">{r.domanda}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{r.risposta}</div>
                </TableCell>
                <TableCell className="text-xs uppercase">{r.tipo}</TableCell>
                <TableCell className="text-xs">{r.hit_count}</TableCell>
                <TableCell>
                  <Switch
                    checked={r.attiva}
                    onCheckedChange={(attiva) => toggleMutation.mutate({ id: r.id, attiva })}
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Elimina"
                    onClick={() => {
                      if (confirm("Eliminare questo know-how?")) deleteMutation.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
