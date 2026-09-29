import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useRecentEntities } from "@/hooks/useRecentEntities";
import { detectEntity, resolveEntityLabel } from "@/lib/entityResolver";

/** Mounts no UI. Listens to route changes and pushes entity visits into recent list. */
const RecentEntitiesTracker = () => {
  const { pathname } = useLocation();
  const { addRecent } = useRecentEntities();

  useEffect(() => {
    const m = detectEntity(pathname);
    if (!m) return;
    let cancelled = false;
    (async () => {
      const info = await resolveEntityLabel(m);
      if (cancelled || !info) return;
      addRecent({ kind: m.kind, id: m.id, label: info.label, sub: info.sub, path: m.path });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, addRecent]);

  return null;
};

export default RecentEntitiesTracker;
