import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CARICO_EXPORT_COLUMNS, type CaricoExportMeta, type CaricoExportRow } from "./columns";

function fmtEur(n: number) {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function cell(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
  });
}

function headerCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })],
    shading: { fill: "E8F5F3" },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
  });
}

const DOCX_COLS = CARICO_EXPORT_COLUMNS.filter((c) =>
  ["polizza", "tipo", "cliente", "agenzia", "inizioGaranzia", "fineGaranzia", "premio", "provvigione", "stato", "messaACassa"].includes(c.key),
);

export async function buildCaricoDocx(
  rows: CaricoExportRow[],
  meta: CaricoExportMeta,
): Promise<Blob> {
  const filtriParas = Object.entries(meta.filtri)
    .filter(([, v]) => v)
    .map(([k, v]) => new Paragraph({ children: [new TextRun({ text: `${k}: ${v}`, size: 20 })] }));

  const tableRows = [
    new TableRow({
      children: DOCX_COLS.map((c) => headerCell(c.header)),
    }),
    ...rows.map(
      (r) =>
        new TableRow({
          children: DOCX_COLS.map((c) => {
            let val = r[c.key];
            if (c.key === "premio" || c.key === "provvigione") val = fmtEur(Number(val) || 0);
            return cell(val == null ? "" : String(val));
          }),
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Carico portafoglio", bold: true, size: 32 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generato il ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`,
                size: 20,
                color: "666666",
              }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Vista: ${meta.vista === "incassati" ? "Incassati" : "Pendenti"}  ·  ${meta.scope === "selezione" ? "Selezione" : "Pagina corrente"}  ·  ${meta.nRighe} righe`,
                size: 20,
              }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Premio totale: ${fmtEur(meta.totalePremio)}  ·  Provvigioni: ${fmtEur(meta.totaleProvvigioni)}`,
                size: 20,
              }),
            ],
            spacing: { after: 120 },
          }),
          ...(filtriParas.length
            ? [
                new Paragraph({
                  children: [new TextRun({ text: "Filtri attivi", bold: true, size: 22 })],
                  spacing: { after: 60 },
                }),
                ...filtriParas,
                new Paragraph({ spacing: { after: 120 } }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
            },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function downloadCaricoDocx(blob: Blob, meta: CaricoExportMeta) {
  const slug = meta.vista === "incassati" ? "incassati" : "pendenti";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carico_portafoglio_${slug}_${format(new Date(), "yyyyMMdd_HHmm")}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
