export const ROOT_ADMIN_EMAIL = "admin@mpc.it";

export const OTHER_ADMIN_LOCKED_MESSAGE =
  "Solo admin@mpc.it può modificare un altro account amministratore";

export function isRootAdminEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === ROOT_ADMIN_EMAIL;
}

export function isAdminAccount(user: {
  ruolo?: string | null;
  ruoli_rls?: string[] | null;
  email?: string | null;
}): boolean {
  if ((user.ruolo || "").trim().toLowerCase() === "admin") return true;
  if (isRootAdminEmail(user.email)) return true;
  return (user.ruoli_rls || []).some((role) => role === "admin");
}

/**
 * Un amministratore può modificare il proprio account.
 * Un altro account admin si modifica solo da admin@mpc.it.
 * Gli account che non sono admin restano modificabili.
 */
export function canModifyAccount(
  actor: { id?: string | null; email?: string | null },
  target: { id?: string | null; ruolo?: string | null; ruoli_rls?: string[] | null; email?: string | null },
): boolean {
  if (actor.id && target.id && actor.id === target.id) return true;
  if (!isAdminAccount(target)) return true;
  return isRootAdminEmail(actor.email);
}
