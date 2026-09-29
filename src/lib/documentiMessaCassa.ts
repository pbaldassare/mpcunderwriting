import { supabase } from "@/integrations/supabase/client";

export type InvioEmailMessaCassaMeta = {
  destinatario: string | null;
  oggetto: string | null;
  inviato_il: string | null;
  send_id: string | null;
};

/** Metadati invio email per documenti archiviati (categoria notifica_messa_cassa). */
export async function fetchMetadatiInvioMessaCassa(
  documentiIds: string[],
): Promise<Map<string, InvioEmailMessaCassaMeta>> {
  const wanted = new Set(documentiIds);
  const out = new Map<string, InvioEmailMessaCassaMeta>();
  if (wanted.size === 0) return out;

  const { data, error } = await supabase
    .from("log_attivita")
    .select("dettagli_json, created_at")
    .eq("azione", "notifica_messa_cassa_inviata")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  for (const row of data ?? []) {
    const d = row.dettagli_json as Record<string, unknown> | null;
    const ids = (d?.documenti_ids as string[] | undefined) ?? [];
    const meta: InvioEmailMessaCassaMeta = {
      destinatario: (d?.destinatario as string) ?? null,
      oggetto: (d?.oggetto as string) ?? null,
      inviato_il: (d?.inviato_il as string) ?? (row.created_at as string) ?? null,
      send_id: (d?.send_id as string) ?? null,
    };
    for (const id of ids) {
      if (wanted.has(id) && !out.has(id)) out.set(id, meta);
    }
    if (out.size >= wanted.size) break;
  }
  return out;
}
