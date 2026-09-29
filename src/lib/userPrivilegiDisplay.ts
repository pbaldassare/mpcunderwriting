import { getLevelByRole, PERMISSION_GROUPS, ROLE_LABELS, type VisibilityScope } from "@/lib/userLevels";

export type UfficioEmbed = { nome_ufficio?: string | null } | { nome_ufficio?: string | null }[] | null;

export type ProfiloSedeDisplay = {
  primaria?: boolean | null;
  uffici?: UfficioEmbed;
};

export type PrivUserDisplay = {
  ruolo?: string | null;
  permessi_json?: Record<string, unknown> | null;
  uffici?: UfficioEmbed;
  profilo_sedi?: ProfiloSedeDisplay[] | null;
  ruoli_rls?: string[] | null;
};

const VISIBILITY_VALUES: VisibilityScope[] = ["all", "own_office", "own_producers", "self_only"];

export function nomeUfficio(embed: UfficioEmbed): string | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  const name = row?.nome_ufficio?.trim();
  return name || null;
}

export function visibilityOf(user: PrivUserDisplay): VisibilityScope {
  const raw = user.permessi_json?._visibility;
  if (typeof raw === "string" && VISIBILITY_VALUES.includes(raw as VisibilityScope)) {
    return raw as VisibilityScope;
  }
  return getLevelByRole(user.ruolo).defaultVisibility;
}

/** Sede assegnata, oppure l'ambito se non c'è una sede nominata. */
export function sedeAssegnataLabel(user: PrivUserDisplay): string {
  const names: string[] = [];
  const direct = nomeUfficio(user.uffici ?? null);
  if (direct) names.push(direct);
  for (const sede of user.profilo_sedi || []) {
    const name = nomeUfficio(sede.uffici ?? null);
    if (!name || names.includes(name)) continue;
    names.push(sede.primaria ? `${name} (primaria)` : name);
  }
  if (names.length > 0) return names.join(", ");
  if (visibilityOf(user) === "all") return "Tutte le sedi";
  return "Nessuna sede";
}

export function permissionSummary(user: PrivUserDisplay): string {
  if (user.ruolo === "admin") return "Accesso totale";
  const perms = user.permessi_json || {};
  const labels = PERMISSION_GROUPS.flatMap((group) => group.items)
    .filter((item) => perms[item.key] === true)
    .map((item) => item.label);
  if (labels.length === 0) return "Nessun permesso attivo";
  if (labels.length <= 4) return labels.join(", ");
  return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Senza ruolo";
  return ROLE_LABELS[role] || role;
}
