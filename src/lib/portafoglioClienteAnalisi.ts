import { format } from "date-fns";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import * as XLSX from "xlsx";
import { classifyDoc } from "@/lib/clienteDocumentiTypes";

export type AnalisiPolizzaRow = {
  id: string;
  numero_titolo: string | null;
  stato: string | null;
  ramo_nome: string | null;
  compagnia_nome: string | null;
  premio_lordo: number | null;
  garanzia_da: string | null;
  garanzia_a: string | null;
  data_scadenza: string | null;
  tacito_rinnovo: boolean | null;
  prodotto_nome: string | null;
  produttore_nome: string | null;
  nome_ufficio: string | null;
  ufficio_id: string | null;
};

export type AnalisiClienteAssegnazioni = {
  produttoreLabel: string | null;
  ufficioLabel: string | null;
};

export type AnalisiGaranziaRow = {
  titolo_id: string;
  numero_polizza: string | null;
  garanzia: string;
  capitale: number | null;
  firma: number | null;
  rata: number | null;
  tipo_premio: string | null;
};

export type AnalisiCgaStato = {
  titolo_id: string | null;
  polizza_cga_id: string;
  stato: string;
  numero_polizza: string | null;
  prodotto_nome: string | null;
  compagnia: string | null;
};

export type AnalisiCgaDettaglio = {
  polizza_cga_id: string;
  titolo_id: string | null;
  numero_polizza: string | null;
  prodotto_nome: string | null;
  compagnia: string | null;
  sommario: string | null;
  massimale_aggregato: number | null;
  garanzie: Array<{
    garanzia: string;
    massimale: number | null;
    franchigia: number | null;
    scoperto: number | null;
    note: string | null;
  }>;
  condizioni: Array<{
    tipo: string | null;
    titolo: string | null;
    testo: string;
  }>;
};

/** Documento già in archivio che sembra una CGA / condizioni (senza riga polizza_cga). */
export type AnalisiDocCgaHint = {
  titolo_id: string;
  documento_id: string;
  nome_file: string | null;
};

export type AnalisiCgaUiStatus =
  | { kind: "elaborata"; stato: string }
  | { kind: "documento"; nome_file: string | null }
  | { kind: "assente" };

export function resolveAnalisiCgaUiStatus(
  cga: AnalisiCgaStato | null | undefined,
  docHint: AnalisiDocCgaHint | null | undefined,
): AnalisiCgaUiStatus {
  if (cga) return { kind: "elaborata", stato: cga.stato };
  if (docHint) return { kind: "documento", nome_file: docHint.nome_file };
  return { kind: "assente" };
}

export function isDocumentoCgaHint(categoria: string | null | undefined, nomeFile: string | null | undefined): boolean {
  if ((categoria || "").toLowerCase().includes("cga")) return true;
  return classifyDoc(categoria, nomeFile).key === "condizioni";
}

const fmtEur = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
};

const dash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

