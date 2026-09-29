import * as XLSX from "xlsx";
import { DESCRIZIONE_MIN_CHARS } from "@/lib/sinistroPraticaSchema";
import { safeId } from "@/lib/safeId";
import { labelStatoSinistro, SINISTRO_STATI, SINISTRO_STATI_CATALOGO, type SinistroStato } from "@/lib/sinistriStati";
import { formatPolizzaRamo } from "@/lib/titoliDisplay";

/** Intestazioni canoniche del tracciato MODULO SX. */
export const MODULO_SX_HEADERS = [
  "DATA ACCADIMENTO",
  "DATA DENUNCIA",
  "CLIENTE",
  "N POLIZZA",
  "N SINISTRO COMPAGNIA",
  "COMPAGNIA",
  "AGENZIA",
  "RAMO",
  "CONTROPARTE",
  "STATO SINISTRO",
  "DESCRIZIONE",
] as const;

export const STATI_SINISTRO_IMPORT = SINISTRO_STATI;

export type StatoSinistroImport = SinistroStato;

export { DESCRIZIONE_MIN_CHARS };

export type SinistroImportField =
  | "data_evento"
  | "data_denuncia"
  | "cliente_excel"
  | "n_polizza"
  | "numero_sinistro_compagnia"
  | "compagnia_excel"
  | "agenzia_excel"
  | "ramo_sinistro"
  | "controparte"
  | "stato"
  | "descrizione";

const HEADER_MAP: Record<string, SinistroImportField> = {
  "data accadimento": "data_evento",
  "data evento": "data_evento",
  "data sinistro": "data_evento",
  accadimento: "data_evento",
  "data denuncia": "data_denuncia",
  denuncia: "data_denuncia",
  cliente: "cliente_excel",
  contraente: "cliente_excel",
  "n polizza": "n_polizza",
  "n. polizza": "n_polizza",
  "n° polizza": "n_polizza",
  "numero polizza": "n_polizza",
  polizza: "n_polizza",
  "n sinistro compagnia": "numero_sinistro_compagnia",
  "n. sinistro compagnia": "numero_sinistro_compagnia",
  "n° sinistro compagnia": "numero_sinistro_compagnia",
  "numero sinistro compagnia": "numero_sinistro_compagnia",
  "sinistro compagnia": "numero_sinistro_compagnia",
  compagnia: "compagnia_excel",
  agenzia: "agenzia_excel",
  ramo: "ramo_sinistro",
  "ramo sinistro": "ramo_sinistro",
  controparte: "controparte",
  "stato sinistro": "stato",
  stato: "stato",
  descrizione: "descrizione",
  dinamica: "descrizione",
};

const STATO_ALIASES_EXTRA: Record<string, StatoSinistroImport> = {
  draft: "bozza",
  valutazione: "in_valutazione",
  aperta: "aperto",
  open: "aperto",
  lavorazione: "in_lavorazione",
  "attesa documenti": "in_attesa_documenti",
  liquidazione: "in_liquidazione",
  chiusa: "chiuso",
  closed: "chiuso",
  evaso: "chiuso",
  respinta: "respinto",
  rejected: "respinto",
  archiviata: "archiviato",
  archived: "archiviato",
};

function buildStatoAliases(): Record<string, StatoSinistroImport> {
  const aliases: Record<string, StatoSinistroImport> = { ...STATO_ALIASES_EXTRA };
  for (const def of SINISTRO_STATI_CATALOGO) {
    aliases[normalizeText(def.value)] = def.value;
    aliases[normalizeText(def.label)] = def.value;
  }
  return aliases;
}

const STATO_ALIASES = buildStatoAliases();

export type SinistroImportRaw = {
  excelRow: number;
  data_evento: unknown;
  data_denuncia: unknown;
  cliente_excel: string;
  n_polizza: string;
  numero_sinistro_compagnia: string;
  compagnia_excel: string;
  agenzia_excel: string;
  ramo_sinistro: string;
  controparte: string;
  stato: string;
  descrizione: string;
};

