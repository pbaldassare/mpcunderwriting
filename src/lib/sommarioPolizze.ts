import { format } from "date-fns";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnalisiCgaDettaglio, AnalisiGaranziaRow, AnalisiPolizzaRow } from "@/lib/portafoglioClienteAnalisi";

export const SOMMARIO_STORAGE_BUCKET = "documenti_clienti";
export const SOMMARIO_STORAGE_FOLDER = "sommario";
export const VARESE_CLIENTE_ID = "94dc5a3c-1682-4aea-a9e2-190bf8bf34b1";
export const VARESE_TEMPLATE_PUBLIC_PATH = "/templates/sommario_polizze_comune_varese.docx";
export const VARESE_TEMPLATE_FILENAME = "SOMMARIO_POLIZZE_COMUNE_VARESE.docx";
export const VARESE_TEMPLATE_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SOMMARIO_NOTA_BENE = [
  "Il presente sommario riporta in sintesi i dati salienti delle polizze stipulate.",
  "Farà fede in caso di errata interpretazione od a completamento delle norme che regolano l'assicurazione, esclusivamente l'originale della Polizza di vostra spettanza (Copia Contraente), da Voi sottoscritto e consegnato all'atto della stipula dei contratti.",
] as const;

export type SommarioLayoutKey = "standard" | "varese";

export type SommarioSummaryColumn =
  | "compagnia"
  | "prodotto"
  | "numero_polizza"
  | "scadenza"
  | "frazionamento"
  | "premio_lordo";

export type SommarioLayoutJson = {
  version: 1;
  summaryColumns: SommarioSummaryColumn[];
  includeNotaBene: boolean;
  includeDettaglio: boolean;
  includeCga: boolean;
};

export const DEFAULT_SOMMARIO_LAYOUT: SommarioLayoutJson = {
  version: 1,
  summaryColumns: [
    "compagnia",
    "prodotto",
    "numero_polizza",
    "scadenza",
    "frazionamento",
    "premio_lordo",
  ],
  includeNotaBene: true,
  includeDettaglio: true,
  includeCga: true,
};

export const SOMMARIO_SUMMARY_LABELS: Record<SommarioSummaryColumn, string> = {
  compagnia: "Compagnia",
  prodotto: "Prodotto",
  numero_polizza: "Numero Polizza",
  scadenza: "Data scadenza contratto",
  frazionamento: "Fraz.",
  premio_lordo: "Premio annuo lordo",
};

export type ClienteTemplateSommarioRow = {
  id: string;
  cliente_id: string;
  layout_key: SommarioLayoutKey;
  nome_file: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  layout_json: SommarioLayoutJson;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type SommarioPolizzaRow = AnalisiPolizzaRow & {
  frazionamento?: string | null;
  periodicita?: string | null;
  disdetta_giorni?: number | null;
  mora_giorni?: number | null;
  limite_mora?: string | null;
  descrizione_polizza?: string | null;
  is_regolazione?: boolean | null;
  regolazione?: boolean | null;
  regolazione_fattore?: string | null;
  regolazione_note?: string | null;
};

export type SommarioSummaryRow = {
  compagnia: string;
  prodotto: string;
  numero_polizza: string;
  scadenza: string;
  frazionamento: string;
  premio_lordo: string;
  premio_lordo_num: number;
};

export type SommarioDettaglioPolizza = {
  indice: number;
  titolo: string;
  numero: string;
  compagnia: string;
  scadenza: string;
  premio: string;
  franchigia: string;
  disdetta: string;
  rateazione: string;
  mora: string;
  regolazione: string;
  oggetto: string | null;
  garanzie: Array<{
    garanzia: string;
    massimale: string;
    franchigia: string;
    scoperto: string;
  }>;
  condizioni: Array<{ titolo: string; testo: string }>;
};

const VARESE_PIVA = new Set(["00441340122", "00441340121"]);

export function normalizePartitaIva(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, "");
}

