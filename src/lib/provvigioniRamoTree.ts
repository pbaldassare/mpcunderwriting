/** Helper UI albero Ramo → Garanzie (matrice provvigioni rapporto). */

export type ProvvMapEntry = {
  id: string;
  perc: number;
  percAccessori: number | null;
};

export function rowKeyProvv(gruppoId: string, ramoId: string | null | undefined): string {
  return `${gruppoId}|${ramoId || ""}`;
}

export function inheritPctLabel(opts: {
  hasOverride: boolean;
  defaultRamo: number | null | undefined;
  inheritedTipo: number | null | undefined;
}): string | null {
  if (opts.hasOverride) return null;
  if (opts.defaultRamo != null && Number.isFinite(opts.defaultRamo)) {
    return `eredita ${opts.defaultRamo}%`;
  }
  if (opts.inheritedTipo != null && Number.isFinite(opts.inheritedTipo)) {
    return `eredita tipo (${opts.inheritedTipo}%)`;
  }
  return "0% (nessuna regola)";
}

export function garanzieDelRamo<T extends { gruppo_ramo_id?: string | null }>(
  catalogo: T[],
  gruppoId: string,
): T[] {
  return catalogo.filter((r) => r.gruppo_ramo_id === gruppoId);
}

/** Placeholder input garanzia: mostra il default ramo se non c'è override. */
export function placeholderPctGaranzia(
  override: number | null | undefined,
  defaultRamo: number | null | undefined,
): string {
  if (override != null && Number.isFinite(override)) return "";
  if (defaultRamo != null && Number.isFinite(defaultRamo)) return String(defaultRamo);
  return "—";
}
