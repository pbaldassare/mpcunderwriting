// Helpers condivisi per frazionamento polizze.
// La verità UI è `titoli.frazionamento` (testo). `titoli.rate` è derivato (intero rate/anno).

export const FRAZIONAMENTI = [
  { value: "Mensile", label: "Mensile" },
  { value: "Trimestrale", label: "Trimestrale" },
  { value: "Quadrimestrale", label: "Quadrimestrale" },
  { value: "Semestrale", label: "Semestrale" },
  { value: "Annuale", label: "Annuale" },
  { value: "Poliennale", label: "Poliennale" },
  { value: "Rata unica", label: "Rata unica" },
  { value: "Premio unico anticipato", label: "Premio unico anticipato" },
] as const;

export type Frazionamento = typeof FRAZIONAMENTI[number]["value"];

/** True se il frazionamento è Premio unico anticipato (2 quietanze: Q1 fino a fine-1, Q2 giorno di fine). */
export function isPremioUnicoAnticipato(f: string | null | undefined): boolean {
  return String(f || "").trim().toLowerCase() === "premio unico anticipato";
}

/** True se pagamento unico alla firma (1 quietanza sull'intero periodo). Accetta legacy "Unica". */
export function isRataUnica(f: string | null | undefined): boolean {
  const v = String(f || "").trim().toLowerCase();
  return v === "rata unica" || v === "unica";
}

export function frazionamentoMesi(f: string, anni: number): number {
  if (isPremioUnicoAnticipato(f) || isRataUnica(f)) {
    return Math.max(1, anni) * 12;
  }
  switch (f) {
    case "Mensile": return 1;
    case "Trimestrale": return 3;
    case "Quadrimestrale": return 4;
    case "Semestrale": return 6;
    case "Poliennale":
    case "Annuale":
    default: return 12;
  }
}

export function frazionamentoToRate(f: string, anni: number): number {
  if (isPremioUnicoAnticipato(f)) return 2;
  if (isRataUnica(f)) return 1;
  if (f === "Poliennale") return 1;
  const m = frazionamentoMesi(f, anni);
  return Math.max(1, Math.round(12 / m));
}

/**
 * Premio (o provvigione) di annualità a partire dalla rata/firma.
 * Es. Semestrale 109.000 → 218.000; Annuale → invariato.
 * Premio unico anticipato: rata × 2 (due quietanze stesso importo).
 * Rata unica: importo intero contratto (invariato).
 */
export function importoAnnualitaDaRata(
  importoRata: number | null | undefined,
  frazionamento: string | null | undefined,
): number {
  const rata = Number(importoRata) || 0;
  if (!rata) return 0;
  if (isRataUnica(frazionamento)) return rata;
  return rata * frazionamentoToRate(String(frazionamento || "Annuale"), 1);
}

/** Deriva il frazionamento testuale da rate/anni (per polizze legacy). */
export function derivaFrazionamentoDaRate(
  rate: number | null | undefined,
  anniDurata?: number | null,
): Frazionamento {
  if ((rate || 1) === 1 && (anniDurata || 0) > 1) return "Rata unica";
  switch (Number(rate)) {
    case 12: return "Mensile";
    case 4: return "Trimestrale";
    case 3: return "Quadrimestrale";
    case 2: return "Semestrale";
    case 1: return "Annuale";
    default: return "Annuale";
  }
}
