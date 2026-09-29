import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useConsultazione } from "@/contexts/ConsultazioneContext";

export default function ConsultazioneGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useConsultazione();
  const location = useLocation();

  if (loading) return null;

  if (!session) {
    return <Navigate to="/login?mode=consultazione" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
