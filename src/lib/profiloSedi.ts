import { supabase } from "@/integrations/supabase/client";
import type { SedeAssegnata } from "@/components/anagrafiche/SediMultiSelect";

export const fetchSediProfilo = async (profilo_id: string): Promise<SedeAssegnata[]> => {
  const { data, error } = await supabase
    .from("profilo_sedi" as any)
    .select("ufficio_id, primaria")
    .eq("profilo_id", profilo_id);
  if (error) throw error;
  return ((data || []) as unknown as SedeAssegnata[]);
};

export const saveSediProfilo = async (profilo_id: string, sedi: SedeAssegnata[]) => {
  // Strategia: cancella tutto e reinserisci. Le primarie sono garantite da indice unico parziale.
  if (sedi.length === 0) return;
  // 1) cancella le righe non più presenti
  const ufficioIds = sedi.map((s) => s.ufficio_id);
  const { error: delErr } = await supabase
    .from("profilo_sedi" as any)
    .delete()
    .eq("profilo_id", profilo_id)
    .not("ufficio_id", "in", `(${ufficioIds.map((id) => `"${id}"`).join(",")})`);
  if (delErr) throw delErr;

  // 2) prima azzera tutte le primarie esistenti (per evitare conflitti con l'indice unico parziale)
  const { error: unsetErr } = await supabase
    .from("profilo_sedi" as any)
    .update({ primaria: false })
    .eq("profilo_id", profilo_id);
  if (unsetErr) throw unsetErr;

  // 3) upsert con primaria=false per tutte
  const upsertRows = sedi.map((s) => ({ profilo_id, ufficio_id: s.ufficio_id, primaria: false }));
  const { error: upErr } = await supabase
    .from("profilo_sedi" as any)
    .upsert(upsertRows, { onConflict: "profilo_id,ufficio_id" });
  if (upErr) throw upErr;

  // 4) imposta la primaria
  const primaria = sedi.find((s) => s.primaria) || sedi[0];
  if (primaria) {
    const { error: pErr } = await supabase
      .from("profilo_sedi" as any)
      .update({ primaria: true })
      .eq("profilo_id", profilo_id)
      .eq("ufficio_id", primaria.ufficio_id);
    if (pErr) throw pErr;
  }
};
