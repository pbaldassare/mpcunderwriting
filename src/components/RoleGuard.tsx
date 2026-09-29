import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { getDefaultRoute } from "@/lib/getDefaultRoute";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: string[];
  permissionKey?: string;
}

const RoleGuard = ({ children, allowedRoles, permissionKey }: RoleGuardProps) => {
  const { user, profile, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  const ruolo = profile?.ruolo || "";
  const isClienteOrProspect = ruolo === "cliente" || ruolo === "prospect";

  // Admin passa sempre; altrimenti ruolo in allowedRoles + eventuale permissionKey
  const roleOk =
    !!profile &&
    !isClienteOrProspect &&
    (ruolo === "admin" || allowedRoles.includes(ruolo));

  const permOk = !permissionKey || hasPermission(permissionKey);
  const isAllowed = roleOk && permOk;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAllowed) {
      logAttivita({
        azione: "accesso_non_autorizzato_bloccato",
        entita_tipo: "pagina",
        entita_id: "00000000-0000-0000-0000-000000000000",
        dettagli_json: {
          path: window.location.pathname,
          ruolo: ruolo || "nessuno",
          allowedRoles,
          permissionKey: permissionKey || null,
        },
        severity: "warning",
      });
      const fallback = getDefaultRoute(profile);
      navigate(fallback, { replace: true });
    }
  }, [loading, user, isAllowed, navigate, profile, ruolo, allowedRoles, permissionKey]);

  if (loading) return null;
  if (!user || !isAllowed) return null;

  return <>{children}</>;
};

export default RoleGuard;