export function exportAnalisiClienteExcel(opts: {
  clienteLabel: string;
  assegnazioni?: AnalisiClienteAssegnazioni | null;
  polizze: AnalisiPolizzaRow[];
  garanzie: AnalisiGaranziaRow[];
  cgaDettagli: AnalisiCgaDettaglio[];
}) {
  const wb = XLSX.utils.book_new();

  const meta = [
    { Campo: "Cliente", Valore: opts.clienteLabel },
    { Campo: "Produttore", Valore: dash(opts.assegnazioni?.produttoreLabel) },
    { Campo: "Sede", Valore: dash(opts.assegnazioni?.ufficioLabel) },
    { Campo: "Generato il", Valore: format(new Date(), "dd/MM/yyyy HH:mm") },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Cliente");

  const sheetPolizze = opts.polizze.map((p) => ({
    Polizza: p.numero_titolo || "",
    Stato: p.stato || "",
    Ramo: p.ramo_nome || "",
    Agenzia: p.compagnia_nome || "",
    Prodotto: p.prodotto_nome || "",
    Produttore: p.produttore_nome || opts.assegnazioni?.produttoreLabel || "",
    Sede: p.nome_ufficio || opts.assegnazioni?.ufficioLabel || "",
    "Premio lordo (€)": Number(p.premio_lordo) || 0,
    "Inizio garanzia": p.garanzia_da || "",
    "Fine garanzia": p.garanzia_a || p.data_scadenza || "",
    "Tacito rinnovo": p.tacito_rinnovo == null ? "" : p.tacito_rinnovo ? "Sì" : "No",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetPolizze), "Polizze");

  const sheetGar = opts.garanzie.map((g) => ({
    Polizza: g.numero_polizza || "",
    Garanzia: g.garanzia,
    "Capitale / Massimale gestionale": g.capitale ?? "",
    "Premio firma": g.firma ?? "",
    "Premio rata": g.rata ?? "",
    "Tipo premio": g.tipo_premio || "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetGar.length ? sheetGar : [{ Garanzia: "(nessuna)" }]), "Garanzie gestionali");

  const sheetMass = opts.cgaDettagli.flatMap((c) =>
    c.garanzie.length
      ? c.garanzie.map((g) => ({
          Polizza: c.numero_polizza || "",
          Prodotto: c.prodotto_nome || "",
          Compagnia: c.compagnia || "",
          Garanzia: g.garanzia,
          Massimale: g.massimale ?? "",
          Franchigia: g.franchigia ?? "",
          Scoperto: g.scoperto ?? "",
          Note: g.note || "",
        }))
      : [
          {
            Polizza: c.numero_polizza || "",
            Prodotto: c.prodotto_nome || "",
            Compagnia: c.compagnia || "",
            Garanzia: "(nessuna garanzia CGA)",
            Massimale: "",
            Franchigia: "",
            Scoperto: "",
            Note: "",
          },
        ],
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(sheetMass.length ? sheetMass : [{ Polizza: "(nessuna CGA)" }]),
    "Massimali CGA",
  );

  const sheetCond = opts.cgaDettagli.flatMap((c) =>
    c.condizioni.map((cond) => ({
      Polizza: c.numero_polizza || "",
      Prodotto: c.prodotto_nome || "",
      Tipo: cond.tipo || "",
      Titolo: cond.titolo || "",
      Testo: cond.testo,
    })),
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(sheetCond.length ? sheetCond : [{ Testo: "(nessuna condizione CGA)" }]),
    "Condizioni CGA",
  );

  const safe = opts.clienteLabel.replace(/[^\w\-]+/g, "_").slice(0, 40);
  XLSX.writeFile(wb, `analisi_cliente_${safe}_${format(new Date(), "yyyyMMdd")}.xlsx`);
}

/** Brand palette allineata a EC agenzia / rimessa / messe a cassa / sinistri-ente. */
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 42, right: 36, bottom: 52, left: 36 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;
const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.65, 0.65, 0.65),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
  bandAccent: rgb(0.043, 0.298, 0.314), // #0B4C50 (chat-pdf / brand teal)
  rowAlt: rgb(0.96, 0.97, 0.97),
  boxBg: rgb(0.97, 0.98, 0.98),
  totBg: rgb(0.78, 0.84, 0.81),
  emptyBg: rgb(0.94, 0.96, 0.95),
};

export type AnalisiPdfClienteMeta = {
  codiceFiscale?: string | null;
  partitaIva?: string | null;
};

type PdfCtx = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pageNum: number;
  docTitle: string;
  generatedAt: string;
};

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text || "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > maxW && line) {
        out.push(line);
        line = w;
      } else {
        line = cand;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function truncate(s: string, font: PDFFont, size: number, maxW: number): string {
  if (!s) return "";
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (font.widthOfTextAtSize(`${s.slice(0, mid)}…`, size) <= maxW) lo = mid + 1;
    else hi = mid;
  }
  return `${s.slice(0, Math.max(0, lo - 1))}…`;
}

function drawPageFooter(ctx: PdfCtx) {
  const fy = 18;
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: fy + 26 },
    end: { x: A4.w - MARGIN.right, y: fy + 26 },
    thickness: 0.4,
    color: COLOR.line,
  });
  const left = `CONSULBROKERS S.p.A.  ·  CBnet  ·  ${ctx.generatedAt}`;
  const mid = "Documento riservato — uso interno / cliente";
  const right = `Pag. ${ctx.pageNum}`;
  ctx.page.drawText(left, { x: MARGIN.left, y: fy + 14, size: 6.5, font: ctx.font, color: COLOR.muted });
  const midW = ctx.font.widthOfTextAtSize(mid, 6.5);
  ctx.page.drawText(mid, {
    x: (A4.w - midW) / 2,
    y: fy + 4,
    size: 6.5,
    font: ctx.font,
    color: COLOR.muted,
  });
  const rightW = ctx.font.widthOfTextAtSize(right, 7);
  ctx.page.drawText(right, {
    x: A4.w - MARGIN.right - rightW,
    y: fy + 14,
    size: 7,
    font: ctx.bold,
    color: COLOR.muted,
  });
}

