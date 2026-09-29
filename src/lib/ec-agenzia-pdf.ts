import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface ECAgenziaTitolo {
  polizza: string;        // "36099 - 6"
  cliente: string;        // "LICEO SCIENTIFICO ..."
  noteCliente?: string;   // "ZB63217ACE" (riferimento polizza/CIG)
  ramo: string;           // "ALL RISKS"
  periodo: string;        // "31/08/2025 31/08/2026"
  tp: string;             // PI / PQ / AM
  premio: number;
  provvigioni: number;
  mi: string;             // A/B/C/*
}

export interface ECAgenziaData {
  // Sede mittente (intestazione)
  sedeNome: string;
  sedeIndirizzo?: string;
  sedeCap?: string;
  sedeCitta?: string;
  sedeProvincia?: string;
  sedeEmail?: string;
  sedeTelefono?: string;
  // Documento
  riferimento: string;            // "BENAQ0/250338"
  dataDocumento: string;          // "10/11/2025"
  periodoTesto: string;           // "Ottobre 2025"
  modalitaPagamento: string;      // "Bonifico"
  // Agenzia destinataria
  agenziaNome: string;            // "AIG C/O BENACQUISTA ASS.NI Srl"
  compagniaCollegata?: string;    // "AIG" (gruppo compagnia mandataria)
  agenziaIndirizzo: string;       // "VIA DEL LIDO, 106"
  agenziaCap: string;             // "04100"
  agenziaCitta: string;           // "LATINA"
  agenziaProvincia: string;       // "LT"
  agenziaCF?: string;
  agenziaPIVA?: string;
  iban: string;                   // "IT85P..."
  intestatoA: string;             // "BENACQUISTA ASSICURAZIONI SNC"
  // Tabella
  titoli: ECAgenziaTitolo[];
  totalePremio: number;
  totaleProvvigioni: number;
  ritenutaAcconto: number;        // somma RA (può essere 0)
  /** Solo export bulk PDF E/C completi: split incassati vs copertura garantita. */
  riepilogoIncasso?: ECRiepilogoIncasso;
  // Footer
  noteFinali?: string;
}

export interface ECRiepilogoIncassoVoce {
  premio: number;
  daRimettere: number;
}

export interface ECRiepilogoIncasso {
  incassati: ECRiepilogoIncassoVoce;
  nonIncassati: ECRiepilogoIncassoVoce;
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
    if (opts.align === "center") { drawX = x + (maxW - f.widthOfTextAtSize(ln, size)) / 2; }
    else if (opts.align === "right") { drawX = x + maxW - f.widthOfTextAtSize(ln, size); }
    ctx.page.drawText(ln, { x: drawX, y: ctx.y - size, size, font: f, color: COLOR.text });
    ctx.y -= size + 2;
  }
}

function spacer(ctx: Ctx, h: number) { ensure(ctx, h); ctx.y -= h; }

