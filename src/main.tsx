import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUNDLE_VERSION, purgeClientCaches } from "./lib/versionCheck";
import { APP_RELEASE_LABEL } from "./lib/appRelease";
import { installSafeRandomUUID } from "./lib/safeId";

installSafeRandomUUID();

console.info(`[CBnet] bundle version: ${BUNDLE_VERSION}`);
console.info(`[CBnet] release marker: ${APP_RELEASE_LABEL}`);

// Best-effort cleanup ad ogni avvio: disinstalla qualsiasi Service Worker
// residuo e svuota le cache HTTP del browser. Non blocca il rendering.
try {
  if (typeof window !== "undefined") {
    purgeClientCaches().catch(() => {});
  }
} catch {}

import { supabase } from "@/integrations/supabase/client";

if (typeof window !== "undefined") {
  (window as any).supabase = supabase;
}

createRoot(document.getElementById("root")!).render(<App />);
