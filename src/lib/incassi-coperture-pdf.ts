import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface IncassiCopertureTitolo {
  numero_titolo: string | null;
  cliente: string;
  premio_lordo: number;
  provvigioni: number;
  netto: number;
  tipo_pagamento: string;
  tipo_incasso: string;
}

export interface IncassiCoperturaGruppo {
  agenzia: string;
  count: number;
  premio_lordo: number;
  provvigioni: number;
  da_rimettere: number;
  titoli: IncassiCopertureTitolo[];
}

export interface IncassiCopertureData {
  meseLabel: string;
  sedeNome?: string;
  generatoIl: string; // gg/mm/aaaa hh:mm
  filtroAgenzia?: string;
  gruppi: IncassiCoperturaGruppo[];
  totali: { count: number; premio_lordo: number; provvigioni: number; da_rimettere: number };
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 45, right: 35, bottom: 45, left: 35 };

const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.7, 0.7, 0.7),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
  groupBg: rgb(0.92, 0.94, 0.93),
  rowAlt: rgb(0.97, 0.97, 0.97),
  totBg: rgb(0.78, 0.84, 0.81),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pageNum: number;
  meseLabel: string;
}

function fmtEur(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pageNum++;
  ctx.y = A4.h - MARGIN.top;
  drawFooter(ctx);
}

function drawFooter(ctx: Ctx) {
  const t = `Riepilogo Messe a Cassa — ${ctx.meseLabel}   ·   pag. ${ctx.pageNum}`;
  ctx.page.drawText(t, { x: MARGIN.left, y: 25, size: 8, font: ctx.font, color: COLOR.muted });
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < MARGIN.bottom + 20) newPage(ctx);
}

function truncate(s: string, font: PDFFont, size: number, maxW: number) {
  if (!s) return "";
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (font.widthOfTextAtSize(s.slice(0, mid) + "…", size) <= maxW) lo = mid + 1; else hi = mid;
  }
  return s.slice(0, Math.max(0, lo - 1)) + "…";
}

function drawHeader(ctx: Ctx, d: IncassiCopertureData) {
  // Banda titolo
  ctx.page.drawRectangle({ x: 0, y: A4.h - 60, width: A4.w, height: 60, color: COLOR.headerBg });
  ctx.page.drawText("CONSULBROKERS", { x: MARGIN.left, y: A4.h - 28, size: 14, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText(d.sedeNome || "Sede", { x: MARGIN.left, y: A4.h - 44, size: 9, font: ctx.font, color: COLOR.text });

  const title = "RIEPILOGO MESSE A CASSA";
  const wT = ctx.bold.widthOfTextAtSize(title, 13);
  ctx.page.drawText(title, { x: A4.w - MARGIN.right - wT, y: A4.h - 28, size: 13, font: ctx.bold, color: COLOR.headerText });
  const sub = `Mese: ${d.meseLabel}`;
  const wS = ctx.font.widthOfTextAtSize(sub, 10);
  ctx.page.drawText(sub, { x: A4.w - MARGIN.right - wS, y: A4.h - 44, size: 10, font: ctx.font, color: COLOR.text });

  ctx.y = A4.h - 75;

  // Riga generato il + filtro
  const meta = `Generato il ${d.generatoIl}${d.filtroAgenzia ? `   ·   Filtro agenzia: ${d.filtroAgenzia}` : ""}`;
  ctx.page.drawText(meta, { x: MARGIN.left, y: ctx.y, size: 8.5, font: ctx.font, color: COLOR.muted });
  ctx.y -= 18;

  // KPI box
  drawKpis(ctx, d.totali);
  ctx.y -= 10;
}

function drawKpis(ctx: Ctx, t: IncassiCopertureData["totali"]) {
  const items = [
    { label: "Titoli a Cassa", value: String(t.count) },
    { label: "Premio Lordo", value: fmtEur(t.premio_lordo) },
    { label: "Provvigioni", value: fmtEur(t.provvigioni) },
    { label: "Da Rimettere", value: fmtEur(t.da_rimettere) },
  ];
  const totalW = A4.w - MARGIN.left - MARGIN.right;
  const gap = 8;
  const w = (totalW - gap * (items.length - 1)) / items.length;
  const h = 38;
  let x = MARGIN.left;
  for (const it of items) {
    ctx.page.drawRectangle({ x, y: ctx.y - h, width: w, height: h, color: COLOR.rowAlt, borderColor: COLOR.line, borderWidth: 0.5 });
    ctx.page.drawText(it.label, { x: x + 8, y: ctx.y - 14, size: 8, font: ctx.font, color: COLOR.muted });
    ctx.page.drawText(it.value, { x: x + 8, y: ctx.y - 30, size: 12, font: ctx.bold, color: COLOR.headerText });
    x += w + gap;
  }
  ctx.y -= h + 6;
}

// Layout colonne tabella titoli (somma deve stare dentro contentW)
const COLS = (() => {
  const contentW = A4.w - MARGIN.left - MARGIN.right;
  // n.titolo, cliente, premio, provv, netto, pag, incasso
  const w = [60, 165, 60, 60, 60, 55, contentW - (60 + 165 + 60 + 60 + 60 + 55)];
  const x: number[] = [MARGIN.left];
  for (let i = 0; i < w.length - 1; i++) x.push(x[i] + w[i]);
  return { w, x };
})();
const HEAD_TXT = ["N° Titolo", "Cliente", "Premio €", "Provv. €", "Netto €", "Pagamento", "Incasso"];
const HEAD_ALIGN: Array<"l"|"r"> = ["l", "l", "r", "r", "r", "l", "l"];

function drawGroupHeader(ctx: Ctx, g: IncassiCoperturaGruppo) {
  ensure(ctx, 38);
  const h = 22;
  ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - h, width: A4.w - MARGIN.left - MARGIN.right, height: h, color: COLOR.groupBg });
  ctx.page.drawText(g.agenzia, { x: MARGIN.left + 6, y: ctx.y - 15, size: 10, font: ctx.bold, color: COLOR.headerText });
  const right = `${g.count} titoli   ·   Lordo ${fmtEur(g.premio_lordo)}   ·   Provv. ${fmtEur(g.provvigioni)}   ·   Da Rimettere ${fmtEur(g.da_rimettere)}`;
  const wR = ctx.font.widthOfTextAtSize(right, 9);
  ctx.page.drawText(right, { x: A4.w - MARGIN.right - wR - 6, y: ctx.y - 15, size: 9, font: ctx.font, color: COLOR.text });
  ctx.y -= h + 2;

  // Header colonne
  const hh = 16;
  ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - hh, width: A4.w - MARGIN.left - MARGIN.right, height: hh, color: COLOR.headerBg });
  for (let i = 0; i < HEAD_TXT.length; i++) {
    const txt = HEAD_TXT[i];
    const tw = ctx.bold.widthOfTextAtSize(txt, 8);
    const x = HEAD_ALIGN[i] === "r" ? COLS.x[i] + COLS.w[i] - tw - 4 : COLS.x[i] + 4;
    ctx.page.drawText(txt, { x, y: ctx.y - 11, size: 8, font: ctx.bold, color: COLOR.headerText });
  }
  ctx.y -= hh;
}

