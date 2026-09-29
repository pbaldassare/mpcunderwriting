/** Pivot generico per estrazioni portafoglio. */
export type EstrazionePivotRow = {
  chiave: string;
  nRighe: number;
  totPremio: number;
  totIncassato: number;
  totProvvAttive: number;
  totProvvPassive: number;
};

export type PivotNumericFields = {
  premio?: number;
  incassato?: number;
  provvAttive?: number;
  provvPassive?: number;
};

export function aggregatePivot<T>(
  rows: T[],
  keyFn: (r: T) => string,
  valueFn: (r: T) => PivotNumericFields,
): EstrazionePivotRow[] {
  const map = new Map<string, EstrazionePivotRow>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    const v = valueFn(r);
    const cur = map.get(k) || {
      chiave: k,
      nRighe: 0,
      totPremio: 0,
      totIncassato: 0,
      totProvvAttive: 0,
      totProvvPassive: 0,
    };
    cur.nRighe += 1;
    cur.totPremio += v.premio ?? 0;
    cur.totIncassato += v.incassato ?? 0;
    cur.totProvvAttive += v.provvAttive ?? 0;
    cur.totProvvPassive += v.provvPassive ?? 0;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.totPremio - a.totPremio);
}

export function totaliEstrazionePivot(rows: EstrazionePivotRow[]) {
  return rows.reduce(
    (acc, r) => ({
      nRighe: acc.nRighe + r.nRighe,
      totPremio: acc.totPremio + r.totPremio,
      totIncassato: acc.totIncassato + r.totIncassato,
      totProvvAttive: acc.totProvvAttive + r.totProvvAttive,
      totProvvPassive: acc.totProvvPassive + r.totProvvPassive,
    }),
    { nRighe: 0, totPremio: 0, totIncassato: 0, totProvvAttive: 0, totProvvPassive: 0 },
  );
}

export function pivotToSheetRows(pivot: EstrazionePivotRow[], dimensione: string) {
  return pivot.map((p) => ({
    [dimensione]: p.chiave,
    "N. Righe": p.nRighe,
    "Totale Premio (€)": Number(p.totPremio.toFixed(2)),
    "Totale Incassato (€)": Number(p.totIncassato.toFixed(2)),
    "Provv. Attive (€)": Number(p.totProvvAttive.toFixed(2)),
    "Provv. Passive (€)": Number(p.totProvvPassive.toFixed(2)),
  }));
}
