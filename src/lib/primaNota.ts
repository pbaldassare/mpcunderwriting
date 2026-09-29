import { supabase } from "@/integrations/supabase/client";
import { formatClienteEc } from "@/lib/ecAgenziaDisplay";
import { exportJsonToXlsx } from "@/lib/exportXlsx";
import { formatDateIT } from "@/lib/formatDate";
import {
  formatAgenziaRiferimento,
  normalizeDateRange,
  paginateComunicazioni,
  unwrapOne,
} from "@/lib/comunicazioniIncasso";

export {
  detectPresetPeriodo,
  endOfMonthISO,
  normalizeDateRange,
  rangeForPreset,
  startOfMonthISO,
  todayISODate,
} from "@/lib/comunicazioniIncasso";

export const paginatePrimaNota = paginateComunicazioni;

const TITOLI_PAGE = 1000;

export type PrimaNotaSortField =
  | "numeroPolizza"
  | "clienteNome"
  | "agenziaNome"
  | "premioIncassato"
  | "dataIncasso";

export type RaggruppaPrimaNota = "nessuno" | "cliente" | "agenzia" | "cliente_agenzia";

export type PrimaNotaRow = {
  titoloId: string;
  numeroPolizza: string;
  clienteNome: string;
  clienteAnagraficaId: string | null;
  agenziaNome: string;
  compagniaId: string | null;
  ufficioId: string | null;
  ufficioNome: string;
  premioIncassato: number | null;
  dataIncasso: string | null;
};

export type PrimaNotaFilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

export type GruppoPrimaNota = {
  key: string;
  label: string;
  rows: PrimaNotaRow[];
  totalPremio: number;
};

export type GruppoAnnidatoPrimaNota = {
  key: string;
  label: string;
  groups: GruppoPrimaNota[];
  totalPremio: number;
};

export type GruppoSedePrimaNota = {
  sedeId: string;
  sedeNome: string;
  rows: PrimaNotaRow[];
};

export type FetchPrimaNotaParams = {
  dataDa: string;
  dataA: string;
  ufficioId?: string | null;
  agenziaId?: string | null;
};

export type PrimaNotaSedeLock = {
  seeAllSedi: boolean;
  sedeLockedId: string | null;
  authReady: boolean;
};

type ClienteSnippet = {
  ragione_sociale?: string | null;
  cognome?: string | null;
  nome?: string | null;
};

type AgenziaSnippet = {
  nome_rapporto?: string | null;
  sede_denominazione?: string | null;
};

type CompagniaSnippet = {
  nome?: string | null;
};

type UfficioSnippet = {
  nome_ufficio?: string | null;
};

export type TitoloPrimaNotaRaw = {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  importo_incassato?: number | null;
  premio_lordo?: number | null;
  conferimento_gestito?: boolean | null;
  tipo_pagamento?: string | null;
  compagnia_id: string | null;
  compagnia_rapporto_id?: string | null;
  cliente_anagrafica_id?: string | null;
  ufficio_id: string | null;
  clienti?: ClienteSnippet | ClienteSnippet[] | null;
  compagnie?: CompagniaSnippet | CompagniaSnippet[] | null;
  compagnia_rapporti?: AgenziaSnippet | AgenziaSnippet[] | null;
  uffici?: UfficioSnippet | UfficioSnippet[] | null;
};

/** Stessa idea di notifica-messa-cassa resolveImportoEmail. */
export function resolvePremioIncassato(t: {
  importo_incassato?: number | null;
  premio_lordo?: number | null;
  conferimento_gestito?: boolean | null;
  tipo_pagamento?: string | null;
}): number | null {
  const incassato = t.importo_incassato != null ? Number(t.importo_incassato) : null;
  const lordo = t.premio_lordo != null ? Number(t.premio_lordo) : null;
  const isGarantito =
    !!t.conferimento_gestito || String(t.tipo_pagamento || "").toLowerCase() === "garantito";
  if (isGarantito && (incassato == null || incassato === 0)) return lordo;
  if (incassato != null && incassato > 0) return incassato;
  return lordo;
}

export function resolveSedeLock(opts: {
  authLoading: boolean;
  isAdmin?: boolean;
  ruolo?: string | null;
  ufficioId?: string | null;
  hasProfile?: boolean;
}): PrimaNotaSedeLock {
  const seeAllSedi = !!opts.isAdmin || opts.ruolo === "cfo";
  const sedeLockedId = !seeAllSedi && opts.ufficioId ? opts.ufficioId : null;
  const authReady = !opts.authLoading && !!opts.hasProfile && (seeAllSedi || !!sedeLockedId);
  return { seeAllSedi, sedeLockedId, authReady };
}

