import { supabase } from "@/integrations/supabase/client";
import { normalizeDateRange } from "@/lib/comunicazioniIncasso";

const TITOLI_PAGE = 1000;

export type FiltroTacitoRinnovo = "tutti" | "si" | "no";

export type PolizzaTacitoRinnovoRow = {
  titoloId: string;
  numeroPolizza: string;
  clienteNome: string;
  agenziaNome: string;
  compagniaId: string | null;
  ufficioId: string | null;
  ufficioNome: string;
  garanziaDa: string | null;
  garanziaA: string | null;
  tacitoRinnovo: boolean | null;
  stato: string | null;
};

export type GruppoSedePolizzeTacito = {
  sedeId: string;
  sedeNome: string;
  rows: PolizzaTacitoRinnovoRow[];
};

export type FetchPolizzeTacitoParams = {
  dataDa: string;
  dataA: string;
  ufficioId?: string | null;
  agenziaId?: string | null;
  tacito?: FiltroTacitoRinnovo;
};

type TitoloTacitoRaw = {
  id: string | null;
  numero_titolo: string | null;
  cliente_nome_display: string | null;
  compagnia_id: string | null;
  compagnia_nome: string | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  tacito_rinnovo: boolean | null;
  ufficio_id: string | null;
  nome_ufficio: string | null;
  ufficio_nome: string | null;
  stato: string | null;
};

export function tacitoRinnovoLabel(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Sì" : "No";
}

export function filterPolizzeByTacito(
  rows: PolizzaTacitoRinnovoRow[],
  tacito: FiltroTacitoRinnovo,
): PolizzaTacitoRinnovoRow[] {
  if (tacito === "tutti") return rows;
  if (tacito === "si") return rows.filter((r) => r.tacitoRinnovo === true);
  return rows.filter((r) => r.tacitoRinnovo === false);
}

export function groupPolizzeTacitoBySede(rows: PolizzaTacitoRinnovoRow[]): GruppoSedePolizzeTacito[] {
  const map = new Map<string, GruppoSedePolizzeTacito>();
  for (const row of rows) {
    const sedeId = row.ufficioId || "_none";
    const sedeNome = row.ufficioNome || "Sede non assegnata";
    const g = map.get(sedeId);
    if (g) g.rows.push(row);
    else map.set(sedeId, { sedeId, sedeNome, rows: [row] });
  }
  return [...map.values()].sort((a, b) => a.sedeNome.localeCompare(b.sedeNome, "it"));
}

export function mapTitoloToPolizzaTacito(raw: TitoloTacitoRaw): PolizzaTacitoRinnovoRow | null {
  if (!raw.id) return null;
  return {
    titoloId: raw.id,
    numeroPolizza: (raw.numero_titolo || "").trim() || "—",
    clienteNome: (raw.cliente_nome_display || "").trim() || "—",
    agenziaNome: (raw.compagnia_nome || "").trim() || "—",
    compagniaId: raw.compagnia_id,
    ufficioId: raw.ufficio_id,
    ufficioNome: (raw.nome_ufficio || raw.ufficio_nome || "").trim() || "Sede non assegnata",
    garanziaDa: raw.garanzia_da,
    garanziaA: raw.garanzia_a,
    tacitoRinnovo: raw.tacito_rinnovo,
    stato: raw.stato,
  };
}

export async function fetchPolizzeTacitoRinnovo(
  params: FetchPolizzeTacitoParams,
): Promise<PolizzaTacitoRinnovoRow[]> {
  const range = normalizeDateRange(params.dataDa, params.dataA);
  const out: PolizzaTacitoRinnovoRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from("v_portafoglio_titoli")
      .select(
        [
          "id",
          "numero_titolo",
          "cliente_nome_display",
          "compagnia_id",
          "compagnia_nome",
          "garanzia_da",
          "garanzia_a",
          "tacito_rinnovo",
          "ufficio_id",
          "nome_ufficio",
          "ufficio_nome",
          "stato",
        ].join(", "),
      )
      .is("sostituisce_polizza", null)
      .in("stato", ["attivo", "sospeso"])
      .gte("garanzia_a", range.da)
      .lte("garanzia_a", range.a)
      .order("garanzia_a", { ascending: true, nullsFirst: false })
      .order("numero_titolo", { ascending: true })
      .range(from, from + TITOLI_PAGE - 1);

    if (params.ufficioId) q = q.eq("ufficio_id", params.ufficioId);
    if (params.agenziaId) q = q.eq("compagnia_id", params.agenziaId);
    if (params.tacito === "si") q = q.eq("tacito_rinnovo", true);
    if (params.tacito === "no") q = q.eq("tacito_rinnovo", false);

    const { data, error } = await q;
    if (error) throw error;
    const batch = ((data || []) as TitoloTacitoRaw[])
      .map(mapTitoloToPolizzaTacito)
      .filter((r): r is PolizzaTacitoRinnovoRow => !!r);
    out.push(...batch);
    if (batch.length < TITOLI_PAGE) break;
    from += TITOLI_PAGE;
  }

  return out;
}
