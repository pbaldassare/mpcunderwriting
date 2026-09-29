import { supabase } from "@/integrations/supabase/client";

export const fetchSediContoBancario = async (contoId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoId);
  if (error) throw error;
  return ((data || []) as unknown as Array<{ ufficio_id: string }>).map((r) => r.ufficio_id);
};

export const saveSediContoBancario = async (contoId: string, ufficioIds: string[]) => {
  const unique = Array.from(new Set(ufficioIds));
  const { error } = await supabase.rpc("save_conti_bancari_uffici" as any, {
    p_conto_id: contoId,
    p_ufficio_ids: unique,
  });
  if (error) throw error;
};

/** Messaggio utente per errori salvataggio sedi / conto bancario. */
export const formatContoBancarioSaveError = (error: unknown): string => {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message || "")
      : error instanceof Error
        ? error.message
        : "";

  if (/almeno una sede abilitata/i.test(message)) {
    return "Seleziona almeno una sede abilitata per i conti Consulbrokers.";
  }
  if (/non trovato/i.test(message)) {
    return "Conto bancario non trovato. Ricarica la pagina e riprova.";
  }
  if (/permission denied|violates row-level security/i.test(message)) {
    return "Non hai i permessi per modificare le sedi abilitate di questo conto.";
  }
  if (message) return message;
  return "Errore durante il salvataggio del conto bancario.";
};
