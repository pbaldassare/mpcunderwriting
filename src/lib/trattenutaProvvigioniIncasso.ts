const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quota provvigione del produttore principale (non split multipli). */
export function calcProvvigioneProduttorePrincipale(
  provvigioniQuietanza: number | null | undefined,
  percentualeCommerciale: number | null | undefined,
): number {
  const tot = Math.max(0, Number(provvigioniQuietanza) || 0);
  if (tot <= 0) return 0;
  const pc = Number(percentualeCommerciale);
  const perc = Number.isFinite(pc) && pc > 0 ? Math.min(pc, 100) : 100;
  return round2((tot * perc) / 100);
}

export interface IncassoTrattenutaResult {
  provvigioneLorda: number;
  ritenutaAcconto: number;
  trattenutoNetto: number;
  importoVersatoConsul: number;
}

/**
 * Incasso versato a Consulbrokers quando il produttore trattiene la provvigione:
 * premio (dovuto) − provvigione + ritenuta d'acconto sulle provvigioni.
 */
export function calcIncassoConTrattenutaProvvigioni(
  dovutoLordo: number,
  provvigioneLorda: number,
  percentualeRa: number,
): IncassoTrattenutaResult {
  const provv = round2(Math.max(0, provvigioneLorda));
  const ra = round2((provv * Math.max(0, Number(percentualeRa) || 0)) / 100);
  const trattenutoNetto = round2(provv - ra);
  const importoVersatoConsul = round2(Math.max(0, dovutoLordo - provv + ra));
  return {
    provvigioneLorda: provv,
    ritenutaAcconto: ra,
    trattenutoNetto,
    importoVersatoConsul,
  };
}

export interface TitoloTrattenutaInput {
  id: string;
  anagrafica_commerciale_id?: string | null;
  provvigioni_quietanza?: number | null;
  percentuale_commerciale?: number | null;
}

export interface ProduttoreTrattenutaInput {
  id: string;
  trattenuta_provvigioni_incasso?: boolean | null;
  percentuale_ra?: number | null;
  ragione_sociale?: string | null;
  cognome?: string | null;
  nome?: string | null;
}

export interface TrattenutaTitoloCtx {
  titoloId: string;
  active: boolean;
  prodId: string | null;
  prodNome: string;
  provvigioneLorda: number;
  ritenutaAcconto: number;
  trattenutoNetto: number;
  percentualeRa: number;
}

export function buildTrattenutaCtx(
  titolo: TitoloTrattenutaInput,
  prodById: Map<string, ProduttoreTrattenutaInput>,
  options?: { force?: boolean },
): TrattenutaTitoloCtx | null {
  const prodId = titolo.anagrafica_commerciale_id;
  if (!prodId) return null;
  const prod = prodById.get(prodId);
  if (!options?.force && !prod?.trattenuta_provvigioni_incasso) return null;
  if (!prod) return null;

  const provv = calcProvvigioneProduttorePrincipale(
    titolo.provvigioni_quietanza,
    titolo.percentuale_commerciale,
  );
  if (provv <= 0) return null;

  const percentualeRa = Number(prod.percentuale_ra) || 0;
  const { ritenutaAcconto, trattenutoNetto } = calcIncassoConTrattenutaProvvigioni(0, provv, percentualeRa);

  return {
    titoloId: titolo.id,
    active: true,
    prodId,
    prodNome: prod.ragione_sociale || `${prod.cognome || ""} ${prod.nome || ""}`.trim() || "Produttore",
    provvigioneLorda: provv,
    ritenutaAcconto,
    trattenutoNetto,
    percentualeRa,
  };
}
