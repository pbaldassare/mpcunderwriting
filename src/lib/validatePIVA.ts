// Validazione Partita IVA italiana (11 cifre + checksum Luhn IT)
export interface PIVAValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

export function validatePIVA(input: string | null | undefined): PIVAValidationResult {
  if (!input || !input.trim()) {
    return { valid: false, error: "Partita IVA obbligatoria" };
  }
  const piva = input.replace(/\s+/g, "");
  if (!/^\d+$/.test(piva)) {
    return { valid: false, error: "La P.IVA deve contenere solo cifre" };
  }
  if (piva.length !== 11) {
    return { valid: false, error: `La P.IVA deve avere 11 cifre (attuali: ${piva.length})` };
  }
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let n = parseInt(piva[i], 10);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  if (sum % 10 !== 0) {
    return { valid: false, error: "P.IVA non valida (checksum errato)" };
  }
  return { valid: true, normalized: piva };
}

export function isPIVAValid(input: string | null | undefined): boolean {
  return validatePIVA(input).valid;
}
