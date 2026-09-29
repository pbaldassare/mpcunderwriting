import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

const todayISO = () => new Date().toISOString().slice(0, 10);

const CAUSALE_STOP_RE =
  /\s+(CIG|RINNOVO|POLIZZ[AE]|PAGAMENTO|LIQUIDAZIONE|Info aggiuntive|PERP|RAMO|CYBER|CREAZIONE|ASSICURATIV).*$/i;

/** IBAN (con o senza spazi) e frammenti tipici degli estratti IT. */
const IBAN_RE = /\b[A-Z]{2}\s?\d{2}(?:[\s]?[A-Z0-9]){11,30}\b/gi;
const BANK_CODE_RE = /\b(?:CRO|TRN|CIG|CUP|ABI|CAB|BIC|SWIFT)\s*[:\s]?\s*[A-Z0-9]+\b/gi;

/** True se il testo è (quasi) solo un IBAN / coordinate conto, inutile per il match nominativo. */
export function looksLikeIbanOrAccount(raw: string): boolean {
  const s = String(raw || "").trim();
  if (!s) return false;
  const compact = s.replace(/[\s-]/g, "").toUpperCase();
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return true;
  // Prefisso IBAN IT anche troncato in UI (IT92P030150…)
  if (/^IT\d{2}[A-Z0-9]{8,}$/.test(compact) && compact.length >= 14) return true;
  // Colonna che inizia con IBAN + indirizzo / end-to-end (tipico estratto IT)
  if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,}/i.test(compact)) return true;
  // Dopo rimozione IBAN non resta un nominativo
  const withoutIban = s
    .replace(/\b[A-Z]{2}\s?\d{2}(?:[\s]?[A-Z0-9]){11,30}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutIban.length < 2 && /[A-Z]{2}\d{2}/i.test(compact);
}

/**
 * Tiene solo il nominativo utile al coordinamento (nome/cognome/ragione sociale).
 * Rimuove IBAN, CRO/TRN/CIG e coda causale.
 */
export function sanitizeOrdinanteNome(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  if (looksLikeIbanOrAccount(s)) return "";

  s = s.replace(IBAN_RE, " ");
  s = s.replace(BANK_CODE_RE, " ");
  s = s.replace(/\bIBAN\b[:\s]*/gi, " ");
  s = s.replace(/\bIndirizzo\s+ordinante\b.*$/i, " ");
  s = s.replace(/\bID\s+End\s+to\s+End\b.*$/i, " ");
  s = s.replace(CAUSALE_STOP_RE, " ");
  s = s.replace(/\s+\d{4}-\d{5,}-\d{6,}.*$/u, " ");
  s = s.replace(/\s+\d{10,}.*$/u, " ");
  s = s.replace(/[*_/|]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  if (!s || looksLikeIbanOrAccount(s)) return "";
  if (/^[\d\s./\-]+$/.test(s)) return "";
  // Troppo corto o solo codice
  if (s.length < 2) return "";
  return s.slice(0, 120);
}

/** Estrae il pagatore da descrizione movimento (BCC, Intesa, ecc.) quando manca colonna Ordinante. */
export function extractOrdinanteFromDescrizione(descrizione: string): string {
  const desc = String(descrizione ?? "").trim();
  if (!desc) return "";

  // BCC: "Bonifico a vs favore *NOME …"
  const bcc = desc.match(/Bonifico\s+a\s+vs\s+favore\s+\*([^*]+)/i);
  if (bcc) {
    let name = bcc[1].trim();
    name = name.replace(CAUSALE_STOP_RE, "").trim();
    name = name.replace(/\s+\d{4}-\d{5,}-\d{6,}.*$/, "").trim();
    name = name.replace(/\s+\d{10,}.*$/, "").trim();
    return sanitizeOrdinanteNome(name);
  }

  // Intesa/Unicredit/BPM: "BONIFICO A VOSTRO FAVORE NOME Data Regolamento:"
  // (prima di ORDINANTE: evita di matchare "Coord.Ordinante:" = IBAN)
  const vostro = desc.match(
    /BONIFICO\s+A\s+VOSTRO\s+FAVORE\s+(.+?)(?:\s+Data\s+Regolamento\b|\s+Coord\.?\s*Ordinante\b|\s+Cro\b|\s+Note\b|$)/i,
  );
  if (vostro) {
    let name = vostro[1].trim();
    name = name.replace(CAUSALE_STOP_RE, "").trim();
    const cleaned = sanitizeOrdinanteNome(name);
    if (cleaned) return cleaned;
  }

  // Etichetta "Ordinante:" / "ORDINANTE:" (non "Coord.Ordinante")
  const ordinanteLabel = desc.match(
    /(?:^|[\s;|/])ORDINANTE[:\s]+(.+?)(?:\s+Causale\b|\s{2,}|\s+CRO\b|\s+TRN\b|\s+IBAN\b|$)/i,
  );
  if (ordinanteLabel) {
    const cleaned = sanitizeOrdinanteNome(ordinanteLabel[1]);
    if (cleaned) return cleaned;
  }

  const da = desc.match(/DA\s+([A-ZÀ-Ü][A-ZÀ-Ü0-9\s&.'-]+?)(?:\s{2,}|$|CRO|TRN|IBAN|CAUSALE)/i);
  if (da) {
    const cleaned = sanitizeOrdinanteNome(da[1]);
    if (cleaned) return cleaned;
  }

  // Evita di prendere un IBAN come "prima parte" della descrizione
  const first = desc.split(/\s{2,}|;|\|/)[0].slice(0, 120).trim();
  return sanitizeOrdinanteNome(first);
}

/** Normalizza chiavi colonna Excel/CSV (spazi; BOM). */
export function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/^\uFEFF/, "").trim(), v]),
  );
}