export function isComuneDiVarese(cliente: {
  id?: string | null;
  ragione_sociale?: string | null;
  partita_iva?: string | null;
}): boolean {
  if (cliente.id === VARESE_CLIENTE_ID) return true;
  const rs = (cliente.ragione_sociale || "").trim().toLowerCase();
  if (rs === "comune di varese") return true;
  return VARESE_PIVA.has(normalizePartitaIva(cliente.partita_iva));
}

export function defaultLayoutKeyForCliente(cliente: {
  id?: string | null;
  ragione_sociale?: string | null;
  partita_iva?: string | null;
}): SommarioLayoutKey {
  return isComuneDiVarese(cliente) ? "varese" : "standard";
}

export function parseSommarioLayoutJson(raw: unknown): SommarioLayoutJson {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const cols = Array.isArray(obj.summaryColumns)
    ? (obj.summaryColumns.filter((c): c is SommarioSummaryColumn =>
        typeof c === "string" && c in SOMMARIO_SUMMARY_LABELS,
      ))
    : [];
  return {
    version: 1,
    summaryColumns: cols.length ? cols : DEFAULT_SOMMARIO_LAYOUT.summaryColumns,
    includeNotaBene: obj.includeNotaBene !== false,
    includeDettaglio: obj.includeDettaglio !== false,
    includeCga: obj.includeCga !== false,
  };
}

export function sommarioStoragePath(clienteId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "template.docx";
  return `${SOMMARIO_STORAGE_FOLDER}/${clienteId}/${safe}`;
}

