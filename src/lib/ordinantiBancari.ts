import { supabase } from "@/integrations/supabase/client";

/** Lista ordinanti distinti già presenti (per combobox inserimento manuale). */
export async function fetchOrdinantiSuggeriti(opts?: {
  search?: string;
  limit?: number;
}): Promise<string[]> {
  const limit = opts?.limit ?? 80;
  const search = (opts?.search || "").trim();

  let q = supabase
    .from("movimenti_bancari" as any)
    .select("ordinante")
    .not("ordinante", "is", null)
    .neq("ordinante", "")
    .order("created_at", { ascending: false })
    .limit(400);

  if (search.length >= 2) {
    q = q.ilike("ordinante", `%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of (data as any[]) || []) {
    const o = String(r.ordinante || "").trim();
    if (!o) continue;
    const key = o.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}