export type PolizzaImportMatch = {
  id: string;
  numero_titolo: string | null;
  compagnia_id?: string | null;
  ufficio_id?: string | null;
  _isCga?: boolean;
  [k: string]: unknown;
};

export type CompagniaImportMatch = {
  id: string;
  nome: string;
  codice?: string | null;
  tipo?: string | null;
};

export type MatchPolizzaKind = "none" | "unique" | "ambiguous" | "cga" | "manual" | "terzi";
export type MatchCompagniaKind = "none" | "unique" | "ambiguous" | "from_polizza";
export type ImportRowStatus = "ok" | "warning" | "blocked";

export type SinistroImportPreviewRow = {
  id: string;
  excelRow: number;
  data_evento: string;
  data_denuncia: string;
  cliente_excel: string;
  clienteMismatch: boolean;
  n_polizza: string;
  numero_sinistro_compagnia: string;
  compagnia_excel: string;
  agenzia_excel: string;
  ramo_sinistro: string;
  controparte: string;
  stato: StatoSinistroImport;
  descrizione: string;
  sinistro_terzi: boolean;
  titolo_id: string | null;
  titolo_label: string | null;
  compagnia_id: string | null;
  compagnia_label: string | null;
  ufficio_id: string | null;
  matchPolizza: MatchPolizzaKind;
  matchCompagnia: MatchCompagniaKind;
  polizzaCandidates: PolizzaImportMatch[];
  errors: string[];
  warnings: string[];
  status: ImportRowStatus;
  importResult?: { ok: boolean; numero?: string; id?: string; error?: string };
};

export function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v).trim();
  return String(v).trim();
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeNumeroPolizza(s: string): string {
  return s.replace(/[\s.\-_]/g, "").toUpperCase();
}

