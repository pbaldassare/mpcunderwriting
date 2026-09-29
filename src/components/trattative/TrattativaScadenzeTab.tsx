import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  trattativaId: string;
  onEvento: (tipo: string, desc: string, dettagli?: any) => void;
}

export const TrattativaScadenzeTab = ({ trattativaId, onEvento }: Props) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [dataScad, setDataScad] = useState<string | null>(null);

  const { data: scadenze = [], isLoading } = useQuery({
    queryKey: ["trattativa_scadenze", trattativaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattativa_scadenze")
        .select("*, autore:created_by(nome, cognome)")
        .eq("trattativa_id", trattativaId)
        .order("data_scadenza", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const addScadenza = useMutation({
    mutationFn: async () => {
      if (!titolo.trim() || !dataScad) throw new Error("Titolo e data obbligatori");
      const { error } = await supabase.from("trattativa_scadenze").insert({
        trattativa_id: trattativaId,
        titolo: titolo.trim(),
        data_scadenza: dataScad,
        created_by: profile?.id,
      });
      if (error) throw error;
      onEvento("appuntamento", `Scadenza aggiunta: ${titolo.trim()}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattativa_scadenze", trattativaId] });
      setTitolo("");
      setDataScad(null);
      setShowAdd(false);
      toast.success("Scadenza aggiunta");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCompletata = useMutation({
    mutationFn: async ({ id, completata }: { id: string; completata: boolean }) => {
      const { error } = await supabase.from("trattativa_scadenze").update({ completata }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trattativa_scadenze", trattativaId] }),
  });

  const deleteScadenza = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trattativa_scadenze").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattativa_scadenze", trattativaId] });
      toast.success("Scadenza eliminata");
    },
  });

  const isScaduta = (d: string) => new Date(d) < new Date() ;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Scadenze ({scadenze.filter((s: any) => !s.completata).length} aperte)
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1">
          <Plus className="w-3.5 h-3.5" />Aggiungi
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo scadenza..." />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start", !dataScad && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataScad ? format(new Date(dataScad), "dd/MM/yyyy", { locale: it }) : "Seleziona data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataScad ? new Date(dataScad) : undefined}
                onSelect={(d) => setDataScad(d ? format(d, "yyyy-MM-dd") : null)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addScadenza.mutate()} disabled={addScadenza.isPending || !titolo.trim() || !dataScad}>Salva</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : scadenze.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nessuna scadenza.</p>
      ) : (
        <div className="space-y-2">
          {scadenze.map((s: any) => (
            <div key={s.id} className={cn(
              "flex items-center justify-between p-3 border rounded-lg transition-colors",
              s.completata && "opacity-60 bg-muted/20",
              !s.completata && isScaduta(s.data_scadenza) && "border-destructive/50 bg-destructive/5"
            )}>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={s.completata}
                  onCheckedChange={(v) => toggleCompletata.mutate({ id: s.id, completata: !!v })}
                />
                <div>
                  <p className={cn("text-sm font-medium", s.completata && "line-through")}>{s.titolo}</p>
                  <p className={cn("text-xs", !s.completata && isScaduta(s.data_scadenza) ? "text-destructive" : "text-muted-foreground")}>
                    {format(new Date(s.data_scadenza), "dd/MM/yyyy", { locale: it })}
                    {!s.completata && isScaduta(s.data_scadenza) && " — SCADUTA"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteScadenza.mutate(s.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
