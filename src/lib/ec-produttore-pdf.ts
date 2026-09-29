import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface ECProduttoreRow {
  data: string;        // dd/MM/yy
  polizza: string;     // numero (+ riga)
  cliente: string;     // ragione sociale / cognome nome
  ramo: string;        // descrizione ramo
  periodo: string;     // dd/MM/yyyy dd/MM/yyyy
  tp: string;          // PI/PQ/AM
  premio: number;
  provvigioni: number;
  altreOper: number;   // sempre 0 al momento
}

/** Provvigioni già trattenute dal produttore in incasso (voce separata, non da liquidare). */
export interface ECProduttoreTrattenutaRow {
  data: string;
  polizza: string;
  cliente: string;
  provvigioneLorda: number;
  ritenutaAcconto: number;
  nettoTrattenuto: number;
}

export interface ECProduttoreData {
  // Mittente sede
  sedeNome: string;
  sedeIndirizzo?: string;
  sedeCap?: string;
  sedeCitta?: string;
  sedeProvincia?: string;
  sedeTelefono?: string;
  sedeEmail?: string;
  // Documento
  numeroRendiconto: string;       // "1"
  dataRendiconto: string;         // "30/04/2026"
  periodoTesto: string;           // "Gennaio 2026"
  // Destinatario produttore
  produttoreIntestazione: string; // "Spettabile"
  produttoreNome: string;         // "ASSICURASUD SRL"
  produttoreIndirizzo: string;
  produttoreCap: string;
  produttoreCitta: string;
  produttoreProvincia: string;
  produttoreCF?: string;
  produttorePIVA?: string;
  iban?: string;
  intestatoA?: string;
  modalitaPagamento?: string;
  // Tabella
  righe: ECProduttoreRow[];
  /** Dettaglio provvigioni trattenute in incasso (escluse dal totale da liquidare). */
  righeTrattenute?: ECProduttoreTrattenutaRow[];
  totalePremio: number;
  totaleProvvigioni: number;
  totaleTrattenute?: number;
  totaleAltreOper: number;
  // Riepilogo
  ritenutaAcconto: number;
  // Note
  noteFinali?: string;
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
  ctx.y = A4.h - MARGIN.top;
  drawFooter(ctx);
  ctx.y = A4.h - MARGIN.top;
}
function ensure(ctx: Ctx, h: number) { if (ctx.y - h < MARGIN.bottom + 60) newPage(ctx); }

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of (text || "").split("\n")) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const cand = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(cand, size) > maxW && line) { out.push(line); line = w; }
      else line = cand;
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; italic?: boolean; x?: number; maxW?: number; align?: "left"|"center"|"right" } = {}) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : opts.italic ? ctx.italic : ctx.font;
  const x = opts.x ?? MARGIN.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const lines = wrap(text || "", f, size, maxW);
  for (const ln of lines) {
    ensure(ctx, size + 3);
    let drawX = x;
    if (opts.align === "center") drawX = x + (maxW - f.widthOfTextAtSize(ln, size)) / 2;
    else if (opts.align === "right") drawX = x + maxW - f.widthOfTextAtSize(ln, size);
    ctx.page.drawText(ln, { x: drawX, y: ctx.y - size, size, font: f, color: COLOR.text });
    ctx.y -= size + 2;
  }
}

