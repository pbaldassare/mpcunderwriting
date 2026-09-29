import type { GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import {
  isRigaEsclusaProvvigioni,
  resolveRowPctAccessori,
  type MatriceProvvAccessori,
} from "@/lib/calcProvvigioniGaranzia";
import { parseDecimalItOr } from "@/lib/number";


/** Importo provvigione da % manuale su base unica (legacy / display inverso). */
export function provvigioniImportoFromPct(base: number, pctStr: string): number {
  const s = (pctStr ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const pct = parseFloat(s);
  if (isNaN(pct) || base <= 0) return 0;
  return (base * pct) / 100;
}

/**
 * % manuale sulla sola parte netto; accessori con % matrice (es. 8% RCA + 12% accessori).
 */
export function provvigioniImportoFromManualPctNetto(
  rows: GaranziaRow[],
  pctNettoStr: string,
  matrice: MatriceProvvAccessori | null,
): number {
  const s = (pctNettoStr ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const pctNetto = parseFloat(s);
  if (isNaN(pctNetto)) return 0;
  return rows.reduce((sum, r) => {
    if (isRigaEsclusaProvvigioni(r)) return sum;
    const netto = parseDecimalItOr(r.netto);
    const accessori = parseDecimalItOr(r.accessori);
    const pctAcc = resolveRowPctAccessori(r, matrice).pct;
    return sum + (netto * pctNetto) / 100 + (accessori * pctAcc) / 100;
  }, 0);
}

/** True se il valore su titoli diverge dal calcolo matrice (qualsiasi centesimo). */
export function isProvvigioniManualStored(stored: number, calculated: number): boolean {
  return stored > 0 && Math.abs(calculated - stored) > 0.0001;
}

/** % derivata da importo/base per display (senza troncamento a 4 decimali). */
export function provvigioniPctFromImporto(importo: number, base: number): string {
  if (base <= 0 || !Number.isFinite(importo)) return "";
  return String((importo / base) * 100);
}

/**
 * % effettiva del blocco Firma/Quietanza sul premio netto.
 * Unica verità UI quando il blocco è in modalità manuale (non matrice).
 */
export function provvigioniPctEffettivaBlocco(importoBlocco: number, premioNetto: number): number {
  if (premioNetto <= 0 || !Number.isFinite(importoBlocco)) return 0;
  return (importoBlocco / premioNetto) * 100;
}

/**
 * Persistenza ufficiale: sempre il totale del blocco.
 * Matrice / somma righe non devono sovrascrivere `provvigioni_firma|quietanza`.
 */
export function resolveProvvigioniForSave(blockImporto: number): number {
  return Math.round(blockImporto * 100) / 100;
}
