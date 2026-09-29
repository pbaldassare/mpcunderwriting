import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface RimessaPdfTitolo {
  numero_titolo: string;
  cliente?: string;
  premio_lordo: number;
  importo_incassato: number;
  importo_rimessa: number;
  data_messa_cassa?: string | null;
}

export interface RimessaPdfData {
  // Documento
  numeroRimessa: string;          // id rimessa o codice progressivo
  dataDocumento: string;          // dd/MM/yyyy
  // Sede mittente Consulbrokers (Napoli forzata)
  sedeNome: string;
  sedeIndirizzo?: string;
  sedeCap?: string;
  sedeCitta?: string;
  sedeProvincia?: string;
  sedeEmail?: string;
  sedeTelefono?: string;
  // Conto bancario mittente Consulbrokers
  contoMittenteEtichetta: string;
  contoMittenteIban: string;
  contoMittenteIntestatoA: string;
  contoMittenteBanca?: string;
  // Agenzia destinataria
  agenziaNome: string;
  agenziaIndirizzo?: string;
  agenziaCap?: string;
  agenziaCitta?: string;
  agenziaProvincia?: string;
  agenziaCF?: string;
  agenziaPIVA?: string;
  ibanDestinazione?: string;
  intestatoADestinazione?: string;
  // Tabella
  titoli: RimessaPdfTitolo[];
  importoPagato: number;
  // Note
  note?: string;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 45, right: 40, bottom: 50, left: 40 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;

const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.65, 0.65, 0.65),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
  rowAlt: rgb(0.96, 0.97, 0.97),
  highlight: rgb(0.92, 0.96, 0.94),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
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

function drawText(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; italic?: boolean; x?: number; maxW?: number } = {}) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : opts.italic ? ctx.italic : ctx.font;
  const x = opts.x ?? MARGIN.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const lines = wrap(text || "", f, size, maxW);
  for (const ln of lines) {
    ensure(ctx, size + 3);
    ctx.page.drawText(ln, { x, y: ctx.y - size, size, font: f, color: COLOR.text });
    ctx.y -= size + 2;
  }
}

function spacer(ctx: Ctx, h: number) { ensure(ctx, h); ctx.y -= h; }

