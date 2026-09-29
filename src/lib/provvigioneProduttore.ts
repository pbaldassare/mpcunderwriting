import { getProvvigioneEC, type TitoloProvvigioneEC } from "@/lib/getProvvigioneEC";
import { calcProvvigioneProduttorePrincipale } from "@/lib/trattenutaProvvigioniIncasso";

export type RigaProduttoreFlags = {
  produttore_nome?: string | null;
  produttori_display?: string | null;
  anagrafica_commerciale_id?: string | null;
  produttore_id?: string | null;
};

export function hasProduttoreRiga(p: RigaProduttoreFlags): boolean {
  const name = String(p.produttori_display || p.produttore_nome || "").trim();
  return !!(p.anagrafica_commerciale_id || p.produttore_id || (name && name !== "—"));
}

export function calcProvvigioneProduttoreEuro(
  totProvv: number,
  opts: { percentualeCommerciale?: number | null; splitPercentuali?: number[] },
): number {
  if (opts.splitPercentuali && opts.splitPercentuali.length > 0) {
    const perc = opts.splitPercentuali.reduce((s, n) => s + (Number(n) || 0), 0);
    return Math.round(((totProvv * perc) / 100) * 100) / 100;
  }
  return calcProvvigioneProduttorePrincipale(totProvv, opts.percentualeCommerciale);
}

export type ProvvigioneProduttoreLookup = {
  splitsByTitolo: Map<string, number[]>;
  percByTitolo: Map<string, number | null>;
};

export function provvigioneProduttoreForRow(
  p: TitoloProvvigioneEC & RigaProduttoreFlags & { id?: string },
  lookup?: ProvvigioneProduttoreLookup | null,
): number | null {
  if (!hasProduttoreRiga(p)) return null;
  const tot = getProvvigioneEC(p);
  const id = p.id;
  return calcProvvigioneProduttoreEuro(tot, {
    percentualeCommerciale: id ? lookup?.percByTitolo.get(id) ?? null : null,
    splitPercentuali: id ? lookup?.splitsByTitolo.get(id) : undefined,
  });
}