export function applySedeFilter<T extends { ufficioId: string | null }>(
  rows: T[],
  sedeLockedId: string | null,
): T[] {
  if (!sedeLockedId) return rows;
  return rows.filter((r) => r.ufficioId === sedeLockedId);
}

export function groupPrimaNotaBySede(rows: PrimaNotaRow[]): GruppoSedePrimaNota[] {
  const map = new Map<string, GruppoSedePrimaNota>();
  for (const row of rows) {
    const sedeId = row.ufficioId || "_none";
    const sedeNome = row.ufficioNome || "Sede non assegnata";
    const g = map.get(sedeId);
    if (g) g.rows.push(row);
    else map.set(sedeId, { sedeId, sedeNome, rows: [row] });
  }
  return [...map.values()].sort((a, b) => a.sedeNome.localeCompare(b.sedeNome, "it"));
}

export function mapTitoloToPrimaNota(titolo: TitoloPrimaNotaRaw): PrimaNotaRow {
  return {
    titoloId: titolo.id,
    numeroPolizza: (titolo.numero_titolo || "").trim() || "—",
    clienteNome: formatClienteEc(unwrapOne(titolo.clienti)),
    clienteAnagraficaId: titolo.cliente_anagrafica_id ?? null,
    agenziaNome: formatAgenziaRiferimento(
      unwrapOne(titolo.compagnia_rapporti),
      unwrapOne(titolo.compagnie),
    ),
    compagniaId: titolo.compagnia_id,
    ufficioId: titolo.ufficio_id,
    ufficioNome: unwrapOne(titolo.uffici)?.nome_ufficio?.trim() || "Sede non assegnata",
    premioIncassato: resolvePremioIncassato(titolo),
    dataIncasso: titolo.data_messa_cassa,
  };
}

export function filterPrimaNotaRows(
  rows: PrimaNotaRow[],
  opts: { clienteId?: string | null; agenziaId?: string | null },
): PrimaNotaRow[] {
  let out = rows;
  if (opts.clienteId) {
    out = out.filter((r) => (r.clienteAnagraficaId || `nome:${r.clienteNome}`) === opts.clienteId);
  }
  if (opts.agenziaId) {
    out = out.filter((r) => (r.compagniaId || `nome:${r.agenziaNome}`) === opts.agenziaId);
  }
  return out;
}

function comparePrimaNota(a: PrimaNotaRow, b: PrimaNotaRow, field: PrimaNotaSortField): number {
  if (field === "premioIncassato") {
    return (a.premioIncassato ?? 0) - (b.premioIncassato ?? 0);
  }
  const av = String(a[field] ?? "");
  const bv = String(b[field] ?? "");
  return av.localeCompare(bv, "it", { numeric: true, sensitivity: "base" });
}

export function sortPrimaNotaRows(
  rows: PrimaNotaRow[],
  field: PrimaNotaSortField,
  direction: "asc" | "desc",
): PrimaNotaRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * comparePrimaNota(a, b, field));
}

export function uniquePrimaNotaOptions(
  rows: PrimaNotaRow[],
  kind: "cliente" | "agenzia",
): PrimaNotaFilterOption[] {
  const seen = new Map<string, PrimaNotaFilterOption>();
  for (const r of rows) {
    const value =
      kind === "cliente"
        ? r.clienteAnagraficaId || `nome:${r.clienteNome}`
        : r.compagniaId || `nome:${r.agenziaNome}`;
    const label = kind === "cliente" ? r.clienteNome : r.agenziaNome;
    if (!value || seen.has(value)) continue;
    seen.set(value, { value, label, searchText: label });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "it"));
}

function sumPremio(rows: PrimaNotaRow[]): number {
  return rows.reduce((s, r) => s + (r.premioIncassato || 0), 0);
}

function groupByKey(
  rows: PrimaNotaRow[],
  keyOf: (r: PrimaNotaRow) => string,
  labelOf: (r: PrimaNotaRow) => string,
): GruppoPrimaNota[] {
  const map = new Map<string, GruppoPrimaNota>();
  for (const row of rows) {
    const key = keyOf(row);
    const g = map.get(key);
    if (g) g.rows.push(row);
    else map.set(key, { key, label: labelOf(row), rows: [row], totalPremio: 0 });
  }
  const groups = [...map.values()].map((g) => ({ ...g, totalPremio: sumPremio(g.rows) }));
  return groups.sort((a, b) => a.label.localeCompare(b.label, "it"));
}

