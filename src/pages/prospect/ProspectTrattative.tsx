import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

interface Trattativa {
  id: string;
  compagnia: string | null;
  prodotto: string | null;
  stato: string;
  premio_previsto: number | null;
  created_at: string | null;
}

const statoColors: Record<string, string> = {
  aperta: "bg-blue-500",
  in_trattativa: "bg-amber-500",
  vinta: "bg-green-500",
  persa: "bg-red-500",
  sospesa: "bg-gray-500",
};

const ProspectTrattative = () => {
  const { user } = useAuth();
  const [trattative, setTrattative] = useState<Trattativa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prospect } = await supabase
        .from("prospect")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prospect) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("trattative")
        .select("id, compagnia, prodotto, stato, premio_previsto, created_at")
        .eq("prospect_id", prospect.id)
        .order("created_at", { ascending: false });

      setTrattative((data as Trattativa[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Le mie Trattative</h1>
        <p className="text-sm text-muted-foreground mt-1">Stato delle tue trattative in corso con l'compagnia.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      ) : trattative.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nessuna trattativa trovata.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trattative.map((t) => (
            <Card key={t.id}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">
                    {t.prodotto || "Trattativa"} {t.compagnia ? `— ${t.compagnia}` : ""}
                  </CardTitle>
                  <Badge className={`${statoColors[t.stato] || "bg-muted"} text-white text-[10px]`}>
                    {t.stato}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {t.premio_previsto != null && (
                    <span>Premio previsto: <strong className="text-foreground">€ {t.premio_previsto.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong></span>
                  )}
                  {t.created_at && (
                    <span>Data: <strong className="text-foreground">{new Date(t.created_at).toLocaleDateString("it-IT")}</strong></span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProspectTrattative;
