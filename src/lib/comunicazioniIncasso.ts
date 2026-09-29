import { supabase } from "@/integrations/supabase/client";
import { formatClienteEc } from "@/lib/ecAgenziaDisplay";
import { romeDateParts } from "@/lib/messaCassaSerale";

export const DOC_CATEGORIA_NOTIFICA_INCASSO = "notifica_messa_cassa";
export const AZIONE_INCASSO_INVIATA = "notifica_messa_cassa_inviata";
export const AZIONE_INCASSO_ERRORE = "notifica_messa_cassa_errore";
const DOC_BUCKET_DEFAULT = "documenti_titoli";
const IN_CHUNK = 200;
const TITOLI_PAGE = 1000;

export type StatoComunicazioneIncasso = "inviato" | "non_inviato" | "programmato";
export type FiltroStatoIncasso = "tutti" | StatoComunicazioneIncasso;

export const CODA_STATUS_PROGRAMMATO = ["pending", "processing"] as const;

export type DocumentoIncassoPreview = {
  id: string;
  nome_file: string;
  bucket_name: string;
  path_storage: string;
  created_at?: string | null;
};

export type ComunicazioneIncassoRow = {
  titoloId: string;
  numeroPolizza: string;
  clienteNome: string;
  agenziaNome: string;
  compagniaId: string | null;
  ufficioId: string | null;
  ufficioNome: string;
  dataMessaCassa: string | null;
  stato: StatoComunicazioneIncasso;
  inviatoIl: string | null;
  documento: DocumentoIncassoPreview | null;
};

export type GruppoSedeComunicazioni = {
  sedeId: string;
  sedeNome: string;
  rows: ComunicazioneIncassoRow[];
};

export type PresetPeriodoIncasso = "oggi" | "mese_corrente" | "personalizzato";

export type DateRangeIncasso = { da: string; a: string };