export function excelDateToIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  const s = cellStr(v);
  const it = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (it) {
    const dd = it[1].padStart(2, "0");
    const mm = it[2].padStart(2, "0");
    let yyyy = it[3];
    if (yyyy.length === 2) yyyy = Number(yyyy) > 50 ? `19${yyyy}` : `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

export function mapHeader(h: string): SinistroImportField | null {
  const key = normalizeText(h).replace(/:$/, "");
  return HEADER_MAP[key] || null;
}

export function mapStatoSinistro(raw: string): { stato: StatoSinistroImport; warning?: string } {
  const n = normalizeText(raw);
  if (!n) return { stato: "aperto" };
  const mapped = STATO_ALIASES[n];
  if (mapped) return { stato: mapped };
  return { stato: "aperto", warning: `Stato "${raw}" non riconosciuto: impostato ${labelStatoSinistro("aperto")}` };
}

export function namesLooselyMatch(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokensA = new Set(na.split(" ").filter((t) => t.length > 2));
  const tokensB = nb.split(" ").filter((t) => t.length > 2);
  if (tokensA.size === 0 || tokensB.length === 0) return false;
  const overlap = tokensB.filter((t) => tokensA.has(t)).length;
  return overlap >= Math.min(2, tokensB.length);
}

export function matchPolizzeByNumero(
  nPolizza: string,
  polizze: PolizzaImportMatch[],
): { kind: MatchPolizzaKind; matches: PolizzaImportMatch[] } {
  const key = normalizeNumeroPolizza(nPolizza);
  if (!key) return { kind: "none", matches: [] };
  const matches = polizze.filter((p) => normalizeNumeroPolizza(p.numero_titolo || "") === key);
  if (matches.length === 0) return { kind: "none", matches: [] };
  const titoli = matches.filter((p) => !p._isCga && !String(p.id).startsWith("cga:"));
  if (titoli.length === 1) return { kind: "unique", matches: titoli };
  if (titoli.length > 1) return { kind: "ambiguous", matches: titoli };
  return { kind: "cga", matches };
}

export function matchCompagnieByName(
  raw: string,
  compagnie: CompagniaImportMatch[],
): { kind: MatchCompagniaKind; matches: CompagniaImportMatch[] } {
  const key = normalizeText(raw);
  if (!key) return { kind: "none", matches: [] };
  const exact = compagnie.filter((c) => {
    const nome = normalizeText(c.nome || "");
    const codice = normalizeText(c.codice || "");
    return nome === key || codice === key;
  });
  if (exact.length === 1) return { kind: "unique", matches: exact };
  if (exact.length > 1) return { kind: "ambiguous", matches: exact };
  const fuzzy = compagnie.filter((c) => {
    const nome = normalizeText(c.nome || "");
    return nome.includes(key) || key.includes(nome);
  });
  if (fuzzy.length === 1) return { kind: "unique", matches: fuzzy };
  if (fuzzy.length > 1) return { kind: "ambiguous", matches: fuzzy.slice(0, 8) };
  return { kind: "none", matches: [] };
}

function emptyRaw(excelRow: number): SinistroImportRaw {
  return {
    excelRow,
    data_evento: "",
    data_denuncia: "",
    cliente_excel: "",
    n_polizza: "",
    numero_sinistro_compagnia: "",
    compagnia_excel: "",
    agenzia_excel: "",
    ramo_sinistro: "",
    controparte: "",
    stato: "",
    descrizione: "",
  };
}

function isEmptyRaw(row: SinistroImportRaw): boolean {
  return (
    !cellStr(row.data_evento) &&
    !cellStr(row.data_denuncia) &&
    !row.cliente_excel &&
    !row.n_polizza &&
    !row.numero_sinistro_compagnia &&
    !row.compagnia_excel &&
    !row.agenzia_excel &&
    !row.ramo_sinistro &&
    !row.controparte &&
    !row.stato &&
    !row.descrizione
  );
}

export function parseModuloSxExcel(buffer: ArrayBuffer | Uint8Array): SinistroImportRaw[] {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!aoa.length) return [];

  const headerRow = (aoa[0] || []).map((h) => cellStr(h));
  const colMap = headerRow.map(mapHeader);
  const hasMapped = colMap.some(Boolean);
  const fallback: SinistroImportField[] = [
    "data_evento",
    "data_denuncia",
    "cliente_excel",
    "n_polizza",
    "numero_sinistro_compagnia",
    "compagnia_excel",
    "agenzia_excel",
    "ramo_sinistro",
    "controparte",
    "stato",
    "descrizione",
  ];

  const out: SinistroImportRaw[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i] || [];
    const raw = emptyRaw(i + 1);
    const assign = (field: SinistroImportField, value: unknown) => {
      if (field === "data_evento" || field === "data_denuncia") {
        raw[field] = value;
        return;
      }
      raw[field] = cellStr(value);
    };
    if (hasMapped) {
      colMap.forEach((field, idx) => {
        if (field) assign(field, cells[idx]);
      });
    } else {
      fallback.forEach((field, idx) => assign(field, cells[idx]));
    }
    if (!isEmptyRaw(raw)) out.push(raw);
  }
  return out;
}

/** File ufficiale in `public/modelli` (include anche CONTROPARTE). */
export const MODULO_SX_TEMPLATE_URL = "/modelli/MODULO_SX.xlsx";

export function downloadModuloSxTemplate(): void {
  const a = document.createElement("a");
  a.href = MODULO_SX_TEMPLATE_URL;
  a.download = "MODULO_SX.xlsx";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Ramo/garanzia da titolo MPCUnderwriting (stessa etichetta del wizard sinistri). */
export function ramoSinistroFromPolizza(p: PolizzaImportMatch | null | undefined): string {
  if (!p) return "";
  const label = formatPolizzaRamo(p);
  return label && label !== "—" ? label : "";
}

export function validateImportRow(row: Pick<
  SinistroImportPreviewRow,
  | "data_evento"
  | "data_denuncia"
  | "descrizione"
  | "sinistro_terzi"
  | "titolo_id"
  | "matchPolizza"
  | "ramo_sinistro"
  | "numero_sinistro_compagnia"
  | "clienteMismatch"
  | "cliente_excel"
  | "compagnia_id"
  | "stato"
>): { errors: string[]; warnings: string[]; status: ImportRowStatus } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.data_evento) errors.push("Data accadimento obbligatoria");
  if (!row.data_denuncia) errors.push("Data denuncia obbligatoria");
  if (row.descrizione.trim().length < DESCRIZIONE_MIN_CHARS) {
    errors.push(`Descrizione obbligatoria (minimo ${DESCRIZIONE_MIN_CHARS} caratteri)`);
  }

  const titoloOk = !!row.titolo_id && !row.titolo_id.startsWith("cga:");
  if (!row.sinistro_terzi && !titoloOk) {
    if (row.matchPolizza === "ambiguous") {
      errors.push("Più polizze con lo stesso numero: scegli quella corretta o marca come senza polizza MPCUnderwriting");
    } else if (row.matchPolizza === "cga") {
      errors.push("La polizza è solo in CGA: collega un titolo MPCUnderwriting oppure marca come senza polizza MPCUnderwriting");
    } else {
      errors.push("Collega una polizza MPCUnderwriting oppure marca la riga come senza polizza MPCUnderwriting");
    }
  }

  if (row.sinistro_terzi && !row.ramo_sinistro.trim()) {
    warnings.push("Ramo vuoto");
  }
  if (!row.numero_sinistro_compagnia.trim()) {
    warnings.push("Numero sinistro compagnia vuoto");
  }
  if (row.clienteMismatch && row.cliente_excel.trim()) {
    warnings.push(`Cliente in Excel diverso dall'anagrafica selezionata ("${row.cliente_excel}")`);
  }
  if (row.sinistro_terzi && !row.compagnia_id) {
    warnings.push("Compagnia non collegata in anagrafica (opzionale)");
  }

  const status: ImportRowStatus = errors.length ? "blocked" : warnings.length ? "warning" : "ok";
  return { errors, warnings, status };
}

