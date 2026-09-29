import { validatePIVA } from "./validatePIVA";
import { validateCF } from "./validateCF";

export interface FiscalCheck {
  label: string;
  value?: string | null;
  kind: "cf16" | "piva" | "cf-azienda";
  /** Se true, il valore vuoto blocca con errore "obbligatorio". Default false (vuoto = skip). */
  required?: boolean;
}

/**
 * Esegue la validazione di un set di campi fiscali (P.IVA / CF).
 * Lancia Error con elenco compatto se ci sono problemi.
 * I valori vuoti vengono ignorati a meno di `required: true`.
 */
export function assertFiscalValid(checks: FiscalCheck[]): void {
  const errors: string[] = [];
  for (const c of checks) {
    const v = (c.value || "").toString().trim();
    if (!v) {
      if (c.required) errors.push(`${c.label}: obbligatorio`);
      continue;
    }
    const r =
      c.kind === "piva"
        ? validatePIVA(v)
        : c.kind === "cf16"
          ? validateCF(v, { allowPIVAFormat: false })
          : validateCF(v, { allowPIVAFormat: true });
    if (!r.valid) errors.push(`${c.label}: ${r.error}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join(" • "));
  }
}
