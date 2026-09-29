import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { format } from "date-fns";

interface ConfermeStatusProps {
  messaggioId: string;
}

export default function ConfermeStatus({ messaggioId }: ConfermeStatusProps) {
  const { data: conferme } = useQuery({
    queryKey: ["chat_conferme_status", messaggioId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conferme_lettura")
        .select("*, profiles:user_id(nome, cognome)")
        .eq("messaggio_id", messaggioId);
      return data || [];
    },
    refetchInterval: 5000,
  });

  if (!conferme) return null;

  const confermati = conferme.filter((c: any) => c.confermato).length;
  const totale = conferme.length;

  return (
    <div className="mt-1 bg-muted/50 rounded-lg p-2 text-xs space-y-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-foreground">Conferme</span>
        <Badge variant={confermati === totale ? "default" : "secondary"} className="text-[10px] px-1.5">
          {confermati}/{totale}
        </Badge>
      </div>
      {conferme.map((c: any) => (
        <div key={c.id} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">
            {c.profiles?.nome || ""} {c.profiles?.cognome || ""}
          </span>
          <div className="flex items-center gap-1">
            {c.confermato ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] text-muted-foreground">
                  {c.confermato_at ? format(new Date(c.confermato_at), "dd/MM HH:mm") : ""}
                </span>
              </>
            ) : (
              <X className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
