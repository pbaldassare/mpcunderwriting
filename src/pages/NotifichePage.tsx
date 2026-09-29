import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCheck, ExternalLink, AlertTriangle, Landmark, Send, FileText, Shield } from "lucide-react";
import { logAttivita } from "@/lib/logAttivita";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

const TIPO_ICONS: Record<string, typeof Bell> = {
  sinistri: AlertTriangle,
  banca: Landmark,
  rimessa: Send,
  titoli: FileText,
  privacy: Shield,
};

const PRIORITA_COLORS: Record<string, string> = {
  alta: "bg-destructive text-destructive-foreground",
  media: "bg-primary text-primary-foreground",
  bassa: "bg-muted text-muted-foreground",
};

const ENTITA_ROUTES: Record<string, string> = {
  sinistro: "/sinistri",
  titolo: "/titoli",
  rimessa: "/contabilita/storico-rimesse",
  prospect: "/prospect",
};

const NotifichePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("tutti");
  const [filtroPriorita, setFiltroPriorita] = useState<string>("tutti");
  const [filtroLetto, setFiltroLetto] = useState<string>("tutti");

  const fetchNotifiche = async () => {
    setLoading(true);
    let query = supabase
      .from("notifiche")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filtroTipo !== "tutti") query = query.eq("tipo", filtroTipo);
    if (filtroPriorita !== "tutti") query = query.eq("priorita", filtroPriorita);
    if (filtroLetto === "non_lette") query = query.eq("letto", false);
    if (filtroLetto === "lette") query = query.eq("letto", true);

    const { data } = await query;
    setNotifiche((data as Notifica[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifiche();
  }, [filtroTipo, filtroPriorita, filtroLetto]);

  const segnaLetto = async (id: string) => {
    await supabase.from("notifiche").update({ letto: true }).eq("id", id);
    await logAttivita({ azione: "notifica_letta", entita_tipo: "notifica", entita_id: id });
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letto: true } : n)));
  };

  const segnaTutteLette = async () => {
    const ids = notifiche.filter((n) => !n.letto).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifiche").update({ letto: true }).in("id", ids);
    setNotifiche((prev) => prev.map((n) => ({ ...n, letto: true })));
  };

  const navigaEntita = (n: Notifica) => {
    if (!n.entita_tipo || !n.entita_id) return;
    const base = ENTITA_ROUTES[n.entita_tipo];
    if (base) {
      if (!n.letto) segnaLetto(n.id);
      navigate(`${base}/${n.entita_id}`);
    }
  };

  const nonLette = notifiche.filter((n) => !n.letto).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro Notifiche</h1>
          <p className="text-muted-foreground text-sm">
            {nonLette > 0 ? `${nonLette} notifiche non lette` : "Nessuna notifica non letta"}
          </p>
        </div>
        {nonLette > 0 && (
          <Button variant="outline" size="sm" onClick={segnaTutteLette}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Segna tutte lette
          </Button>
        )}
      </div>

      {/* Filtri */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i tipi</SelectItem>
            <SelectItem value="sinistri">Sinistri</SelectItem>
            <SelectItem value="banca">Banca</SelectItem>
            <SelectItem value="rimessa">Rimessa</SelectItem>
            <SelectItem value="titoli">Titoli</SelectItem>
            <SelectItem value="privacy">Privacy</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPriorita} onValueChange={setFiltroPriorita}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priorità" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="bassa">Bassa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroLetto} onValueChange={setFiltroLetto}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutte</SelectItem>
            <SelectItem value="non_lette">Non lette</SelectItem>
            <SelectItem value="lette">Lette</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {loading && <p className="text-muted-foreground text-sm">Caricamento...</p>}
        {!loading && notifiche.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nessuna notifica trovata</p>
          </div>
        )}
        {notifiche.map((n) => {
          const Icon = TIPO_ICONS[n.tipo] || Bell;
          return (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                n.letto ? "bg-card border-border" : "bg-accent/30 border-primary/20"
              }`}
            >
              <div className={`p-2 rounded-lg ${n.letto ? "bg-muted" : "bg-primary/10"}`}>
                <Icon className={`w-5 h-5 ${n.letto ? "text-muted-foreground" : "text-primary"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium text-sm ${n.letto ? "text-muted-foreground" : "text-foreground"}`}>
                    {n.titolo}
                  </span>
                  <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITA_COLORS[n.priorita]}`}>
                    {n.priorita}
                  </Badge>
                  {!n.letto && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{n.messaggio}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {n.entita_tipo && n.entita_id && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigaEntita(n)}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                {!n.letto && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => segnaLetto(n.id)}>
                    <CheckCheck className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotifichePage;
