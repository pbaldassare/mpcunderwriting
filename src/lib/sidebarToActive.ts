function pathOf(to: string) {
  return to.split("?")[0];
}

/**
 * Active state per NavLink con query string.
 * CB Bot (`?tab=cb-bot`) e Archivio Documentale condividono il pathname:
 * senza questo controllo si accenderebbero entrambi.
 */
export function isSidebarToActive(
  location: { pathname: string; search: string },
  to: string,
  end = false,
) {
  const path = pathOf(to);
  const pathMatch = end
    ? location.pathname === path
    : location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  if (!pathMatch) return false;

  const wantedTab = new URLSearchParams(to.includes("?") ? to.slice(to.indexOf("?") + 1) : "").get("tab");
  const currentTab = new URLSearchParams(location.search).get("tab");
  const isCbBotTab = currentTab === "cb-bot" || currentTab === "assistente-garanzie";

  if (wantedTab === "cb-bot" || wantedTab === "assistente-garanzie") return isCbBotTab;
  if (path === "/portafoglio/documentale") return !isCbBotTab;
  if (wantedTab) return currentTab === wantedTab;
  return true;
}