function newRowId(): string {
  return safeId();
}

export function buildPreviewRows(
  raws: SinistroImportRaw[],
  ctx: {
    clienteNome: string;
    polizze: PolizzaImportMatch[];
    compagnie: CompagniaImportMatch[];
  },
): SinistroImportPreviewRow[] {
  return raws.map((raw) => {
    const statoMapped = mapStatoSinistro(raw.stato);
    const polizzaMatch = matchPolizzeByNumero(raw.n_polizza, ctx.polizze);
    const compagniaMatch = matchCompagnieByName(raw.compagnia_excel || raw.agenzia_excel, ctx.compagnie);

    const uniqueTitolo = polizzaMatch.kind === "unique" ? polizzaMatch.matches[0] : null;
    const sinistro_terzi = !uniqueTitolo;
    const compagniaFromPolizza = uniqueTitolo?.compagnia_id
      ? ctx.compagnie.find((c) => c.id === uniqueTitolo.compagnia_id) || null
      : null;
    const compagniaResolved = uniqueTitolo
      ? compagniaFromPolizza
      : compagniaMatch.kind === "unique"
        ? compagniaMatch.matches[0]
        : null;

    const row: SinistroImportPreviewRow = {
      id: newRowId(),
      excelRow: raw.excelRow,
      data_evento: excelDateToIso(raw.data_evento),
      data_denuncia: excelDateToIso(raw.data_denuncia),
      cliente_excel: raw.cliente_excel,
      clienteMismatch: !namesLooselyMatch(raw.cliente_excel, ctx.clienteNome),
      n_polizza: raw.n_polizza,
      numero_sinistro_compagnia: raw.numero_sinistro_compagnia,
      compagnia_excel: raw.compagnia_excel,
      agenzia_excel: raw.agenzia_excel,
      ramo_sinistro: ramoSinistroFromPolizza(uniqueTitolo) || raw.ramo_sinistro,
      controparte: raw.controparte,
      stato: statoMapped.stato,
      descrizione: raw.descrizione,
      sinistro_terzi,
      titolo_id: uniqueTitolo ? uniqueTitolo.id : null,
      titolo_label: uniqueTitolo?.numero_titolo || null,
      compagnia_id: compagniaResolved?.id || null,
      compagnia_label: compagniaResolved?.nome || null,
      ufficio_id: uniqueTitolo?.ufficio_id || null,
      matchPolizza: uniqueTitolo ? "unique" : polizzaMatch.kind === "none" && !raw.n_polizza ? "terzi" : polizzaMatch.kind,
      matchCompagnia: uniqueTitolo ? (compagniaResolved ? "from_polizza" : "none") : compagniaMatch.kind,
      polizzaCandidates: polizzaMatch.matches,
      errors: [],
      warnings: [],
      status: "ok",
    };

    const checked = revalidatePreviewRow(row);
    if (statoMapped.warning && !checked.warnings.includes(statoMapped.warning)) {
      checked.warnings = [statoMapped.warning, ...checked.warnings];
      if (checked.status === "ok") checked.status = "warning";
    }
    return checked;
  });
}

