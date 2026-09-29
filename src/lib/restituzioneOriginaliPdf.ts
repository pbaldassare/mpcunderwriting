import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  labelTipoTitoloRestituzione,
  wrapTestoPdf,
  type RestituzioneDocRiga,
  type RestituzioneGruppoCompagnia,
} from "@/lib/restituzioneOriginali";

const A4 = { w: 595.28, h: 841.89 };
const M = { top: 48, right: 36, bottom: 42, left: 36 };

const C = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.4, 0.4, 0.4),
  line: rgb(0.75, 0.75, 0.75),
  header: rgb(0.05, 0.35, 0.32),
  box: rgb(0.94, 0.97, 0.96),
};

function pdfSafe(text: string): string {
  return (text || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0000-\u00ff\n]/g, "");
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < M.bottom) {
    ctx.page = ctx.doc.addPage([A4.w, A4.h]);
    ctx.y = A4.h - M.top;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export async function buildDistintaRestituzionePdf(
  gruppo: RestituzioneGruppoCompagnia,
  generatedAt: Date,
  options?: { note?: string; clientiLabel?: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - M.top, font, bold };

  ctx.page.drawText(pdfSafe("Distinta di spedizione originali"), {
    x: M.left,
    y: ctx.y,
    size: 16,
    font: ctx.bold,
    color: C.header,
  });
  ctx.y -= 22;
  ctx.page.drawText(pdfSafe(`Agenzia / compagnia: ${gruppo.compagniaNome}`), {
    x: M.left,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: C.text,
  });
  ctx.y -= 16;
  ctx.page.drawText(
    pdfSafe(
      `Data: ${format(generatedAt, "dd MMMM yyyy", { locale: it })}  ·  Documenti: ${gruppo.rows.length}`,
    ),
    { x: M.left, y: ctx.y, size: 9, font: ctx.font, color: C.muted },
  );
  ctx.y -= 14;
  if (options?.clientiLabel?.trim()) {
    ctx.page.drawText(pdfSafe(`Clienti: ${options.clientiLabel.trim()}`), {
      x: M.left,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: C.muted,
    });
    ctx.y -= 14;
  }
  ctx.y -= 4;

  const cols = [
    { label: "Cliente", w: 150 },
    { label: "N. titolo", w: 95 },
    { label: "Tipo", w: 70 },
    { label: "Documento", w: 160 },
    { label: "Data", w: 50 },
  ];

  if (gruppo.rows.length > 0) {
    ctx.page.drawRectangle({
      x: M.left,
      y: ctx.y - 6,
      width: A4.w - M.left - M.right,
      height: 22,
      color: C.box,
    });
    let x = M.left + 4;
    for (const c of cols) {
      ctx.page.drawText(c.label, { x, y: ctx.y, size: 8, font: ctx.bold, color: C.header });
      x += c.w;
    }
    ctx.y -= 20;
  }

  const drawRow = (r: RestituzioneDocRiga) => {
    ensure(ctx, 16);
    const cells = [
      pdfSafe(r.clienteNome).slice(0, 28),
      pdfSafe(r.numeroTitolo).slice(0, 18),
      pdfSafe(labelTipoTitoloRestituzione(r.tipoTitolo)),
      pdfSafe(r.nomeFile).slice(0, 32),
      fmtDate(r.createdAt),
    ];
    let xi = M.left + 4;
    cols.forEach((c, i) => {
      ctx.page.drawText(cells[i], { x: xi, y: ctx.y, size: 8, font: ctx.font, color: C.text });
      xi += c.w;
    });
    ctx.y -= 13;
    ctx.page.drawLine({
      start: { x: M.left, y: ctx.y + 8 },
      end: { x: A4.w - M.right, y: ctx.y + 8 },
      thickness: 0.3,
      color: C.line,
    });
  };

  if (gruppo.rows.length === 0) {
    ensure(ctx, 20);
    ctx.page.drawText(pdfSafe("Nessun documento originale selezionato."), {
      x: M.left,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: C.muted,
    });
    ctx.y -= 16;
  } else {
    for (const r of gruppo.rows) drawRow(r);
  }

  const noteLines = wrapTestoPdf(options?.note || "", 88);
  if (noteLines.length > 0) {
    ctx.y -= 10;
    ensure(ctx, 28);
    ctx.page.drawText(pdfSafe("Note"), {
      x: M.left,
      y: ctx.y,
      size: 11,
      font: ctx.bold,
      color: C.header,
    });
    ctx.y -= 16;
    for (const line of noteLines) {
      ensure(ctx, 13);
      ctx.page.drawText(pdfSafe(line), {
        x: M.left,
        y: ctx.y,
        size: 9,
        font: ctx.font,
        color: C.text,
      });
      ctx.y -= 12;
    }
  }

  ctx.y -= 16;
  ensure(ctx, 36);
  ctx.page.drawText(pdfSafe("Documenti originali in restituzione all'agenzia / compagnia indicata."), {
    x: M.left,
    y: ctx.y,
    size: 8,
    font: ctx.font,
    color: C.muted,
  });

  return doc.save();
}