function newPage(ctx: PdfCtx, withContinuationHeader = false) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pageNum += 1;
  drawPageFooter(ctx);
  ctx.y = A4.h - MARGIN.top;
  if (withContinuationHeader) {
    ctx.page.drawText("CONSULBROKERS", {
      x: MARGIN.left,
      y: ctx.y - 10,
      size: 9,
      font: ctx.bold,
      color: COLOR.headerText,
    });
    const cont = `${ctx.docTitle} (segue)`;
    const w = ctx.font.widthOfTextAtSize(cont, 8);
    ctx.page.drawText(cont, {
      x: A4.w - MARGIN.right - w,
      y: ctx.y - 10,
      size: 8,
      font: ctx.font,
      color: COLOR.muted,
    });
    ctx.y -= 18;
    ctx.page.drawLine({
      start: { x: MARGIN.left, y: ctx.y },
      end: { x: A4.w - MARGIN.right, y: ctx.y },
      thickness: 0.5,
      color: COLOR.line,
    });
    ctx.y -= 12;
  }
}

function ensure(ctx: PdfCtx, h: number) {
  if (ctx.y - h < MARGIN.bottom + 8) newPage(ctx, true);
}

function spacer(ctx: PdfCtx, h: number) {
  ensure(ctx, h);
  ctx.y -= h;
}

function drawBrandHeader(ctx: PdfCtx, title: string, subtitle: string) {
  const bandH = 56;
  ctx.page.drawRectangle({
    x: 0,
    y: A4.h - bandH,
    width: A4.w,
    height: bandH,
    color: COLOR.headerBg,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: A4.h - bandH,
    width: 5,
    height: bandH,
    color: COLOR.bandAccent,
  });

  ctx.page.drawText("CONSULBROKERS", {
    x: MARGIN.left,
    y: A4.h - 22,
    size: 13,
    font: ctx.bold,
    color: COLOR.headerText,
  });
  ctx.page.drawText("S.p.A.  ·  CBnet", {
    x: MARGIN.left + 112,
    y: A4.h - 22,
    size: 8,
    font: ctx.font,
    color: COLOR.muted,
  });
  ctx.page.drawText("Broker assicurativo", {
    x: MARGIN.left,
    y: A4.h - 36,
    size: 8,
    font: ctx.font,
    color: COLOR.muted,
  });

  const tw = ctx.bold.widthOfTextAtSize(title, 12);
  ctx.page.drawText(title, {
    x: A4.w - MARGIN.right - tw,
    y: A4.h - 22,
    size: 12,
    font: ctx.bold,
    color: COLOR.headerText,
  });
  const sw = ctx.font.widthOfTextAtSize(subtitle, 8);
  ctx.page.drawText(subtitle, {
    x: A4.w - MARGIN.right - sw,
    y: A4.h - 36,
    size: 8,
    font: ctx.font,
    color: COLOR.muted,
  });

  ctx.y = A4.h - bandH - 14;
}

