export const DOCUMENTALE_TABS = ["archivio", "libreria-cga", "assistente-garanzie"] as const;
export type DocumentaleTab = (typeof DOCUMENTALE_TABS)[number];

/** Etichetta visibile in UI (sidebar, tab, H1, breadcrumb). */
export const CB_BOT_LABEL = "CB Bot";

/** Query `tab=cb-bot` (sidebar) → tab interno `assistente-garanzie`. */
export function parseDocumentaleTab(raw: string | null, consultazioneMode: boolean): DocumentaleTab {
  if (raw === "cb-bot" || raw === "assistente-garanzie") return "assistente-garanzie";
  if (raw === "libreria-cga") return "libreria-cga";
  if (raw === "archivio") return "archivio";
  return consultazioneMode ? "assistente-garanzie" : "archivio";
}

/** Tab CB Bot (assistente + libreria), non archivio cartelle. */
export function isCbBotChromeTab(tab: DocumentaleTab): boolean {
  return tab === "assistente-garanzie" || tab === "libreria-cga";
}

export function documentaleRouteLabel(tab: DocumentaleTab): string {
  return isCbBotChromeTab(tab) ? CB_BOT_LABEL : "Archivio Documentale";
}

export function documentalePageSubtitle(tab: DocumentaleTab): string {
  if (tab === "assistente-garanzie") {
    return "Assistente Web, documenti e Libreria CGA — siti autorizzati, ricerche e confronti";
  }
  if (tab === "libreria-cga") {
    return "Libreria CGA — garanzie, massimali ed esclusioni dal catalogo CBnet";
  }
  return "CGA, Condizioni di Polizza, Fascicoli Informativi e Modulistica";
}

export function documentaleTabFromLocation(pathname: string, search: string): DocumentaleTab {
  const consultazione = pathname.startsWith("/consultazione");
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("tab");
  return parseDocumentaleTab(raw, consultazione);
}

export function documentaleTabToQuery(tab: DocumentaleTab, consultazioneMode: boolean): string | null {
  if (tab === "assistente-garanzie") return "cb-bot";
  if (tab === "archivio" && !consultazioneMode) return null;
  return tab;
}
