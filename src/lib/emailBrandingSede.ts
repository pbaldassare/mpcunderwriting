/** Valore form per template/branding senza sede (fallback globale). */
export const TEMPLATE_SEDE_GLOBALE = "__globale__";

export type BrandingSedeRow = {
  ufficio_id?: string | null;
};

/** Sede del form → ufficio_id (null = globale). */
export function sedeToUfficioId(value: string | null | undefined): string | null {
  if (!value || value === TEMPLATE_SEDE_GLOBALE) return null;
  return value;
}

/** ufficio_id → valore del dropdown. */
export function sedeFormValue(ufficioId: string | null | undefined): string {
  return ufficioId || TEMPLATE_SEDE_GLOBALE;
}

export function labelSedeTemplate(
  ufficioId: string | null | undefined,
  ufficiById: Record<string, string>,
): string {
  if (!ufficioId) return "Globale";
  return ufficiById[ufficioId] || "Sede";
}

/** Nome per il template duplicato. */
export function duplicateTemplateNome(nome: string): string {
  const base = (nome || "").replace(/\s*\(copia(?:\s+\d+)?\)\s*$/i, "").trim() || "Template";
  return `${base} (copia)`;
}

/**
 * Risolve il branding: riga della sede se c'è, altrimenti globale (ufficio_id null),
 * altrimenti la prima riga disponibile.
 */
export function pickBrandingRow<T extends BrandingSedeRow>(
  rows: T[],
  ufficioId: string | null | undefined,
): T | null {
  if (!rows.length) return null;
  if (ufficioId) {
    const sede = rows.find((r) => r.ufficio_id === ufficioId);
    if (sede) return sede;
  }
  return rows.find((r) => r.ufficio_id == null) ?? rows[0] ?? null;
}

export function resolveUfficioBranding(opts: {
  ufficioId?: string | null;
  templateUfficioId?: string | null;
}): string | null {
  return opts.ufficioId || opts.templateUfficioId || null;
}
