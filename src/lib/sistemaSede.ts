/** Ruoli di sede (non admin) che vedono Sistema: Tabelle di base + Template mail. */
export const SEDE_SISTEMA_ROLES = [
  "ufficio",
  "backoffice",
  "contabilita",
  "responsabile_sede",
] as const;

export const SISTEMA_SEDE_ALLOWED_ROLES = ["admin", ...SEDE_SISTEMA_ROLES] as const;

/** Voci Sistema riservate all'admin. */
export const SISTEMA_ADMIN_ONLY_PATHS = [
  "/anomalie-sistema",
  "/backup-export",
  "/sitemap",
] as const;

export type TemplateSedeScope = {
  ruolo?: string | null;
  ufficioId?: string | null;
};

export function isAdminSistema(ruolo?: string | null): boolean {
  return ruolo === "admin";
}

export function isSedeSistemaRole(ruolo?: string | null): boolean {
  return !!ruolo && (SEDE_SISTEMA_ROLES as readonly string[]).includes(ruolo);
}

export function canAccessSistema(ruolo?: string | null): boolean {
  return isAdminSistema(ruolo) || isSedeSistemaRole(ruolo);
}

export function sistemaChildVisible(
  path: string,
  opts: { ruolo?: string | null; adminOnly?: boolean } = {},
): boolean {
  const ruolo = opts.ruolo ?? "";
  if (opts.adminOnly && !isAdminSistema(ruolo)) return false;
  if (
    (SISTEMA_ADMIN_ONLY_PATHS as readonly string[]).includes(path) &&
    !isAdminSistema(ruolo)
  ) {
    return false;
  }
  return true;
}

/** Admin: tutti. Sede: propri + globali. Altri (non sulla pagina): nessun filtro extra. */
export function templateVisibilePerSede<T extends { ufficio_id?: string | null }>(
  t: T,
  scope: TemplateSedeScope,
): boolean {
  if (isAdminSistema(scope.ruolo) || !isSedeSistemaRole(scope.ruolo)) return true;
  return t.ufficio_id == null || t.ufficio_id === scope.ufficioId;
}

export function filterTemplatesPerSede<T extends { ufficio_id?: string | null }>(
  templates: T[],
  scope: TemplateSedeScope,
): T[] {
  return templates.filter((t) => templateVisibilePerSede(t, scope));
}

/** Solo admin o template della propria sede (non i globali). */
export function canEditTemplate(
  t: { ufficio_id?: string | null },
  scope: TemplateSedeScope,
): boolean {
  if (isAdminSistema(scope.ruolo)) return true;
  if (!isSedeSistemaRole(scope.ruolo) || !scope.ufficioId) return false;
  return t.ufficio_id === scope.ufficioId;
}

export function canManageTemplateCategorie(ruolo?: string | null): boolean {
  return isAdminSistema(ruolo);
}

export function canChangeTemplateSede(ruolo?: string | null): boolean {
  return isAdminSistema(ruolo);
}

export function canEditGlobalBranding(ruolo?: string | null): boolean {
  return isAdminSistema(ruolo);
}

/** Sede: forza sempre la propria. Admin: rispetta il valore richiesto. */
export function forceUfficioIdForSave(
  requested: string | null | undefined,
  scope: TemplateSedeScope,
): string | null {
  if (isAdminSistema(scope.ruolo)) return requested ?? null;
  return scope.ufficioId ?? null;
}

/**
 * `undefined` = sede sbloccata (admin).
 * string/null = sede bloccata sul proprio ufficio.
 */
export function lockedSedeUfficioId(scope: TemplateSedeScope): string | null | undefined {
  if (isAdminSistema(scope.ruolo)) return undefined;
  return scope.ufficioId ?? null;
}
