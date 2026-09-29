import { supabase } from "@/integrations/supabase/client";

export type CausaleCambioNumero = "sostituzione" | "sospensione" | "riattivazione" | "emittenda";

/**
 * Cambia `numero_titolo` su TUTTE le righe della polizza (madre + quietanze + conguagli)
 * e archivia il numero precedente in `titoli_numeri_storici`.
 *
 * No-op se `numeroNuovo` è vuoto o uguale a `numeroCorrente`.
 * Ritorna `true` se il cambio è stato effettivamente eseguito.
 */
export async function aggiornaNumeroPolizza(params: {
  titoloId: string;
  numeroCorrente: string | null | undefined;
  numeroNuovo: string | null | undefined;
  causale: CausaleCambioNumero;
  motivo?: string | null;
  riferimentoId?: string | null;
}): Promise<boolean> {
  const { titoloId, numeroCorrente, numeroNuovo, causale, motivo, riferimentoId } = params;
  const nuovo = (numeroNuovo || "").trim();
  const corrente = (numeroCorrente || "").trim();
  if (!nuovo || !corrente || nuovo === corrente) return false;

  // 1. Aggiorna numero_titolo su tutte le righe (stessa polizza)
  const { error: errTit } = await supabase
    .from("titoli")
    .update({ numero_titolo: nuovo } as any)
    .eq("numero_titolo", corrente);
  if (errTit) throw errTit;

  // 2. Aggiorna riferimenti `sostituisce_polizza` (quietanze/conguagli che puntano al vecchio numero)
  await supabase
    .from("titoli")
    .update({ sostituisce_polizza: nuovo } as any)
    .eq("sostituisce_polizza", corrente);

  // 3. Archivio
  const { data: { user } } = await supabase.auth.getUser();
  const { error: errArch } = await supabase.from("titoli_numeri_storici" as any).insert({
    titolo_id: titoloId,
    numero_precedente: corrente,
    numero_nuovo: nuovo,
    causale,
    motivo: motivo || null,
    riferimento_id: riferimentoId || null,
    cambiato_da_user_id: user?.id || null,
  });
  if (errArch) throw errArch;

  return true;
}