function drawClienteBlock(
  ctx: PdfCtx,
  opts: {
    clienteLabel: string;
    assegnazioni?: AnalisiClienteAssegnazioni | null;
    meta?: AnalisiPdfClienteMeta | null;
  },
) {
  ensure(ctx, 78);
  const boxH = 72;
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
  ctx.page.drawRectangle({
    x: MARGIN.left,
    y: yTop - 16,
    width: CONTENT_W,
    height: 16,
    color: COLOR.headerBg,
  });
  ctx.page.drawText("Cliente", {
    x: MARGIN.left + 8,
    y: yTop - 12,
    size: 8,
    font: ctx.bold,
    color: COLOR.headerText,
  });

  let ly = yTop - 30;
  ctx.page.drawText(truncate(opts.clienteLabel, ctx.bold, 11, CONTENT_W - 16), {
    x: MARGIN.left + 8,
    y: ly,
    size: 11,
    font: ctx.bold,
    color: COLOR.text,
  });
  ly -= 14;

  const ids: string[] = [];
  if (opts.meta?.partitaIva) ids.push(`P.IVA ${opts.meta.partitaIva}`);
  if (opts.meta?.codiceFiscale) ids.push(`CF ${opts.meta.codiceFiscale}`);
  if (ids.length) {
    ctx.page.drawText(ids.join("   ·   "), {
      x: MARGIN.left + 8,
      y: ly,
      size: 8,
      font: ctx.font,
      color: COLOR.muted,
    });
    ly -= 13;
  }

  const half = CONTENT_W / 2;
  ctx.page.drawText("Produttore", {
    x: MARGIN.left + 8,
    y: ly,
    size: 7,
    font: ctx.font,
    color: COLOR.muted,
  });
  ctx.page.drawText("Sede", {
    x: MARGIN.left + half + 4,
    y: ly,
    size: 7,
    font: ctx.font,
    color: COLOR.muted,
  });
  ly -= 11;
  ctx.page.drawText(truncate(dash(opts.assegnazioni?.produttoreLabel), ctx.bold, 9, half - 16), {
    x: MARGIN.left + 8,
    y: ly,
    size: 9,
    font: ctx.bold,
    color: COLOR.text,
  });
  ctx.page.drawText(truncate(dash(opts.assegnazioni?.ufficioLabel), ctx.bold, 9, half - 16), {
    x: MARGIN.left + half + 4,
    y: ly,
    size: 9,
    font: ctx.bold,
    color: COLOR.text,
  });

  ctx.y = yTop - boxH - 12;
}

function drawSectionTitle(ctx: PdfCtx, title: string) {
  ensure(ctx, 22);
  ctx.page.drawRectangle({
    x: MARGIN.left,
    y: ctx.y - 16,
    width: CONTENT_W,
    height: 16,
    color: COLOR.headerBg,
  });
  ctx.page.drawText(title, {
    x: MARGIN.left + 6,
    y: ctx.y - 12,
    size: 8.5,
    font: ctx.bold,
    color: COLOR.headerText,
  });
  ctx.y -= 20;
}

function drawKpis(ctx: PdfCtx, items: Array<{ label: string; value: string }>) {
  ensure(ctx, 44);
  const gap = 8;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const h = 38;
  let x = MARGIN.left;
  for (const it of items) {
    ctx.page.drawRectangle({
      x,
      y: ctx.y - h,
      width: w,
      height: h,
      color: COLOR.rowAlt,
      borderColor: COLOR.line,
      borderWidth: 0.5,
    });
    ctx.page.drawText(it.label, {
      x: x + 8,
      y: ctx.y - 14,
      size: 7.5,
      font: ctx.font,
      color: COLOR.muted,
    });
    ctx.page.drawText(truncate(it.value, ctx.bold, 11, w - 14), {
      x: x + 8,
      y: ctx.y - 30,
      size: 11,
      font: ctx.bold,
      color: COLOR.headerText,
    });
    x += w + gap;
  }
  ctx.y -= h + 10;
}

