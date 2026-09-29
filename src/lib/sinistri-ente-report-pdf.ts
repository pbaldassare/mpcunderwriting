import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import type {
  EnteInfo,
  SinistroPdfRow,
  SinPerRamoRow,
  SinistriReportKpis,
} from "./sinistriEnteReportData";

export interface SinistriEnteReportData {
  ente: EnteInfo;
  titolo: string;
  generatedAt: string;
  generatedBy: string;
  filterLines: string[];
  kpis: SinistriReportKpis;
  sinPerRamo: SinPerRamoRow[];
  sinistri: SinistroPdfRow[];
  chartImageBytes?: Uint8Array | null;
  mapImageBytes?: Uint8Array | null;
  /** Titolo secondo grafico (es. "Sinistri per reparto" per clienti sanitari). Default: Distribuzione geografica */
  secondaryChartTitle?: string;
  includeRepartoColumn?: boolean;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 45, right: 35, bottom: 60, left: 35 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;

const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.65, 0.65, 0.65),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
  rowAlt: rgb(0.96, 0.97, 0.97),
  boxBg: rgb(0.97, 0.98, 0.98),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  drawFooter(ctx);
  ctx.y = A4.h - MARGIN.top;
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < MARGIN.bottom + 50) newPage(ctx);
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text || "").split("\n")) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > maxW && line) {
        out.push(line);
        line = w;
      } else line = cand;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; italic?: boolean; x?: number; maxW?: number; color?: ReturnType<typeof rgb> } = {},
) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : opts.italic ? ctx.italic : ctx.font;
  const x = opts.x ?? MARGIN.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const col = opts.color ?? COLOR.text;
  for (const ln of wrap(text || "", f, size, maxW)) {
    ensure(ctx, size + 3);
    ctx.page.drawText(ln, { x, y: ctx.y - size, size, font: f, color: col });
    ctx.y -= size + 2;
  }
}

function spacer(ctx: Ctx, h: number) {
  ensure(ctx, h);
  ctx.y -= h;
}

const fmtEur = (n: number) =>
  (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function drawFooter(ctx: Ctx) {
  const fy = MARGIN.bottom - 10;
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: fy + 28 },
    end: { x: A4.w - MARGIN.right, y: fy + 28 },
    thickness: 0.4,
    color: COLOR.line,
  });
  const lines = [
    "CONSULBROKERS - Società per Azioni  |  CBnet Gestionale Assicurativo",
    "Documento generato automaticamente — riservato all'ente destinatario",
  ];
  let ly = fy + 22;
  for (const ln of lines) {
    const w = ctx.font.widthOfTextAtSize(ln, 7);
    ctx.page.drawText(ln, { x: (A4.w - w) / 2, y: ly, size: 7, font: ctx.font, color: COLOR.muted });
    ly -= 8;
  }
}

function drawHeader(ctx: Ctx, d: SinistriEnteReportData) {
  ctx.page.drawText("CBnet", { x: MARGIN.left, y: ctx.y - 16, size: 18, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText("Consulbrokers", { x: MARGIN.left + 58, y: ctx.y - 16, size: 9, font: ctx.font, color: COLOR.muted });

  const metaX = A4.w - MARGIN.right - 200;
  ctx.page.drawText(`Generato il ${d.generatedAt}`, { x: metaX, y: ctx.y - 12, size: 8, font: ctx.font, color: COLOR.muted });
  if (d.generatedBy) {
    ctx.page.drawText(`Da: ${d.generatedBy}`, { x: metaX, y: ctx.y - 24, size: 8, font: ctx.font, color: COLOR.muted });
  }

  ctx.y -= 36;
  drawText(ctx, d.titolo, { size: 14, bold: true });
  spacer(ctx, 4);
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: ctx.y },
    end: { x: A4.w - MARGIN.right, y: ctx.y },
    thickness: 0.6,
    color: COLOR.line,
  });
  ctx.y -= 12;
}

