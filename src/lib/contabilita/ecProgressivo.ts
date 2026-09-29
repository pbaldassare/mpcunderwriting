import { supabase } from "@/integrations/supabase/client";

export type EcProgressivoTipo = "agenzia" | "produttore";

export interface EcProgressivoResult {
  ok: boolean;
  numero?: number;
  riferimento?: string;
  error?: string;
}

export async function prossimoRiferimentoEc(
  tipo: EcProgressivoTipo,
  entitaId: string,
  codice: string,
  opts?: { incrementa?: boolean; mese?: Date },
): Promise<EcProgressivoResult> {
  const pMese = opts?.mese ? opts.mese.toISOString().slice(0, 10) : undefined;
  const { data, error } = await supabase.rpc("prossimo_riferimento_ec", {
    p_tipo: tipo,
    p_entita_id: entitaId,
    p_codice: codice || "REF",
    p_mese: pMese,
    p_incrementa: opts?.incrementa ?? true,
  } as any);

  if (error) {
    return { ok: false, error: error.message };
  }

  const res = data as { ok?: boolean; numero?: number; riferimento?: string; error?: string } | null;
  if (!res?.ok) {
    return { ok: false, error: res?.error || "Progressivo non disponibile" };
  }

  return {
    ok: true,
    numero: res.numero,
    riferimento: res.riferimento,
  };
}

export async function anteprimaRiferimentoEc(
  tipo: EcProgressivoTipo,
  entitaId: string,
  codice: string,
): Promise<EcProgressivoResult> {
  return prossimoRiferimentoEc(tipo, entitaId, codice, { incrementa: false });
}
