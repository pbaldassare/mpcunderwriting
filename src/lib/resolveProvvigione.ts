import { supabase } from "@/integrations/supabase/client";

/**
 * Catena di risoluzione della % provvigione per un titolo:
 *  1. Match esatto Rapporto + Ramo + Sottoramo
 *  2. Default Ramo del Rapporto (ramo_id NULL)
 *  3. % globale del Rapporto (compagnia_rapporti.percentuale_provvigione)
 *  4. Default per Tipo rapporto + Ramo/Sottoramo (provvigioni_default_tipo)
 *  5. 0% + warning (fallback)
 */
export type ProvvigioneResolveInput = {
  compagnia_rapporto_id?: string | null;
  gruppo_ramo_id?: string | null;
  ramo_id?: string | null;
};

export type ProvvigioneResolveResult = {
  percentuale: number;
  livello: 1 | 2 | 3 | 4 | 5;
  fonte: string;
  warning?: string;
};

export async function resolvePercentualeProvvigione(
  input: ProvvigioneResolveInput
): Promise<ProvvigioneResolveResult> {
  const { compagnia_rapporto_id, gruppo_ramo_id, ramo_id } = input;

  // Sottorami "esenti" (Contributo Forzoso, Oneri, ...): provvigione sempre 0
  if (ramo_id) {
    const { data: ramoRow } = await supabase
      .from("rami")
      .select("escludi_provvigioni, diritti_agenzia")
      .eq("id", ramo_id)
      .maybeSingle();
    if ((ramoRow as any)?.escludi_provvigioni) {
      return {
        percentuale: 0,
        livello: 5,
        fonte: "sottoramo esente (CF/Oneri)",
      };
    }
    if ((ramoRow as any)?.diritti_agenzia) {
      return {
        percentuale: 0,
        livello: 5,
        fonte: "diritti di agenzia (solo tasse)",
      };
    }
  }

  if (!compagnia_rapporto_id || !gruppo_ramo_id) {
    return {
      percentuale: 0,
      livello: 5,
      fonte: "nessun rapporto/ramo",
      warning: "Rapporto o Ramo mancanti: nessuna provvigione applicabile.",
    };
  }

  // 1+2: match esatto poi default ramo
  const { data: provvRows } = await supabase
    .from("provvigioni_compagnia_ramo")
    .select("ramo_id, percentuale_provvigione")
    .eq("compagnia_rapporto_id", compagnia_rapporto_id)
    .eq("gruppo_ramo_id", gruppo_ramo_id)
    .eq("attiva", true);

  if (provvRows && provvRows.length) {
    const exact = ramo_id ? provvRows.find((r: any) => r.ramo_id === ramo_id) : null;
    if (exact) {
      return { percentuale: Number(exact.percentuale_provvigione), livello: 1, fonte: "match esatto rapporto+ramo+sottoramo" };
    }
    const def = provvRows.find((r: any) => r.ramo_id === null);
    if (def) {
      return { percentuale: Number(def.percentuale_provvigione), livello: 2, fonte: "default ramo del rapporto" };
    }
    // Fallback senza sottoramo: % prevalente nel gruppo
    if (!ramo_id) {
      const counts = new Map<number, number>();
      for (const r of provvRows as any[]) {
        const p = Number(r.percentuale_provvigione);
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      let bestP = 0, bestC = 0;
      for (const [p, c] of counts) if (c > bestC) { bestC = c; bestP = p; }
      const total = (provvRows as any[]).length;
      const isUniform = counts.size === 1;
      return {
        percentuale: bestP,
        livello: 2,
        fonte: isUniform
          ? `uniforme nel gruppo (${total} sottorami)`
          : `aliquota prevalente del gruppo (${bestC}/${total} sottorami al ${bestP}%)`,
        warning: isUniform ? undefined : "Seleziona il Sottoramo per la % esatta (esistono eccezioni nel gruppo).",
      };
    }
  }

  // 3: % globale del rapporto
  const { data: rapporto } = await supabase
    .from("compagnia_rapporti")
    .select("percentuale_provvigione, tipo_rapporto")
    .eq("id", compagnia_rapporto_id)
    .maybeSingle();

  if (rapporto?.percentuale_provvigione != null) {
    return {
      percentuale: Number(rapporto.percentuale_provvigione),
      livello: 3,
      fonte: "% globale del rapporto",
    };
  }

  // 4: default per tipo rapporto
  if (rapporto?.tipo_rapporto) {
    const { data: defTipo } = await supabase
      .from("provvigioni_default_tipo" as any)
      .select("ramo_id, percentuale")
      .eq("tipo_rapporto", rapporto.tipo_rapporto)
      .eq("gruppo_ramo_id", gruppo_ramo_id)
      .eq("attiva", true);
    if (defTipo && defTipo.length) {
      const exact = ramo_id ? (defTipo as any[]).find((r) => r.ramo_id === ramo_id) : null;
      const def = (defTipo as any[]).find((r) => r.ramo_id === null);
      const hit = exact || def;
      if (hit) {
        return {
          percentuale: Number(hit.percentuale),
          livello: 4,
          fonte: `default tipo "${rapporto.tipo_rapporto}"`,
        };
      }
    }
  }

  return {
    percentuale: 0,
    livello: 5,
    fonte: "nessuna regola",
    warning: "Nessuna regola provvigionale trovata: applicato 0%. Configura in Provvigioni Compagnie/Ramo.",
  };
}