function drawWrapped(
  ctx: PdfCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; maxW?: number; gap?: number } = {},
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? ctx.bold : ctx.font;
  const color = opts.color ?? COLOR.text;
  const x = opts.x ?? MARGIN.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const gap = opts.gap ?? 2;
  for (const ln of wrap(text, font, size, maxW)) {
    ensure(ctx, size + gap + 2);
    ctx.page.drawText(ln, { x, y: ctx.y - size, size, font, color });
    ctx.y -= size + gap;
  }
}

function createPdfCtx(doc: PDFDocument, font: PDFFont, bold: PDFFont, docTitle: string): PdfCtx {
  const page = doc.addPage([A4.w, A4.h]);
  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");
  const ctx: PdfCtx = {
    doc,
    page,
    y: A4.h - MARGIN.top,
    font,
    bold,
    pageNum: 1,
    docTitle,
    generatedAt,
  };
  drawPageFooter(ctx);
  return ctx;
}

function tacitoLabel(v: boolean | null | undefined) {
  if (v == null) return "—";
  return v ? "Sì" : "No";
}

export async function buildPdfSinteticoCliente(opts: {
  clienteLabel: string;
  assegnazioni?: AnalisiClienteAssegnazioni | null;
  polizze: AnalisiPolizzaRow[];
  meta?: AnalisiPdfClienteMeta | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const title = "Analisi portafoglio — Sintetico";
  const ctx = createPdfCtx(doc, font, bold, title);

  drawBrandHeader(ctx, "REPORT SINTETICO", "Stato · premi · scadenze");
  drawClienteBlock(ctx, opts);

  const totPremi = opts.polizze.reduce((s, p) => s + (Number(p.premio_lordo) || 0), 0);
  const attive = opts.polizze.filter((p) => (p.stato || "").toLowerCase() === "attivo").length;
  drawKpis(ctx, [
    { label: "Polizze", value: String(opts.polizze.length) },
    { label: "Attive", value: String(attive) },
    { label: "Totale premi lordi", value: fmtEur(totPremi) },
  ]);

  drawSectionTitle(ctx, "Elenco polizze");

  // Colonne: N° | Stato | Ramo/Prodotto | Agenzia | Premio | Scadenza | Tacito
  const cols = [
    { key: "num", title: "N° polizza", w: 72, align: "left" as const },
    { key: "stato", title: "Stato", w: 48, align: "left" as const },
    { key: "ramo", title: "Ramo / Prodotto", w: 118, align: "left" as const },
    { key: "age", title: "Agenzia", w: 100, align: "left" as const },
    { key: "premio", title: "Premio lordo", w: 68, align: "right" as const },
    { key: "scad", title: "Scadenza", w: 58, align: "center" as const },
    { key: "tac", title: "Tacito", w: CONTENT_W - (72 + 48 + 118 + 100 + 68 + 58), align: "center" as const },
  ];

  const drawTableHeader = () => {
    ensure(ctx, 18);
    const yTop = ctx.y;
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: yTop - 14,
      width: CONTENT_W,
      height: 14,
      color: COLOR.headerBg,
    });
    let cx = MARGIN.left;
    for (const col of cols) {
      const label = col.title;
      let tx = cx + 3;
      if (col.align === "right") tx = cx + col.w - 3 - bold.widthOfTextAtSize(label, 7);
      else if (col.align === "center") tx = cx + (col.w - bold.widthOfTextAtSize(label, 7)) / 2;
      ctx.page.drawText(label, { x: tx, y: yTop - 10, size: 7, font: bold, color: COLOR.headerText });
      cx += col.w;
    }
    ctx.y = yTop - 16;
  };

  drawTableHeader();

  if (!opts.polizze.length) {
    ensure(ctx, 28);
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: ctx.y - 24,
      width: CONTENT_W,
      height: 24,
      color: COLOR.emptyBg,
      borderColor: COLOR.line,
      borderWidth: 0.4,
    });
    ctx.page.drawText("Nessuna polizza in portafoglio per questo cliente.", {
      x: MARGIN.left + 8,
      y: ctx.y - 15,
      size: 9,
      font: ctx.font,
      color: COLOR.muted,
    });
    ctx.y -= 32;
  } else {
    opts.polizze.forEach((p, i) => {
      const ramoProd = [p.ramo_nome, p.prodotto_nome].filter(Boolean).join(" · ") || "—";
      const cells = [
        truncate(p.numero_titolo || "—", font, 7.5, cols[0].w - 6),
        truncate(p.stato || "—", font, 7.5, cols[1].w - 6),
        truncate(ramoProd, font, 7.5, cols[2].w - 6),
        truncate(p.compagnia_nome || "—", font, 7.5, cols[3].w - 6),
        fmtEur(p.premio_lordo),
        fmtDate(p.garanzia_a || p.data_scadenza),
        tacitoLabel(p.tacito_rinnovo),
      ];
      const rowH = 16;
      ensure(ctx, rowH + 2);
      if (ctx.y < MARGIN.bottom + 40) {
        newPage(ctx, true);
        drawTableHeader();
      }
      const yTop = ctx.y;
      if (i % 2 === 1) {
        ctx.page.drawRectangle({
          x: MARGIN.left,
          y: yTop - rowH,
          width: CONTENT_W,
          height: rowH,
          color: COLOR.rowAlt,
        });
      }
      let cx = MARGIN.left;
      cells.forEach((txt, ci) => {
        const col = cols[ci];
        let tx = cx + 3;
        if (col.align === "right") tx = cx + col.w - 3 - font.widthOfTextAtSize(txt, 7.5);
        else if (col.align === "center") tx = cx + (col.w - font.widthOfTextAtSize(txt, 7.5)) / 2;
        ctx.page.drawText(txt, { x: tx, y: yTop - 11, size: 7.5, font, color: COLOR.text });
        cx += col.w;
      });
      ctx.y = yTop - rowH;
    });

    // Totale
    ensure(ctx, 20);
    const yTop = ctx.y;
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: yTop - 16,
      width: CONTENT_W,
      height: 16,
      color: COLOR.totBg,
    });
    ctx.page.drawText(`Totale ${opts.polizze.length} polizze`, {
      x: MARGIN.left + 6,
      y: yTop - 11,
      size: 8,
      font: bold,
      color: COLOR.headerText,
    });
    const tot = fmtEur(totPremi);
    ctx.page.drawText(tot, {
      x: MARGIN.left + cols[0].w + cols[1].w + cols[2].w + cols[3].w + cols[4].w - 3 - bold.widthOfTextAtSize(tot, 8),
      y: yTop - 11,
      size: 8,
      font: bold,
      color: COLOR.headerText,
    });
    ctx.y = yTop - 22;
  }

  spacer(ctx, 8);
  drawWrapped(ctx, "Report sintetico: riepilogo operativo senza massimali/condizioni CGA. Per il dettaglio contrattuale utilizzare il PDF elaborato.", {
    size: 7.5,
    color: COLOR.muted,
  });

  return doc.save();
}

