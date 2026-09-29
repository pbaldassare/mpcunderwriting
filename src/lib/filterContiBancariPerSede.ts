import {
  extractUfficioIds,
  isConsulbrokersContoTipo,
  type ContoBancarioConSedi,
} from "@/lib/contiBancariSedi";

export interface FilterContiBancariContext {
  ruolo?: string | null;
  ufficioId?: string | null;
}

/** Solo admin/CFO vedono tutti i conti Consulbrokers; ufficio/contabilità filtrano per sede. */
export const bypassesSedeFilterContiBancari = (ruolo?: string | null): boolean =>
  ruolo === "admin" || ruolo === "cfo";

export const contoBancarioVisibilePerSede = (
  conto: ContoBancarioConSedi,
  ctx: FilterContiBancariContext,
): boolean => {
  if (!isConsulbrokersContoTipo(conto.tipo)) return true;
  if (bypassesSedeFilterContiBancari(ctx.ruolo)) return true;
  if (!ctx.ufficioId) return false;
  return extractUfficioIds(conto).includes(ctx.ufficioId);
};

export const filterContiBancariPerSede = <T extends ContoBancarioConSedi>(
  conti: T[],
  ctx: FilterContiBancariContext,
): T[] => conti.filter((c) => contoBancarioVisibilePerSede(c, ctx));

/**
 * Utenti sede (ufficio/contabilità/…) con un solo ufficio_id:
 * restringe pickers clienti alla propria sede. Admin/CFO non filtrati.
 */
export const shouldScopeClientiPerSede = (
  ruolo?: string | null,
  ufficioId?: string | null,
): ufficioId is string =>
  !bypassesSedeFilterContiBancari(ruolo) && !!ufficioId;
