// Validazione Codice Fiscale italiano (16 caratteri + carattere di controllo)
// Per persone giuridiche è ammesso anche il formato 11 cifre (uguale alla P.IVA).
// Supporta i CF con OMOCODIA: nelle posizioni "cifra" (indici 6,7,9,10,12,13,14)
// l'Agenzia delle Entrate sostituisce la cifra con una lettera secondo la tabella
//   0→L, 1→M, 2→N, 3→P, 4→Q, 5→R, 6→S, 7→T, 8→U, 9→V
// Il check digit (pos 15) viene calcolato sul CF così come emesso (forma omocodica).
import { validatePIVA } from "./validatePIVA";

export interface CFValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  isPIVAFormat?: boolean;
  isOmocodia?: boolean;
}

// Regex che accetta omocodia: nelle posizioni cifra (6,7,9,10,12,13,14) sono ammesse
// anche le lettere usate come sostituti (L,M,N,P,Q,R,S,T,U,V).
const CF_REGEX =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

// Posizioni 0-based che devono essere LETTERA (mai soggette a omocodia)
const CF_LETTER_POS = new Set([0, 1, 2, 3, 4, 5, 8, 11, 15]);
// Posizioni 0-based che sono originariamente CIFRA (ammettono omocodia)
const CF_DIGIT_POS = new Set([6, 7, 9, 10, 12, 13, 14]);

// Sostituzione omocodia: lettera → cifra originale
const OMOCODIA_LETTER_TO_DIGIT: Record<string, string> = {
  L: "0", M: "1", N: "2", P: "3", Q: "4",
  R: "5", S: "6", T: "7", U: "8", V: "9",
};

const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CHECK_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface ValidateCFOptions {
  /** Se true ammette anche CF azienda in formato 11 cifre (P.IVA). Default true. */
  allowPIVAFormat?: boolean;
}

/** Restituisce un messaggio di errore puntuale sul primo carattere fuori posizione. */
function describePositionError(cf: string): string | null {
  for (let i = 0; i < cf.length && i < 16; i++) {
    const ch = cf[i];
    if (CF_LETTER_POS.has(i)) {
      if (!/[A-Z]/.test(ch)) {
        return `Carattere "${ch}" non valido in posizione ${i + 1} (atteso: lettera)`;
      }
    } else if (CF_DIGIT_POS.has(i)) {
      if (!/[0-9]/.test(ch) && !(ch in OMOCODIA_LETTER_TO_DIGIT)) {
        return `Carattere "${ch}" non valido in posizione ${i + 1} (attesa: cifra o lettera di omocodia L,M,N,P,Q,R,S,T,U,V)`;
      }
    }
  }
  return null;
}

export function validateCF(
  input: string | null | undefined,
  opts: ValidateCFOptions = {},
): CFValidationResult {
  const { allowPIVAFormat = true } = opts;
  if (!input || !input.trim()) {
    return { valid: false, error: "Codice Fiscale obbligatorio" };
  }
  const cf = input.replace(/\s+/g, "").toUpperCase();

  // Formato 11 cifre (CF azienda = P.IVA)
  if (/^\d{11}$/.test(cf)) {
    if (!allowPIVAFormat) {
      return { valid: false, error: "Codice Fiscale persona deve essere di 16 caratteri" };
    }
    const r = validatePIVA(cf);
    return { valid: r.valid, error: r.error, normalized: r.normalized, isPIVAFormat: true };
  }

  if (cf.length !== 16) {
    return { valid: false, error: `Codice Fiscale deve avere 16 caratteri (attuali: ${cf.length})` };
  }
  if (!CF_REGEX.test(cf)) {
    const detail = describePositionError(cf);
    return { valid: false, error: detail ?? "Formato Codice Fiscale non valido" };
  }

  // Checksum calcolato sul CF "così com'è" (forma omocodica inclusa)
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i];
    const table = (i + 1) % 2 === 1 ? ODD : EVEN; // posizione 1-based: dispari→ODD
    const v = table[ch];
    if (v === undefined) return { valid: false, error: "Carattere non valido nel CF" };
    sum += v;
  }
  const expected = CHECK_CHARS[sum % 26];
  if (expected !== cf[15]) {
    return { valid: false, error: "Codice Fiscale non valido (carattere di controllo errato)" };
  }

  // Rileva omocodia: almeno una posizione cifra contiene una lettera
  let isOmocodia = false;
  for (const i of CF_DIGIT_POS) {
    if (/[A-Z]/.test(cf[i])) { isOmocodia = true; break; }
  }

  return { valid: true, normalized: cf, isOmocodia };
}

export function isCFValid(input: string | null | undefined, opts?: ValidateCFOptions): boolean {
  return validateCF(input, opts).valid;
}
