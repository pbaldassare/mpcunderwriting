import { supabase } from "@/integrations/supabase/client";
import type { SedeAssegnata } from "@/components/anagrafiche/SediMultiSelect";

export const fetchSediSpecialistSinistri = async (profilo_id: string): Promise<SedeAssegnata[]> => {
  const { data, error } = await supabase
    .from("specialist_sinistri_sedi" as any)
    .select("ufficio_id, primaria")
    .eq("profilo_id", profilo_id);
  if (error) throw error;
  return (data || []) as unknown as SedeAssegnata[];
};

/** Sostituisce le sedi di copertura per uno Specialist Sinistri. */
export const saveSediSpecialistSinistri = async (profilo_id: string, sedi: SedeAssegnata[]) => {
  if (sedi.length === 0) {
    const { error } = await supabase
      .from("specialist_sinistri_sedi" as any)
      .delete()
      .eq("profilo_id", profilo_id);
    if (error) throw error;
    return;
  }

  const ufficioIds = sedi.map((s) => s.ufficio_id);

  const { error: delErr } = await supabase
    .from("specialist_sinistri_sedi" as any)
    .delete()
    .eq("profilo_id", profilo_id)
    .not("ufficio_id", "in", `(${ufficioIds.map((id) => `"${id}"`).join(",")})`);
  if (delErr) throw delErr;

  const { error: unsetErr } = await supabase
    .from("specialist_sinistri_sedi" as any)
    .update({ primaria: false })
    .eq("profilo_id", profilo_id);
  if (unsetErr) throw unsetErr;

  const upsertRows = sedi.map((s) => ({
    profilo_id,
    ufficio_id: s.ufficio_id,
    primaria: false,
  }));
  const { error: upErr } = await supabase
    .from("specialist_sinistri_sedi" as any)
    .upsert(upsertRows, { onConflict: "profilo_id,ufficio_id" });
  if (upErr) throw upErr;

  const primaria = sedi.find((s) => s.primaria) || sedi[0];
  if (primaria) {
    const { error: pErr } = await supabase
      .from("specialist_sinistri_sedi" as any)
      .update({ primaria: true })
      .eq("profilo_id", profilo_id)
      .eq("ufficio_id", primaria.ufficio_id);
    if (pErr) throw pErr;
  }
};

/** Rimuove completamente lo Specialist Sinistri (tutte le sedi). */
export const removeSpecialistSinistri = async (profilo_id: string) => {
  const { error } = await supabase
    .from("specialist_sinistri_sedi" as any)
    .delete()
    .eq("profilo_id", profilo_id);
  if (error) throw error;
};
