/**
 * Version check + cache purge utilities.
 *
 * Confronta la versione del bundle (VITE_APP_VERSION embedded a build-time)
 * con quella servita da /version.json. Se non coincidono, l'utente sta
 * eseguendo un bundle vecchio: puliamo cache/SW e ricarichiamo con URL
 * cache-busted (throttle breve anti-loop, nessun cooldown lungo).
 */

const VERSION_STORAGE_PREFIX = "__cbnet_version_";
const RELOAD_FLAG = `${VERSION_STORAGE_PREFIX}reload_ts`;
const RELOAD_THROTTLE_MS = 5_000;
const RELOAD_ATTEMPT = `${VERSION_STORAGE_PREFIX}reload_attempt`;
const STORAGE_KEYS_TO_KEEP = (k: string) =>
  k.startsWith("sb-") || k.startsWith("supabase.") || k.startsWith(VERSION_STORAGE_PREFIX);

export const BUNDLE_VERSION: string =
  (import.meta as any).env?.VITE_APP_VERSION || "dev";

// Disattiviamo il check SOLO su localhost (vero dev locale).
const IS_LOCAL_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
let versionCheckPromise: Promise<boolean> | null = null;

export type VersionStatus =
  | { state: "idle" | "checking" | "current"; info?: VersionInfo }
  | { state: "stale" | "reload-blocked"; info: VersionInfo; reason: string };

const listeners = new Set<(status: VersionStatus) => void>();

function notifyVersionStatus(status: VersionStatus): void {
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {}
  });
}

export function subscribeToVersionStatus(listener: (status: VersionStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}


export interface VersionInfo {
  bundle: string;
  server: string | null;
  match: boolean;
}

export async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const server = await fetchServerVersion();
  return {
    bundle: BUNDLE_VERSION,
    server,
    match: !server || server === BUNDLE_VERSION,
  };
}

/**
 * Disinstalla service worker registrati e cancella tutte le cache.
 */
export async function purgeClientCaches(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {}

  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n).catch(() => false)));
    }
  } catch {}

  try {
    const removeFrom = (s: Storage) => {
      const toRemove: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && !STORAGE_KEYS_TO_KEEP(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => s.removeItem(k));
    };
    removeFrom(localStorage);
    removeFrom(sessionStorage);
  } catch {}
}

export async function getServiceWorkerDiagnostics(): Promise<{ registrations: number; cacheNames: string[] }> {
  const [registrations, cacheNames] = await Promise.all([
    "serviceWorker" in navigator
      ? navigator.serviceWorker.getRegistrations().catch(() => [])
      : Promise.resolve([]),
    typeof caches !== "undefined" ? caches.keys().catch(() => []) : Promise.resolve([]),
  ]);
  return { registrations: registrations.length, cacheNames };
}

function readVersionStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeVersionStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {}
}

function canReloadNow(): boolean {
  try {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
    if (typeof window !== "undefined" && (window as any).__lovableFormDirty === true) return false;
    if (typeof document !== "undefined") {
      const ae = document.activeElement as HTMLElement | null;
      if (ae) {
        const tag = ae.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
        if ((ae as any).isContentEditable) return false;
      }
    }
  } catch {}
  return true;
}

export function forceReload(reason: string, _serverVersion?: string | null): boolean {
  if (!canReloadNow()) {
    console.warn(`[versionCheck] reload deferred (form dirty / focus): ${reason}`);
    return false;
  }
  try {
    const last = Number(readVersionStorage(RELOAD_FLAG) || 0);
    const now = Date.now();
    if (now - last < RELOAD_THROTTLE_MS) {
      console.warn(`[versionCheck] reload skipped (throttle): ${reason}`);
      return false;
    }
    writeVersionStorage(RELOAD_FLAG, String(now));
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set("__v", Date.now().toString());
  url.searchParams.delete("sw-cleanup");
  console.warn(`[versionCheck] forcing reload: ${reason}`);
  window.location.replace(url.toString());
  return true;
}


export async function refreshToLatestVersion(reason = "manual update requested"): Promise<void> {
  try {
    writeVersionStorage(RELOAD_ATTEMPT, String(Date.now()));
    await purgeClientCaches();
  } finally {
    if (!forceReload(reason)) {
      const url = new URL(window.location.href);
      url.searchParams.set("__v", Date.now().toString());
      window.location.href = url.toString();
    }
  }
}

/**
 * Esegue il check, pulisce caches e ricarica se la versione è disallineata.
 * Ritorna true se la versione è OK (l'app può proseguire).
 */
async function runLatestVersionCheck(): Promise<boolean> {
  if (IS_LOCAL_DEV) return true;

  notifyVersionStatus({ state: "checking" });
  const info = await getVersionInfo();
  console.info(
    `[versionCheck] bundle=${info.bundle} server=${info.server ?? "n/a"} match=${info.match}`,
  );
  if (info.match) {
    notifyVersionStatus({ state: "current", info });
    return true;
  }

  // NON ricarichiamo mai automaticamente: mostriamo solo il banner
  // "Versione non aggiornata" e lasciamo che sia l'utente a cliccare
  // "Aggiorna ora" (refreshToLatestVersion). Niente più reload a sorpresa
  // che fanno perdere form aperti.
  const reason = `bundle ${info.bundle} != server ${info.server}`;
  notifyVersionStatus({ state: "stale", info, reason });
  return true;
}

export async function ensureLatestVersion(): Promise<boolean> {
  if (versionCheckPromise) return versionCheckPromise;
  versionCheckPromise = runLatestVersionCheck().finally(() => {
    versionCheckPromise = null;
  });
  return versionCheckPromise;
}