function fmtEur(n: number): string {
  return (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawTopHeader(ctx: Ctx, d: RimessaPdfData) {
  ctx.page.drawText("CONSULBROKERS", { x: MARGIN.left, y: ctx.y - 14, size: 14, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText("S.p.A.", { x: MARGIN.left + 116, y: ctx.y - 14, size: 9, font: ctx.font, color: COLOR.muted });
  ctx.page.drawText(d.sedeNome || "", { x: MARGIN.left, y: ctx.y - 28, size: 9, font: ctx.bold, color: COLOR.text });
  const indir = [d.sedeIndirizzo, [d.sedeCap, d.sedeCitta].filter(Boolean).join(" "), d.sedeProvincia ? `(${d.sedeProvincia})` : ""].filter(Boolean).join(" - ");
  if (indir) ctx.page.drawText(indir, { x: MARGIN.left, y: ctx.y - 40, size: 8.5, font: ctx.font, color: COLOR.text });
  const contatti = [d.sedeTelefono ? `Tel: ${d.sedeTelefono}` : "", d.sedeEmail || ""].filter(Boolean).join("   ");
  if (contatti) ctx.page.drawText(contatti, { x: MARGIN.left, y: ctx.y - 52, size: 8.5, font: ctx.font, color: COLOR.muted });

  const title = `Distinta Rimessa Premi`;
  const wT = ctx.bold.widthOfTextAtSize(title, 12);
  ctx.page.drawText(title, { x: A4.w - MARGIN.right - wT, y: ctx.y - 14, size: 12, font: ctx.bold, color: COLOR.headerText });
  const sub = `Rimessa n. ${d.numeroRimessa}`;
  const wS = ctx.font.widthOfTextAtSize(sub, 9);
  ctx.page.drawText(sub, { x: A4.w - MARGIN.right - wS, y: ctx.y - 28, size: 9, font: ctx.font, color: COLOR.text });
  const dt = `Data: ${d.dataDocumento}`;
  const wD = ctx.font.widthOfTextAtSize(dt, 9);
  ctx.page.drawText(dt, { x: A4.w - MARGIN.right - wD, y: ctx.y - 40, size: 9, font: ctx.font, color: COLOR.text });

  ctx.y -= 70;
  ctx.page.drawLine({ start: { x: MARGIN.left, y: ctx.y }, end: { x: A4.w - MARGIN.right, y: ctx.y }, thickness: 0.6, color: COLOR.line });
  ctx.y -= 10;
}

function drawDestinatario(ctx: Ctx, d: RimessaPdfData) {
  const boxX = A4.w - MARGIN.right - 250;
  const boxY = ctx.y;
  const lines: string[] = [
    "Spettabile",
    d.agenziaNome || "",
    d.agenziaIndirizzo || "",
    [d.agenziaCap, d.agenziaCitta, d.agenziaProvincia].filter(Boolean).join(" "),
  ];
  if (d.agenziaCF) lines.push(`Codice fiscale: ${d.agenziaCF}`);
  if (d.agenziaPIVA && d.agenziaPIVA !== d.agenziaCF) lines.push(`P. IVA: ${d.agenziaPIVA}`);

  let ly = boxY;
  for (const ln of lines.filter(Boolean)) {
    const isFirst = ln === "Spettabile";
    ctx.page.drawText(ln, { x: boxX, y: ly - 10, size: 9, font: isFirst ? ctx.italic : ctx.bold, color: COLOR.text });
    ly -= 12;
  }
  ctx.y = Math.min(ctx.y, ly) - 6;
}

function drawPagamentoBox(ctx: Ctx, d: RimessaPdfData) {
  spacer(ctx, 10);
  ensure(ctx, 90);
  const boxY = ctx.y;
  const boxH = 78;
  ctx.page.drawRectangle({ x: MARGIN.left, y: boxY - boxH, width: CONTENT_W, height: boxH, color: COLOR.highlight });
  ctx.page.drawRectangle({ x: MARGIN.left, y: boxY - boxH, width: CONTENT_W, height: boxH, borderColor: COLOR.line, borderWidth: 0.5, color: COLOR.highlight });

  const colW = CONTENT_W / 2 - 10;
  // Sinistra: Conto mittente Consulbrokers
  let ly = boxY - 12;
  ctx.page.drawText("PAGAMENTO DA (Consulbrokers)", { x: MARGIN.left + 8, y: ly, size: 8.5, font: ctx.bold, color: COLOR.headerText });
  ly -= 12;
  ctx.page.drawText(d.contoMittenteEtichetta || "", { x: MARGIN.left + 8, y: ly, size: 9, font: ctx.bold, color: COLOR.text });
  ly -= 11;
  if (d.contoMittenteBanca) {
    ctx.page.drawText(`Banca: ${d.contoMittenteBanca}`, { x: MARGIN.left + 8, y: ly, size: 8.5, font: ctx.font, color: COLOR.text });
    ly -= 11;
  }
  ctx.page.drawText(`IBAN: ${d.contoMittenteIban || ""}`, { x: MARGIN.left + 8, y: ly, size: 8.5, font: ctx.font, color: COLOR.text });
  ly -= 11;
  ctx.page.drawText(`Intestato a: ${d.contoMittenteIntestatoA || ""}`, { x: MARGIN.left + 8, y: ly, size: 8.5, font: ctx.font, color: COLOR.text });

  // Destra: Conto destinazione agenzia
  const rx = MARGIN.left + colW + 20;
  let ry = boxY - 12;
  ctx.page.drawText("PAGAMENTO A (Agenzia)", { x: rx, y: ry, size: 8.5, font: ctx.bold, color: COLOR.headerText });
  ry -= 12;
  ctx.page.drawText(d.agenziaNome || "", { x: rx, y: ry, size: 9, font: ctx.bold, color: COLOR.text });
  ry -= 11;
  ctx.page.drawText(`IBAN: ${d.ibanDestinazione || "—"}`, { x: rx, y: ry, size: 8.5, font: ctx.font, color: COLOR.text });
  ry -= 11;
  if (d.intestatoADestinazione) {
    ctx.page.drawText(`Intestato a: ${d.intestatoADestinazione}`, { x: rx, y: ry, size: 8.5, font: ctx.font, color: COLOR.text });
  }

  ctx.y = boxY - boxH - 8;
}

function drawTabella(ctx: Ctx, d: RimessaPdfData) {
  const cols = [
    { title: "N. Titolo",     w: 90,  align: "left" as const },
    { title: "Cliente",       w: 200, align: "left" as const },
    { title: "Data Cassa",    w: 70,  align: "center" as const },
    { title: "Premio Lordo",  w: 70,  align: "right" as const },
    { title: "Incassato",     w: 70,  align: "right" as const },
    { title: "Importo Rim.",  w: 75,  align: "right" as const },
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
  let totLordo = 0, totIncassato = 0, totRimessa = 0;
  for (const t of d.titoli) {
    const dataStr = t.data_messa_cassa ? formatDateIt(t.data_messa_cassa) : "—";
    const cells = [t.numero_titolo || "—", t.cliente || "—", dataStr, fmtEur(t.premio_lordo), fmtEur(t.importo_incassato), fmtEur(t.importo_rimessa)];
    let maxH = 0;
    cols.forEach((col, i) => {
      const lines = wrap(cells[i] || "", ctx.font, 8.5, col.w - 6);
      maxH = Math.max(maxH, lines.length * 9.5 + 4);
    });
    ensure(ctx, maxH + 2);
    const yTop = ctx.y;
    if (alt) {
      ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    }
    let cx = MARGIN.left;
    cols.forEach((col, i) => {
      drawCell(cells[i], cx, col.w, yTop - 2, ctx.font, 8.5, col.align);
      cx += col.w;
    });
    ctx.page.drawLine({ start: { x: MARGIN.left, y: yTop - maxH }, end: { x: MARGIN.left + CONTENT_W, y: yTop - maxH }, thickness: 0.2, color: COLOR.line });
    ctx.y = yTop - maxH;
    alt = !alt;
    totLordo += t.premio_lordo || 0;
    totIncassato += t.importo_incassato || 0;
    totRimessa += t.importo_rimessa || 0;
  }

  // Totals row
  spacer(ctx, 4);
  ensure(ctx, 16);
  const yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
  let cx = MARGIN.left;
  const labelW = cols[0].w + cols[1].w + cols[2].w;
  ctx.page.drawText("TOTALI", { x: cx + labelW - ctx.bold.widthOfTextAtSize("TOTALI", 9) - 6, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += labelW;
  for (const [w, val] of [[cols[3].w, totLordo], [cols[4].w, totIncassato], [cols[5].w, totRimessa]] as [number, number][]) {
    const s = fmtEur(val);
    ctx.page.drawText(s, { x: cx + w - ctx.bold.widthOfTextAtSize(s, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
    cx += w;
  }
  ctx.y -= 18;
}

function drawTotalePagato(ctx: Ctx, d: RimessaPdfData) {
  spacer(ctx, 8);
  ensure(ctx, 36);
  const boxY = ctx.y;
  const boxH = 30;
  const boxX = MARGIN.left + CONTENT_W - 260;
  ctx.page.drawRectangle({ x: boxX, y: boxY - boxH, width: 260, height: boxH, color: COLOR.headerBg });
  ctx.page.drawText("IMPORTO PAGATO", { x: boxX + 10, y: boxY - 18, size: 10, font: ctx.bold, color: COLOR.headerText });
  const v = `EUR ${fmtEur(d.importoPagato)}`;
  ctx.page.drawText(v, { x: boxX + 260 - ctx.bold.widthOfTextAtSize(v, 11) - 10, y: boxY - 19, size: 11, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= boxH + 6;
}

function drawNote(ctx: Ctx, d: RimessaPdfData) {
  if (d.note) {
    spacer(ctx, 10);
    drawText(ctx, "Note:", { size: 9, bold: true });
    drawText(ctx, d.note, { size: 8.5 });
  }
  spacer(ctx, 8);
  drawText(ctx, "Esente IVA Art. 10 - Comma 9 - DPR 26/10/72 - N. 633", { size: 8, italic: true });
  drawText(ctx, "Esente da Bollo Art. 34 - Comma 5x DPR 29/09/73 - n. 601", { size: 8, italic: true });
}

function formatDateIt(iso: string): string {
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export async function buildRimessaPdf(d: RimessaPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN.top, font, bold, italic };

  drawFooter(ctx);
  drawTopHeader(ctx, d);
  drawDestinatario(ctx, d);
  drawPagamentoBox(ctx, d);
  drawTabella(ctx, d);
  drawTotalePagato(ctx, d);
  drawNote(ctx, d);

  return await doc.save();
}