function fmtEur(n: number): string {
  return (n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ------- Header (top of first page) -------
function drawTopHeader(ctx: Ctx, d: ECAgenziaData) {
  // Brand block (left)
  ctx.page.drawText("CONSULBROKERS", { x: MARGIN.left, y: ctx.y - 14, size: 14, font: ctx.bold, color: COLOR.headerText });
  ctx.page.drawText("S.p.A.", { x: MARGIN.left + 116, y: ctx.y - 14, size: 9, font: ctx.font, color: COLOR.muted });
  ctx.page.drawText(d.sedeNome || "", { x: MARGIN.left, y: ctx.y - 28, size: 9, font: ctx.bold, color: COLOR.text });
  const indir = [d.sedeIndirizzo, [d.sedeCap, d.sedeCitta].filter(Boolean).join(" "), d.sedeProvincia ? `(${d.sedeProvincia})` : ""].filter(Boolean).join(" - ");
  if (indir) ctx.page.drawText(indir, { x: MARGIN.left, y: ctx.y - 40, size: 8.5, font: ctx.font, color: COLOR.text });
  const contatti = [d.sedeTelefono ? `Tel: ${d.sedeTelefono}` : "", d.sedeEmail || ""].filter(Boolean).join("   ");
  if (contatti) ctx.page.drawText(contatti, { x: MARGIN.left, y: ctx.y - 52, size: 8.5, font: ctx.font, color: COLOR.muted });

  // Title (right)
  const title = `Estratto conto del ${d.dataDocumento}`;
  const wT = ctx.bold.widthOfTextAtSize(title, 11);
  ctx.page.drawText(title, { x: A4.w - MARGIN.right - wT, y: ctx.y - 14, size: 11, font: ctx.bold, color: COLOR.headerText });
  const rif = `Rif: ${d.riferimento || ""}`;
  const wR = ctx.font.widthOfTextAtSize(rif, 9);
  ctx.page.drawText(rif, { x: A4.w - MARGIN.right - wR, y: ctx.y - 28, size: 9, font: ctx.font, color: COLOR.text });

  ctx.y -= 70;

  // Separator
  ctx.page.drawLine({ start: { x: MARGIN.left, y: ctx.y }, end: { x: A4.w - MARGIN.right, y: ctx.y }, thickness: 0.6, color: COLOR.line });
  ctx.y -= 10;
}

// ------- Destinatario box -------
function drawDestinatario(ctx: Ctx, d: ECAgenziaData) {
  const boxX = A4.w - MARGIN.right - 250;
  const boxY = ctx.y;
  const lines: string[] = [
    "Spettabile",
    d.agenziaNome || "",
  ];
  if (d.compagniaCollegata && d.compagniaCollegata !== d.agenziaNome) {
    lines.push(`Compagnia: ${d.compagniaCollegata}`);
  }
  lines.push(
    d.agenziaIndirizzo || "",
    [d.agenziaCap, d.agenziaCitta, d.agenziaProvincia].filter(Boolean).join(" "),
  );
  if (d.agenziaCF) lines.push(`Codice fiscale: ${d.agenziaCF}`);
  if (d.agenziaPIVA && d.agenziaPIVA !== d.agenziaCF) lines.push(`P. IVA: ${d.agenziaPIVA}`);

  let ly = boxY;
  for (const ln of lines) {
    const isFirst = ln === "Spettabile";
    ctx.page.drawText(ln, { x: boxX, y: ly - 10, size: 9, font: isFirst ? ctx.italic : ctx.bold, color: COLOR.text });
    ly -= 12;
  }
  ctx.y = Math.min(ctx.y, ly) - 6;
}

// ------- Intro + Pagamento -------
function drawIntro(ctx: Ctx, d: ECAgenziaData) {
  spacer(ctx, 8);
  drawText(ctx, `A saldo delle operazioni effettuate per conto della Vostra Agenzia per il periodo: ${d.periodoTesto}.`, { size: 9.5 });
  spacer(ctx, 6);
  drawText(ctx, `Pagamento a mezzo ${d.modalitaPagamento || "Bonifico"}`, { size: 9, bold: true });
  if (d.iban) drawText(ctx, `c/c: ${d.iban}`, { size: 9 });
  if (d.intestatoA) drawText(ctx, `intestato a ${d.intestatoA}`, { size: 9 });
  spacer(ctx, 8);
}

// ------- Tabella titoli -------
function drawTabella(ctx: Ctx, d: ECAgenziaData) {
  // Column widths sum = CONTENT_W
  const cols = [
    { key: "polizza", title: "Polizza Delegataria", w: 80, align: "left" as const },
    { key: "cliente", title: "Cliente / Note", w: 150, align: "left" as const },
    { key: "ramo",    title: "Ramo / Periodo",    w: 120, align: "left" as const },
    { key: "tp",      title: "tp",                w: 28,  align: "center" as const },
    { key: "premio",  title: "Premio",            w: 60,  align: "right" as const },
    { key: "provv",   title: "Provvigioni",       w: 60,  align: "right" as const },
    { key: "mi",      title: "MI",                w: 18,  align: "center" as const },
  ];
  // Normalize widths to CONTENT_W
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
    return y - ly; // height consumed
  };

  let alt = false;
  for (const t of d.titoli) {
    // Compose multi-line cells like the model
    const clienteCell = [t.cliente || "", t.noteCliente || ""].filter(Boolean).join("\n");
    const ramoCell = [t.ramo || "", t.periodo || ""].filter(Boolean).join("\n");

    const cellsTexts = [t.polizza || "", clienteCell, ramoCell, t.tp || "", fmtEur(t.premio), fmtEur(t.provvigioni), t.mi || ""];

    // Compute height needed
    let maxH = 0;
    cols.forEach((col, i) => {
      const lines = wrap(cellsTexts[i] || "", ctx.font, 8.5, col.w - 6);
      maxH = Math.max(maxH, lines.length * 9.5 + 4);
    });

    ensure(ctx, maxH + 2);
    const yTop = ctx.y;
    if (alt) {
      ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - maxH, width: CONTENT_W, height: maxH, color: COLOR.rowAlt });
    }
    let cx = MARGIN.left;
    cols.forEach((col, i) => {
      drawCell(cellsTexts[i], cx, col.w, yTop - 2, ctx.font, 8.5, col.align);
      cx += col.w;
    });
    // Bottom border
    ctx.page.drawLine({ start: { x: MARGIN.left, y: yTop - maxH }, end: { x: MARGIN.left + CONTENT_W, y: yTop - maxH }, thickness: 0.2, color: COLOR.line });
    ctx.y = yTop - maxH;
    alt = !alt;
  }

  // Totals row "EURO  <Premio>  <Provv>"
  spacer(ctx, 4);
  ensure(ctx, 16);
  const yTop = ctx.y;
  ctx.page.drawRectangle({ x: MARGIN.left, y: yTop - 14, width: CONTENT_W, height: 14, color: COLOR.headerBg });
  let cx = MARGIN.left;
  // Spans first 3 cols
  const labelW = cols[0].w + cols[1].w + cols[2].w + cols[3].w;
  ctx.page.drawText("EURO", { x: cx + labelW - ctx.bold.widthOfTextAtSize("EURO", 9) - 6, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += labelW;
  const totPrem = fmtEur(d.totalePremio);
  ctx.page.drawText(totPrem, { x: cx + cols[4].w - ctx.bold.widthOfTextAtSize(totPrem, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  cx += cols[4].w;
  const totProv = fmtEur(d.totaleProvvigioni);
  ctx.page.drawText(totProv, { x: cx + cols[5].w - ctx.bold.widthOfTextAtSize(totProv, 9) - 4, y: yTop - 10, size: 9, font: ctx.bold, color: COLOR.headerText });
  ctx.y -= 18;
}

// ------- Riepilogo finale -------
function drawTotali(ctx: Ctx, d: ECAgenziaData) {
  const debitoCredito = d.totalePremio - d.totaleProvvigioni;
  const aVostroCredito = debitoCredito + d.ritenutaAcconto;

  spacer(ctx, 6);
  const rightX = MARGIN.left + CONTENT_W - 220;
  const drawLine = (label: string, value: number, bold = false) => {
    ensure(ctx, 14);
    const f = bold ? ctx.bold : ctx.font;
    ctx.page.drawText(label, { x: rightX, y: ctx.y - 10, size: 9, font: f, color: COLOR.text });
    const v = fmtEur(value);
    ctx.page.drawText(v, { x: MARGIN.left + CONTENT_W - f.widthOfTextAtSize(v, 9) - 4, y: ctx.y - 10, size: 9, font: f, color: COLOR.text });
    ctx.y -= 13;
  };
  drawLine("Debito/Credito", debitoCredito);
  drawLine("+ Ritenuta Acconto", d.ritenutaAcconto);
  // separator
  ensure(ctx, 4);
  ctx.page.drawLine({ start: { x: rightX, y: ctx.y - 1 }, end: { x: MARGIN.left + CONTENT_W, y: ctx.y - 1 }, thickness: 0.6, color: COLOR.line });
  ctx.y -= 4;
  drawLine("A Vostro Credito", aVostroCredito, true);

  if (d.riepilogoIncasso) {
    spacer(ctx, 10);
    drawText(ctx, "Riepilogo per stato incasso", { size: 9, bold: true });
    spacer(ctx, 4);
    drawLine("Totale incassati", d.riepilogoIncasso.incassati.daRimettere);
    drawLine("Totale non incassati", d.riepilogoIncasso.nonIncassati.daRimettere);
  }
}

// ------- Note legali -------
function drawNote(ctx: Ctx, d: ECAgenziaData) {
  spacer(ctx, 10);
  drawText(ctx, "(MI) Modalità Incasso: A=Assegno, B=Bonifico, C=Contanti, *=Broker", { size: 8, italic: true });
  drawText(ctx, "Esente IVA Art. 10 - Comma 9 - DPR 26/10/72 - N. 633", { size: 8, italic: true });
  drawText(ctx, "Esente da Bollo Art. 34 - Comma 5x DPR 29/09/73 - n. 601", { size: 8, italic: true });
  if (d.noteFinali) {
    spacer(ctx, 4);
    drawText(ctx, d.noteFinali, { size: 8.5 });
  }
}

// ------- Footer (every page) -------
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

export async function buildECAgenziaPdf(d: ECAgenziaData): Promise<Uint8Array> {
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
  drawTotali(ctx, d);
  drawNote(ctx, d);

  return await doc.save();
}
