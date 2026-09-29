import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Route alias `/polizze/:id` → risolve la polizza-contratto e reindirizza
 * al `titolo` legacy collegato (vista TitoloDetail, modello sincronizzato).
 *
 * In Fase 3, quando `titoli` verrà ritirata, qui vivrà il vero dettaglio polizza.
 */
export default function PolizzaDetailRedirect() {
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
      // Cerca il titolo madre collegato a questa polizza (numero_rata = 1 se passiamo via quietanze,
      // ma è più affidabile prendere il titolo che ha polizza_id = :id e nessun sostituisce_polizza)
      const { data, error } = await supabase
        .from("titoli")
        .select("id, sostituisce_polizza, created_at")
        .eq("polizza_id", id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
        return;
      }
      const madre = data.find((t: any) => !t.sostituisce_polizza) ?? data[0];
      setTitoloId(madre.id);
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
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Apertura polizza…
    </div>
  );
}
