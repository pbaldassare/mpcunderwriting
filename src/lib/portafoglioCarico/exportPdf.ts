import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CARICO_EXPORT_COLUMNS, type CaricoExportMeta, type CaricoExportRow } from "./columns";

const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const M = { top: 36, right: 28, bottom: 36, left: 28 };

const C = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.45, 0.45, 0.45),
  line: rgb(0.75, 0.75, 0.75),
  header: rgb(0.05, 0.35, 0.32),
  box: rgb(0.94, 0.97, 0.96),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function cellText(v: string | number | null | undefined, max = 22): string {
  const s = v == null ? "" : String(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < M.bottom) {
    ctx.page = ctx.doc.addPage([A4_LANDSCAPE.w, A4_LANDSCAPE.h]);
    ctx.y = A4_LANDSCAPE.h - M.top;
  }
}

const PDF_COLS = [
  { key: "polizza" as const, w: 72 },
  { key: "tipo" as const, w: 52 },
  { key: "cliente" as const, w: 88 },
  { key: "agenzia" as const, w: 72 },
  { key: "inizioGaranzia" as const, w: 52 },
  { key: "fineGaranzia" as const, w: 52 },
  { key: "premio" as const, w: 58 },
  { key: "provvigione" as const, w: 58 },
  { key: "stato" as const, w: 48 },
  { key: "messaACassa" as const, w: 52 },
];

export async function buildCaricoPdf(
  rows: CaricoExportRow[],
  meta: CaricoExportMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4_LANDSCAPE.w, A4_LANDSCAPE.h]);
  const ctx: Ctx = { doc, page, y: A4_LANDSCAPE.h - M.top, font, bold };

  ctx.page.drawText("Carico portafoglio", {
    x: M.left, y: ctx.y, size: 14, font: bold, color: C.header,
  });
  ctx.y -= 16;

  const subtitle = [
    meta.vista === "incassati" ? "Incassati" : "Pendenti",
    meta.scope === "selezione" ? "Selezione" : "Pagina corrente",
    format(new Date(), "dd/MM/yyyy HH:mm", { locale: it }),
  ].join("  ·  ");
  ctx.page.drawText(subtitle, { x: M.left, y: ctx.y, size: 8, font, color: C.muted });
  ctx.y -= 14;

  const filtriLine = Object.entries(meta.filtri)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  |  ");
  if (filtriLine) {
    ctx.page.drawText(filtriLine.slice(0, 140), { x: M.left, y: ctx.y, size: 7, font, color: C.muted });
    ctx.y -= 12;
  }

  const kpiH = 36;
  ctx.page.drawRectangle({
    x: M.left, y: ctx.y - kpiH, width: A4_LANDSCAPE.w - M.left - M.right, height: kpiH,
    color: C.box, borderColor: C.line, borderWidth: 0.5,
  });
  const kpiY = ctx.y - 12;
  const kw = (A4_LANDSCAPE.w - M.left - M.right) / 3;
  const kpis = [
    ["Righe", String(meta.nRighe)],
    ["Premio", fmtEur(meta.totalePremio)],
    ["Provvigioni", fmtEur(meta.totaleProvvigioni)],
  ];
  kpis.forEach(([label, val], i) => {
    const x = M.left + 10 + i * kw;
    ctx.page.drawText(label, { x, y: kpiY, size: 7, font, color: C.muted });
    ctx.page.drawText(val, { x, y: kpiY - 12, size: 10, font: bold, color: C.text });
  });
  ctx.y -= kpiH + 10;

  ensure(ctx, 20);
  let x = M.left;
  for (const col of PDF_COLS) {
    const header = CARICO_EXPORT_COLUMNS.find((c) => c.key === col.key)?.header || col.key;
    ctx.page.drawText(header.slice(0, 12), { x, y: ctx.y, size: 7, font: bold, color: C.muted });
    x += col.w;
  }
  ctx.y -= 10;
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.y },
    end: { x: A4_LANDSCAPE.w - M.right, y: ctx.y },
    thickness: 0.5,
    color: C.line,
  });
  ctx.y -= 8;

  for (const row of rows) {
    ensure(ctx, 12);
    x = M.left;
    for (const col of PDF_COLS) {
      let val: string | number = row[col.key] ?? "";
      if (col.key === "premio" || col.key === "provvigione") {
        val = fmtEur(Number(val) || 0);
      } else {
        val = cellText(val, col.key === "cliente" ? 28 : 18);
      }
      ctx.page.drawText(String(val), { x, y: ctx.y, size: 7, font, color: C.text });
      x += col.w;
    }
    ctx.y -= 11;
  }

  return doc.save();
}

export function downloadCaricoPdf(bytes: Uint8Array, meta: CaricoExportMeta) {
  const slug = meta.vista === "incassati" ? "incassati" : "pendenti";
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carico_portafoglio_${slug}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