/**
 * Risolve ordinante: nominativo da colonna (se non è IBAN), altrimenti da descrizione.
 * Non salva IBAN / coordinate conto.
 */
export function resolveOrdinanteImport(
  ordinanteRaw: string,
  descrizione: string,
): string {
  // Preferisci sempre il nominativo in descrizione (ORDINANTE: … Causale:)
  const fromDesc = extractOrdinanteFromDescrizione(descrizione);
  const rawCol = String(ordinanteRaw ?? "").trim();
  if (fromDesc) {
    // Se la colonna è solo IBAN/indirizzo, ignorala
    if (!rawCol || looksLikeIbanOrAccount(rawCol)) return fromDesc;
    const fromCol = sanitizeOrdinanteNome(rawCol);
    // Preferisci descrizione se più “nome-like” (ha lettere e non è IBAN)
    return fromCol && fromCol.length >= fromDesc.length ? fromCol : fromDesc;
  }
  if (rawCol && !looksLikeIbanOrAccount(rawCol)) {
    const fromCol = sanitizeOrdinanteNome(rawCol);
    if (fromCol) return fromCol;
  }
  return sanitizeOrdinanteNome(rawCol);
}

/**
 * Importo numerico da cella (IT: 1.234,56 / EN: 1234.56).
 * Su estratti BCC/XLS il valore numerico grezzo Excel (`v`) è spesso ×100 o ÷1000:
 * usare sempre il testo formattato (`w` / stringa IT), non il number grezzo.
 */
export function parseImportoBancario(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  // Number solo se già “euro” sensato (es. Avere=385 da CSV). Non usare i `v` BCC corrotti.
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return round2(Math.abs(raw));
  }
  let s = String(raw).replace(/[€$\s]/g, "").trim();
  if (!s) return 0;
  // Negativi tra parentesi o con segno
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  } else if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  // IT con migliaia: 1.234,56 / 10.255,07 / 42.000,00
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s) || /^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    // IT senza migliaia: 838,09
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    // EN con migliaia: 1,234.56
    s = s.replace(/,/g, "");
  } else {
    // Ultimo fallback: sola virgola decimale
    if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return round2(neg ? -Math.abs(n) : Math.abs(n));
}

/** Valore cella Excel: preferisci testo formattato (`w`) al number grezzo (`v`). */
export function excelCellDisplayValue(cell: XLSX.CellObject | undefined): unknown {
  if (cell == null) return "";
  if (cell.w != null && String(cell.w).trim() !== "") return String(cell.w);
  return cell.v ?? "";
}

/**
 * Per colonne data: preferisci il seriale Excel (`v`) al testo `w` (spesso m/d/yy US negli estratti BCC),
 * così la data resta YYYY-MM-DD coerente con il DB.
 */