function drawEnteBox(ctx: Ctx, ente: EnteInfo) {
  ensure(ctx, 70);
  const boxH = 58;
  const yTop = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN.left,
    y: yTop - boxH,
    width: CONTENT_W,
    height: boxH,
    color: COLOR.boxBg,
    borderColor: COLOR.line,
    borderWidth: 0.5,
  });
  let ly = yTop - 14;
  ctx.page.drawText("Dati ente", { x: MARGIN.left + 8, y: ly, size: 9, font: ctx.bold, color: COLOR.headerText });
  ly -= 14;
  ctx.page.drawText(ente.ragioneSociale, { x: MARGIN.left + 8, y: ly, size: 10, font: ctx.bold, color: COLOR.text });
  ly -= 12;
  const indir = [ente.indirizzo, [ente.cap, ente.citta].filter(Boolean).join(" "), ente.provincia ? `(${ente.provincia})` : ""]
    .filter(Boolean)
    .join(" — ");
  if (indir) {
    ctx.page.drawText(indir, { x: MARGIN.left + 8, y: ly, size: 8.5, font: ctx.font, color: COLOR.text });
    ly -= 11;
  }
  const ids = [ente.partitaIva ? `P.IVA ${ente.partitaIva}` : "", ente.codiceFiscale ? `C.F. ${ente.codiceFiscale}` : ""]
    .filter(Boolean)
    .join("   ");
  if (ids) ctx.page.drawText(ids, { x: MARGIN.left + 8, y: ly, size: 8, font: ctx.font, color: COLOR.muted });
  ctx.y = yTop - boxH - 10;
}

function drawSectionTitle(ctx: Ctx, title: string) {
  spacer(ctx, 4);
  drawText(ctx, title, { size: 10, bold: true, color: COLOR.headerText });
  spacer(ctx, 2);
}

function drawFilters(ctx: Ctx, lines: string[]) {
  drawSectionTitle(ctx, "Filtri applicati");
  for (const ln of lines) drawText(ctx, `• ${ln}`, { size: 8.5, color: COLOR.muted });
  spacer(ctx, 4);
}

function drawKpis(ctx: Ctx, kpis: SinistriReportKpis) {
  drawSectionTitle(ctx, "Riepilogo");
  const items = [
    { label: "Totale", value: String(kpis.totale) },
    { label: "Aperti", value: String(kpis.aperti) },
    { label: "Chiusi", value: String(kpis.chiusi) },
    { label: "Riserve", value: fmtEur(kpis.riserve) },
    { label: "Liquidato", value: fmtEur(kpis.liquidato) },
  ];
  const colW = CONTENT_W / items.length;
  ensure(ctx, 36);
  const yTop = ctx.y;
  items.forEach((item, i) => {
    const x = MARGIN.left + i * colW;
    ctx.page.drawRectangle({ x: x + 2, y: yTop - 32, width: colW - 4, height: 32, color: COLOR.boxBg, borderColor: COLOR.line, borderWidth: 0.3 });
    ctx.page.drawText(item.label, { x: x + 8, y: yTop - 14, size: 7.5, font: ctx.font, color: COLOR.muted });
    ctx.page.drawText(item.value, { x: x + 8, y: yTop - 26, size: 10, font: ctx.bold, color: COLOR.headerText });
  });
  ctx.y = yTop - 40;
}

