import { supabase } from "@/integrations/supabase/client";
import { targaColumnOrClause } from "@/lib/sinistriListSearch";

/** Titoli collegati a una targa su veicolo o campo legacy targa_telaio. */
export async function fetchTitoloIdsByTarga(raw: string, limit = 500): Promise<string[]> {
  const veicoloClause = targaColumnOrClause("targa", raw);
  const telaioClause = targaColumnOrClause("targa_telaio", raw);
  const [veicoli, titoli] = await Promise.all([
    veicoloClause
      ? supabase.from("veicoli_polizza").select("titolo_id").or(veicoloClause).limit(limit)
      : Promise.resolve({ data: [] as { titolo_id: string | null }[] }),
    telaioClause
      ? supabase.from("titoli").select("id").or(telaioClause).limit(limit)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  return [...new Set([
    ...((veicoli.data || []).map((r) => r.titolo_id).filter(Boolean) as string[]),
    ...((titoli.data || []).map((r) => r.id)),
  ])];
}