export type FetchComunicazioniIncassoParams = {
  dataDa: string;
  dataA: string;
  ufficioId?: string | null;
  agenziaId?: string | null;
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

type TitoloIncassoRaw = {
  id: string;
  numero_titolo: string | null;
  data_messa_cassa: string | null;
  compagnia_id: string | null;
  compagnia_rapporto_id: string | null;
  ufficio_id: string | null;
  clienti?: ClienteSnippet | ClienteSnippet[] | null;
  compagnie?: CompagniaSnippet | CompagniaSnippet[] | null;
  compagnia_rapporti?: AgenziaSnippet | AgenziaSnippet[] | null;
  uffici?: UfficioSnippet | UfficioSnippet[] | null;
};

type LogIncassoRaw = {
  entita_id: string | null;
  azione: string | null;
  created_at: string | null;
  dettagli_json: Record<string, unknown> | null;
};

export type CodaIncassoRaw = {
  id: string;
  titolo_ids: string[] | null;
  scheduled_for: string;
  status: string;
};

type DocumentoRaw = {
  id: string;
  nome_file: string | null;
  bucket_name: string | null;
  path_storage: string | null;
  entita_id: string | null;
  created_at?: string | null;
};

export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfMonthISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function endOfMonthISO(now: Date = new Date()): string {
  return todayISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

export function rangeForPreset(
  preset: Exclude<PresetPeriodoIncasso, "personalizzato">,
  now: Date = new Date(),
): DateRangeIncasso {
  if (preset === "oggi") {
    const d = todayISODate(now);
    return { da: d, a: d };
  }
  return { da: startOfMonthISO(now), a: endOfMonthISO(now) };
}

export function normalizeDateRange(da: string, a: string): DateRangeIncasso {
  const fallback = todayISODate();
  const d1 = /^\d{4}-\d{2}-\d{2}$/.test(da) ? da : fallback;
  const d2 = /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : d1;
  return d1 <= d2 ? { da: d1, a: d2 } : { da: d2, a: d1 };
}

export function detectPresetPeriodo(
  da: string,
  a: string,
  now: Date = new Date(),
): PresetPeriodoIncasso {
  const oggi = rangeForPreset("oggi", now);
  if (da === oggi.da && a === oggi.a) return "oggi";
  const mese = rangeForPreset("mese_corrente", now);
  if (da === mese.da && a === mese.a) return "mese_corrente";
  return "personalizzato";
}

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function formatAgenziaRiferimento(
  rapporto: AgenziaSnippet | null | undefined,
  compagnia: CompagniaSnippet | null | undefined,
  fallbackLog?: string | null,
): string {
  const fromRapporto =
    rapporto?.nome_rapporto?.trim() || rapporto?.sede_denominazione?.trim() || "";
  const fromCompagnia = compagnia?.nome?.trim() || "";
  const fromLog = fallbackLog?.trim() || "";
  return fromRapporto || fromCompagnia || fromLog || "—";
}

export function resolveStatoIncasso(azione: string | null | undefined): StatoComunicazioneIncasso {
  return azione === AZIONE_INCASSO_INVIATA ? "inviato" : "non_inviato";
}

export function isCodaProgrammata(status: string | null | undefined): boolean {
  return status === "pending" || status === "processing";
}

export function isoToRomeDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = romeDateParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function codaScheduledInRange(scheduledFor: string, da: string, a: string): boolean {
  const day = isoToRomeDate(scheduledFor);
  return !!day && day >= da && day <= a;
}

export function scheduledForByTitolo(rows: CodaIncassoRaw[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!isCodaProgrammata(row.status) || !row.scheduled_for) continue;
    for (const id of row.titolo_ids || []) {
      if (!id) continue;
      const prev = map.get(id);
      if (!prev || row.scheduled_for < prev) map.set(id, row.scheduled_for);
    }
  }
  return map;
}

export function applyStatoProgrammato(
  row: ComunicazioneIncassoRow,
  scheduledFor: string | undefined,
): ComunicazioneIncassoRow {
  if (!scheduledFor || row.stato === "inviato") return row;
  return { ...row, stato: "programmato", inviatoIl: scheduledFor };
}

export function labelStatoComunicazione(stato: StatoComunicazioneIncasso): string {
  if (stato === "inviato") return "Inviato";
  if (stato === "programmato") return "Programmato";
  return "Non inviato";
}

export function pickLogIncassoPreferito(logs: LogIncassoRaw[]): LogIncassoRaw | null {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => {
    const aInv = a.azione === AZIONE_INCASSO_INVIATA ? 1 : 0;
    const bInv = b.azione === AZIONE_INCASSO_INVIATA ? 1 : 0;
    if (aInv !== bInv) return bInv - aInv;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  return sorted[0] ?? null;
}

export function filterComunicazioniByStato(
  rows: ComunicazioneIncassoRow[],
  stato: FiltroStatoIncasso,
): ComunicazioneIncassoRow[] {
  if (stato === "tutti") return rows;
  return rows.filter((r) => r.stato === stato);
}

export function groupComunicazioniBySede(rows: ComunicazioneIncassoRow[]): GruppoSedeComunicazioni[] {
  const map = new Map<string, GruppoSedeComunicazioni>();
  for (const row of rows) {
    const sedeId = row.ufficioId || "_none";
    const sedeNome = row.ufficioNome || "Sede non assegnata";
    const g = map.get(sedeId);
    if (g) g.rows.push(row);
    else map.set(sedeId, { sedeId, sedeNome, rows: [row] });
  }
  return [...map.values()].sort((a, b) => a.sedeNome.localeCompare(b.sedeNome, "it"));
}

export function paginateComunicazioni<T>(rows: T[], page: number, pageSize: number): T[] {
  const from = Math.max(0, page) * pageSize;
  return rows.slice(from, from + pageSize);
}

export function mapTitoloToComunicazione(
  titolo: TitoloIncassoRaw,
  log: LogIncassoRaw | null,
  documento: DocumentoIncassoPreview | null,
): ComunicazioneIncassoRow {
  const dettagli = log?.dettagli_json ?? null;
  const inviatoDaLog = log?.azione === AZIONE_INCASSO_INVIATA;
  const inviatoIl =
    (typeof dettagli?.inviato_il === "string" && dettagli.inviato_il) ||
    (inviatoDaLog ? log?.created_at : null) ||
    documento?.created_at ||
    null;
  return {
    titoloId: titolo.id,
    numeroPolizza: (titolo.numero_titolo || "").trim() || "—",
    clienteNome: formatClienteEc(unwrapOne(titolo.clienti)),
    agenziaNome: formatAgenziaRiferimento(
      unwrapOne(titolo.compagnia_rapporti),
      unwrapOne(titolo.compagnie),
      typeof dettagli?.agenzia === "string" ? dettagli.agenzia : null,
    ),
    compagniaId: titolo.compagnia_id,
    ufficioId: titolo.ufficio_id,
    ufficioNome: unwrapOne(titolo.uffici)?.nome_ufficio?.trim() || "Sede non assegnata",
    dataMessaCassa: titolo.data_messa_cassa,
    stato: inviatoDaLog || !!documento ? "inviato" : resolveStatoIncasso(log?.azione),
    inviatoIl,
    documento,
  };
}

function docFromRaw(d: DocumentoRaw | null | undefined): DocumentoIncassoPreview | null {
  if (!d?.path_storage) return null;
  return {
    id: d.id,
    nome_file: d.nome_file || "Avviso incasso.pdf",
    bucket_name: d.bucket_name || DOC_BUCKET_DEFAULT,
    path_storage: d.path_storage,
    created_at: d.created_at ?? null,
  };
}

function docFromLog(dettagli: Record<string, unknown> | null): DocumentoIncassoPreview | null {
  const path = typeof dettagli?.path_storage === "string" ? dettagli.path_storage : null;
  if (!path) return null;
  return {
    id: "",
    nome_file: "Avviso incasso.pdf",
    bucket_name: DOC_BUCKET_DEFAULT,
    path_storage: path,
  };
}

const TITOLI_INCASSO_SELECT = [
  "id",
  "numero_titolo",
  "data_messa_cassa",
  "compagnia_id",
  "compagnia_rapporto_id",
  "ufficio_id",
  "clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome)",
  "compagnie:compagnie!titoli_compagnia_id_fkey(nome)",
  "compagnia_rapporti:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(nome_rapporto, sede_denominazione)",
  "uffici(nome_ufficio)",
].join(", ");

function applyTitoliFiltri<T extends { eq: (c: string, v: string) => T }>(
  q: T,
  params: FetchComunicazioniIncassoParams,
): T {
  let next = q;
  if (params.ufficioId) next = next.eq("ufficio_id", params.ufficioId);
  if (params.agenziaId) next = next.eq("compagnia_id", params.agenziaId);
  return next;
}

async function fetchTitoliPeriodo(params: FetchComunicazioniIncassoParams): Promise<TitoloIncassoRaw[]> {
  const { da, a } = normalizeDateRange(params.dataDa, params.dataA);
  const out: TitoloIncassoRaw[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from("titoli")
      .select(TITOLI_INCASSO_SELECT)
      .gte("data_messa_cassa", da)
      .lte("data_messa_cassa", a)
      .order("numero_titolo", { ascending: true })
      .range(from, from + TITOLI_PAGE - 1);

    q = applyTitoliFiltri(q, params);

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data || []) as unknown as TitoloIncassoRaw[];
    out.push(...batch);
    if (batch.length < TITOLI_PAGE) break;
    from += TITOLI_PAGE;
  }
  return out;
}

async function fetchTitoliByIds(
  ids: string[],
  params: FetchComunicazioniIncassoParams,
): Promise<TitoloIncassoRaw[]> {
  const out: TitoloIncassoRaw[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    let q = supabase.from("titoli").select(TITOLI_INCASSO_SELECT).in("id", chunk);
    q = applyTitoliFiltri(q, params);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data || []) as unknown as TitoloIncassoRaw[]));
  }
  return out;
}

