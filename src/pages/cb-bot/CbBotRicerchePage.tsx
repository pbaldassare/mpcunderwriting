import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowLeft, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

type Ricerca = {
  id: string;
  titolo: string;
  tipo: string;
  autore_email: string | null;
  salvata: boolean;
  salvata_at: string | null;
  updated_at: string;
  in_evidenza: boolean;
  condivisa: boolean;
};

type Msg = { id: string; role: string; content: string; created_at: string };

const CbBotRicerchePage = () => {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cb-bot-ricerche-salvate"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garanzie_chat_conversazioni")
        .select("id, titolo, tipo, autore_email, salvata, salvata_at, updated_at, in_evidenza, condivisa" as never)
        .eq("salvata" as never, true)
        .order("salvata_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Ricerca[];
    },
  });

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ["cb-bot-ricerche-salvate", "msg", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garanzie_chat_messaggi")
        .select("id, role, content, created_at")
        .eq("conversazione_id", openId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cb-bot")} title="Torna a CB Bot">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ricerche salvate</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Archivio delle ricerche pinate da Assistente Web e Libreria CGA. Restano dopo «Azzera cronologia».
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nessuna ricerca salvata. Dalla chat, usa «Salva ricerca» o il segnalibro.
        </div>
      ) : (
        <TableScrollArea className="rounded-lg border">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Titolo</th>
                <th className="text-left p-3">Canale</th>
                <th className="text-left p-3">Autore</th>
                <th className="text-left p-3">Salvata il</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">
                    {r.titolo}
                    <div className="flex gap-1 mt-1">
                      {r.in_evidenza && <Badge variant="secondary" className="text-[9px]">Know-how</Badge>}
                      {r.condivisa && <Badge variant="outline" className="text-[9px]">Team</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.tipo === "cga" ? "Libreria CGA" : "Assistente Web"}</td>
                  <td className="p-3 text-muted-foreground">{r.autore_email ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {format(new Date(r.salvata_at ?? r.updated_at), "dd MMM yyyy HH:mm", { locale: it })}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                      {openId === r.id ? "Chiudi" : "Apri"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScrollArea>
      )}

      {openId && (
        <div className="rounded-xl border bg-card p-4">
          {msgLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3 pr-3">
                {messages.map((m) => (
                  <div key={m.id}>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {m.role === "user" ? "Domanda" : "Risposta"}
                    </p>
                    <pre className="text-sm whitespace-pre-wrap">{m.content}</pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
};

export default CbBotRicerchePage;
