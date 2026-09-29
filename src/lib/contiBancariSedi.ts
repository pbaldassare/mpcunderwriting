/** Tipi conto Consulbrokers (soggetti a sedi abilitate N:N). */
export const CONSULBROKERS_CONTI_TIPI = ["incasso_clienti", "provvigioni", "generico"] as const;
export type ConsulbrokersContoTipo = (typeof CONSULBROKERS_CONTI_TIPI)[number];

export const isConsulbrokersContoTipo = (tipo?: string | null): tipo is ConsulbrokersContoTipo =>
  !!tipo && (CONSULBROKERS_CONTI_TIPI as readonly string[]).includes(tipo);

export interface ContoBancarioConSedi {
  id: string;
  tipo: string;
  ufficio_ids?: string[];
  conti_bancari_uffici?: Array<{ ufficio_id: string }>;
}

/** Estrae gli ufficio_id dalla riga conto (join o array pre-mappato). */
export const extractUfficioIds = (conto: ContoBancarioConSedi): string[] => {
  if (conto.ufficio_ids?.length) return conto.ufficio_ids;
  return (conto.conti_bancari_uffici || []).map((r) => r.ufficio_id);
};

export interface ValidateSediResult {
  valid: boolean;
  error?: string;
}

/** Validazione sedi abilitate per conti Consulbrokers (min 1). */
export const validateContoBancarioSedi = (
  tipo: string | null | undefined,
  ufficioIds: string[],
): ValidateSediResult => {
  if (!isConsulbrokersContoTipo(tipo)) {
    return { valid: true };
  }
  if (!ufficioIds.length) {
    return {
      valid: false,
      error: "Seleziona almeno una sede abilitata per i conti Consulbrokers.",
    };
  }
  return { valid: true };
};