async function fetchCodaProgrammata(): Promise<CodaIncassoRaw[]> {
  const { data, error } = await (supabase.from("messa_cassa_notifiche_coda") as any)
    .select("id, titolo_ids, scheduled_for, status")
    .in("status", [...CODA_STATUS_PROGRAMMATO]);
  if (error) throw error;
  return (data || []) as CodaIncassoRaw[];
}

async function fetchLogsForTitoli(titoloIds: string[]): Promise<LogIncassoRaw[]> {
  const out: LogIncassoRaw[] = [];
  for (let i = 0; i < titoloIds.length; i += IN_CHUNK) {
    const chunk = titoloIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("log_attivita")
      .select("entita_id, azione, created_at, dettagli_json")
      .eq("entita_tipo", "titolo")
      .in("azione", [AZIONE_INCASSO_INVIATA, AZIONE_INCASSO_ERRORE])
      .in("entita_id", chunk);
    if (error) throw error;
    out.push(...((data || []) as unknown as LogIncassoRaw[]));
  }
  return out;
}

async function fetchDocumentiIncasso(opts: {
  titoloIds: string[];
  documentoIds: string[];
}): Promise<DocumentoRaw[]> {
  const seen = new Set<string>();
  const out: DocumentoRaw[] = [];
  const push = (rows: DocumentoRaw[]) => {
    for (const r of rows) {
      if (!r.id || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };

  const select = "id, nome_file, bucket_name, path_storage, entita_id, created_at";
  for (let i = 0; i < opts.titoloIds.length; i += IN_CHUNK) {
    const chunk = opts.titoloIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("documenti")
      .select(select)
      .eq("entita_tipo", "titolo")
      .eq("categoria", DOC_CATEGORIA_NOTIFICA_INCASSO)
      .in("entita_id", chunk);
    if (error) throw error;
    push((data || []) as unknown as DocumentoRaw[]);
  }
  for (let i = 0; i < opts.documentoIds.length; i += IN_CHUNK) {
    const chunk = opts.documentoIds.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from("documenti")
      .select(select)
      .in("id", chunk);
    if (error) throw error;
    push((data || []) as unknown as DocumentoRaw[]);
  }
  return out;
}

export async function fetchComunicazioniIncasso(
  params: FetchComunicazioniIncassoParams,
): Promise<ComunicazioneIncassoRow[]> {
  const range = normalizeDateRange(params.dataDa, params.dataA);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.da) || !/^\d{4}-\d{2}-\d{2}$/.test(range.a)) return [];

  const [titoliPeriodo, coda] = await Promise.all([
    fetchTitoliPeriodo({ ...params, dataDa: range.da, dataA: range.a }),
    fetchCodaProgrammata().catch(() => [] as CodaIncassoRaw[]),
  ]);

  const codaInRange = coda.filter((c) => codaScheduledInRange(c.scheduled_for, range.da, range.a));
  const scheduledByTitolo = scheduledForByTitolo(coda);
  const scheduledInRange = scheduledForByTitolo(codaInRange);

  const knownIds = new Set(titoliPeriodo.map((t) => t.id));
  const missingIds = [...scheduledInRange.keys()].filter((id) => !knownIds.has(id));
  const extraTitoli = missingIds.length > 0 ? await fetchTitoliByIds(missingIds, params) : [];
  const titoli = [...titoliPeriodo, ...extraTitoli];
  if (titoli.length === 0) return [];

  const titoloIds = titoli.map((t) => t.id);
  const logs = await fetchLogsForTitoli(titoloIds);
  const logsByTitolo = new Map<string, LogIncassoRaw[]>();
  for (const log of logs) {
    if (!log.entita_id) continue;
    const list = logsByTitolo.get(log.entita_id);
    if (list) list.push(log);
    else logsByTitolo.set(log.entita_id, [log]);
  }

  const documentoIds: string[] = [];
  for (const log of logs) {
    const ids = log.dettagli_json?.documenti_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === "string" && id) documentoIds.push(id);
      }
    }
  }

  const docs = await fetchDocumentiIncasso({ titoloIds, documentoIds });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const docByTitolo = new Map<string, DocumentoRaw>();
  for (const d of docs) {
    if (d.entita_id && !docByTitolo.has(d.entita_id)) docByTitolo.set(d.entita_id, d);
  }

  return titoli
    .map((titolo) => {
      const log = pickLogIncassoPreferito(logsByTitolo.get(titolo.id) || []);
      const dettagli = log?.dettagli_json ?? null;
      const ids = Array.isArray(dettagli?.documenti_ids) ? dettagli.documenti_ids : [];
      const fromIds = ids
        .map((id) => (typeof id === "string" ? docById.get(id) : undefined))
        .find(Boolean);
      const documento =
        docFromRaw(fromIds) ||
        docFromRaw(docByTitolo.get(titolo.id)) ||
        docFromLog(dettagli);
      const mapped = mapTitoloToComunicazione(titolo, log, documento);
      return applyStatoProgrammato(mapped, scheduledByTitolo.get(titolo.id));
    })
    .sort((a, b) => a.numeroPolizza.localeCompare(b.numeroPolizza, "it"));
}