export function contextualImportWarnings(row: SinistroImportPreviewRow): string[] {
  const warnings: string[] = [];
  if (row.sinistro_terzi && !row.titolo_id) {
    if (row.matchPolizza === "cga") {
      warnings.push("Numero trovato solo in CGA, non collegabile come titolo MPCUnderwriting");
    } else if (row.n_polizza && row.matchPolizza === "none") {
      warnings.push(`Polizza "${row.n_polizza}" non trovata per questo cliente: proposta come senza polizza MPCUnderwriting`);
    } else if (!row.n_polizza && row.matchPolizza === "terzi") {
      warnings.push("Nessun numero polizza: proposta come senza polizza MPCUnderwriting");
    }
  }
  return warnings;
}

export function revalidatePreviewRow(row: SinistroImportPreviewRow): SinistroImportPreviewRow {
  const checked = validateImportRow(row);
  const extra = contextualImportWarnings(row);
  const warnings = [...extra, ...checked.warnings.filter((w) => !extra.includes(w))];
  return { ...row, errors: checked.errors, warnings, status: checked.status };
}

export function applyPreviewPatch(
  row: SinistroImportPreviewRow,
  patch: Partial<SinistroImportPreviewRow>,
  ctx?: { polizze?: PolizzaImportMatch[]; compagnie?: CompagniaImportMatch[] },
): SinistroImportPreviewRow {
  const next: SinistroImportPreviewRow = { ...row, ...patch };

  if (patch.sinistro_terzi === true) {
    next.titolo_id = null;
    next.titolo_label = null;
    next.ufficio_id = null;
    next.matchPolizza = "terzi";
  }

  if (patch.titolo_id !== undefined && ctx?.polizze) {
    if (!patch.titolo_id || patch.titolo_id.startsWith("cga:")) {
      next.titolo_id = null;
      next.titolo_label = null;
      next.ufficio_id = null;
      next.sinistro_terzi = true;
      next.matchPolizza = "terzi";
    } else {
      const p = ctx.polizze.find((x) => x.id === patch.titolo_id);
      next.titolo_id = p?.id || patch.titolo_id;
      next.titolo_label = p?.numero_titolo || next.titolo_label;
      next.ufficio_id = p?.ufficio_id || null;
      next.sinistro_terzi = false;
      next.matchPolizza = "manual";
      if (p?.compagnia_id && ctx.compagnie) {
        const c = ctx.compagnie.find((x) => x.id === p.compagnia_id);
        next.compagnia_id = p.compagnia_id;
        next.compagnia_label = c?.nome || next.compagnia_label;
        next.matchCompagnia = "from_polizza";
      }
      const ramoAuto = ramoSinistroFromPolizza(p);
      if (ramoAuto) next.ramo_sinistro = ramoAuto;
    }
  }

  if (patch.compagnia_id !== undefined && ctx?.compagnie) {
    const c = ctx.compagnie.find((x) => x.id === patch.compagnia_id);
    next.compagnia_label = c?.nome || (patch.compagnia_id ? next.compagnia_label : null);
  }

  return revalidatePreviewRow(next);
}

export function countByStatus(rows: SinistroImportPreviewRow[]) {
  return rows.reduce(
    (acc, r) => {
      acc.total += 1;
      acc[r.status] += 1;
      return acc;
    },
    { total: 0, ok: 0, warning: 0, blocked: 0 },
  );
}
