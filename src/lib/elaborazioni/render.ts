import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export interface CampoCatalogo {
  id: string;
  chiave: string;
  etichetta: string;
  tipo: string;
  descrizione_ai: string | null;
  gruppo_ramo_id: string | null;
  ordine: number;
}

export type ValoriCampi = Record<string, unknown>;

/** Formatta un valore estratto secondo il tipo del campo. */
export function formatValore(valore: unknown, tipo?: string): string {
  if (valore === null || valore === undefined || valore === "") return "";
  if (tipo === "number" && typeof valore === "number") {
    return valore.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (tipo === "boolean") return valore ? "Sì" : "No";
  if (tipo === "date") {
    const d = new Date(String(valore));
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("it-IT");
  }
  return String(valore);
}

/** Sostituisce i segnaposto {{chiave}} con i valori estratti. */
export function renderTemplate(
  corpo: string,
  valori: ValoriCampi,
  campi: CampoCatalogo[],
): string {
  const tipoByChiave = new Map(campi.map((c) => [c.chiave, c.tipo]));
  return corpo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, chiave: string) => {
    const raw = valori[chiave];
    const out = formatValore(raw, tipoByChiave.get(chiave));
    return out || "________";
  });
}

/** Elenco dei segnaposto usati nel corpo del template. */
export function placeholderUsati(corpo: string): string[] {
  const out = new Set<string>();
  for (const m of corpo.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) out.add(m[1]);
  return [...out];
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Rimuove i caratteri non supportati dai font standard WinAnsi di pdf-lib. */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0000-\u00ff\n]/g, "");
}

export interface PdfMeta {
  titolo: string;
  cliente?: string | null;
  polizza?: string | null;
  dataLabel?: string;
}

export async function buildElaborazionePdf(testo: string, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const A4 = { w: 595.28, h: 841.89 };
  const M = { top: 50, right: 45, bottom: 50, left: 45 };
  const maxW = A4.w - M.left - M.right;
  const brand = rgb(0.05, 0.35, 0.32);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M.top;
  };

  // Intestazione
  page.drawRectangle({ x: 0, y: A4.h - 70, width: A4.w, height: 70, color: brand });
  page.drawText(sanitize(meta.titolo).slice(0, 70), {
    x: M.left, y: A4.h - 42, size: 16, font: bold, color: rgb(1, 1, 1),
  });
  const sub = [meta.cliente, meta.polizza ? `Polizza ${meta.polizza}` : null]
    .filter(Boolean)
    .join(" — ");
  if (sub) {
    page.drawText(sanitize(sub).slice(0, 110), {
      x: M.left, y: A4.h - 58, size: 9, font, color: rgb(0.9, 0.95, 0.94),
    });
  }
  y = A4.h - 100;

  for (const line of wrap(sanitize(testo), font, 10.5, maxW)) {
    if (y < M.bottom + 20) newPage();
    if (line) page.drawText(line, { x: M.left, y, size: 10.5, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;
  }

  // Piè di pagina
  const footer = `Documento generato il ${meta.dataLabel ?? new Date().toLocaleString("it-IT")}`;
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(sanitize(footer), { x: M.left, y: 28, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
    const num = `${i + 1} / ${pages.length}`;
    p.drawText(num, {
      x: A4.w - M.right - font.widthOfTextAtSize(num, 7.5),
      y: 28, size: 7.5, font, color: rgb(0.5, 0.5, 0.5),
    });
  });

  return await doc.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
