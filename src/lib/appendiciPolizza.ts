import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import { baseNumeroPolizza, isAppendice, type TitoloLike } from "@/lib/quietanze";

export type AppendicePolizzaRow = {
  id: string;
  titolo_id: string;
  quietanza_id?: string | null;
  numero_appendice: string;
  data_appendice?: string | null;
  data_effetto?: string | null;
  tipo?: string | null;
  oggetto?: string | null;
  file_path?: string | null;
  nome_file?: string | null;
  titolo_modifica_id?: string | null;
  titolo_proroga_id?: string | null;
  titolo_regolazione_id?: string | null;
  created_at?: string | null;
};

/** Campi minimi di `appendici_polizza` per collegare un titolo-appendice alla madre. */
export type AppendiceLinkRow = {
  titolo_id?: string | null;
  quietanza_id?: string | null;
  titolo_modifica_id?: string | null;
  titolo_proroga_id?: string | null;
  titolo_regolazione_id?: string | null;
};

/** Id del titolo-appendice (AM/PR/RG) puntato dalla riga `appendici_polizza`. */
export function appendiceTitoloIdFromRow(row: AppendiceLinkRow): string | null {
  return row.titolo_modifica_id || row.titolo_proroga_id || row.titolo_regolazione_id || null;
}

/** Id ancora (quietanza preferita, altrimenti polizza madre) per il numero base. */
export function appendiceAncoraIdFromRow(row: AppendiceLinkRow): string | null {
  return row.quietanza_id || row.titolo_id || null;
}

/**
 * Risolve il numero base polizza per un'appendice tramite link `appendici_polizza`.
 * Ritorna null se il link manca, è ambiguo (più righe) o l'ancora non ha numero.
 */
export function linkAppendiceAPolizzaBase(
  appendiceTitoloId: string,
  appendiciRows: AppendiceLinkRow[],
  titoliById: Map<string, { numero_titolo?: string | null }>,
): string | null {
  const matches = appendiciRows.filter((r) => appendiceTitoloIdFromRow(r) === appendiceTitoloId);
  if (matches.length !== 1) return null;
  const ancoraId = appendiceAncoraIdFromRow(matches[0]);
  if (!ancoraId) return null;
  const ancora = titoliById.get(ancoraId);
  const num = ancora?.numero_titolo;
  if (!num?.trim()) return null;
  return baseNumeroPolizza(num);
}

/**
 * Override di raggruppamento: appendice id → numero base polizza madre,
 * solo quando il link è univoco e il base da `numero_titolo` differisce
 * (es. "2026/AM1" vs madre "2026/348272").
 */
export function buildAppendiceBaseOverrides<T extends TitoloLike>(
  titoli: T[],
  appendiciRows: AppendiceLinkRow[],
): Map<string, string> {
  const byId = new Map<string, T>();
  for (const t of titoli) {
    if (t.id) byId.set(t.id, t);
  }

  const out = new Map<string, string>();
  for (const t of titoli) {
    if (!t.id || !isAppendice(t)) continue;
    const linkedBase = linkAppendiceAPolizzaBase(t.id, appendiciRows, byId);
    if (!linkedBase) continue;
    if (baseNumeroPolizza(t.numero_titolo) === linkedBase) continue;
    out.set(t.id, linkedBase);
  }
  return out;
}

/** Appendici collegate a uno o più titoli della catena (madre, quietanze, derivati AM/PR/RG). */
export async function fetchAppendiciPolizzaForTitoli(
  supabase: SupabaseClient,
  titoloIds: string[],
): Promise<AppendicePolizzaRow[]> {
  const uniq = [...new Set(titoloIds.filter(Boolean))];
  if (uniq.length === 0) return [];

  const [byTitolo, byQuietanza, byReg, byPro, byMod] = await Promise.all([
    supabase.from("appendici_polizza").select("*").in("titolo_id", uniq),
    supabase.from("appendici_polizza").select("*").in("quietanza_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_regolazione_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_proroga_id", uniq),
    supabase.from("appendici_polizza").select("*").in("titolo_modifica_id", uniq),
  ]);

  for (const r of [byTitolo, byQuietanza, byReg, byPro, byMod]) {
    if (r.error) throw r.error;
  }

  const seen = new Set<string>();
  const merged: AppendicePolizzaRow[] = [];
  for (const row of [
    ...(byTitolo.data ?? []),
    ...(byQuietanza.data ?? []),
    ...(byReg.data ?? []),
    ...(byPro.data ?? []),
    ...(byMod.data ?? []),
  ] as AppendicePolizzaRow[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }

  merged.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
  return merged;
}

/** Tutti i titoli della stessa polizza (madre + quietanze + appendici /AMx). */
export async function fetchChainTitoloIds(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<string[]> {
  const madreId = await resolveTitoloMadreId(supabase, titoloId);
  const { data: madreRow, error } = await supabase
    .from("titoli")
    .select("id, numero_titolo")
    .eq("id", madreId)
    .maybeSingle();
  if (error) throw error;
  const base = (madreRow?.numero_titolo || "").trim();
  if (!base) return [titoloId];

  const [exact, suffixed] = await Promise.all([
    supabase.from("titoli").select("id").eq("numero_titolo", base),
    supabase.from("titoli").select("id").like("numero_titolo", `${base}/%`),
  ]);
  if (exact.error) throw exact.error;
  if (suffixed.error) throw suffixed.error;

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of [...(exact.data ?? []), ...(suffixed.data ?? [])]) {
    const id = row.id as string;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : [titoloId];
}

export async function fetchAppendiciPolizzaForTitolo(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<AppendicePolizzaRow[]> {
  const chainIds = await fetchChainTitoloIds(supabase, titoloId);
  return fetchAppendiciPolizzaForTitoli(supabase, chainIds);
}

/** Id polizza madre da usare come ancoraggio persistenza appendici. */
export async function resolveMadreIdForAppendice(
  supabase: SupabaseClient,
  titoloId: string,
): Promise<string> {
  return resolveTitoloMadreId(supabase, titoloId);
}
