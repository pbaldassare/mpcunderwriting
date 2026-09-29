import { supabase } from "@/integrations/supabase/client";
import {
  filterQuietanzeSuccessiveNonContabilizzate,
  mapTitoloToRettificaSearchRow,
  sanitizeRettificaSearchTerm,
  type QuietanzaRettificaSearchRow,
  type QuietanzaSuccessivaCandidate,
} from "@/lib/rettificaProvvigioniQuietanza";

/**
 * Cerca quietanze già a cassa / incassate su `titoli` (fonte di verità della RPC).
 * Non usa `v_portafoglio_quietanze`: quella vista parte da `quietanze` e esclude
 * centinaia di rate messe a cassa solo su titoli.
 */
const TITOLO_SELECT =
  "id, numero_titolo, premio_lordo, provvigioni_quietanza, data_messa_cassa, stato, riga, rate, " +
  "sostituisce_polizza, garanzia_da, " +
  "clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome, codice_cliente), " +
  "compagnie:compagnie!titoli_compagnia_id_fkey(nome)";

function baseQuietanzeACassa() {
  return supabase
    .from("titoli")
    .select(TITOLO_SELECT)
    .not("sostituisce_polizza", "is", null)
    // IS NOT TRUE → include false e null (esclude regolazioni)
    .not("is_regolazione", "is", true)
    .or("stato.eq.incassato,data_messa_cassa.not.is.null")
    .order("data_messa_cassa", { ascending: false, nullsFirst: false })
    .limit(30);
}

export async function searchQuietanzePerRettifica(rawTerm: string): Promise<QuietanzaRettificaSearchRow[]> {
  const term = sanitizeRettificaSearchTerm(rawTerm);
  if (term.length < 2) return [];

  const { data: byNum, error: errNum } = await baseQuietanzeACassa().ilike("numero_titolo", `%${term}%`);
  if (errNum) throw errNum;

  const { data: clientiMatch, error: errCli } = await supabase
    .from("clienti")
    .select("id")
    .or(
      `ragione_sociale.ilike.%${term}%,cognome.ilike.%${term}%,nome.ilike.%${term}%,codice_cliente.ilike.%${term}%`,
    )
    .limit(40);
  if (errCli) throw errCli;

  let byCliente: typeof byNum = [];
  const clienteIds = (clientiMatch || []).map((c) => c.id).filter(Boolean);
  if (clienteIds.length > 0) {
    const { data, error } = await baseQuietanzeACassa().in("cliente_anagrafica_id", clienteIds);
    if (error) throw error;
    byCliente = data || [];
  }

  const merged = new Map<string, QuietanzaRettificaSearchRow>();
  for (const raw of [...(byNum || []), ...byCliente]) {
    const row = raw as unknown as Parameters<typeof mapTitoloToRettificaSearchRow>[0];
    if (!row?.id || merged.has(row.id)) continue;
    merged.set(row.id, mapTitoloToRettificaSearchRow(row));
  }

  return Array.from(merged.values()).slice(0, 30);
}

/** Quietanze successive non a cassa della stessa polizza (per flag rettifica). */
export async function fetchQuietanzeSuccessivePerRettifica(
  selected: Pick<QuietanzaRettificaSearchRow, "id" | "sostituisce_polizza" | "numero_rata" | "garanzia_da">,
): Promise<QuietanzaSuccessivaCandidate[]> {
  const key = (selected.sostituisce_polizza || "").trim();
  if (!key) return [];

  const { data, error } = await supabase
    .from("titoli")
    .select("id, numero_titolo, riga, garanzia_da, data_messa_cassa, stato, is_regolazione, provvigioni_quietanza")
    .eq("sostituisce_polizza", key)
    .neq("id", selected.id)
    .not("is_regolazione", "is", true)
    .is("data_messa_cassa", null)
    .order("riga", { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) throw error;

  return filterQuietanzeSuccessiveNonContabilizzate(
    {
      id: selected.id,
      riga: selected.numero_rata,
      garanzia_da: selected.garanzia_da,
    },
    (data || []).map((row) => ({
      id: row.id,
      numero_titolo: row.numero_titolo,
      riga: row.riga ?? null,
      garanzia_da: row.garanzia_da ?? null,
      data_messa_cassa: row.data_messa_cassa ?? null,
      stato: row.stato ?? null,
      is_regolazione: row.is_regolazione ?? false,
      provvigioni_quietanza: row.provvigioni_quietanza ?? null,
    })),
  );
}
