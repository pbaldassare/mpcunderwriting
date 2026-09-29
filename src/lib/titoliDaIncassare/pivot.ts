import type { TitoloDaIncassareRow } from "./columns";

export type PivotRow = {
  chiave: string;
  nTitoli: number;
  totPremio: number;
  totProvvAttive: number;
  totProvvPassive: number;
};

function aggregate(rows: TitoloDaIncassareRow[], keyFn: (r: TitoloDaIncassareRow) => string): PivotRow[] {
  const map = new Map<string, PivotRow>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    const cur = map.get(k) || { chiave: k, nTitoli: 0, totPremio: 0, totProvvAttive: 0, totProvvPassive: 0 };
    cur.nTitoli += 1;
    cur.totPremio += Number(r.premio) || 0;
    cur.totProvvAttive += Number(r.provvAttive) || 0;
    cur.totProvvPassive += Number(r.provvPassive) || 0;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.totPremio - a.totPremio);
}

export function pivotPerCompagnia(rows: TitoloDaIncassareRow[]) {
  return aggregate(rows, (r) => String(r.compagnia));
}

export function pivotPerCliente(rows: TitoloDaIncassareRow[]) {
  return aggregate(rows, (r) => String(r.cliente));
}

export function pivotPerSede(rows: TitoloDaIncassareRow[]) {
  return aggregate(rows, (r) => String(r.sede));
}

export function pivotPerRamo(rows: TitoloDaIncassareRow[]) {
  return aggregate(rows, (r) => String(r.ramo));
}

export function pivotPerProduttore(rows: TitoloDaIncassareRow[]) {
  return aggregate(rows, (r) => String(r.produttore));
}

export function totaliPivot(rows: TitoloDaIncassareRow[]) {
  return rows.reduce(
    (acc, r) => ({
      nTitoli: acc.nTitoli + 1,
      totPremio: acc.totPremio + (Number(r.premio) || 0),
      totProvvAttive: acc.totProvvAttive + (Number(r.provvAttive) || 0),
      totProvvPassive: acc.totProvvPassive + (Number(r.provvPassive) || 0),
      nGarantiti: acc.nGarantiti + (r.garantito === "G" ? 1 : 0),
    }),
    { nTitoli: 0, totPremio: 0, totProvvAttive: 0, totProvvPassive: 0, nGarantiti: 0 },
  );
}

/** Commento testuale sul pivot (per PDF / UI). */
export function buildPivotCommentary(
  rows: TitoloDaIncassareRow[],
  meseLabel: string,
): string {
  const tot = totaliPivot(rows);
  if (tot.nTitoli === 0) {
    return `Nessun titolo da incassare con competenza in ${meseLabel}.`;
  }

  const perComp = pivotPerCompagnia(rows);
  const perSede = pivotPerSede(rows);
  const topComp = perComp[0];
  const topSede = perSede[0];
  const pctGarantiti = ((tot.nGarantiti / tot.nTitoli) * 100).toFixed(1);
  const fmt = (n: number) =>
    n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const lines = [
    `Estrazione titoli da incassare — competenza ${meseLabel}.`,
    `Totale ${tot.nTitoli} titoli per ${fmt(tot.totPremio)} di premio lordo.`,
    `Provvigioni attive ${fmt(tot.totProvvAttive)}, passive ${fmt(tot.totProvvPassive)}.`,
    `${tot.nGarantiti} titoli già in copertura garantita (${pctGarantiti}%).`,
  ];

  if (topComp) {
    const share = ((topComp.totPremio / tot.totPremio) * 100).toFixed(1);
    lines.push(
      `Concentrazione principale su ${topComp.chiave}: ${topComp.nTitoli} titoli (${share}% del premio).`,
    );
  }
  if (topSede && topSede.chiave !== topComp?.chiave) {
    lines.push(
      `Sede con maggior carico: ${topSede.chiave} (${fmt(topSede.totPremio)}).`,
    );
  }

  const senzaIncasso = rows.filter((r) => !r.dataIncasso).length;
  if (senzaIncasso === tot.nTitoli) {
    lines.push("Tutti i titoli risultano ancora da incassare.");
  }

  return lines.join("\n");
}
