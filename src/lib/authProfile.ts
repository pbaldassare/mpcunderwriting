export type ProfileFetchError = { message?: string } | null | undefined;

/**
 * Un errore di rete/RLS sul fetch profilo non deve cancellare il profilo già in memoria:
 * altrimenti AuthGuard tratta l'utente come "zombie" e fa signOut (es. durante un upload).
 */
export function resolveProfileAfterFetch<T>(
  current: T | null,
  data: T | null | undefined,
  error: ProfileFetchError,
): { profile: T | null; confirmedMissing: boolean } {
  if (data) return { profile: data, confirmedMissing: false };
  if (error) return { profile: current, confirmedMissing: false };
  return { profile: null, confirmedMissing: true };
}

/** Eventi auth su cui ha senso ricaricare `profiles`. TOKEN_REFRESHED no: il profilo non cambia. */
export function shouldRefetchProfileOnAuthEvent(event: string): boolean {
  return event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED";
}
