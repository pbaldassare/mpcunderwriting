/** Percorso visibile in barra degli indirizzi per l'hub MPC Bot. */
export const MPC_BOT_PATH = "/mpc-bot";

/** Query `tab` della pagina documentale quando è aperto MPC Bot. */
export const MPC_BOT_TAB_QUERY = "mpc-bot";

const LEGACY_BOT_TAB_QUERIES = new Set(["cb-bot", "assistente-garanzie"]);

export function isMpcBotTabQuery(raw: string | null | undefined): boolean {
  return raw === MPC_BOT_TAB_QUERY || (!!raw && LEGACY_BOT_TAB_QUERIES.has(raw));
}

export function isLegacyBotTabQuery(raw: string | null | undefined): boolean {
  return !!raw && LEGACY_BOT_TAB_QUERIES.has(raw);
}

export function mpcBotPath(suffix = ""): string {
  const tail = suffix.replace(/^\//, "");
  return tail ? `${MPC_BOT_PATH}/${tail}` : MPC_BOT_PATH;
}
