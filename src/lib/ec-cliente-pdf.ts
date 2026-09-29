import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface ECCompensazioneRow {
  codice: string;
  descrizione: string;
  segno: "+" | "-";  // '+' riduce dovuto, '-' aumenta dovuto
  importo: number;
  note?: string;
}

export interface ECClienteRow {
  polizza: string;       // numero polizza
  ramo: string;          // descrizione ramo
  rischio: string;       // prodotto / descrizione polizza
  compagnia: string;
  effetto: string;       // dd/MM/yyyy
  premio: number;
  compensazioni?: ECCompensazioneRow[]; // opzionali, mostrate come sub-rows
}

/**
 * Partita di giroconto inter-cliente.
 * - verso 'dare'  → cliente beneficiario: la sua quietanza è stata saldata con
 *   acconti di un altro cliente → importo a DARE (aumenta il dovuto).
 * - verso 'avere' → cliente pagatore: ha usato i propri acconti per saldare
 *   quietanze altrui → importo ad AVERE (riduce il dovuto).
 */
export interface ECGirocontoRow {
  data: string;          // dd/MM/yyyy
  descrizione: string;
  verso: "dare" | "avere";
  importo: number;       // sempre positivo
}

export interface ECClienteData {
  // Mittente / sede
  sedeNome: string;
  sedeIndirizzo?: string;
  sedeCap?: string;
  sedeCitta?: string;
  sedeProvincia?: string;
  sedeTelefono?: string;
  sedeEmail?: string;
  // Destinatario (cliente)
  clienteIntestazione: string; // "Preg.ma Sig.ra ..." oppure "Spett.le ..."
  clienteNome: string;         // nome / cognome / ragione sociale
  clienteIndirizzo?: string;
  clienteCap?: string;
  clienteCitta?: string;
  clienteProvincia?: string;
  // Documento
  luogoData: string;           // "Napoli, 18/03/2026"
  oggetto: string;             // "Estratto conto premi"
  introTesto: string;
  // Tabella
  righe: ECClienteRow[];
  giroconti?: ECGirocontoRow[]; // partite inter-cliente (dare/avere)
  totale: number;
  // Pagamento
  intestatarioConto: string;
  bancaConto: string;
  iban: string;
  // Footer
  ragioneSocialeFooter: string;
  noteLegali: string[];        // es. ["Esente da Iva art. 10...", "Esente da bollo art. 34..."]
  footerLines: string[];       // contatti, sedi, P.IVA
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 50, right: 45, bottom: 60, left: 45 };
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
}
function ensure(ctx: Ctx, h: number) { if (ctx.y - h < MARGIN.bottom + 80) newPage(ctx); }

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
  const size = opts.size ?? 9.5;
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

