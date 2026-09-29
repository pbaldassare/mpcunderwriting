import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { documentaleRouteLabel, documentaleTabFromLocation } from "@/lib/documentaleTab";

const KEY = "nav-history-v1";
const MAX = 12;

export interface NavEntry {
  path: string;
  label: string;
  at: number;
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/archivi/clienti": "Clienti",
  "/trattative": "Trattative",
  "/titoli": "Titoli",
  "/sinistri": "Sinistri",
  "/portafoglio/attive": "Polizze Attive",
  "/portafoglio/carico": "Carico del mese",
  "/portafoglio/incassi": "Incassi",
  "/portafoglio/gestione": "Gestione Polizze",
  "/portafoglio/storico": "Storico Polizze",
  "/contabilita": "Riepilogo Messe a Cassa",
  "/contabilita/ec-clienti": "E/C Clienti",
  "/contabilita/ec-agenzia": "E/C Agenzie",
  "/contabilita/ec-produttori": "E/C Produttori",
  "/comunicazioni": "Comunicazioni",
  "/notifiche": "Notifiche",
  "/dashboard": "Dashboard",
  "/documentale": "Archivio Documentale",
  "/bandi": "Bandi Pubblici",
  "/bandi-pubblici": "Bandi Pubblici",
  "/bandi-pubblici/partecipati": "Bandi partecipati",
  "/trattative/storico-gare": "Storico Gare",
};

function labelFor(fullPath: string): string {
  const [pathname, search = ""] = fullPath.split("?");
  if (pathname.includes("/documentale") || pathname.startsWith("/consultazione")) {
    return documentaleRouteLabel(documentaleTabFromLocation(pathname, search));
  }
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  // longest prefix match
  let best = "";
  for (const k of Object.keys(ROUTE_LABELS)) {
    if (pathname.startsWith(k) && k.length > best.length) best = k;
  }
  return best ? ROUTE_LABELS[best] : pathname;
}

function read(): NavEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(list: NavEntry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* noop */
  }
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Tracks visited list-like routes (no detail/UUID pages) to feed the smart back. */
export function useNavigationHistoryTracker() {
  const { pathname, search } = useLocation();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (UUID_RE.test(pathname)) return; // ignore detail pages
    const full = pathname + search;
    if (last.current === full) return;
    last.current = full;
    const list = read();
    if (list.length && list[list.length - 1].path === full) return;
    list.push({ path: full, label: labelFor(full), at: Date.now() });
    write(list);
  }, [pathname, search]);
}

/** Returns the previous list-like route, used by the smart "Torna a..." button. */
export function getPreviousListRoute(currentPath: string): NavEntry | null {
  const list = read();
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].path !== currentPath && !UUID_RE.test(list[i].path)) return list[i];
  }
  return null;
}