function spacer(ctx: Ctx, h: number) { ensure(ctx, h); ctx.y -= h; }
function fmtEur(n: number): string { return (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function drawTopHeader(ctx: Ctx, d: ECProduttoreData) {
  ctx.page.drawText("CONSULBROKERS", { x: MARGIN.left, y: ctx.y - 14, size: 14, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText("S.p.A.", { x: MARGIN.left + 116, y: ctx.y - 14, size: 9, font: ctx.font, color: COLOR.muted });
  ctx.page.drawText(d.sedeNome || "", { x: MARGIN.left, y: ctx.y - 28, size: 9, font: ctx.bold, color: COLOR.text });
  const indir = [d.sedeIndirizzo, [d.sedeCap, d.sedeCitta].filter(Boolean).join(" "), d.sedeProvincia ? `(${d.sedeProvincia})` : ""].filter(Boolean).join(" - ");
  if (indir) ctx.page.drawText(indir, { x: MARGIN.left, y: ctx.y - 40, size: 8.5, font: ctx.font, color: COLOR.text });
  const contatti = [d.sedeTelefono ? `Tel: ${d.sedeTelefono}` : "", d.sedeEmail || ""].filter(Boolean).join("   ");
  if (contatti) ctx.page.drawText(contatti, { x: MARGIN.left, y: ctx.y - 52, size: 8.5, font: ctx.font, color: COLOR.muted });

  const title = `Rendiconto n. ${d.numeroRendiconto || "0"} del ${d.dataRendiconto || ""}`;
  const wT = ctx.bold.widthOfTextAtSize(title, 11);
  ctx.page.drawText(title, { x: A4.w - MARGIN.right - wT, y: ctx.y - 14, size: 11, font: ctx.bold, color: COLOR.headerText });

  ctx.y -= 70;
  ctx.page.drawLine({ start: { x: MARGIN.left, y: ctx.y }, end: { x: A4.w - MARGIN.right, y: ctx.y }, thickness: 0.6, color: COLOR.line });
  ctx.y -= 10;
}

function drawDestinatario(ctx: Ctx, d: ECProduttoreData) {
  const boxX = A4.w - MARGIN.right - 260;
  const lines: string[] = [
    d.produttoreIntestazione || "Spettabile",
    d.produttoreNome || "",
    d.produttoreIndirizzo || "",
    [d.produttoreCap, d.produttoreCitta, d.produttoreProvincia].filter(Boolean).join(" "),
  ];
  if (d.produttoreCF) lines.push(`Codice fiscale: ${d.produttoreCF}`);
  if (d.produttorePIVA && d.produttorePIVA !== d.produttoreCF) lines.push(`P. IVA: ${d.produttorePIVA}`);
  let ly = ctx.y;
  for (const ln of lines) {
    const isFirst = ln === d.produttoreIntestazione;
    ctx.page.drawText(ln, { x: boxX, y: ly - 10, size: 9, font: isFirst ? ctx.italic : ctx.bold, color: COLOR.text });
    ly -= 12;
  }
  ctx.y = ly - 6;
}

function drawIntro(ctx: Ctx, d: ECProduttoreData) {
  spacer(ctx, 6);
  drawText(ctx, `Di seguito il dettaglio delle intermediazioni maturate nel periodo: ${d.periodoTesto || ""}.`, { size: 9.5 });
  spacer(ctx, 6);
  drawText(ctx, `Pagamento a mezzo ${d.modalitaPagamento || "Bonifico"}`, { size: 9, bold: true });
  if (d.iban) drawText(ctx, `c/c: ${d.iban}`, { size: 9 });
  if (d.intestatoA) drawText(ctx, `intestato a ${d.intestatoA}`, { size: 9 });
  spacer(ctx, 6);
}

function drawTabella(ctx: Ctx, d: ECProduttoreData) {
  const cols = [
    { key: "data",     title: "Data",                w: 42,  align: "left"   as const },
    { key: "polizza",  title: "Polizza Delegataria", w: 88,  align: "left"   as const },
    { key: "cliente",  title: "Cliente / Note",      w: 110, align: "left"   as const },
    { key: "ramo",     title: "Ramo / Periodo",      w: 130, align: "left"   as const },
    { key: "tp",       title: "tp",                  w: 22,  align: "center" as const },
    { key: "premio",   title: "Premio",              w: 65,  align: "right"  as const },
    { key: "provv",    title: "Provvigioni",         w: 65,  align: "right"  as const },
    { key: "altre",    title: "Altre op.",           w: 55,  align: "right"  as const },
  ];
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / sumW;
  cols.forEach((c) => (c.w = c.w * scale));

  const drawHeaderRow = () => {
    ensure(ctx, 18);
    const yTop = ctx.y;
    ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
    let cx = MARGIN.left;
    for (const col of cols) {
      const tx = col.align === "right" ? cx + col.w - ctx.bold.widthOfTextAtSize(col.title, 8.5) - 4
              : col.align === "center" ? cx + (col.w - ctx.bold.widthOfTextAtSize(col.title, 8.5)) / 2
              : cx + 4;
      ctx.page.drawText(col.title, { x: tx, y: yTop - 10, size: 8.5, font: ctx.bold, color: COLOR.headerText });
      cx += col.w;
    }
    ctx.y -= 16;
  };
  drawHeaderRow();

  const drawCell = (text: string, x: number, w: number, y: number, font: PDFFont, size: number, align: "left"|"right"|"center") => {
    const lines = wrap(text || "", font, size, w - 6);
    let ly = y;
    for (const ln of lines) {
      let tx = x + 3;
      if (align === "right") tx = x + w - font.widthOfTextAtSize(ln, size) - 4;
      else if (align === "center") tx = x + (w - font.widthOfTextAtSize(ln, size)) / 2;
      ctx.page.drawText(ln, { x: tx, y: ly - size, size, font, color: COLOR.text });
      ly -= size + 1;
    }
  };

  let alt = false;
  for (const r of d.righe) {
    const ramoCell = [r.ramo || "", r.periodo || ""].filter(Boolean).join("\n");
    const cellsTexts = [r.data || "", r.polizza || "", r.cliente || "", ramoCell, r.tp || "", fmtEur(r.premio), fmtEur(r.provvigioni), fmtEur(r.altreOper)];

    let maxH = 0;
    cols.forEach((col, i) => {
      const lines = wrap(cellsTexts[i] || "", ctx.font, 8.5, col.w - 6);
      maxH = Math.max(maxH, lines.length * 9.5 + 4);
    });

    ensure(ctx, maxH + 2);
    const yTop = ctx.y;
    if (alt) ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    let cx = MARGIN.left;
    cols.forEach((col, i) => {
      drawCell(cellsTexts[i], cx, col.w, yTop - 2, ctx.font, 8.5, col.align);
      cx += col.w;
    });
    ctx.page.drawLine({ start: { x: MARGIN.left, y: yTop - maxH }, end: { x: MARGIN.left + CONTENT_W, y: yTop - maxH }, thickness: 0.2, color: COLOR.line });
    ctx.y = yTop - maxH;
    alt = !alt;
  }

  // Totals row
  spacer(ctx, 4);
  ensure(ctx, 16);
  const yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
  let cx = MARGIN.left;
  const labelW = cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
  ctx.page.drawText("EURO", { x: cx + labelW - ctx.bold.widthOfTextAtSize("EURO", 9) - 6, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += labelW;
  const totPrem = fmtEur(d.totalePremio);
  ctx.page.drawText(totPrem, { x: cx + cols[5].w - ctx.bold.widthOfTextAtSize(totPrem, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += cols[5].w;
  const totProv = fmtEur(d.totaleProvvigioni);
  ctx.page.drawText(totProv, { x: cx + cols[6].w - ctx.bold.widthOfTextAtSize(totProv, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += cols[6].w;
  const totAlt = fmtEur(d.totaleAltreOper);
  ctx.page.drawText(totAlt, { x: cx + cols[7].w - ctx.bold.widthOfTextAtSize(totAlt, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= 18;
}

function drawTrattenuteSection(ctx: Ctx, d: ECProduttoreData) {
  const rows = d.righeTrattenute || [];
  if (!rows.length) return;

  spacer(ctx, 10);
  drawText(ctx, "Provvigioni trattenute in incasso (già liquidate dal produttore)", { size: 9, bold: true });
  spacer(ctx, 4);

  const cols = [
    { title: "Data", w: 52, align: "left" as const },
    { title: "Polizza", w: 90, align: "left" as const },
    { title: "Cliente", w: 130, align: "left" as const },
    { title: "Lordo", w: 70, align: "right" as const },
    { title: "RA", w: 55, align: "right" as const },
    { title: "Netto trattenuto", w: 80, align: "right" as const },
  ];

  ensure(ctx, 20);
  let yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 16, width: CONTENT_W, height: 16, color: COLOR.headerBg });
  let cx = MARGIN.left;
  for (const col of cols) {
    const tx = col.align === "right"
      ? cx + col.w - ctx.bold.widthOfTextAtSize(col.title, 8) - 4
      : cx + 4;
    ctx.page.drawText(col.title, { x: tx, y: yTop - 10, size: 8, font: ctx.bold, color: COLOR.headerText });
    cx += col.w;
  }
  ctx.y -= 18;

  for (const r of rows) {
    ensure(ctx, 14);
    yTop = ctx.y;
    const texts = [
      r.data,
      r.polizza,
      r.cliente,
      fmtEur(r.provvigioneLorda),
      fmtEur(r.ritenutaAcconto),
      fmtEur(r.nettoTrattenuto),
    ];
    cx = MARGIN.left;
    texts.forEach((text, i) => {
      const col = cols[i];
      const tx = col.align === "right"
        ? cx + col.w - ctx.font.widthOfTextAtSize(text, 8) - 4
        : cx + 4;
      ctx.page.drawText(text, { x: tx, y: yTop - 10, size: 8, font: ctx.font, color: COLOR.text });
      cx += col.w;
    });
    ctx.page.drawLine({
      start: { x: MARGIN.left, y: yTop - 14 },
      end: { x: MARGIN.left + CONTENT_W, y: yTop - 14 },
      thickness: 0.2,
      color: COLOR.line,
    });
    ctx.y = yTop - 14;
  }

  const tot = d.totaleTrattenute ?? rows.reduce((s, r) => s + r.nettoTrattenuto, 0);
  spacer(ctx, 2);
  ensure(ctx, 14);
  yTop = ctx.y;
  const totLabel = "Totale netto trattenuto";
  const totVal = fmtEur(tot);
  ctx.page.drawText(totLabel, { x: MARGIN.left + CONTENT_W - 200, y: yTop - 10, size: 8.5, font: ctx.bold, color: COLOR.text });
  ctx.page.drawText(totVal, { x: MARGIN.left + CONTENT_W - ctx.bold.widthOfTextAtSize(totVal, 8.5) - 4, y: yTop - 10, size: 8.5, font: ctx.bold, color: COLOR.text });
  ctx.y -= 16;
}

function drawTotali(ctx: Ctx, d: ECProduttoreData) {
  const debitoCredito = d.totaleProvvigioni;
  const aVostroCredito = debitoCredito - d.ritenutaAcconto;
  spacer(ctx, 6);
  const rightX = MARGIN.left + CONTENT_W - 240;
  const drawLine = (label: string, value: number, bold = false) => {
    ensure(ctx, 14);
    const f = bold ? ctx.bold : ctx.font;
    ctx.page.drawText(label, { x: rightX, y: ctx.y - 10, size: 9, font: f, color: COLOR.text });
    const v = fmtEur(value);
    ctx.page.drawText(v, { x: MARGIN.left + CONTENT_W - f.widthOfTextAtSize(v, 9) - 4, y: ctx.y - 10, size: 9, font: f, color: COLOR.text });
    ctx.y -= 13;
  };
  drawLine("Debito/Credito", debitoCredito, true);
  drawLine("- Ritenuta d'Acconto", d.ritenutaAcconto);
  ensure(ctx, 4);
  ctx.page.drawLine({ start: { x: rightX, y: ctx.y - 1 }, end: { x: MARGIN.left + CONTENT_W, y: ctx.y - 1 }, thickness: 0.6, color: COLOR.line });
  ctx.y -= 4;
  drawLine("A Vostro Credito", aVostroCredito, true);
}

function drawNote(ctx: Ctx, d: ECProduttoreData) {
  spacer(ctx, 10);
  drawText(ctx, "Esente IVA Art. 10 - Comma 9 - DPR 26/10/72 - N. 633", { size: 8, italic: true });
  drawText(ctx, "Esente da Bollo Art. 16 L. 29/10/61 N. 1216", { size: 8, italic: true });
  if (d.noteFinali) {
    spacer(ctx, 4);
    drawText(ctx, d.noteFinali, { size: 8.5 });
  }
}

function drawFooter(ctx: Ctx) {
  const fy = MARGIN.bottom - 10;
  ctx.page.drawLine({ start: { x: MARGIN.left, y: fy + 28 }, end: { x: A4.w - MARGIN.right, y: fy + 28 }, thickness: 0.4, color: COLOR.line });
  const lines = [
    "CONSULBROKERS - Società per Azioni  |  Numero REA: MI - 2756388  |  RUI B000778092",
    "P. IVA e C.F. 14003610962  |  Tel. 081 7648268",
    "20121 MILANO - Corso di Porta Nuova, 16   |   85100 POTENZA - Viale Marconi, 90   |   80122 NAPOLI - Via Mergellina, 2   |   00198 ROMA - Via Reno, 30",
  ];
  let ly = fy + 22;
  for (const ln of lines) {
    const w = ctx.font.widthOfTextAtSize(ln, 7);
    ctx.page.drawText(ln, { x: (A4.w - w) / 2, y: ly, size: 7, font: ctx.font, color: COLOR.muted });
    ly -= 8;
  }
}

export async function buildECProduttorePdf(d: ECProduttoreData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN.top, font, bold, italic };
  drawFooter(ctx);
  drawTopHeader(ctx, d);
  drawDestinatario(ctx, d);
  drawIntro(ctx, d);
  drawTabella(ctx, d);
  drawTrattenuteSection(ctx, d);
  drawTotali(ctx, d);
  drawNote(ctx, d);
  return await doc.save();
}