export function excelCellValueForColumn(
  cell: XLSX.CellObject | undefined,
  columnName: string,
): unknown {
  if (cell == null) return "";
  if (/data|valuta/i.test(columnName) && cell.t === "n" && typeof cell.v === "number" && Number.isFinite(cell.v)) {
    // Seriali data Excel tipici (~1982–2064); evita di trattare importi piccoli come date
    if (cell.v >= 30000 && cell.v <= 60000) {
      const d = XLSX.SSF?.parse_date_code?.(cell.v);
      if (d && d.y >= 1990 && d.y <= 2100) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    }
  }
  return excelCellDisplayValue(cell);
}

/**
 * sheet_to_json che usa sempre `w` (display) quando presente.
 * Evita gli importi BCC dove v=83809 ma w=" 838,09 ".
 * Colonne data/valuta: seriale Excel → YYYY-MM-DD (non m/d/yy US del `w`).
 */
export function sheetRowsPreferDisplay(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const ref = sheet["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
    const raw = excelCellDisplayValue(sheet[addr]);
    headers.push(String(raw ?? "").replace(/^\uFEFF/, "").trim());
  }
  const out: Record<string, unknown>[] = [];
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    const row: Record<string, unknown> = {};
    let empty = true;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const key = headers[C - range.s.c];
      if (!key) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const val = excelCellValueForColumn(sheet[addr], key);
      if (val !== "" && val != null) empty = false;
      row[key] = val;
    }
    if (!empty) out.push(normalizeExcelRow(row));
  }
  return out;
}

