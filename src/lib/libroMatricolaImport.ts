import * as XLSX from "xlsx";

export type LookupOpt = { value: string; label: string; codice?: string; descrizione?: string };

/** Shape imported into the grid (mirrors LibroMatricolaRiga without importing the dialog). */
export type LibroMatricolaImportBase = {
  n_progressivo?: number;
  targa: string;
  tipologia: string;
  descrizione: string;
  usoId: string;
  data_immatricolazione: string;
  data_inclusione: string;
  data_esclusione: string;
  note: string;
};

export type LibroMatricolaImportPreviewRow = LibroMatricolaImportBase & {
  _rowNum: number;
  _ok: boolean;
  _errors: string[];
};

function emptyImportRiga(): LibroMatricolaImportBase {
  return {
    targa: "",
    tipologia: "",
    descrizione: "",
    usoId: "",
    data_immatricolazione: "",
    data_inclusione: "",
    data_esclusione: "",
    note: "",
  };
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v).trim();
  return String(v).trim();
}

function excelDateToIso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && Number.isFinite(v)) {
    const utc = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  const s = cellStr(v);
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTipologia(raw: string, opts: LookupOpt[]): string {
  if (!raw) return "";
  const n = norm(raw);
  const byCode = opts.find((o) => norm(o.value) === n);
  if (byCode) return byCode.value;
  const byLabel = opts.find((o) => {
    const lab = norm(o.label);
    return lab === n || lab.includes(n) || n.includes(lab);
  });
  return byLabel?.value || "";
}

function matchUso(raw: string, opts: LookupOpt[]): string {
  if (!raw) return "";
  const n = norm(raw);
  const byId = opts.find((o) => o.value === raw);
  if (byId) return byId.value;
  const byCodice = opts.find((o) => o.codice && norm(o.codice) === n);
  if (byCodice) return byCodice.value;
  const byLabel = opts.find((o) => {
    const lab = norm(o.label);
    const desc = o.descrizione ? norm(o.descrizione) : "";
    return lab === n || desc === n || lab.includes(n) || (desc && desc.includes(n));
  });
  return byLabel?.value || "";
}

type FieldKey = keyof LibroMatricolaImportBase;

const HEADER_MAP: Record<string, FieldKey> = {
  n: "n_progressivo",
  "n°": "n_progressivo",
  "n.": "n_progressivo",
  progressivo: "n_progressivo",
  "n progressivo": "n_progressivo",
  "n° progressivo": "n_progressivo",
  targa: "targa",
  tipologia: "tipologia",
  "tipo veicolo": "tipologia",
  tipo: "tipologia",
  descrizione: "descrizione",
  uso: "usoId",
  "data immatricolazione": "data_immatricolazione",
  immatricolazione: "data_immatricolazione",
  "data inclusione": "data_inclusione",
  inclusione: "data_inclusione",
  "data esclusione": "data_esclusione",
  esclusione: "data_esclusione",
  note: "note",
};

function mapHeader(h: string): FieldKey | null {
  const key = norm(h).replace(/:$/, "");
  return HEADER_MAP[key] || null;
}

export function parseLibroMatricolaExcel(
  buffer: ArrayBuffer,
  tipologiaOpts: LookupOpt[],
  usoOpts: LookupOpt[],
): LibroMatricolaImportPreviewRow[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (!aoa.length) return [];

  const headerRow = (aoa[0] || []).map((h) => cellStr(h));
  const colMap: (FieldKey | null)[] = headerRow.map(mapHeader);
  const hasMapped = colMap.some(Boolean);
  const fixed: FieldKey[] | null = !hasMapped
    ? [
        "n_progressivo",
        "targa",
        "tipologia",
        "descrizione",
        "usoId",
        "data_immatricolazione",
        "data_inclusione",
        "data_esclusione",
        "note",
      ]
    : null;

  const out: LibroMatricolaImportPreviewRow[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const base = emptyImportRiga();
    let nProg: number | undefined;
    const errors: string[] = [];

    const setField = (field: FieldKey, raw: unknown) => {
      if (field === "n_progressivo") {
        const n = Number(cellStr(raw));
        if (Number.isFinite(n) && n > 0) nProg = Math.trunc(n);
        return;
      }
      if (field === "data_immatricolazione" || field === "data_inclusione" || field === "data_esclusione") {
        base[field] = excelDateToIso(raw);
        return;
      }
      if (field === "tipologia") {
        const rawS = cellStr(raw);
        const matched = matchTipologia(rawS, tipologiaOpts);
        base.tipologia = matched;
        if (rawS && !matched) errors.push(`Tipologia non trovata: "${rawS}"`);
        return;
      }
      if (field === "usoId") {
        const rawS = cellStr(raw);
        const matched = matchUso(rawS, usoOpts);
        base.usoId = matched;
        if (rawS && !matched) errors.push(`Uso non trovato: "${rawS}"`);
        return;
      }
      if (field === "targa") {
        base.targa = cellStr(raw).toUpperCase();
        return;
      }
      if (field === "descrizione" || field === "note") {
        base[field] = cellStr(raw);
      }
    };

    if (fixed) {
      fixed.forEach((f, ci) => setField(f, row[ci]));
    } else {
      colMap.forEach((f, ci) => {
        if (f) setField(f, row[ci]);
      });
    }

    const empty =
      !base.targa &&
      !base.tipologia &&
      !base.descrizione &&
      !base.usoId &&
      !base.data_immatricolazione &&
      !base.data_inclusione &&
      !base.data_esclusione &&
      !base.note;
    if (empty) continue;

    if (!base.targa) errors.push("Targa mancante");

    out.push({
      ...base,
      n_progressivo: nProg,
      _rowNum: i + 1,
      _ok: errors.length === 0,
      _errors: errors,
    });
  }

  return out;
}

export function downloadLibroMatricolaTemplate() {
  const rows = [
    {
      "N°": 1,
      Targa: "AB123CD",
      Tipologia: "Autovettura",
      Descrizione: "Fiat Panda",
      Uso: "Privato",
      "Data immatricolazione": "01/01/2020",
      "Data inclusione": "01/01/2026",
      "Data esclusione": "",
      Note: "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mezzi");
  XLSX.writeFile(wb, "template_libro_matricola.xlsx");
}
