import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, MessageSquare, Phone, Mail, CalendarDays, ArrowRightLeft, FileText, Pencil } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const TIPO_ICONE: Record<string, any> = {
  nota: MessageSquare,
  telefonata: Phone,
  email: Mail,
  appuntamento: CalendarDays,
  cambio_stato: ArrowRightLeft,
  documento: FileText,
  modifica: Pencil,
};

const TIPO_COLORS: Record<string, string> = {
  nota: "bg-blue-100 text-blue-700",
  telefonata: "bg-green-100 text-green-700",
  email: "bg-purple-100 text-purple-700",
  appuntamento: "bg-amber-100 text-amber-700",
  cambio_stato: "bg-red-100 text-red-700",
  documento: "bg-cyan-100 text-cyan-700",
  modifica: "bg-gray-100 text-gray-700",
};

interface Props {
  trattativaId: string;
}

export const TrattativaTimelineTab = ({ trattativaId }: Props) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [tipo, setTipo] = useState("nota");
  const [desc, setDesc] = useState("");

  const { data: eventi = [], isLoading } = useQuery({
    queryKey: ["trattativa_eventi", trattativaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattativa_eventi")
        .select("*, autore:created_by(nome, cognome)")
        .eq("trattativa_id", trattativaId)
        .order("data_evento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addEvento = useMutation({
    mutationFn: async () => {
      if (!desc.trim()) throw new Error("Inserisci una descrizione");
      const { error } = await supabase.from("trattativa_eventi").insert({
        trattativa_id: trattativaId,
        tipo_evento: tipo,
        descrizione: desc.trim(),
        created_by: profile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattativa_eventi", trattativaId] });
      setDesc("");
      setShowAdd(false);
      toast.success("Evento aggiunto");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1">
          <Plus className="w-3.5 h-3.5" />Aggiungi
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nota">📝 Nota</SelectItem>
              <SelectItem value="telefonata">📞 Telefonata</SelectItem>
              <SelectItem value="email">✉️ Email</SelectItem>
              <SelectItem value="appuntamento">📅 Appuntamento</SelectItem>
            </SelectContent>
          </Select>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrizione dell'evento..." rows={3} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addEvento.mutate()} disabled={addEvento.isPending || !desc.trim()}>Salva</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Annulla</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : eventi.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nessun evento registrato.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {eventi.map((ev: any) => {
              const Icon = TIPO_ICONE[ev.tipo_evento] || MessageSquare;
              return (
                <div key={ev.id} className="relative pl-10">
                  <div className={`absolute left-2 top-1 w-5 h-5 rounded-full flex items-center justify-center ${TIPO_COLORS[ev.tipo_evento] || "bg-muted"}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="border rounded-lg p-3 bg-background">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{ev.tipo_evento}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {ev.autore ? `${ev.autore.cognome || ""} ${ev.autore.nome || ""}`.trim() : "Sistema"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ev.data_evento || ev.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{ev.descrizione}</p>
                    {ev.dettagli_json && (
                      <pre className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-1.5 overflow-x-auto">
                        {JSON.stringify(ev.dettagli_json, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
