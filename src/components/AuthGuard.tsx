import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultRoute } from "@/lib/getDefaultRoute";

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, profileMissing, loading } = useAuth();
  const location = useLocation();

  // Solo se la riga profiles manca davvero. Un fetch fallito (es. durante upload)
  // non deve buttare fuori l'utente.
  useEffect(() => {
    if (!loading && user && profileMissing) {
      console.warn("[AuthGuard] User without profile, signing out");
      toast.error("Sessione non valida", { description: "Effettua nuovamente l'accesso." });
      supabase.auth.signOut();
    }
  }, [loading, user, profileMissing]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Redirect clients to portal if trying to access gestionale
  if (profile.ruolo === "cliente" && !location.pathname.startsWith("/cliente")) {
    return <Navigate to="/cliente" replace />;
  }

  // Redirect prospects to portal if trying to access gestionale
  if (profile.ruolo === "prospect" && !location.pathname.startsWith("/prospect")) {
    return <Navigate to="/prospect" replace />;
  }

  // If user lands on "/" but has no dashboard permission, redirect to their default route
  if (location.pathname === "/") {
    const defaultRoute = getDefaultRoute(profile);
    if (defaultRoute !== "/" && defaultRoute !== "/login") {
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return <>{children}</>;
};

export default AuthGuard;
