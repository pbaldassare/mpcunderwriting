/** Voci che il trigger `titoli_normalizza_importi` somma nel premio_lordo (importo firma). */
export type VociImportoFirma = {
  netto: number;
  tasse: number;
  ssn: number;
  addizionali: number;
};

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function lordoFirmaDaVoci(v: VociImportoFirma): number {
  return round2(v.netto + v.tasse + v.ssn + v.addizionali);
}

/**
 * Imposta un nuovo lordo firma mantenendo tasse/SSN/accessori quando possibile.
 * Se le voci extra superano il lordo, azzera le extra e mette tutto sul netto.
 */
export function vociDaLordoFirma(lordo: number, current: VociImportoFirma): VociImportoFirma {
  const target = round2(lordo);
  const extras = round2(current.tasse + current.ssn + current.addizionali);
  const netto = round2(target - extras);
  if (netto >= -0.005) {
    return {
      netto: Math.max(0, netto),
      tasse: round2(current.tasse),
      ssn: round2(current.ssn),
      addizionali: round2(current.addizionali),
    };
  }
  return { netto: target, tasse: 0, ssn: 0, addizionali: 0 };
}

export function payloadImportoFirma(v: VociImportoFirma) {
  return {
    premio_netto: round2(v.netto),
    tasse: round2(v.tasse),
    ssn_firma: round2(v.ssn),
    addizionali: round2(v.addizionali),
  };
}
