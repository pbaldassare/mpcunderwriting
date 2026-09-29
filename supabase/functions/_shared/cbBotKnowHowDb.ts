import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchKnowHow, type KnowHowRow, type KnowHowTipo } from "./cbBotKnowHow.ts";

function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function findKnowHowHit(tipo: KnowHowTipo, domanda: string): Promise<KnowHowRow | null> {
  const db = admin();
  if (!db) return null;
  const { data, error } = await db
    .from("cb_bot_know_how")
    .select("id, tipo, domanda, domanda_norm, risposta, fonti")
    .eq("tipo", tipo)
    .eq("attiva", true)
    .limit(200);
  if (error) {
    console.warn("cb_bot_know_how", error.message);
    return null;
  }
  return matchKnowHow((data ?? []) as KnowHowRow[], domanda);
}

export async function bumpKnowHowHit(id: string): Promise<void> {
  const db = admin();
  if (!db) return;
  const { data } = await db.from("cb_bot_know_how").select("hit_count").eq("id", id).maybeSingle();
  const next = (typeof data?.hit_count === "number" ? data.hit_count : 0) + 1;
  await db.from("cb_bot_know_how").update({ hit_count: next }).eq("id", id);
}

export function knowHowFonti(hit: KnowHowRow): unknown[] {
  const raw = Array.isArray(hit.fonti) ? hit.fonti : [];
  return [{ kind: "know-how", id: hit.id }, ...raw];
}