async function embedImage(ctx: Ctx, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await ctx.doc.embedPng(bytes);
  } catch {
    try {
      return await ctx.doc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

async function drawImageBlock(ctx: Ctx, title: string, bytes: Uint8Array | null | undefined, maxH: number, maxW: number) {
  if (!bytes?.length) return;
  const img = await embedImage(ctx, bytes);
  if (!img) return;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  ensure(ctx, h + 24);
  drawText(ctx, title, { size: 9, bold: true });
  spacer(ctx, 2);
  ctx.page.drawImage(img, { x: MARGIN.left, y: ctx.y - h, width: w, height: h });
  ctx.y -= h + 8;
}

async function drawChartsAndMap(ctx: Ctx, d: SinistriEnteReportData) {
  const hasChart = !!d.chartImageBytes?.length;
  const hasMap = !!d.mapImageBytes?.length;
  if (!hasChart && !hasMap) return;

  const secondaryTitle = d.secondaryChartTitle || "Distribuzione geografica";
  drawSectionTitle(ctx, "Grafici e mappa");
  if (hasChart && hasMap) {
    const halfW = (CONTENT_W - 8) / 2;
    const maxH = 160;
    const chartImg = await embedImage(ctx, d.chartImageBytes!);
    const mapImg = await embedImage(ctx, d.mapImageBytes!);
    if (chartImg || mapImg) {
      ensure(ctx, maxH + 30);
      const yTop = ctx.y;
      if (chartImg) {
        const scale = Math.min(halfW / chartImg.width, maxH / chartImg.height, 1);
        const w = chartImg.width * scale;
        const h = chartImg.height * scale;
        ctx.page.drawText("Sinistri per ramo", { x: MARGIN.left, y: yTop - 10, size: 8, font: ctx.bold, color: COLOR.muted });
        ctx.page.drawImage(chartImg, { x: MARGIN.left, y: yTop - h - 14, width: w, height: h });
      }
      if (mapImg) {
        const scale = Math.min(halfW / mapImg.width, maxH / mapImg.height, 1);
        const w = mapImg.width * scale;
        const h = mapImg.height * scale;
        const x = MARGIN.left + halfW + 8;
        ctx.page.drawText(secondaryTitle, { x, y: yTop - 10, size: 8, font: ctx.bold, color: COLOR.muted });
        ctx.page.drawImage(mapImg, { x, y: yTop - h - 14, width: w, height: h });
      }
      ctx.y = yTop - maxH - 22;
    }
  } else {
    if (hasChart) await drawImageBlock(ctx, "Sinistri per ramo", d.chartImageBytes, 180, CONTENT_W);
    if (hasMap) await drawImageBlock(ctx, secondaryTitle, d.mapImageBytes, 180, CONTENT_W);
  }
}

function drawRamoSummary(ctx: Ctx, rows: SinPerRamoRow[]) {
  if (!rows.length) return;
  drawSectionTitle(ctx, "Dettaglio per garanzia");
  const cols = [
    { title: "Garanzia", w: 140, align: "left" as const },
    { title: "Aperti", w: 50, align: "center" as const },
    { title: "Chiusi", w: 50, align: "center" as const },
    { title: "Riserve", w: 80, align: "right" as const },
    { title: "Liquidato", w: 80, align: "right" as const },
  ];
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / sumW;
  cols.forEach((c) => (c.w *= scale));

  const drawRow = (cells: string[], bold = false) => {
    ensure(ctx, 14);
    const yTop = ctx.y;
    let cx = MARGIN.left;
    const f = bold ? ctx.bold : ctx.font;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const txt = cells[i] || "";
      let tx = cx + 4;
      if (col.align === "right") tx = cx + col.w - f.widthOfTextAtSize(txt, 8.5) - 4;
      else if (col.align === "center") tx = cx + (col.w - f.widthOfTextAtSize(txt, 8.5)) / 2;
      ctx.page.drawText(txt, { x: tx, y: yTop - 10, size: 8.5, font: f, color: COLOR.text });
      cx += col.w;
    }
    ctx.y -= 13;
  };

  ensure(ctx, 16);
  const yH = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yH - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
  let cx = MARGIN.left;
  for (const col of cols) {
    ctx.page.drawText(col.title, { x: cx + 4, y: yH - 10, size: 8.5, font: ctx.bold, color: COLOR.headerText });
    cx += col.w;
  }
  ctx.y -= 16;

  let totA = 0;
  let totC = 0;
  let totR = 0;
  let totL = 0;
  for (const r of rows) {
    drawRow([r.ramo, String(r.aperti), String(r.chiusi), fmtEur(r.riserva), fmtEur(r.liquidato)]);
    totA += r.aperti;
    totC += r.chiusi;
    totR += r.riserva;
    totL += r.liquidato;
  }
  drawRow(["Totale", String(totA), String(totC), fmtEur(totR), fmtEur(totL)], true);
  spacer(ctx, 6);
}

function drawSinistriTable(ctx: Ctx, rows: SinistroPdfRow[], includeReparto = false) {
  if (!rows.length) return;
  drawSectionTitle(ctx, "Elenco sinistri");

  const cols = [
    { key: "numeroSinistro", title: "N° Sinistro", w: 72 },
    { key: "garanzia", title: "Garanzia", w: 58 },
    { key: "polizza", title: "Polizza", w: 52 },
    { key: "stato", title: "Stato", w: 52 },
    ...(includeReparto ? [{ key: "reparto", title: "Reparto", w: 60 }] : []),
    { key: "luogo", title: includeReparto ? "Ubicazione" : "Luogo", w: includeReparto ? 52 : 68 },
    { key: "riserva", title: "Riserva", w: 52, align: "right" as const },
    { key: "liquidato", title: "Liquidato", w: 52, align: "right" as const },
    { key: "dataEvento", title: "Evento", w: 48 },
  ];
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / sumW;
  cols.forEach((c) => (c.w *= scale));

  const drawHeaderRow = () => {
    ensure(ctx, 16);
    const yTop = ctx.y;
    ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
    let cx = MARGIN.left;
    for (const col of cols) {
      ctx.page.drawText(col.title, { x: cx + 3, y: yTop - 10, size: 7.5, font: ctx.bold, color: COLOR.headerText });
      cx += col.w;
    }
    ctx.y -= 16;
  };

  drawHeaderRow();
  let alt = false;
  for (const r of rows) {
    const cells = [
      r.numeroSinistro,
      r.garanzia,
      r.polizza,
      r.stato,
      ...(includeReparto ? [r.reparto || "—"] : []),
      r.luogo,
      r.riserva,
      r.liquidato,
      r.dataEvento,
    ];
    let maxH = 12;
    cols.forEach((col, i) => {
      const lines = wrap(cells[i], ctx.font, 7.5, col.w - 4);
      maxH = Math.max(maxH, lines.length * 8.5 + 2);
    });
    ensure(ctx, maxH + 2);
    const yTop = ctx.y;
    if (alt) ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    let cx = MARGIN.left;
    cols.forEach((col, i) => {
      const lines = wrap(cells[i], ctx.font, 7.5, col.w - 4);
      let ly = yTop - 2;
      for (const ln of lines) {
        let tx = cx + 3;
        if (col.align === "right") tx = cx + col.w - ctx.font.widthOfTextAtSize(ln, 7.5) - 3;
        ctx.page.drawText(ln, { x: tx, y: ly - 7.5, size: 7.5, font: ctx.font, color: COLOR.text });
        ly -= 8.5;
      }
      cx += col.w;
    });
    ctx.y = yTop - maxH;
    alt = !alt;
    if (ctx.y < MARGIN.bottom + 80) {
      newPage(ctx);
      drawHeaderRow();
    }
  }
}

function drawEconomicSummary(ctx: Ctx, kpis: SinistriReportKpis) {
  spacer(ctx, 8);
  drawSectionTitle(ctx, "Riepilogo economico");
  const rightX = MARGIN.left + CONTENT_W - 220;
  const lines: Array<[string, string]> = [
    ["Sinistri nel report", String(kpis.totale)],
    ["Riserve totali", fmtEur(kpis.riserve)],
    ["Importo liquidato", fmtEur(kpis.liquidato)],
    ["Sinistri aperti", String(kpis.aperti)],
    ["Sinistri chiusi", String(kpis.chiusi)],
  ];
  for (const [label, value] of lines) {
    ensure(ctx, 14);
    ctx.page.drawText(label, { x: rightX, y: ctx.y - 10, size: 9, font: ctx.font, color: COLOR.text });
    ctx.page.drawText(value, {
      x: MARGIN.left + CONTENT_W - ctx.bold.widthOfTextAtSize(value, 9) - 4,
      y: ctx.y - 10,
      size: 9,
      font: ctx.bold,
      color: COLOR.headerText,
    });
    ctx.y -= 13;
  }
}

function drawDisclaimer(ctx: Ctx) {
  spacer(ctx, 10);
  drawText(
    ctx,
    "Il presente report ha finalità informativa e non costituisce documento contabile né certificazione di liquidazione. " +
      "Gli importi di riserva sono stime della compagnia assicuratrice e possono variare nel tempo. " +
      "Per informazioni ufficiali o aggiornamenti contattare il proprio referente Consulbrokers.",
    { size: 7.5, italic: true, color: COLOR.muted },
  );
}

export async function buildSinistriEnteReportPdf(d: SinistriEnteReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN.top, font, bold, italic };

  drawFooter(ctx);
  drawHeader(ctx, d);
  drawEnteBox(ctx, d.ente);
  drawFilters(ctx, d.filterLines);
  drawKpis(ctx, d.kpis);
  await drawChartsAndMap(ctx, d);
  drawRamoSummary(ctx, d.sinPerRamo);
  drawSinistriTable(ctx, d.sinistri, d.includeRepartoColumn);
  drawEconomicSummary(ctx, d.kpis);
  drawDisclaimer(ctx);

  return doc.save();
}