export function fmtSommarioEur(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function fmtSommarioDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export function formatFrazionamento(
  frazionamento?: string | null,
  periodicita?: string | null,
): string {
  const v = (frazionamento || periodicita || "").trim();
  return v || "—";
}

export function formatDisdetta(giorni?: number | null): string {
  if (giorni == null || Number.isNaN(Number(giorni))) return "—";
  return `${Number(giorni)} gg`;
}

export function formatMora(giorni?: number | null, limite?: string | null): string {
  if (giorni != null && !Number.isNaN(Number(giorni))) return `${Number(giorni)} gg`;
  const lim = (limite || "").trim();
  return lim || "—";
}

export function formatRegolazione(p: Pick<
  SommarioPolizzaRow,
  "regolazione_note" | "regolazione_fattore" | "regolazione" | "is_regolazione"
>): string {
  const note = (p.regolazione_note || "").trim();
  if (note) return note;
  const fattore = (p.regolazione_fattore || "").trim();
  if (fattore) return fattore;
  if (p.regolazione || p.is_regolazione) return "Soggetta a regolazione del premio";
  return "Polizza non soggetta alla Regolazione del Premio";
}

export function prodottoSommarioLabel(p: SommarioPolizzaRow): string {
  return (p.prodotto_nome || p.ramo_nome || "Polizza").trim() || "Polizza";
}

export function pickFranchigiaPrincipale(
  cga: AnalisiCgaDettaglio | null | undefined,
  garanzie: AnalisiGaranziaRow[] | undefined,
): string {
  const fromCga = (cga?.garanzie || []).find((g) => g.franchigia != null);
  if (fromCga?.franchigia != null) return fmtSommarioEur(fromCga.franchigia);
  const fromGest = (garanzie || []).find((g) => g.capitale != null && /franchig/i.test(g.garanzia || ""));
  if (fromGest?.capitale != null) return fmtSommarioEur(fromGest.capitale);
  return "—";
}

export function pickOggettoPolizza(
  p: SommarioPolizzaRow,
  cga: AnalisiCgaDettaglio | null | undefined,
): string | null {
  const desc = (p.descrizione_polizza || "").trim();
  if (desc) return desc;
  const sommario = (cga?.sommario || "").trim();
  return sommario || null;
}

export function buildSommarioSummaryRows(polizze: SommarioPolizzaRow[]): SommarioSummaryRow[] {
  return polizze.map((p) => ({
    compagnia: (p.compagnia_nome || "").trim() || "—",
    prodotto: prodottoSommarioLabel(p),
    numero_polizza: (p.numero_titolo || "").trim() || "—",
    scadenza: fmtSommarioDate(p.garanzia_a || p.data_scadenza),
    frazionamento: formatFrazionamento(p.frazionamento, p.periodicita),
    premio_lordo: fmtSommarioEur(p.premio_lordo),
    premio_lordo_num: Number(p.premio_lordo) || 0,
  }));
}

export function mergeCgaByTitolo(
  polizze: SommarioPolizzaRow[],
  cgaDettagli: AnalisiCgaDettaglio[],
): Map<string, AnalisiCgaDettaglio> {
  const byTitolo = new Map<string, AnalisiCgaDettaglio>();
  const byNumero = new Map<string, AnalisiCgaDettaglio>();
  for (const c of cgaDettagli) {
    if (c.titolo_id && !byTitolo.has(c.titolo_id)) byTitolo.set(c.titolo_id, c);
    const num = (c.numero_polizza || "").trim();
    if (num && !byNumero.has(num)) byNumero.set(num, c);
  }
  const out = new Map<string, AnalisiCgaDettaglio>();
  for (const p of polizze) {
    const hit = byTitolo.get(p.id) || byNumero.get((p.numero_titolo || "").trim());
    if (hit) out.set(p.id, hit);
  }
  return out;
}

export function buildSommarioDettaglioPolizze(opts: {
  polizze: SommarioPolizzaRow[];
  garanzie: AnalisiGaranziaRow[];
  cgaDettagli: AnalisiCgaDettaglio[];
  includeCga?: boolean;
}): SommarioDettaglioPolizza[] {
  const includeCga = opts.includeCga !== false;
  const cgaByTitolo = mergeCgaByTitolo(opts.polizze, opts.cgaDettagli);
  const garByTitolo = new Map<string, AnalisiGaranziaRow[]>();
  for (const g of opts.garanzie) {
    (garByTitolo.get(g.titolo_id) || garByTitolo.set(g.titolo_id, []).get(g.titolo_id)!).push(g);
  }

  return opts.polizze.map((p, i) => {
    const cga = includeCga ? cgaByTitolo.get(p.id) : undefined;
    const gest = garByTitolo.get(p.id) || [];
    const garanzie = (cga?.garanzie?.length
      ? cga.garanzie.map((g) => ({
          garanzia: g.garanzia || "—",
          massimale: g.massimale != null ? fmtSommarioEur(g.massimale) : "—",
          franchigia: g.franchigia != null ? fmtSommarioEur(g.franchigia) : "—",
          scoperto: g.scoperto != null ? `${g.scoperto}%` : "—",
        }))
      : gest.map((g) => ({
          garanzia: g.garanzia || "—",
          massimale: g.capitale != null ? fmtSommarioEur(g.capitale) : "—",
          franchigia: "—",
          scoperto: "—",
        })));

    const condizioni = includeCga
      ? (cga?.condizioni || [])
          .filter((c) => (c.testo || "").trim())
          .slice(0, 8)
          .map((c) => ({
            titolo: (c.titolo || c.tipo || "Condizione").trim(),
            testo: c.testo.trim(),
          }))
      : [];

    return {
      indice: i + 1,
      titolo: prodottoSommarioLabel(p).toUpperCase(),
      numero: (p.numero_titolo || "").trim() || "—",
      compagnia: (p.compagnia_nome || "").trim() || "—",
      scadenza: fmtSommarioDate(p.garanzia_a || p.data_scadenza),
      premio: fmtSommarioEur(p.premio_lordo),
      franchigia: pickFranchigiaPrincipale(cga, gest),
      disdetta: formatDisdetta(p.disdetta_giorni),
      rateazione: formatFrazionamento(p.frazionamento, p.periodicita),
      mora: formatMora(p.mora_giorni, p.limite_mora),
      regolazione: formatRegolazione(p),
      oggetto: pickOggettoPolizza(p, cga),
      garanzie,
      condizioni,
    };
  });
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 40, right: 36, bottom: 48, left: 36 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;
const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.65, 0.65, 0.65),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
  band: rgb(0.043, 0.298, 0.314),
  rowAlt: rgb(0.96, 0.97, 0.97),
  totBg: rgb(0.78, 0.84, 0.81),
  boxBg: rgb(0.97, 0.98, 0.98),
};