/** Data movimento da cella (preferisce gg/mm/aaaa italiani e ISO). */
export function parseDataBancaria(raw: unknown): string {
  if (raw == null || raw === "") return todayISO();
  // Seriale Excel (quando cellDates:false): calendario senza timezone
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = XLSX.SSF?.parse_date_code?.(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // Mezzanotte locale (IT): usare componenti locali, non UTC (altrimenti giorno -1)
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  // Solo data ISO (yyyy-mm-dd); se c'è orario Z non usare il giorno UTC grezzo
  const isoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) return `${isoDateOnly[1]}-${isoDateOnly[2]}-${isoDateOnly[3]}`;
  const isoDateTime = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (isoDateTime) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return `${isoDateTime[1]}-${isoDateTime[2]}-${isoDateTime[3]}`;
  }
  // gg/mm/aaaa (estratti IT) — sempre interpretato come giorno/mese (non US)
  const it = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (it) {
    const y = it[3].length === 2 ? `20${it[3]}` : it[3];
    const day = Number(it[1]);
    const month = Number(it[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return todayISO();
}

export type ColonneEstratto = {
  data: string | null;
  importo: string | null;
  avere: string | null;
  dare: string | null;
  ordinante: string | null;
  descrizione: string | null;
  clienteId: string | null;
};

export function detectColonneEstratto(cols: string[]): ColonneEstratto {
  const find = (...res: RegExp[]) => cols.find((c) => res.some((re) => re.test(c))) || null;
  return {
    data:
      find(/valuta/i) ||
      find(/data\s*contabile/i) ||
      find(/^data$/i) ||
      find(/^data/i) ||
      cols[0] ||
      null,
    importo: find(/^importo$/i) || find(/importo|amount/i),
    avere: find(/^avere$/i) || find(/avere|accredito|^credito$/i),
    dare: find(/^dare$/i) || find(/dare|addebito|^debito$/i),
    // Evita "controparte" / colonne IBAN: spesso contengono solo coordinate conto
    ordinante:
      find(/^ordinante$/i) ||
      find(/^mittente$/i) ||
      find(/ordinante|mittente|nominativo|ragione\s*sociale/i) ||
      null,
    descrizione: find(/descri/i) || find(/causale|operazione/i),
    clienteId: find(/cliente\s*id/i),
  };
}

/**
 * Importo da riga estratto: colonna Importo, oppure Avere (entrate).
 * Solo Dare (uscite) → importo 0 con motivo solo_dare.
 */
export function resolveImportoEstratto(
  row: Record<string, unknown>,
  cols: ColonneEstratto,
): { importo: number; motivo?: string } {
  if (cols.importo) {
    const n = Math.abs(parseImportoBancario(row[cols.importo]));
    if (n > 0) return { importo: n };
    return { importo: 0, motivo: "importo_zero_o_invalido" };
  }
  const avere = cols.avere ? Math.abs(parseImportoBancario(row[cols.avere])) : 0;
  const dare = cols.dare ? Math.abs(parseImportoBancario(row[cols.dare])) : 0;
  if (avere > 0) return { importo: avere };
  if (dare > 0) return { importo: 0, motivo: "solo_dare" };
  return { importo: 0, motivo: "importo_zero_o_invalido" };
}

/** Etichette italiane per i motivi di scarto import. */
export const MOTIVO_SCARTO_LABEL: Record<string, string> = {
  solo_dare: "Uscita (Dare): non è un accredito — esclusa dall'import",
  duplicato:
    "Già presente in archivio (stessa data/importo/ordinante/descrizione, anche su altro conto)",
  importo_zero_o_invalido: "Importo mancante o non valido",
};

/** Sentinel per NULL SQL nella chiave vincolo (Postgres tratta i NULL come distinti). */
const CONSTRAINT_NULL = "\0";

/** Lunghezza minima descrizione normalizzata per la content-key (senza data). */
export const MIN_DESC_LEN_CONTENT_DEDUP = 24;

/** Normalizza descrizione per chiave anti-doppio (ignora IBAN / CRO / rumore spazi). */
export function normalizeDescrizioneDedup(desc: string | null | undefined): string {
  return String(desc || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b[A-Z]{2}\s?\d{2}(?:[\s]?[A-Z0-9]){11,30}\b/g, " ")
    .replace(/\b(?:CRO|TRN|CIG|CUP|ABI|CAB|BIC|SWIFT|ID[\s_]?BONIFICO)\s*[:\s]?\s*[A-Z0-9]+\b/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Chiave allineata a `uq_movimenti_bancari_dedup`
 * (data_movimento, importo, ordinante, md5(descrizione)) — globale, senza conto.
 * Usa descrizione/ordinante grezzi (come in insert); `""` ≡ NULL come in import.
 */
export function buildMovimentoConstraintDedupKey(r: {
  data_movimento: string;
  importo: number | null | undefined;
  descrizione?: string | null;
  ordinante?: string | null;
}): string {
  const imp = round2(Number(r.importo) || 0);
  const data = String(r.data_movimento || "").slice(0, 10);
  const ordRaw = String(r.ordinante ?? "").trim();
  const descRaw = String(r.descrizione ?? "").trim();
  const ord = ordRaw ? ordRaw : CONSTRAINT_NULL;
  const desc = descRaw ? descRaw : CONSTRAINT_NULL;
  return ["c", data, String(imp), ord, desc].join("\x1f");
}

/**
 * Chiave soft anti-doppio: conto + data + importo + descrizione normalizzata.
 * Non usa l'ordinante (può essere IBAN o nominativo a seconda del carico).
 * Copre anche movimenti già ricongiunti/incassati sullo stesso conto.
 * `data_movimento` va sempre come YYYY-MM-DD (slice 0,10).
 */
export function buildMovimentoDedupKey(r: {
  conto_bancario_id?: string | null;
  data_movimento: string;
  importo: number | null | undefined;
  descrizione?: string | null;
  ordinante?: string | null;
}): string {
  const imp = round2(Number(r.importo) || 0);
  const data = String(r.data_movimento || "").slice(0, 10);
  const desc = normalizeDescrizioneDedup(r.descrizione);
  // Se descrizione vuota, usa ordinante sanitizzato come fallback
  const fallback = desc || sanitizeOrdinanteNome(String(r.ordinante || "")).toUpperCase();
  // Soft: solo importo+data se descrizione (e fallback) troppo corta — evita falsi positivi su bonifici omonimi
  if (fallback.length < 8) {
    return [r.conto_bancario_id || "", data, String(imp), ""].join("|");
  }
  return [r.conto_bancario_id || "", data, String(imp), fallback].join("|");
}

/**
 * Chiave secondaria senza data: conto|importo|descrizione.
 * Usata solo se la descrizione normalizzata è abbastanza lunga (≥ MIN_DESC_LEN_CONTENT_DEDUP)
 * su entrambi i lati — cattura re-import con date storicamente parseate male (m/d vs d/m).
 * Non usata per descrizioni corte (rischio falso positivo su stesso importo).
 */
export function buildMovimentoContentDedupKey(r: {
  conto_bancario_id?: string | null;
  importo: number | null | undefined;
  descrizione?: string | null;
  ordinante?: string | null;
}): string | null {
  const imp = round2(Number(r.importo) || 0);
  const desc = normalizeDescrizioneDedup(r.descrizione);
  const fallback = desc || sanitizeOrdinanteNome(String(r.ordinante || "")).toUpperCase();
  if (fallback.length < MIN_DESC_LEN_CONTENT_DEDUP) return null;
  return [r.conto_bancario_id || "", String(imp), fallback].join("|");
}

/** True se la riga matcha un movimento già in archivio (vincolo DB, soft-key o content-key). */
export function isMovimentoDedupHit(
  r: {
    conto_bancario_id?: string | null;
    data_movimento: string;
    importo: number | null | undefined;
    descrizione?: string | null;
    ordinante?: string | null;
  },
  existingDedupKeys: Set<string>,
): boolean {
  if (existingDedupKeys.has(buildMovimentoConstraintDedupKey(r))) return true;
  if (existingDedupKeys.has(buildMovimentoDedupKey(r))) return true;
  const ck = buildMovimentoContentDedupKey(r);
  return ck != null && existingDedupKeys.has(ck);
}

/** True se l'errore PostgREST/Postgres è violazione di `uq_movimenti_bancari_dedup`. */
export function isMovimentiBancariDedupViolation(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = String(err.message || "");
  return (
    err.code === "23505" ||
    msg.includes("uq_movimenti_bancari_dedup") ||
    (msg.includes("duplicate key") && msg.includes("movimenti_bancari"))
  );
}

export function labelMotivoScarto(motivo: string | null | undefined): string {
  if (!motivo) return "Motivo non indicato";
  return MOTIVO_SCARTO_LABEL[motivo] || motivo;
}

export type PreviewRigaEstratto = {
  riga: number;
  data_movimento: string;
  importo: number | null;
  ordinante: string | null;
  descrizione: string | null;
  esito: "ok" | "scarto";
  motivo: string | null;
};

export type PreviewEstratto = {
  nomeFile: string;
  colonne: ColonneEstratto;
  righeFile: number;
  daImportare: number;
  scarti: number;
  scartiByMotivo: Record<string, number>;
  preview: PreviewRigaEstratto[];
  rawRows: Record<string, unknown>[];
};

/** Anteprima parsing; se `existingDedupKeys` è valorizzato marca i doppioni già in archivio/collegati. */
export function buildPreviewEstratto(
  fileName: string,
  rows: Record<string, unknown>[],
  opts?: { contoBancarioId?: string | null; existingDedupKeys?: Set<string> },
): PreviewEstratto {
  const cols = detectColonneEstratto(Object.keys(rows[0] || {}));
  const scartiByMotivo: Record<string, number> = {};
  let daImportare = 0;
  const preview: PreviewRigaEstratto[] = [];
  const seenInFile = new Set<string>();
  const existing = opts?.existingDedupKeys;
  const contoId = opts?.contoBancarioId || "";

  rows.forEach((r, idx) => {
    const riga = idx + 2;
    const descrizione = cols.descrizione ? String(r[cols.descrizione] ?? "").trim() : "";
    const ordinante =
      resolveOrdinanteImport(cols.ordinante ? String(r[cols.ordinante] ?? "") : "", descrizione) || null;
    const data_movimento = parseDataBancaria(cols.data ? r[cols.data] : null);
    const { importo, motivo } = resolveImportoEstratto(r, cols);
    if (!importo) {
      const m = motivo || "importo_zero_o_invalido";
      scartiByMotivo[m] = (scartiByMotivo[m] || 0) + 1;
      if (preview.length < 40) {
        preview.push({
          riga,
          data_movimento,
          importo: null,
          ordinante,
          descrizione: descrizione || null,
          esito: "scarto",
          motivo: m,
        });
      }
      return;
    }

    const dedupPayload = {
      conto_bancario_id: contoId,
      data_movimento,
      importo,
      descrizione,
      ordinante,
    };
    const dedupKey = buildMovimentoDedupKey(dedupPayload);
    const contentKey = buildMovimentoContentDedupKey(dedupPayload);
    const constraintKey = buildMovimentoConstraintDedupKey(dedupPayload);
    const dupInFile =
      seenInFile.has(dedupKey) ||
      seenInFile.has(constraintKey) ||
      (contentKey != null && seenInFile.has(contentKey));
    const dupInArchive = existing ? isMovimentoDedupHit(dedupPayload, existing) : false;
    if (dupInArchive || dupInFile) {
      scartiByMotivo.duplicato = (scartiByMotivo.duplicato || 0) + 1;
      if (preview.length < 40) {
        preview.push({
          riga,
          data_movimento,
          importo,
          ordinante,
          descrizione: descrizione || null,
          esito: "scarto",
          motivo: "duplicato",
        });
      }
      return;
    }
    seenInFile.add(dedupKey);
    seenInFile.add(constraintKey);
    if (contentKey) seenInFile.add(contentKey);

    daImportare += 1;
    if (preview.length < 40) {
      preview.push({
        riga,
        data_movimento,
        importo,
        ordinante,
        descrizione: descrizione || null,
        esito: "ok",
        motivo: null,
      });
    }
  });

  const scarti = Object.values(scartiByMotivo).reduce((s, n) => s + n, 0);
  return {
    nomeFile: fileName,
    colonne: cols,
    righeFile: rows.length,
    daImportare,
    scarti,
    scartiByMotivo,
    preview,
    rawRows: rows,
  };
}

const DEDUP_FETCH_PAGE = 1000;

/** Page size PostgREST per fetch multi-page di movimenti bancari (max tipico API = 1000). */
export const MOVIMENTI_BANCARI_PAGE_SIZE = 1000;

/**
 * Scarica tutte le pagine di una query PostgREST (range 0–999, 1000–1999, …)
 * finché una page restituisce meno di `pageSize` righe.
 * `fetchPage` deve applicare `.range(from, to)` e restituire `{ data, error }`.
 */
export async function fetchAllQueryPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  pageSize: number = MOVIMENTI_BANCARI_PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/** Sanitizza termine per filtri PostgREST `ilike` / `.or(...)` (evita wildcard e virgole). */
export function sanitizeIlikeTerm(raw: string): string {
  return String(raw || "")
    .replace(/[%*,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Carica chiavi dedup dei movimenti già presenti.
 * - Soft/content-key: tutti i movimenti del conto selezionato (qualsiasi stato).
 * - Constraint-key (`uq_movimenti_bancari_dedup`): movimenti con le date del file su QUALSIASI conto,
 *   perché l'indice unico DB è globale (non include conto_bancario_id).
 * `dates` filtra solo il fetch del vincolo; se assente/vuoto, il vincolo usa le date dei movimenti del conto.
 */
export async function fetchExistingMovimentoDedupKeys(
  contoBancarioId: string,
  dates?: string[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!contoBancarioId) return keys;

  const addRowKeys = (
    row: {
      conto_bancario_id?: string | null;
      data_movimento?: string | null;
      importo?: number | null;
      descrizione?: string | null;
      ordinante?: string | null;
    },
    opts?: { soft?: boolean; constraint?: boolean },
  ) => {
    const payload = {
      conto_bancario_id: row.conto_bancario_id,
      data_movimento: String(row.data_movimento || "").slice(0, 10),
      importo: Number(row.importo) || 0,
      descrizione: row.descrizione,
      ordinante: row.ordinante,
    };
    if (opts?.constraint !== false) {
      keys.add(buildMovimentoConstraintDedupKey(payload));
    }
    if (opts?.soft !== false) {
      keys.add(buildMovimentoDedupKey(payload));
      const ck = buildMovimentoContentDedupKey(payload);
      if (ck) keys.add(ck);
    }
  };

  const contoRows = await fetchAllQueryPages<{
    conto_bancario_id?: string | null;
    data_movimento?: string | null;
    importo?: number | null;
    descrizione?: string | null;
    ordinante?: string | null;
  }>(async (from, to) =>
    (supabase
      .from("movimenti_bancari" as any)
      .select("conto_bancario_id, data_movimento, importo, descrizione, ordinante")
      .eq("conto_bancario_id", contoBancarioId)
      .order("id", { ascending: true })
      .range(from, to)) as any,
  DEDUP_FETCH_PAGE);

  for (const row of contoRows) addRowKeys(row);

  const dateSet = new Set(
    (dates && dates.length > 0
      ? dates
      : contoRows.map((r) => String(r.data_movimento || "").slice(0, 10))
    ).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );
  const dateList = Array.from(dateSet);
  if (dateList.length === 0) return keys;

  // Vincolo globale: stesse date su altri conti (chunk per evitare URL PostgREST troppo lunghi)
  const DATE_CHUNK = 50;
  for (let i = 0; i < dateList.length; i += DATE_CHUNK) {
    const chunk = dateList.slice(i, i + DATE_CHUNK);
    const globalRows = await fetchAllQueryPages<{
      conto_bancario_id?: string | null;
      data_movimento?: string | null;
      importo?: number | null;
      descrizione?: string | null;
      ordinante?: string | null;
    }>(async (from, to) =>
      (supabase
        .from("movimenti_bancari" as any)
        .select("conto_bancario_id, data_movimento, importo, descrizione, ordinante")
        .in("data_movimento", chunk)
        .order("id", { ascending: true })
        .range(from, to)) as any,
    DEDUP_FETCH_PAGE);
    for (const row of globalRows) {
      // Soft keys solo per il conto target (già caricati); qui solo constraint
      if (row.conto_bancario_id === contoBancarioId) continue;
      addRowKeys(row, { soft: false, constraint: true });
    }
  }

  return keys;
}

/**
 * Inserisce movimenti a chunk; se il batch viola `uq_movimenti_bancari_dedup`,
 * riprova riga per riga e salta i duplicati invece di far fallire tutto il carico.
 */
export async function insertMovimentiBancariSkippingDedup(
  rows: Record<string, unknown>[],
  chunkSize = 200,
): Promise<{ inseriti: number; saltatiDedup: number }> {
  let inseriti = 0;
  let saltatiDedup = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("movimenti_bancari" as any).insert(slice as any);
    if (!error) {
      inseriti += slice.length;
      continue;
    }
    if (!isMovimentiBancariDedupViolation(error)) throw error;
    for (const row of slice) {
      const { error: rowErr } = await supabase.from("movimenti_bancari" as any).insert(row as any);
      if (!rowErr) {
        inseriti += 1;
      } else if (isMovimentiBancariDedupViolation(rowErr)) {
        saltatiDedup += 1;
      } else {
        throw rowErr;
      }
    }
  }
  return { inseriti, saltatiDedup };
}

/** @internal esposto per test della paginazione */
export const __DEDUP_FETCH_PAGE = DEDUP_FETCH_PAGE;

export function countByMotivo(motivi: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of motivi) {
    out[m] = (out[m] || 0) + 1;
  }
  return out;
}

/** Legge Excel o CSV (delimiter ; o ,) in righe oggetto. */
export async function readEstrattoBancarioRows(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || name.endsWith(".txt");
  let wb: XLSX.WorkBook;

  if (isCsv) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    // Fallback se file Windows-1252 con caratteri rotti
    if ((text.match(/\uFFFD/g) || []).length > 5) {
      text = new TextDecoder("windows-1252").decode(buf);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const semi = (firstLine.match(/;/g) || []).length;
    const comma = (firstLine.match(/,/g) || []).length;
    const FS = semi > comma ? ";" : ",";
    // raw:true obbligatorio sui CSV IT: senza, SheetJS interpreta gg/mm/aaaa come mm/dd
    // (03/08/2026 → 8 marzo) e "203,49" → 20349. Le stringhe restano per parseData/Importo.
    wb = XLSX.read(text, { type: "string", FS, cellDates: false, raw: true });
  } else {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array", cellDates: false });
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  // Preferisci sempre testo formattato cella (`w`): su BCC XLS il `v` numerico è ×100/÷1000
  return sheetRowsPreferDisplay(sheet);
}

/** Conti bancari visibili per una sede (per filtrare movimenti). */
export async function fetchContoIdsForUfficio(ufficioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("conto_bancario_id")
    .eq("ufficio_id", ufficioId);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => r.conto_bancario_id as string);
}

/** Primo ufficio collegato al conto (per ufficio_id su import senza cliente). */
export async function resolveUfficioFromConto(contoBancarioId: string): Promise<string | null> {
  const { data } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoBancarioId)
    .limit(1)
    .maybeSingle();
  return (data as any)?.ufficio_id ?? null;
}

export interface FinalizeMovimentoParams {
  movimentoId: string;
  clienteId: string;
  contoBancarioId: string | null;
  dataMessaCassa: string;
  anticipoImporto: number;
  ammancoImporto: number;
  polizzeLineIds: string[];
  userId: string | null;
  note?: string | null;
}

/**
 * Dopo messa a cassa da ricongiungimento: acconto eccedenza, ammanco contabile, chiusura movimento.
 */
export async function finalizeMovimentoBancarioIncasso(p: FinalizeMovimentoParams): Promise<void> {
  const today = p.dataMessaCassa || new Date().toISOString().slice(0, 10);

  if (p.polizzeLineIds.length > 0) {
    const { error: errMp } = await supabase
      .from("movimenti_polizze" as any)
      .update({ messo_a_cassa: true, data_messa_cassa: today } as any)
      .in("id", p.polizzeLineIds)
      .eq("tipo", "polizza");
    if (errMp) throw errMp;
  }

  const ant = round2(Number(p.anticipoImporto) || 0);
  if (ant > 0) {
    let causaleId: string | null = null;
    // Surplus bonifico → acconto cliente (ECCED disattivata; solo ACC_*)
    for (const codice of ["ACC_CRED", "ACC_STOR"]) {
      const { data: c } = await supabase
        .from("causali_contabili" as any)
        .select("id")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .eq("codice", codice)
        .eq("attivo", true)
        .maybeSingle();
      if ((c as any)?.id) {
        causaleId = (c as any).id;
        break;
      }
    }
    if (!causaleId) throw new Error("Causale contabile ACC_CRED/ACC_STOR non trovata per acconto da bonifico");

    const { error: errAnt } = await supabase.from("cliente_anticipi" as any).insert({
      cliente_id: p.clienteId,
      conto_bancario_id: p.contoBancarioId,
      movimento_bancario_id: p.movimentoId,
      data_anticipo: today,
      importo: ant,
      importo_residuo: ant,
      causale_id: causaleId,
      segno: "+",
      note: p.note ?? `Acconto da surplus bonifico ${p.movimentoId.slice(0, 8)}`,
      creato_da: p.userId,
    } as any);
    if (errAnt) throw errAnt;
  }

  const amm = round2(Number(p.ammancoImporto) || 0);
  if (amm > 0) {
    const { data: mov } = await supabase
      .from("movimenti_bancari" as any)
      .select("ufficio_id")
      .eq("id", p.movimentoId)
      .maybeSingle();
    const ufficioId = (mov as any)?.ufficio_id ?? null;
    const { error: errMc } = await supabase.from("movimenti_contabili" as any).insert({
      ufficio_id: ufficioId,
      tipo: "uscita",
      categoria: "ammanco_ricongiungimento",
      riferimento_tipo: "movimento_bancario",
      riferimento_id: p.movimentoId,
      importo: amm,
      data_movimento: today,
      descrizione: `Ammanco bonifico (${p.movimentoId.slice(0, 8)})`,
      stato: "registrato",
      created_by: p.userId,
    } as any);
    if (errMc) throw errMc;
  }

  const { error: errMb } = await supabase
    .from("movimenti_bancari" as any)
    .update({ stato: "incassato" } as any)
    .eq("id", p.movimentoId);
  if (errMb) throw errMb;
}

/** Assegna pagatore (cliente pre-matchato) al movimento. */
export async function assegnaPagatoreMovimento(
  movimentoId: string,
  clienteId: string,
  ufficioId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("movimenti_bancari" as any)
    .update({
      cliente_id: clienteId,
      ufficio_id: ufficioId,
      stato: "assegnato",
    } as any)
    .eq("id", movimentoId);
  if (error) throw error;
}
