import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { TitoloDaIncassareRow } from "./columns";
import {
  buildPivotCommentary,
  pivotPerCompagnia,
  totaliPivot,
  type PivotRow,
} from "./pivot";

const A4 = { w: 595.28, h: 841.89 };
const M = { top: 45, right: 40, bottom: 45, left: 40 };

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

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < M.bottom) {
    ctx.page = ctx.doc.addPage([A4.w, A4.h]);
    ctx.y = A4.h - M.top;
  }
}

function drawPivotTable(ctx: Ctx, title: string, pivot: PivotRow[], maxRows = 12) {
  ensure(ctx, 24);
  ctx.page.drawText(title, { x: M.left, y: ctx.y, size: 11, font: ctx.bold, color: C.header });
  ctx.y -= 18;

  const cols = [
    { label: "Voce", w: 200, align: "left" as const },
    { label: "N.", w: 40, align: "right" as const },
    { label: "Premio", w: 90, align: "right" as const },
    { label: "Provv.", w: 80, align: "right" as const },
  ];
  const x0 = M.left;
  let x = x0;
  for (const c of cols) {
    ctx.page.drawText(c.label, { x, y: ctx.y, size: 8, font: ctx.bold, color: C.muted });
    x += c.w;
  }
  ctx.y -= 12;
  ctx.page.drawLine({ start: { x: M.left, y: ctx.y }, end: { x: A4.w - M.right, y: ctx.y }, thickness: 0.5, color: C.line });
  ctx.y -= 10;

  for (const row of pivot.slice(0, maxRows)) {
    ensure(ctx, 14);
    x = x0;
    const cells = [
      row.chiave.slice(0, 38),
      String(row.nTitoli),
      fmtEur(row.totPremio),
      fmtEur(row.totProvvAttive),
    ];
    let xi = x0;
    cols.forEach((c, i) => {
      const t = cells[i];
      const tw = ctx.font.widthOfTextAtSize(t, 8);
      const tx = c.align === "right" ? xi + c.w - tw : xi;
      ctx.page.drawText(t, { x: tx, y: ctx.y, size: 8, font: ctx.font, color: C.text });
      xi += c.w;
    });
    ctx.y -= 13;
  }
  ctx.y -= 8;
}

export async function buildTitoliDaIncassarePdf(
  rows: TitoloDaIncassareRow[],
  meseLabel: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - M.top, font, bold };

  const tot = totaliPivot(rows);
  const commentary = buildPivotCommentary(rows, meseLabel);

  ctx.page.drawText("Report titoli da incassare", {
    x: M.left, y: ctx.y, size: 16, font: bold, color: C.header,
  });
  ctx.y -= 20;
  ctx.page.drawText(`Competenza: ${meseLabel}  ·  Generato: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`, {
    x: M.left, y: ctx.y, size: 9, font, color: C.muted,
  });
  ctx.y -= 22;

  const kpiH = 52;
  ctx.page.drawRectangle({
    x: M.left, y: ctx.y - kpiH, width: A4.w - M.left - M.right, height: kpiH,
    color: C.box, borderColor: C.line, borderWidth: 0.5,
  });
  const kpiY = ctx.y - 16;
  const kw = (A4.w - M.left - M.right) / 4;
  const kpis = [
    ["Titoli", String(tot.nTitoli)],
    ["Premio", fmtEur(tot.totPremio)],
    ["Provv. attive", fmtEur(tot.totProvvAttive)],
    ["Garantiti", String(tot.nGarantiti)],
  ];
  kpis.forEach(([label, val], i) => {
    const x = M.left + 12 + i * kw;
    ctx.page.drawText(label, { x, y: kpiY, size: 8, font, color: C.muted });
    ctx.page.drawText(val, { x, y: kpiY - 14, size: 11, font: bold, color: C.text });
  });
  ctx.y -= kpiH + 16;

  ctx.page.drawText("Analisi", { x: M.left, y: ctx.y, size: 11, font: bold, color: C.header });
  ctx.y -= 14;
  const maxW = A4.w - M.left - M.right;
  for (const line of commentary.split("\n")) {
    for (const wl of wrapText(line, font, 9, maxW)) {
      ensure(ctx, 12);
      ctx.page.drawText(wl, { x: M.left, y: ctx.y, size: 9, font, color: C.text });
      ctx.y -= 12;
    }
  }
  ctx.y -= 10;

  drawPivotTable(ctx, "Pivot per Compagnia", pivotPerCompagnia(rows));

  return doc.save();
}

export function downloadTitoliDaIncassarePdf(bytes: Uint8Array, meseLabel: string) {
  const slug = meseLabel.replace(/\s+/g, "_").replace(/\//g, "-");
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_titoli_da_incassare_${slug}_${format(new Date(), "yyyyMMdd")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
