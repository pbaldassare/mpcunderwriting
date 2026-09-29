import { useEffect } from "react";
import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ensureLatestVersion,
  BUNDLE_VERSION,
  subscribeToVersionStatus,
  refreshToLatestVersion,
  getServiceWorkerDiagnostics,
  type VersionStatus,
} from "@/lib/versionCheck";
import { APP_RELEASE_LABEL } from "@/lib/appRelease";

/**
 * AppVersionGuard
 *
 * - All'avvio: confronta bundle vs /version.json. Se diverso, pulisce caches e reload.
 * - Polling rapido (ogni 30s) così la preview si auto-aggiorna dopo una modifica.
 * - Re-check immediato quando il tab torna visibile o riceve focus.
 * - Re-check quando torna online dopo disconnessione.
 *
 * Throttle anti-loop di reload è gestito in versionCheck.ts (30s).
 */
const POLL_MS = 30_000;
const MIN_CHECK_GAP_MS = 10_000;

const AppVersionGuard = () => {
  const [status, setStatus] = useState<VersionStatus>({ state: "idle" });
  const [diagnostics, setDiagnostics] = useState<string>("");

  useEffect(() => {
    console.info(`[AppVersionGuard] bundle ${BUNDLE_VERSION}`);
    console.info(`[AppVersionGuard] release ${APP_RELEASE_LABEL}`);

    const unsubscribe = subscribeToVersionStatus((next) => {
      setStatus(next);
      if (next.state === "stale" || next.state === "reload-blocked") {
        getServiceWorkerDiagnostics()
          .then((d) => setDiagnostics(`SW ${d.registrations} • Cache ${d.cacheNames.length}`))
          .catch(() => setDiagnostics(""));
      }
    });

    let cancelled = false;
    let lastCheck = 0;
    const run = () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastCheck < MIN_CHECK_GAP_MS) return;
      lastCheck = now;
      ensureLatestVersion().catch(() => {});
    };

    const t0 = window.setTimeout(run, 800);
    const interval = window.setInterval(run, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    const onFocus = () => run();
    const onOnline = () => run();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearTimeout(t0);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (status.state !== "stale" && status.state !== "reload-blocked") return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[1000] border-b border-destructive/30 bg-background/95 px-4 py-3 text-foreground shadow-lg backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Versione non aggiornata caricata</p>
            <p className="text-xs text-muted-foreground">
              Bundle {status.info.bundle} • Server {status.info.server ?? "n/d"}
              {diagnostics ? ` • ${diagnostics}` : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => refreshToLatestVersion("user accepted stale version banner")} className="shrink-0">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Aggiorna ora
        </Button>
      </div>
    </div>
  );
};

export default AppVersionGuard;