function drawTitoloRow(ctx: Ctx, t: IncassiCopertureTitolo, alt: boolean) {
  const h = 14;
  ensure(ctx, h + 2);
  if (alt) {
    ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - h, width: A4.w - MARGIN.left - MARGIN.right, height: h, color: COLOR.rowAlt });
  }
  const cells: Array<[string, "l"|"r"]> = [
    [t.numero_titolo || "—", "l"],
    [truncate(t.cliente || "—", ctx.font, 8, COLS.w[1] - 8), "l"],
    [fmtEur(t.premio_lordo), "r"],
    [fmtEur(t.provvigioni), "r"],
    [fmtEur(t.netto), "r"],
    [t.tipo_pagamento || "—", "l"],
    [truncate(t.tipo_incasso || "—", ctx.font, 8, COLS.w[6] - 8), "l"],
  ];
  for (let i = 0; i < cells.length; i++) {
    const [txt, al] = cells[i];
    const f = ctx.font;
    const tw = f.widthOfTextAtSize(txt, 8);
    const x = al === "r" ? COLS.x[i] + COLS.w[i] - tw - 4 : COLS.x[i] + 4;
    ctx.page.drawText(txt, { x, y: ctx.y - 10, size: 8, font: f, color: COLOR.text });
  }
  ctx.y -= h;
}

function drawTotali(ctx: Ctx, t: IncassiCopertureData["totali"]) {
  ensure(ctx, 26);
  ctx.y -= 6;
  const h = 20;
  ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - h, width: A4.w - MARGIN.left - MARGIN.right, height: h, color: COLOR.totBg });
  ctx.page.drawText("TOTALE GENERALE", { x: MARGIN.left + 6, y: ctx.y - 13, size: 10, font: ctx.bold, color: COLOR.headerText });
  const right = `${t.count} titoli   ·   Lordo ${fmtEur(t.premio_lordo)}   ·   Provv. ${fmtEur(t.provvigioni)}   ·   Da Rimettere ${fmtEur(t.da_rimettere)}`;
  const wR = ctx.bold.widthOfTextAtSize(right, 10);
  ctx.page.drawText(right, { x: A4.w - MARGIN.right - wR - 6, y: ctx.y - 13, size: 10, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= h;
}

export async function buildIncassiCoperturePdf(d: IncassiCopertureData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = {
    doc,
    page: doc.addPage([A4.w, A4.h]),
    y: A4.h - MARGIN.top,
    font,
    bold,
    pageNum: 1,
    meseLabel: d.meseLabel,
  };
  drawFooter(ctx);
  drawHeader(ctx, d);

  if (d.gruppi.length === 0) {
    ensure(ctx, 30);
    ctx.page.drawText("Nessun titolo messo a cassa nel mese selezionato.", {
      x: MARGIN.left, y: ctx.y - 14, size: 10, font: ctx.font, color: COLOR.muted,
    });
  } else {
    for (const g of d.gruppi) {
      drawGroupHeader(ctx, g);
      let i = 0;
      for (const t of g.titoli) {
        drawTitoloRow(ctx, t, i % 2 === 1);
        i++;
      }
      ctx.y -= 6;
    }
  }
  drawTotali(ctx, d.totali);

  return doc.save();
}
