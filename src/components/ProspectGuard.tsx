import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ProspectGuard = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Admin/ufficio possono fare anteprima del portale prospect
  if (profile?.ruolo === "admin" || profile?.ruolo === "ufficio") return <>{children}</>;
  if (profile?.ruolo !== "prospect") return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProspectGuard;