type PdfCtx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pageNum: number;
};

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`;
      if (font.widthOfTextAtSize(next, size) <= maxW) line = next;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

function truncate(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let s = text;
  while (s.length && font.widthOfTextAtSize(`${s}…`, size) > maxW) s = s.slice(0, -1);
  return s ? `${s}…` : "";
}

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pageNum += 1;
  ctx.y = A4.h - MARGIN.top;
  ctx.page.drawText(String(ctx.pageNum), {
    x: A4.w / 2 - 6,
    y: 22,
    size: 8,
    font: ctx.font,
    color: COLOR.muted,
  });
}

function ensure(ctx: PdfCtx, h: number) {
  if (ctx.y - h < MARGIN.bottom + 8) newPage(ctx);
}

function drawWrapped(
  ctx: PdfCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; maxW?: number; gap?: number } = {},
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? COLOR.text;
  const maxW = opts.maxW ?? CONTENT_W;
  const gap = opts.gap ?? 2;
  for (const ln of wrap(text, font, size, maxW)) {
    ensure(ctx, size + gap + 2);
    ctx.page.drawText(ln, { x: MARGIN.left, y: ctx.y - size, size, font, color });
    ctx.y -= size + gap;
  }
}

export async function buildPdfSommarioCliente(opts: {
  clienteLabel: string;
  polizze: SommarioPolizzaRow[];
  garanzie: AnalisiGaranziaRow[];
  cgaDettagli: AnalisiCgaDettaglio[];
  layout?: SommarioLayoutJson | null;
  meta?: { codiceFiscale?: string | null; partitaIva?: string | null } | null;
}): Promise<Uint8Array> {
  const layout = parseSommarioLayoutJson(opts.layout);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: PdfCtx = { doc, page, y: A4.h - MARGIN.top, font, bold, pageNum: 1 };
  ctx.page.drawText("1", { x: A4.w / 2 - 6, y: 22, size: 8, font, color: COLOR.muted });

  ctx.page.drawRectangle({
    x: MARGIN.left,
    y: ctx.y - 28,
    width: CONTENT_W,
    height: 28,
    color: COLOR.band,
  });
  ctx.page.drawText("SOMMARIO POLIZZE", {
    x: MARGIN.left + 10,
    y: ctx.y - 18,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });
  ctx.y -= 40;

  drawWrapped(ctx, opts.clienteLabel, { size: 13, bold: true });
  const ids = [
    opts.meta?.partitaIva ? `P.IVA ${opts.meta.partitaIva}` : null,
    opts.meta?.codiceFiscale ? `CF ${opts.meta.codiceFiscale}` : null,
  ].filter(Boolean);
  if (ids.length) drawWrapped(ctx, ids.join("  ·  "), { size: 8, color: COLOR.muted });
  drawWrapped(ctx, format(new Date(), "dd/MM/yyyy"), { size: 9, color: COLOR.muted });
  ctx.y -= 8;

  if (layout.includeNotaBene) {
    drawWrapped(ctx, "NOTA BENE", { size: 10, bold: true, color: COLOR.headerText });
    ctx.y -= 2;
    for (const p of SOMMARIO_NOTA_BENE) {
      drawWrapped(ctx, p, { size: 8, color: COLOR.muted, gap: 3 });
    }
    ctx.y -= 10;
  }

  const summary = buildSommarioSummaryRows(opts.polizze);
  const cols = layout.summaryColumns.map((key) => {
    const widths: Record<SommarioSummaryColumn, number> = {
      compagnia: 108,
      prodotto: 118,
      numero_polizza: 88,
      scadenza: 78,
      frazionamento: 48,
      premio_lordo: 82,
    };
    return { key, title: SOMMARIO_SUMMARY_LABELS[key], w: widths[key], align: key === "premio_lordo" ? "right" as const : "left" as const };
  });
  const colSum = cols.reduce((s, c) => s + c.w, 0);
  if (colSum !== CONTENT_W && cols.length) {
    cols[cols.length - 1].w += CONTENT_W - colSum;
  }

  const drawHeader = () => {
    ensure(ctx, 18);
    const yTop = ctx.y;
    ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
    let cx = MARGIN.left;
    for (const col of cols) {
      const label = truncate(col.title, bold, 6.5, col.w - 6);
      let tx = cx + 3;
      if (col.align === "right") tx = cx + col.w - 3 - bold.widthOfTextAtSize(label, 6.5);
      ctx.page.drawText(label, { x: tx, y: yTop - 10, size: 6.5, font: bold, color: COLOR.headerText });
      cx += col.w;
    }
    ctx.y = yTop - 16;
  };

  drawWrapped(ctx, "Polizze vigenti", { size: 11, bold: true, color: COLOR.headerText });
  ctx.y -= 4;
  drawHeader();

  if (!summary.length) {
    ensure(ctx, 22);
    ctx.page.drawText("Nessuna polizza in portafoglio per questo cliente.", {
      x: MARGIN.left + 6,
      y: ctx.y - 12,
      size: 9,
      font,
      color: COLOR.muted,
    });
    ctx.y -= 24;
  } else {
    summary.forEach((row, i) => {
      const cells = cols.map((c) => row[c.key]);
      ensure(ctx, 16);
      if (ctx.y < MARGIN.bottom + 36) {
        newPage(ctx);
        drawHeader();
      }
      const yTop = ctx.y;
      if (i % 2 === 1) {
        ctx.page.drawRectangle({
          x: MARGIN.left,
          y: yTop - 14,
          width: CONTENT_W,
          height: 14,
          color: COLOR.rowAlt,
        });
      }
      let cx = MARGIN.left;
      cells.forEach((txt, ci) => {
        const col = cols[ci];
        const shown = truncate(txt, font, 7, col.w - 6);
        let tx = cx + 3;
        if (col.align === "right") tx = cx + col.w - 3 - font.widthOfTextAtSize(shown, 7);
        ctx.page.drawText(shown, { x: tx, y: yTop - 10, size: 7, font, color: COLOR.text });
        cx += col.w;
      });
      ctx.y = yTop - 14;
    });

    const totPremi = summary.reduce((s, r) => s + r.premio_lordo_num, 0);
    ensure(ctx, 20);
    const yTop = ctx.y;
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: yTop - 16,
      width: CONTENT_W,
      height: 16,
      color: COLOR.totBg,
    });
    ctx.page.drawText(`Totale premio annuo lordo: ${fmtSommarioEur(totPremi)}`, {
      x: MARGIN.left + 6,
      y: yTop - 11,
      size: 8,
      font: bold,
      color: COLOR.headerText,
    });
    ctx.y = yTop - 26;
  }

  if (layout.includeDettaglio && opts.polizze.length) {
    const dettagli = buildSommarioDettaglioPolizze({
      polizze: opts.polizze,
      garanzie: opts.garanzie,
      cgaDettagli: opts.cgaDettagli,
      includeCga: layout.includeCga,
    });

    newPage(ctx);
    drawWrapped(ctx, "POLIZZE VIGENTI", { size: 13, bold: true, color: COLOR.headerText });
    ctx.y -= 8;

    for (const d of dettagli) {
      ensure(ctx, 92);
      ctx.page.drawRectangle({
        x: MARGIN.left,
        y: ctx.y - 16,
        width: CONTENT_W,
        height: 16,
        color: COLOR.band,
      });
      ctx.page.drawText(
        truncate(`${d.indice}  ${d.titolo}`, bold, 9, CONTENT_W - 12),
        { x: MARGIN.left + 6, y: ctx.y - 11, size: 9, font: bold, color: rgb(1, 1, 1) },
      );
      ctx.y -= 20;

      const kv = [
        ["N°", d.numero],
        ["Compagnia", d.compagnia],
        ["Scadenza", d.scadenza],
        ["Premio", d.premio],
        ["Franchigia", d.franchigia],
        ["Disdetta", d.disdetta],
        ["Rateazione", d.rateazione],
        ["Mora", d.mora],
      ];
      for (let i = 0; i < kv.length; i += 4) {
        const slice = kv.slice(i, i + 4);
        ensure(ctx, 22);
        const cellW = CONTENT_W / slice.length;
        slice.forEach(([lab, val], j) => {
          const x = MARGIN.left + j * cellW;
          ctx.page.drawText(lab, { x: x + 3, y: ctx.y - 8, size: 6.5, font, color: COLOR.muted });
          ctx.page.drawText(truncate(val, bold, 8, cellW - 8), {
            x: x + 3,
            y: ctx.y - 18,
            size: 8,
            font: bold,
            color: COLOR.text,
          });
        });
        ctx.y -= 24;
      }

      ensure(ctx, 18);
      ctx.page.drawText("Regolazione del Premio", {
        x: MARGIN.left,
        y: ctx.y - 8,
        size: 7,
        font,
        color: COLOR.muted,
      });
      ctx.y -= 10;
      drawWrapped(ctx, d.regolazione, { size: 8 });
      ctx.y -= 6;

      if (d.oggetto) {
        drawWrapped(ctx, "Oggetto dell'Assicurazione", { size: 9, bold: true, color: COLOR.headerText });
        ctx.y -= 2;
        drawWrapped(ctx, d.oggetto, { size: 8, gap: 2 });
        ctx.y -= 6;
      }

      if (d.garanzie.length) {
        drawWrapped(ctx, "Garanzie / limiti", { size: 9, bold: true, color: COLOR.headerText });
        ctx.y -= 2;
        const gcols = [
          { t: "Garanzia", w: 180 },
          { t: "Massimale", w: 110 },
          { t: "Franchigia", w: 110 },
          { t: "Scoperto", w: CONTENT_W - 400 },
        ];
        ensure(ctx, 14);
        let gx = MARGIN.left;
        ctx.page.drawRectangle({
          x: MARGIN.left,
          y: ctx.y - 12,
          width: CONTENT_W,
          height: 12,
          color: COLOR.headerBg,
        });
        for (const c of gcols) {
          ctx.page.drawText(c.t, { x: gx + 3, y: ctx.y - 9, size: 6.5, font: bold, color: COLOR.headerText });
          gx += c.w;
        }
        ctx.y -= 14;
        for (const g of d.garanzie.slice(0, 18)) {
          ensure(ctx, 12);
          const vals = [g.garanzia, g.massimale, g.franchigia, g.scoperto];
          let cx = MARGIN.left;
          vals.forEach((v, i) => {
            ctx.page.drawText(truncate(v, font, 7, gcols[i].w - 6), {
              x: cx + 3,
              y: ctx.y - 9,
              size: 7,
              font,
              color: COLOR.text,
            });
            cx += gcols[i].w;
          });
          ctx.y -= 12;
        }
        ctx.y -= 6;
      }

      if (d.condizioni.length) {
        for (const c of d.condizioni) {
          drawWrapped(ctx, c.titolo, { size: 9, bold: true, color: COLOR.headerText });
          drawWrapped(ctx, c.testo.length > 900 ? `${c.testo.slice(0, 900)}…` : c.testo, { size: 7.5, color: COLOR.muted, gap: 2 });
          ctx.y -= 4;
        }
      }

      ctx.y -= 10;
    }
  }

  return doc.save();
}
