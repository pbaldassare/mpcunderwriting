// Validazione IBAN secondo standard ISO 13616 (mod-97)
// Lunghezze ufficiali per paese (subset principali, IT incluso)
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IS: 26, IT: 27,
  JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21,
  MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15,
  PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SC: 31,
  SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20,
};

export interface IbanValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

export function validateIban(input: string | null | undefined): IbanValidationResult {
  if (!input || !input.trim()) {
    return { valid: false, error: "IBAN obbligatorio" };
  }
  const iban = input.replace(/\s+/g, "").toUpperCase();

  if (!/^[A-Z0-9]+$/.test(iban)) {
    return { valid: false, error: "L'IBAN può contenere solo lettere e numeri" };
  }
  if (iban.length < 15 || iban.length > 34) {
    return { valid: false, error: "Lunghezza IBAN non valida (15-34 caratteri)" };
  }
  const country = iban.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(country)) {
    return { valid: false, error: "Codice paese non valido (es. IT, FR, DE)" };
  }
  const expectedLen = IBAN_LENGTHS[country];
  if (expectedLen && iban.length !== expectedLen) {
    return {
      valid: false,
      error: `IBAN ${country} deve avere ${expectedLen} caratteri (attuali: ${iban.length})`,
    };
  }
  if (!/^\d{2}$/.test(iban.slice(2, 4))) {
    return { valid: false, error: "Cifre di controllo non valide" };
  }

  // mod-97
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    const value = code >= 65 ? code - 55 : code - 48; // A=10..Z=35, 0..9
    if (value < 0 || value > 35) {
      return { valid: false, error: "Carattere non valido nell'IBAN" };
    }
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  if (remainder !== 1) {
    return { valid: false, error: "IBAN non valido (checksum errato)" };
  }
  return { valid: true, normalized: iban };
}
