import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPreviousListRoute } from "@/hooks/useNavigationHistory";

/** True se React Router ha una voce precedente nella sessione. */
function hasRouterHistory(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * Torna al punto precedente. Se non c'è storia (link diretto),
 * usa l'ultima lista visitata o `fallback`.
 */
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (hasRouterHistory()) {
      navigate(-1);
      return;
    }
    const prev = getPreviousListRoute(location.pathname + location.search);
    navigate(prev?.path || fallback);
  }, [fallback, location.pathname, location.search, navigate]);
}
