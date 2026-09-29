/**
 * Regole voci messa a cassa / acconti cliente.
 *
 * - Menu messa a cassa: abbuoni, arrotondamenti e acconti (stesso tendina).
 * - Abbuoni / arrotondamenti: salvati su titoli_compensazioni (sulla quietanza),
 *   NON vanno in «Acconti» del cliente.
 * - Acconti (ACC_*): salvati su cliente_anticipi (scheda Acconti).
 * - Eccedenza / sconto commerciale / spese accessorie: non usate.
 */

/** Causali che rettificano il dovuto sulla quietanza. */
export const CAUSALI_COMP_MESSA_CASSA_UI = [
  "ABB_ATT",
  "ABB_PAS",
  "ARROT_A",
  "ARROT_P",
] as const;

/** Causali per creazione acconto cliente (anche dal menu messa a cassa). */
export const CAUSALI_ACCONTO_CLIENTE = ["ACC_STOR", "ACC_CRED"] as const;

/** Causali da disattivare (non più selezionabili). */
export const CAUSALI_COMP_DISATTIVATE = ["ECCED", "SCONTO", "SPESE"] as const;

export type CodiceCompMessaCassaUi = (typeof CAUSALI_COMP_MESSA_CASSA_UI)[number];

export function isCausaleCompMessaCassaUi(codice: string | null | undefined): boolean {
  return !!codice && (CAUSALI_COMP_MESSA_CASSA_UI as readonly string[]).includes(codice);
}

export function isCausaleAccontoCliente(codice: string | null | undefined): boolean {
  if (!codice) return false;
  if ((CAUSALI_ACCONTO_CLIENTE as readonly string[]).includes(codice)) return true;
  return codice.startsWith("ACC_");
}

/** Voci nel menu a tendina messa a cassa: abbuoni/arrotondamenti + acconti. */
export function isCausaleMessaCassaMenu(codice: string | null | undefined): boolean {
  return isCausaleCompMessaCassaUi(codice) || isCausaleAccontoCliente(codice);
}

/** Solo abbuoni/arrotondamenti alterano il dovuto della quietanza. */
export function rettificaDovutoQuietanza(codice: string | null | undefined): boolean {
  return isCausaleCompMessaCassaUi(codice);
}

/**
 * Differenza bonifico vs incasso applicato classificata a mano:
 * - diff ≈ 0 → ok (anche via ABB/ARROT che riallineano il dovuto)
 * - diff > 0 (eccedenza) → acconto attivo ACC_* con segno +
 * - diff < 0 (mancanza) → acconto/accredito passivo ACC_* con segno −
 */
export function isDifferenzaBonificoClassificata(opts: {
  diff: number;
  accAttivo: number;
  accPassivo: number;
  toll?: number;
}): boolean {
  const toll = opts.toll ?? 0.005;
  const d = Math.round((Number(opts.diff) || 0) * 100) / 100;
  if (Math.abs(d) < toll) return true;
  if (d > 0) {
    return Math.abs((Number(opts.accAttivo) || 0) - d) < toll;
  }
  return Math.abs((Number(opts.accPassivo) || 0) - Math.abs(d)) < toll;
}
