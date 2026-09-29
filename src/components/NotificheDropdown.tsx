import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Bell, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { logAttivita } from "@/lib/logAttivita";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

interface Notifica {
  id: string;
  tipo: string;
  titolo: string;
  messaggio: string;
  entita_tipo: string | null;
  entita_id: string | null;
  priorita: string;
  letto: boolean;
  created_at: string;
}

const ENTITA_ROUTES: Record<string, string> = {
  sinistro: "/sinistri",
  titolo: "/titoli",
  rimessa: "/contabilita/storico-rimesse",
  prospect: "/prospect",
};

const NotificheDropdown = () => {
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifiche = async () => {
    const { data } = await supabase
      .from("notifiche")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifiche((data as Notifica[]) || []);
  };

  useEffect(() => {
    fetchNotifiche();
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      channel = supabase
        .channel("notifiche-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifiche", filter: userId ? `destinatario_id=eq.${userId}` : undefined },
          (payload) => {
            const n = payload.new as Notifica;
            fetchNotifiche();
            // Toast immediato per eventi movimenti bancari
            if (n?.tipo?.startsWith("mov_bancario_")) {
              toast.info(n.titolo, { description: n.messaggio });
            }
          },
        )
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const nonLette = notifiche.filter((n) => !n.letto).length;

  const segnaLetto = async (id: string) => {
    await supabase.from("notifiche").update({ letto: true }).eq("id", id);
    await logAttivita({ azione: "notifica_letta", entita_tipo: "notifica", entita_id: id });
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letto: true } : n)));
  };

  const navigaEntita = (n: Notifica) => {
    if (!n.entita_tipo || !n.entita_id) return;
    const base = ENTITA_ROUTES[n.entita_tipo];
    if (base) {
      if (!n.letto) segnaLetto(n.id);
      setOpen(false);
      navigate(`${base}/${n.entita_id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Bell className="w-5 h-5" />
          {nonLette > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {nonLette > 9 ? "9+" : nonLette}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm text-foreground">Notifiche</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => { setOpen(false); navigate("/notifiche"); }}
          >
            Vedi tutte
          </Button>
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifiche.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">Nessuna notifica</p>
          )}
          {notifiche.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                !n.letto ? "bg-accent/20" : ""
              }`}
              onClick={() => (n.entita_tipo && n.entita_id ? navigaEntita(n) : segnaLetto(n.id))}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {!n.letto && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  <span className={`text-sm font-medium truncate ${n.letto ? "text-muted-foreground" : "text-foreground"}`}>
                    {n.titolo}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.messaggio}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(n.created_at), "dd MMM HH:mm", { locale: it })}
                </p>
              </div>
              {n.entita_tipo && n.entita_id && (
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificheDropdown;
