import type { PremiProvvigioniRow } from "./columns";
import { aggregatePivot } from "@/lib/estrazioni/pivot";

const values = (r: PremiProvvigioniRow) => ({
  premio: Number(r.premio) || 0,
  incassato: Number(r.incassato) || 0,
  provvAttive: Number(r.attive) || 0,
  provvPassive: Number(r.passive) || 0,
});

export function pivotPremiPerCompagnia(rows: PremiProvvigioniRow[]) {
  return aggregatePivot(rows, (r) => String(r.nomeCompagnia), values);
}

export function pivotPremiPerCliente(rows: PremiProvvigioniRow[]) {
  return aggregatePivot(rows, (r) => String(r.nomeCliente), values);
}

export function pivotPremiPerSede(rows: PremiProvvigioniRow[]) {
  return aggregatePivot(rows, (r) => String(r.nomeAE), values);
}

export function pivotPremiPerRamo(rows: PremiProvvigioniRow[]) {
  return aggregatePivot(rows, (r) => String(r.ramo), values);
}

export function pivotPremiPerProduttore(rows: PremiProvvigioniRow[]) {
  return aggregatePivot(rows, (r) => String(r.nomeProduttore), values);
}

export function totaliPremiProvvigioni(rows: PremiProvvigioniRow[]) {
  return rows.reduce(
    (acc, r) => ({
      nRighe: acc.nRighe + 1,
      totPremio: acc.totPremio + (Number(r.premio) || 0),
      totIncassato: acc.totIncassato + (Number(r.incassato) || 0),
      totProvvAttive: acc.totProvvAttive + (Number(r.attive) || 0),
      totProvvPassive: acc.totProvvPassive + (Number(r.passive) || 0),
      nIncassate: acc.nIncassate + (r.pagata === "Incassata" ? 1 : 0),
    }),
    { nRighe: 0, totPremio: 0, totIncassato: 0, totProvvAttive: 0, totProvvPassive: 0, nIncassate: 0 },
  );
}

export function buildPremiProvvigioniCommentary(
  rows: PremiProvvigioniRow[],
  periodo: string,
  criterioLabel?: string,
): string {
  const tot = totaliPremiProvvigioni(rows);
  if (tot.nRighe === 0) {
    const suff = criterioLabel ? ` (criterio: ${criterioLabel})` : "";
    return `Nessun titolo incassato nel periodo ${periodo}${suff}.`;
  }

  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
  const topComp = pivotPremiPerCompagnia(rows)[0];
  const topProd = pivotPremiPerProduttore(rows)[0];
  const pctIncassate = ((tot.nIncassate / tot.nRighe) * 100).toFixed(1);

  const lines = [
    `Estrazione premi e provvigioni — periodo ${periodo}${criterioLabel ? ` · criterio ${criterioLabel}` : ""}.`,
    `${tot.nRighe} titoli incassati per ${fmt(tot.totPremio)} di premio lordo (${fmt(tot.totIncassato)} incassato).`,
    `Provvigioni attive ${fmt(tot.totProvvAttive)}, passive ${fmt(tot.totProvvPassive)}.`,
    `Provvigioni produttore incassate su ${tot.nIncassate} titoli (${pctIncassate}%).`,
  ];

  if (topComp) {
    const share = ((topComp.totPremio / tot.totPremio) * 100).toFixed(1);
    lines.push(`Compagnia principale: ${topComp.chiave} (${share}% del premio).`);
  }
  if (topProd?.chiave && topProd.chiave !== "—") {
    lines.push(`Produttore con maggior volume: ${topProd.chiave} (${fmt(topProd.totPremio)}).`);
  }

  return lines.join("\n");
}
