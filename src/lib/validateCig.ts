/**
 * Validazione CIG (Codice Identificativo di Gara).
 * Formato standard: 10 caratteri alfanumerici maiuscoli.
 * I CIG temporanei/SmartCIG possono avere formato diverso → si richiede solo non vuoto.
 */
export const CIG_REGEX = /^[A-Z0-9]{10}$/;
/** CIG temporaneo auto-generato: CIG0001, CIG0002, … */
export const GENERATED_CIG_TEMPORANEO_REGEX = /^CIG[0-9]+$/;

export function normalizeCig(value: string): string {
  return (value || "").toUpperCase().replace(/\s+/g, "");
}

export function isValidCig(value: string): boolean {
  return CIG_REGEX.test(normalizeCig(value));
}

/**
 * Validazione con flag temporaneo:
 * - se temporaneo: basta non vuoto
 * - altrimenti: 10 alfanumerici
 */
export function isValidCigWithFlag(value: string, temporaneo: boolean): boolean {
  const v = normalizeCig(value);
  if (!v) return false;
  if (temporaneo) return true;
  return CIG_REGEX.test(v);
}

export function isGeneratedCigTemporaneo(value: string): boolean {
  return GENERATED_CIG_TEMPORANEO_REGEX.test(normalizeCig(value));
}