export async function buildPdfElaboratoCliente(opts: {
  clienteLabel: string;
  assegnazioni?: AnalisiClienteAssegnazioni | null;
  polizze: AnalisiPolizzaRow[];
  cgaDettagli: AnalisiCgaDettaglio[];
  meta?: AnalisiPdfClienteMeta | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const title = "Analisi portafoglio — Elaborato";
  const ctx = createPdfCtx(doc, font, bold, title);

  drawBrandHeader(ctx, "REPORT ELABORATO", "Massimali e condizioni da CGA");
  drawClienteBlock(ctx, opts);

  const withCga = opts.cgaDettagli.length;
  drawKpis(ctx, [
    { label: "Polizze in portafoglio", value: String(opts.polizze.length) },
    { label: "CGA elaborate", value: String(withCga) },
    {
      label: "Copertura CGA",
      value: opts.polizze.length ? `${Math.round((withCga / Math.max(opts.polizze.length, 1)) * 100)}%` : "—",
    },
  ]);

  if (!opts.cgaDettagli.length) {
    drawSectionTitle(ctx, "Dettaglio CGA");
    ensure(ctx, 70);
    const boxH = 62;
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: ctx.y - boxH,
      width: CONTENT_W,
      height: boxH,
      color: COLOR.emptyBg,
      borderColor: COLOR.line,
      borderWidth: 0.5,
    });
    ctx.page.drawText("Nessuna CGA elaborata per questo cliente", {
      x: MARGIN.left + 12,
      y: ctx.y - 22,
      size: 10,
      font: bold,
      color: COLOR.headerText,
    });
    const emptyLines = [
      "Le condizioni generali strutturate si rilevano automaticamente se già presenti in anagrafica.",
      "L'analisi AI si esegue dal dettaglio polizza o dal documentale, non da questa schermata.",
    ];
    let ly = ctx.y - 38;
    for (const ln of emptyLines) {
      ctx.page.drawText(ln, { x: MARGIN.left + 12, y: ly, size: 8, font, color: COLOR.muted });
      ly -= 12;
    }
    ctx.y -= boxH + 12;

    if (opts.polizze.length) {
      drawSectionTitle(ctx, "Polizze in portafoglio (senza CGA)");
      for (const p of opts.polizze) {
        ensure(ctx, 14);
        drawWrapped(
          ctx,
          `• ${p.numero_titolo || p.id}  ·  ${p.ramo_nome || "—"}  ·  ${p.compagnia_nome || "—"}  ·  ${fmtEur(p.premio_lordo)}`,
          { size: 8.5 },
        );
      }
    }

    return doc.save();
  }

  for (let i = 0; i < opts.cgaDettagli.length; i++) {
    const c = opts.cgaDettagli[i];
    if (i > 0 && ctx.y < A4.h - 120) {
      newPage(ctx, true);
    }
    ensure(ctx, 90);

    // Card header polizza
    const headH = 34;
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: ctx.y - headH,
      width: CONTENT_W,
      height: headH,
      color: COLOR.headerBg,
    });
    ctx.page.drawRectangle({
      x: MARGIN.left,
      y: ctx.y - headH,
      width: 4,
      height: headH,
      color: COLOR.bandAccent,
    });
    ctx.page.drawText(`Polizza ${c.numero_polizza || "—"}`, {
      x: MARGIN.left + 12,
      y: ctx.y - 14,
      size: 11,
      font: bold,
      color: COLOR.headerText,
    });
    const sub = truncate(`${c.prodotto_nome || "—"}  ·  ${c.compagnia || "—"}`, font, 8, CONTENT_W - 24);
    ctx.page.drawText(sub, {
      x: MARGIN.left + 12,
      y: ctx.y - 26,
      size: 8,
      font,
      color: COLOR.muted,
    });
    ctx.y -= headH + 8;

    if (c.massimale_aggregato != null) {
      drawWrapped(ctx, `Massimale aggregato annuo: ${fmtEur(c.massimale_aggregato)}`, {
        size: 9,
        bold: true,
        color: COLOR.headerText,
      });
      spacer(ctx, 4);
    }
    if (c.sommario) {
      drawWrapped(ctx, c.sommario, { size: 8.5, color: COLOR.text });
      spacer(ctx, 6);
    }

    // Tabella massimali
    drawSectionTitle(ctx, "Massimali / garanzie");
    if (!c.garanzie.length) {
      drawWrapped(ctx, "Nessuna garanzia estratta dalla CGA.", { size: 8.5, color: COLOR.muted });
    } else {
      const gCols = [
        { title: "Garanzia", w: 160 },
        { title: "Massimale", w: 90 },
        { title: "Franchigia", w: 90 },
        { title: "Scoperto", w: 70 },
        { title: "Note", w: CONTENT_W - (160 + 90 + 90 + 70) },
      ];
      const drawGHeader = () => {
        ensure(ctx, 16);
        const yTop = ctx.y;
        ctx.page.drawRectangle({
          x: MARGIN.left,
          y: yTop - 13,
          width: CONTENT_W,
          height: 13,
          color: COLOR.headerBg,
        });
        let cx = MARGIN.left;
        for (const col of gCols) {
          ctx.page.drawText(col.title, {
            x: cx + 3,
            y: yTop - 10,
            size: 7,
            font: bold,
            color: COLOR.headerText,
          });
          cx += col.w;
        }
        ctx.y = yTop - 15;
      };
      drawGHeader();
      c.garanzie.forEach((g, gi) => {
        const noteLines = wrap(g.note || "—", font, 7, gCols[4].w - 6);
        const nameLines = wrap(g.garanzia || "—", font, 7.5, gCols[0].w - 6);
        const rowH = Math.max(14, Math.max(nameLines.length, noteLines.length) * 9 + 4);
        ensure(ctx, rowH + 2);
        if (ctx.y < MARGIN.bottom + 50) {
          newPage(ctx, true);
          drawGHeader();
        }
        const yTop = ctx.y;
        if (gi % 2 === 1) {
          ctx.page.drawRectangle({
            x: MARGIN.left,
            y: yTop - rowH,
            width: CONTENT_W,
            height: rowH,
            color: COLOR.rowAlt,
          });
        }
        const vals = [
          nameLines,
          [g.massimale != null ? fmtEur(g.massimale) : "—"],
          [g.franchigia != null ? fmtEur(g.franchigia) : "—"],
          [g.scoperto != null ? `${g.scoperto}%` : "—"],
          noteLines,
        ];
        let cx = MARGIN.left;
        vals.forEach((lines, ci) => {
          let ly = yTop - 10;
          for (const ln of lines) {
            ctx.page.drawText(ln, { x: cx + 3, y: ly, size: ci === 0 || ci === 4 ? 7.5 : 7.5, font, color: COLOR.text });
            ly -= 9;
          }
          cx += gCols[ci].w;
        });
        ctx.y = yTop - rowH;
      });
    }

    spacer(ctx, 8);
    drawSectionTitle(ctx, "Condizioni");
    if (!c.condizioni.length) {
      drawWrapped(ctx, "Nessuna condizione estratta dalla CGA.", { size: 8.5, color: COLOR.muted });
    } else {
      const maxCond = 40;
      for (const cond of c.condizioni.slice(0, maxCond)) {
        ensure(ctx, 28);
        const titleLine = [cond.tipo, cond.titolo].filter(Boolean).join(" — ") || "Condizione";
        drawWrapped(ctx, titleLine, { size: 8.5, bold: true, color: COLOR.headerText });
        drawWrapped(ctx, cond.testo.slice(0, 1200), { size: 8, color: COLOR.text });
        spacer(ctx, 4);
      }
      if (c.condizioni.length > maxCond) {
        drawWrapped(ctx, `… altre ${c.condizioni.length - maxCond} condizioni omesse`, {
          size: 8,
          color: COLOR.muted,
        });
      }
    }
    spacer(ctx, 14);
  }

  // Appendice: polizze senza CGA
  const withCgaTitoli = new Set(opts.cgaDettagli.map((c) => c.titolo_id).filter(Boolean));
  const withCgaNum = new Set(
    opts.cgaDettagli.map((c) => (c.numero_polizza || "").trim().toUpperCase()).filter(Boolean),
  );
  const missing = opts.polizze.filter((p) => {
    if (withCgaTitoli.has(p.id)) return false;
    const num = (p.numero_titolo || "").trim().toUpperCase();
    return !num || !withCgaNum.has(num);
  });
  if (missing.length) {
    newPage(ctx, true);
    drawSectionTitle(ctx, "Polizze senza CGA elaborata");
    drawWrapped(
      ctx,
      "Le seguenti polizze risultano in portafoglio ma non hanno una CGA strutturata collegata.",
      { size: 8, color: COLOR.muted },
    );
    spacer(ctx, 6);
    for (const p of missing) {
      drawWrapped(
        ctx,
        `• ${p.numero_titolo || p.id}  ·  ${p.ramo_nome || "—"}  ·  ${p.compagnia_nome || "—"}  ·  ${fmtEur(p.premio_lordo)}`,
        { size: 8.5 },
      );
    }
  }

  return doc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
