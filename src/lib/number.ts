/**
 * Helpers per parsing/formattazione numeri decimali con locale italiano.
 *
 * Accetta sia "476,50" (IT) che "476.50" (en-US) e gestisce il separatore
 * migliaia "." (es. "1.234,56" → 1234.56).
 */

/**
 * Parsa una stringa decimale tollerante al locale italiano.
 * Ritorna `null` se la stringa è vuota o non numerica.
 *
 * Regole:
 *  - trim + rimozione spazi interni e simbolo € e suffissi non numerici tipici;
 *  - se contiene sia "." che ",", l'ultimo separatore (per posizione) è il decimale,
 *    gli altri sono separatori migliaia → rimossi;
 *  - se contiene solo ",", la "," è il decimale;
 *  - se contiene solo ".", il "." è il decimale (compat en-US);
 *  - segno meno iniziale supportato.
 */
export function parseDecimalIt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let s = String(value).trim();
  if (!s) return null;
  // Rimuovi simboli valuta, percent, spazi
  s = s.replace(/[€\s%]/g, "");
  if (!s) return null;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = s;
  } else if (lastComma > lastDot) {
    // ',' è il separatore decimale → rimuovi tutti i '.' (migliaia) e altre ','
    normalized = s.replace(/\./g, "").replace(/,(?=.*,)/g, "").replace(",", ".");
  } else {
    // '.' è il separatore decimale → rimuovi tutte le ',' (migliaia) e altri '.'
    normalized = s.replace(/,/g, "").replace(/\.(?=.*\.)/g, "");
  }
  if (!/^[0-9]*\.?[0-9]*$/.test(normalized) || normalized === "." || normalized === "") return null;
  const n = parseFloat(normalized);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

/** Come `parseDecimalIt` ma con fallback (default 0). */
export function parseDecimalItOr(value: unknown, fallback = 0): number {
  const n = parseDecimalIt(value);
  return n === null ? fallback : n;
}

/** Formatta in formato italiano con N decimali (default 2). */
export function formatDecimalIt(n: number, decimals = 2): string {
  if (!isFinite(n)) return "";
  return n.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
