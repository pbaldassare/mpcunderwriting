import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, FileText, Clock } from "lucide-react";

const ProspectDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ trattative: 0, documenti: 0 });
  const [prospectId, setProspectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Find prospect linked to this user
      const { data: prospect } = await supabase
        .from("prospect")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prospect) return;
      setProspectId(prospect.id);

      // Count trattative
      const { count: trattativeCount } = await supabase
        .from("trattative")
        .select("*", { count: "exact", head: true })
        .eq("prospect_id", prospect.id);

      // Count documenti
      const { count: docCount } = await supabase
        .from("documenti")
        .select("*", { count: "exact", head: true })
        .eq("entita_tipo", "prospect")
        .eq("entita_id", prospect.id);

      setStats({
        trattative: trattativeCount || 0,
        documenti: docCount || 0,
      });
    };
    load();
  }, [user]);

  const kpis = [
    { label: "Trattative", value: stats.trattative, icon: ClipboardList, color: "text-orange-500" },
    { label: "Documenti", value: stats.documenti, icon: FileText, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Benvenuto nella tua Area Prospect</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Qui puoi seguire l'avanzamento delle tue trattative e gestire i tuoi documenti.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!prospectId && (
        <Card>
          <CardContent className="py-8 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Il tuo profilo prospect non è ancora stato collegato. Contatta l'agenzia per assistenza.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProspectDashboard;