function fmtEur(n: number): string {
  return (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ------- Header brand (top) -------
function drawBrand(ctx: Ctx) {
  ctx.page.drawText("CONSULBROKERS", { x: MARGIN.left, y: ctx.y - 14, size: 14, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText("SPA", { x: MARGIN.left + 116, y: ctx.y - 14, size: 11, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= 30;
}

// ------- Destinatario (blocco cliente in alto a destra) -------
function drawDestinatario(ctx: Ctx, d: ECClienteData) {
  const boxX = A4.w - MARGIN.right - 240;
  const boxW = 240;
  const topY = A4.h - MARGIN.top;
  const lines = [
    d.clienteIntestazione,
    d.clienteNome,
    d.clienteIndirizzo || "",
    [d.clienteCap, d.clienteCitta, d.clienteProvincia ? `(${d.clienteProvincia})` : ""].filter(Boolean).join(" "),
  ].filter((ln) => ln && ln.trim());

  const lineH = 13;
  const pad = 8;
  const boxH = Math.max(lines.length * lineH + pad * 2, 52);

  ctx.page.drawRectangle({
    x: boxX,
    y: topY - boxH,
    width: boxW,
    height: boxH,
    borderColor: COLOR.line,
    borderWidth: 0.6,
    color: rgb(0.99, 0.99, 0.99),
  });

  let ly = topY - pad - 10;
  for (let i = 0; i < lines.length; i++) {
    const f = i === 0 ? ctx.italic : i === 1 ? ctx.bold : ctx.font;
    const size = i === 1 ? 10 : 9.5;
    ctx.page.drawText(lines[i], { x: boxX + pad, y: ly - size, size, font: f, color: COLOR.text });
    ly -= lineH;
  }

  // Spazio sotto il blocco più ampio (brand + destinatario affiancati)
  const destBottom = topY - boxH - 12;
  ctx.y = Math.min(ctx.y, destBottom);
}

// ------- Luogo/Data + Oggetto -------
function drawIntro(ctx: Ctx, d: ECClienteData) {
  spacer(ctx, 10);
  drawText(ctx, d.luogoData, { size: 10 });
  spacer(ctx, 6);
  drawText(ctx, `Oggetto: ${d.oggetto}`, { size: 10, bold: true });
  spacer(ctx, 8);
  drawText(ctx, d.introTesto, { size: 10 });
  spacer(ctx, 10);
}

// ------- Tabella -------
function drawTabella(ctx: Ctx, d: ECClienteData) {
  const cols = [
    { key: "polizza",   title: "polizza",    w: 75,  align: "left" as const },
    { key: "ramo",      title: "ramo",       w: 95,  align: "left" as const },
    { key: "rischio",   title: "rischio",    w: 130, align: "left" as const },
    { key: "compagnia", title: "Compagnia",  w: 100, align: "left" as const },
    { key: "effetto",   title: "Effetto",    w: 70,  align: "center" as const },
    { key: "premio",    title: "Premio",     w: 65,  align: "right" as const },
  ];
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / sumW;
  cols.forEach((c) => (c.w = c.w * scale));

  // Header
  ensure(ctx, 18);
  let yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 16, width: CONTENT_W, height: 16, color: COLOR.headerBg });
  let cx = MARGIN.left;
  for (const col of cols) {
    let tx = cx + 4;
    const tw = ctx.bold.widthOfTextAtSize(col.title, 9);
    if (col.align === "right") tx = cx + col.w - tw - 4;
    else if (col.align === "center") tx = cx + (col.w - tw) / 2;
    ctx.page.drawText(col.title, { x: tx, y: yTop - 11, size: 9, font: ctx.bold, color: COLOR.headerText });
    cx += col.w;
  }
  ctx.y -= 18;

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
    const cells = [r.polizza, r.ramo, r.rischio, r.compagnia, r.effetto, fmtEur(r.premio)];
    let maxH = 0;
    cols.forEach((col, i) => {
      const lines = wrap(cells[i] || "", ctx.font, 9, col.w - 6);
      maxH = Math.max(maxH, lines.length * 10 + 6);
    });
    ensure(ctx, maxH + 2);
    const yT = ctx.y;
    if (alt) ctx.page.drawRectangle({ x: MARGIN.left, y: yT - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    let cx2 = MARGIN.left;
    cols.forEach((col, i) => {
      const f = col.key === "premio" ? ctx.bold : ctx.font;
      drawCell(cells[i], cx2, col.w, yT - 3, f, 9, col.align);
      cx2 += col.w;
    });
    ctx.page.drawLine({ start: { x: MARGIN.left, y: yT - maxH }, end: { x: MARGIN.left + CONTENT_W, y: yT - maxH }, thickness: 0.2, color: COLOR.line });
    ctx.y = yT - maxH;

    // Sub-rows: compensazioni contabili applicate (abbuoni, sconti, arrotondamenti)
    if (r.compensazioni && r.compensazioni.length > 0) {
      const subSize = 8;
      const indent = 18;
      for (const c of r.compensazioni) {
        ensure(ctx, subSize + 4);
        const ySub = ctx.y;
        if (alt) ctx.page.drawRectangle({ x: MARGIN.left, y: ySub - (subSize + 4), width: CONTENT_W, height: subSize + 4, color: COLOR.rowAlt });
        const segnoMostrato = c.segno === "+" ? "−" : "+"; // effetto su importo dovuto cliente
        const label = `   ↳ ${c.codice} — ${c.descrizione}${c.note ? ` (${c.note})` : ""}`;
        const importoStr = `${segnoMostrato} ${fmtEur(c.importo)}`;
        ctx.page.drawText(label, { x: MARGIN.left + indent, y: ySub - subSize - 1, size: subSize, font: ctx.italic, color: COLOR.muted });
        const iw = ctx.bold.widthOfTextAtSize(importoStr, subSize);
        ctx.page.drawText(importoStr, {
          x: MARGIN.left + CONTENT_W - iw - 4,
          y: ySub - subSize - 1,
          size: subSize,
          font: ctx.bold,
          color: c.segno === "+" ? rgb(0.0, 0.45, 0.15) : rgb(0.65, 0.1, 0.1),
        });
        ctx.y = ySub - (subSize + 4);
        ctx.page.drawLine({ start: { x: MARGIN.left, y: ctx.y }, end: { x: MARGIN.left + CONTENT_W, y: ctx.y }, thickness: 0.15, color: COLOR.line });
      }
    }

    alt = !alt;
  }

  // Giroconti inter-cliente (partite dare/avere)
  for (const g of d.giroconti || []) {
    const isDare = g.verso === "dare";
    const importoStr = `${isDare ? "" : "− "}${fmtEur(g.importo)}`;
    const cells = [
      "Giroconto",
      g.data,
      g.descrizione,
      "",
      isDare ? "DARE" : "AVERE",
      importoStr,
    ];
    let maxH = 0;
    cols.forEach((col, i) => {
      const lines = wrap(cells[i] || "", ctx.font, 9, col.w - 6);
      maxH = Math.max(maxH, lines.length * 10 + 6);
    });
    ensure(ctx, maxH + 2);
    const yT = ctx.y;
    if (alt) ctx.page.drawRectangle({ x: MARGIN.left, y: yT - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    let cx3 = MARGIN.left;
    cols.forEach((col, i) => {
      const f = col.key === "premio" ? ctx.bold : ctx.italic;
      const color = col.key === "premio" ? (isDare ? rgb(0.65, 0.1, 0.1) : rgb(0.0, 0.45, 0.15)) : COLOR.muted;
      const lines = wrap(cells[i] || "", f, 9, col.w - 6);
      let ly = yT - 3;
      for (const ln of lines) {
        let tx = cx3 + 3;
        if (col.align === "right") tx = cx3 + col.w - f.widthOfTextAtSize(ln, 9) - 4;
        else if (col.align === "center") tx = cx3 + (col.w - f.widthOfTextAtSize(ln, 9)) / 2;
        ctx.page.drawText(ln, { x: tx, y: ly - 9, size: 9, font: f, color });
        ly -= 10;
      }
      cx3 += col.w;
    });
    ctx.page.drawLine({ start: { x: MARGIN.left, y: yT - maxH }, end: { x: MARGIN.left + CONTENT_W, y: yT - maxH }, thickness: 0.2, color: COLOR.line });
    ctx.y = yT - maxH;
    alt = !alt;
  }

  // Totale
  spacer(ctx, 4);
  ensure(ctx, 18);
  yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 16, width: CONTENT_W, height: 16, color: COLOR.headerBg });
  const labelW = cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w;
  const labelText = "Totale EURO";
  const lw = ctx.bold.widthOfTextAtSize(labelText, 10);
  ctx.page.drawText(labelText, { x: MARGIN.left + labelW - lw - 6, y: yTop - 11, size: 10, font: ctx.bold, color: COLOR.headerText });
  const totT = fmtEur(d.totale);
  const tw = ctx.bold.widthOfTextAtSize(totT, 10);
  ctx.page.drawText(totT, { x: MARGIN.left + CONTENT_W - tw - 4, y: yTop - 11, size: 10, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= 22;
}

// ------- Blocco IBAN pagamento -------
function drawPagamento(ctx: Ctx, d: ECClienteData) {
  spacer(ctx, 8);
  drawText(ctx, "Il pagamento potrà essere effettuato tramite bonifico bancario sul seguente conto corrente a noi intestato:", { size: 9.5 });
  spacer(ctx, 6);
  drawText(ctx, d.intestatarioConto, { size: 10, bold: true });
  drawText(ctx, d.bancaConto, { size: 9.5 });
  drawText(ctx, `IBAN: ${d.iban}`, { size: 9.5, bold: true });
  spacer(ctx, 14);
  drawText(ctx, d.ragioneSocialeFooter, { size: 10, bold: true });
  spacer(ctx, 8);
  for (const ln of d.noteLegali) drawText(ctx, ln, { size: 9, italic: true });
}

// ------- Footer (every page) -------
function drawFooter(ctx: Ctx, d: ECClienteData) {
  const fy = MARGIN.bottom - 20;
  ctx.page.drawLine({ start: { x: MARGIN.left, y: fy + 32 }, end: { x: A4.w - MARGIN.right, y: fy + 32 }, thickness: 0.4, color: COLOR.line });
  let ly = fy + 26;
  for (const ln of d.footerLines) {
    const w = ctx.font.widthOfTextAtSize(ln, 7);
    ctx.page.drawText(ln, { x: (A4.w - w) / 2, y: ly, size: 7, font: ctx.font, color: COLOR.muted });
    ly -= 8;
  }
}

export async function buildECClientePdf(d: ECClienteData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN.top, font, bold, italic };

  drawBrand(ctx);
  drawDestinatario(ctx, d);
  drawIntro(ctx, d);
  drawTabella(ctx, d);
  drawPagamento(ctx, d);

  // Footer su tutte le pagine
  for (const p of doc.getPages()) {
    const tmpCtx = { ...ctx, page: p };
    drawFooter(tmpCtx as Ctx, d);
  }

  return await doc.save();
}
