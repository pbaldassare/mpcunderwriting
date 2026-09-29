/**
 * Centralised landing-route logic.
 * Given a profile object returns the first route the user is allowed to see.
 */
export function getDefaultRoute(
  profile: { ruolo?: string | null; permessi_json?: unknown } | null | undefined,
): string {
  if (!profile) return "/login";

  if (profile.ruolo === "cliente") return "/cliente";
  if (profile.ruolo === "prospect") return "/prospect";

  // Tutti gli altri ruoli vanno alla dashboard principale
  return "/";
}