export function groupPrimaNotaByCliente(rows: PrimaNotaRow[]): GruppoPrimaNota[] {
  return groupByKey(
    rows,
    (r) => r.clienteAnagraficaId || `nome:${r.clienteNome}`,
    (r) => r.clienteNome,
  );
}

export function groupPrimaNotaByAgenzia(rows: PrimaNotaRow[]): GruppoPrimaNota[] {
  return groupByKey(
    rows,
    (r) => r.compagniaId || `nome:${r.agenziaNome}`,
    (r) => r.agenziaNome,
  );
}

export function groupPrimaNotaByClienteEAgenzia(rows: PrimaNotaRow[]): GruppoAnnidatoPrimaNota[] {
  return groupPrimaNotaByCliente(rows).map((cliente) => {
    const groups = groupPrimaNotaByAgenzia(cliente.rows);
    return {
      key: cliente.key,
      label: cliente.label,
      groups,
      totalPremio: cliente.totalPremio,
    };
  });
}

export function rowsForPrimaNotaExport(rows: PrimaNotaRow[], seeAllSedi: boolean): PrimaNotaRow[] {
  if (!seeAllSedi) return rows;
  return groupPrimaNotaBySede(rows).flatMap((g) => g.rows);
}

export function rowsToPrimaNotaSheet(
  rows: PrimaNotaRow[],
  opts?: { includeSede?: boolean },
): Record<string, string | number | null>[] {
  return rows.map((r) => {
    const out: Record<string, string | number | null> = {};
    if (opts?.includeSede) out["Sede"] = r.ufficioNome;
    out["N. polizza"] = r.numeroPolizza;
    out["Nome cliente"] = r.clienteNome;
    out["Agenzia"] = r.agenziaNome;
    out["Premio incassato"] = r.premioIncassato;
    out["Data incasso"] = formatDateIT(r.dataIncasso);
    return out;
  });
}

export function primaNotaExportFilename(da: string, a: string): string {
  if (da === a) return `prima-nota-${da}.xlsx`;
  return `prima-nota-${da}_${a}.xlsx`;
}

export function exportPrimaNotaXlsx(
  rows: PrimaNotaRow[],
  opts: { dataDa: string; dataA: string; includeSede?: boolean },
) {
  const sheet = rowsToPrimaNotaSheet(rows, { includeSede: opts.includeSede });
  exportJsonToXlsx(sheet, "Prima nota", primaNotaExportFilename(opts.dataDa, opts.dataA));
}

export async function fetchPrimaNota(params: FetchPrimaNotaParams): Promise<PrimaNotaRow[]> {
  const range = normalizeDateRange(params.dataDa, params.dataA);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.da) || !/^\d{4}-\d{2}-\d{2}$/.test(range.a)) return [];

  const out: PrimaNotaRow[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from("titoli")
      .select(
        [
          "id",
          "numero_titolo",
          "data_messa_cassa",
          "importo_incassato",
          "premio_lordo",
          "conferimento_gestito",
          "tipo_pagamento",
          "compagnia_id",
          "compagnia_rapporto_id",
          "cliente_anagrafica_id",
          "ufficio_id",
          "clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome)",
          "compagnie:compagnie!titoli_compagnia_id_fkey(nome)",
          "compagnia_rapporti:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(nome_rapporto, sede_denominazione)",
          "uffici(nome_ufficio)",
        ].join(", "),
      )
      .gte("data_messa_cassa", range.da)
      .lte("data_messa_cassa", range.a)
      .order("data_messa_cassa", { ascending: true })
      .order("numero_titolo", { ascending: true })
      .range(from, from + TITOLI_PAGE - 1);

    if (params.ufficioId) q = q.eq("ufficio_id", params.ufficioId);
    if (params.agenziaId) q = q.eq("compagnia_id", params.agenziaId);

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data || []) as unknown as TitoloPrimaNotaRaw[];
    out.push(...batch.map(mapTitoloToPrimaNota));
    if (batch.length < TITOLI_PAGE) break;
    from += TITOLI_PAGE;
  }
  return out;
}
