import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ClienteGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const [areaType, setAreaType] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const isPreviewRole = profile?.ruolo === "admin" || profile?.ruolo === "ufficio";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    // Admin/ufficio: anteprima portale, no query su clienti
    if (isPreviewRole) {
      setChecking(false);
      return;
    }
    supabase
      .from("clienti")
      .select("area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAreaType((data as any)?.area_riservata_tipo || "nessuna");
        setChecking(false);
      });
  }, [user, loading, isPreviewRole]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (isPreviewRole) return <>{children}</>;
  if (profile?.ruolo !== "cliente") return <Navigate to="/" replace />;
  if (areaType === "nessuna") return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ClienteGuard;
