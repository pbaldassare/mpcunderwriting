import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Route alias `/quietanze/:id` → risolve la quietanza e reindirizza
 * al `titolo` legacy 1:1 (la rata vive come riga `titoli` per backward compat).
 *
 * In Fase 3 qui vivrà la vera vista "rata" autonoma.
 */
export default function QuietanzaDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const [titoloId, setTitoloId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!id) {
        setNotFound(true);
        return;
      }
      const { data, error } = await supabase
        .from("quietanze")
        .select("titolo_id, polizza_id")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data || !data.titolo_id) {
        setNotFound(true);
        return;
      }
      setTitoloId(data.titolo_id);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) return <Navigate to="/portafoglio/attive" replace />;
  if (titoloId) return <Navigate to={`/titoli/${titoloId}`} replace />;
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Apertura quietanza…
    </div>
  );
}
