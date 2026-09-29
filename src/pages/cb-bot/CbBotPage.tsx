import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  History,
  Link2,
  Mail,
  ScrollText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countCbBotFontiSiti } from "@/lib/cbBotFontiSiti";
import { Badge } from "@/components/ui/badge";
import AssistenteGaranzieSection from "@/components/documentale/AssistenteGaranzieSection";

const adminLinks = [
  { label: "Fonti siti", path: "/cb-bot/fonti-siti", icon: Link2, key: "fonti" },
  { label: "Libreria CGA", path: "/cb-bot/libreria-cga", icon: BookOpen, key: "cga" },
  { label: "Ricerche salvate", path: "/cb-bot/ricerche", icon: History, key: "ricerche" },
  { label: "Accessi", path: "/cb-bot/accessi", icon: Mail, key: "accessi" },
  { label: "Istruzioni", path: "/cb-bot/istruzioni", icon: ScrollText, key: "istruzioni" },
] as const;

const CbBotPage = () => {
  const navigate = useNavigate();

  const { data: ricercheCount } = useQuery({
    queryKey: ["cb-bot", "ricerche-salvate-count"],
    queryFn: async () => {
      const { count, error } = await (supabase.from("garanzie_chat_conversazioni") as any)
        .select("id", { count: "exact", head: true })
        .eq("salvata", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: cgaCount } = useQuery({
    queryKey: ["cb-bot", "prodotti-cga-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("prodotti_cga")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const fontiCount = countCbBotFontiSiti();

  const badgeFor = (key: string) => {
    if (key === "cga" && cgaCount != null) return `${cgaCount} prodotti`;
    if (key === "ricerche" && ricercheCount != null) return `${ricercheCount} salvate`;
    if (key === "fonti") return fontiCount > 0 ? `${fontiCount} siti` : "da caricare";
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CB Bot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assistente Web sui siti autorizzati, documenti e Libreria CGA. Sotto, la configurazione admin.
        </p>
      </div>

      <AssistenteGaranzieSection />

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configurazione</p>
        <div className="flex flex-wrap gap-2">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const badge = badgeFor(link.key);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent/50 hover:border-primary/30 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {link.label}
                {badge && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CbBotPage;
