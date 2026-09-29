import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ClienteNotifiche = () => {
  const [notifiche, setNotifiche] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("notifiche")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifiche(data ?? []);
        setLoading(false);
      });
  }, []);

  const markRead = async (id: string) => {
    await supabase.from("notifiche").update({ letto: true }).eq("id", id);
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letto: true } : n)));
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div data-tour="cl-notif-page" className="space-y-4">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Bell className="h-5 w-5 text-destructive" /> Notifiche
      </h1>
      {notifiche.length === 0 ? (
        <p className="text-muted-foreground">Nessuna notifica.</p>
      ) : (
        <div className="grid gap-2">
          {notifiche.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer transition-colors ${!n.letto ? "border-primary/30 bg-primary/5" : ""}`}
              onClick={() => !n.letto && markRead(n.id)}
            >
              <CardContent className="flex items-start justify-between py-3">
                <div>
                  <p className="font-medium text-sm text-foreground">{n.titolo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.messaggio}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {!n.letto && <Badge variant="destructive" className="text-[10px]">Nuova</Badge>}
                  <p className="text-[10px] text-muted-foreground mt-1">{n.created_at?.slice(0, 10)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteNotifiche;
