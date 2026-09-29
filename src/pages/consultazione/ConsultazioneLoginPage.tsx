import { Navigate } from "react-router-dom";

/** Ingresso unificato su /login?mode=consultazione */
export default function ConsultazioneLoginPage() {
  return <Navigate to="/login?mode=consultazione" replace />;
}
