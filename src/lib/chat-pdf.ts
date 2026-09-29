import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Palette CBnet — teal/dark petrol green
const TEAL = rgb(0.043, 0.298, 0.314); // #0B4C50
const TEAL_LIGHT = rgb(0.85, 0.92, 0.92);
const AMBER = rgb(0.85, 0.55, 0.13);
const TEXT = rgb(0.12, 0.15, 0.18);
const MUTED = rgb(0.45, 0.48, 0.52);
const BUBBLE_OTHER = rgb(0.95, 0.96, 0.97);
const BUBBLE_ME = rgb(0.91, 0.96, 0.96);
const BORDER = rgb(0.88, 0.89, 0.91);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 50;

export interface ChatPdfMessage {
  id: string;
  created_at: string;
  messaggio: string;
  mittente_nome?: string | null;
  mittente_cognome?: string | null;
  mittente_ruolo?: string | null;
  is_self?: boolean;
}

export interface ChatPdfMember {
  nome?: string | null;
  cognome?: string | null;
  ruolo?: string | null;
}

export interface ChatPdfLog {
  data: string;
  evento: string;
  attore?: string | null;
}

export interface ChatPdfData {
  canaleNome: string;
  canaleTipo: string;
  entitaLabel?: string | null;
  entitaNumero?: string | null;
  statoLabel?: string | null;
  createdAt?: string | null;
  clienteNome: string;
  membri: ChatPdfMember[];
  messaggi: ChatPdfMessage[];
  log?: ChatPdfLog[];
}

function ruoloLabel(r?: string | null): string {
  if (!r) return "—";
  const map: Record<string, string> = {
    cliente: "Cliente",
    prospect: "Prospect",
    admin: "Admin",
    cfo: "CFO",
    ufficio: "Sede",
    backoffice: "Specialist",
    contabilita: "Contabilità",
    manager: "Manager",
    produttore: "Produttore",
    corrispondente: "Consul",
  };
  return map[r] || r;
}

function initials(nome?: string | null, cognome?: string | null): string {
  const a = (nome || "").trim().charAt(0).toUpperCase();
  const b = (cognome || "").trim().charAt(0).toUpperCase();
  return (a + b) || "?";
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  const paragraphs = (text || "").replace(/\r/g, "").split("\n");
  for (const para of paragraphs) {
    if (!para) { out.push(""); continue; }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) {
        line = test;
      } else {
        if (line) out.push(line);
        // word longer than line — hard split
        if (font.widthOfTextAtSize(w, size) > maxW) {
          let chunk = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) <= maxW) chunk += ch;
            else { out.push(chunk); chunk = ch; }
          }
          line = chunk;
        } else {
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function sanitize(s: string): string {
  // pdf-lib StandardFonts (WinAnsi) doesn't support most emojis/unicode beyond Latin-1.
  // Replace common emojis & strip unsupported chars.
  return (s || "")
    .replace(/📎/g, "[link]")
    .replace(/✅/g, "[ok]")
    .replace(/⚠️|⚠/g, "[!]")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[^\x00-\xFF]/g, "?");
}

export async function exportChatToPdf(data: ChatPdfData): Promise<void> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const exportTs = new Date();
  const exportStr = format(exportTs, "dd/MM/yyyy 'alle' HH:mm", { locale: it });

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;
  let pageNum = 1;

  const drawFooter = (p: PDFPage, n: number) => {
    p.drawLine({
      start: { x: MARGIN_X, y: 35 },
      end: { x: PAGE_W - MARGIN_X, y: 35 },
      thickness: 0.5,
      color: BORDER,
    });
    p.drawText(`CBnet · Esportato il ${exportStr} · ${data.clienteNome}`, {
      x: MARGIN_X, y: 22, size: 8, font, color: MUTED,
    });
    const pn = `Pagina ${n}`;
    p.drawText(pn, {
      x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(pn, 8),
      y: 22, size: 8, font, color: MUTED,
    });
  };

  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      drawFooter(page, pageNum);
      page = pdf.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - MARGIN_TOP;
    }
  };

  // === HEADER BAND ===
  page.drawRectangle({ x: 0, y: PAGE_H - 70, width: PAGE_W, height: 70, color: TEAL });
  page.drawText("CBnet", { x: MARGIN_X, y: PAGE_H - 35, size: 22, font: fontBold, color: WHITE });
  page.drawText("Conversazione Chat", { x: MARGIN_X, y: PAGE_H - 55, size: 11, font, color: rgb(0.85, 0.92, 0.92) });
  const dateLine = `Esportato il ${exportStr}`;
  page.drawText(dateLine, {
    x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(dateLine, 10),
    y: PAGE_H - 35, size: 10, font, color: WHITE,
  });
  page.drawText(data.clienteNome, {
    x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(data.clienteNome, 9),
    y: PAGE_H - 52, size: 9, font: fontItalic, color: rgb(0.85, 0.92, 0.92),
  });
  y = PAGE_H - 90;

  // === CANALE INFO CARD ===
  const cardH = 70;
  ensure(cardH + 10);
  page.drawRectangle({
    x: MARGIN_X, y: y - cardH, width: PAGE_W - 2 * MARGIN_X, height: cardH,
    color: TEAL_LIGHT, borderColor: BORDER, borderWidth: 0.5,
  });
  const titolo = sanitize(data.canaleNome || "Conversazione");
  page.drawText(titolo, { x: MARGIN_X + 14, y: y - 22, size: 13, font: fontBold, color: TEAL });
  let infoX = MARGIN_X + 14;
  const infoY = y - 42;
  if (data.entitaLabel) {
    const t = sanitize(`${data.entitaLabel}${data.entitaNumero ? " N° " + data.entitaNumero : ""}`);
    drawBadge(page, font, t, infoX, infoY, TEAL, WHITE);
    infoX += font.widthOfTextAtSize(t, 9) + 24;
  }
  if (data.statoLabel) {
    const t = sanitize(data.statoLabel);
    drawBadge(page, font, t, infoX, infoY, AMBER, WHITE);
    infoX += font.widthOfTextAtSize(t, 9) + 24;
  }
  if (data.createdAt) {
    const t = `Creata il ${format(new Date(data.createdAt), "dd/MM/yyyy HH:mm")}`;
    page.drawText(t, { x: infoX, y: infoY + 3, size: 9, font, color: MUTED });
  }
  // Partecipanti list
  const partLabel = "Partecipanti: ";
  page.drawText(partLabel, { x: MARGIN_X + 14, y: y - 60, size: 9, font: fontBold, color: TEXT });
  let px = MARGIN_X + 14 + font.widthOfTextAtSize(partLabel, 9);
  const partTxt = data.membri.length
    ? data.membri.map((m) => sanitize(`${m.nome || ""} ${m.cognome || ""}`.trim() + ` (${ruoloLabel(m.ruolo)})`)).join(" · ")
    : "—";
  const wrapped = wrap(partTxt, font, 9, PAGE_W - 2 * MARGIN_X - 28 - (px - MARGIN_X - 14));
  page.drawText(wrapped[0] || "—", { x: px, y: y - 60, size: 9, font, color: TEXT });
  y -= cardH + 20;

  // === SECTION: MESSAGGI ===
  ensure(30);
  page.drawText("Messaggi", { x: MARGIN_X, y: y, size: 14, font: fontBold, color: TEAL });
  page.drawLine({
    start: { x: MARGIN_X, y: y - 4 }, end: { x: PAGE_W - MARGIN_X, y: y - 4 },
    thickness: 1, color: TEAL,
  });
  y -= 18;

  const bubbleMaxW = (PAGE_W - 2 * MARGIN_X) * 0.72;
  const bodySize = 10;
  const lineH = 13;

  for (const m of data.messaggi) {
    const isSelf = !!m.is_self;
    const author = sanitize(`${m.mittente_nome || ""} ${m.mittente_cognome || ""}`.trim() || "Sistema");
    const ruolo = ruoloLabel(m.mittente_ruolo);
    const ts = format(new Date(m.created_at), "dd/MM/yyyy HH:mm");
    const text = sanitize(m.messaggio || "");
    const lines = wrap(text, font, bodySize, bubbleMaxW - 20);
    const bubbleH = 22 + lines.length * lineH + 6;

    ensure(bubbleH + 8);

    const bubbleW = Math.min(bubbleMaxW,
      Math.max(
        font.widthOfTextAtSize(`${author} · ${ruolo} · ${ts}`, 8),
        ...lines.map((l) => font.widthOfTextAtSize(l, bodySize))
      ) + 20);
    const bx = isSelf ? PAGE_W - MARGIN_X - bubbleW : MARGIN_X + 32;
    const by = y - bubbleH;

    // avatar
    const avX = isSelf ? PAGE_W - MARGIN_X - bubbleW - 24 : MARGIN_X;
    const avY = y - 22;
    page.drawCircle({ x: avX + 11, y: avY, size: 11, color: isSelf ? TEAL : rgb(0.75, 0.78, 0.81) });
    const ini = initials(m.mittente_nome, m.mittente_cognome);
    page.drawText(ini, {
      x: avX + 11 - fontBold.widthOfTextAtSize(ini, 9) / 2,
      y: avY - 3, size: 9, font: fontBold, color: WHITE,
    });

    // bubble
    page.drawRectangle({
      x: bx, y: by, width: bubbleW, height: bubbleH,
      color: isSelf ? BUBBLE_ME : BUBBLE_OTHER,
      borderColor: BORDER, borderWidth: 0.5,
    });
    page.drawText(`${author}`, { x: bx + 10, y: y - 12, size: 9, font: fontBold, color: TEAL });
    page.drawText(` · ${ruolo} · ${ts}`, {
      x: bx + 10 + fontBold.widthOfTextAtSize(author, 9),
      y: y - 12, size: 8, font, color: MUTED,
    });
    let ly = y - 26;
    for (const ln of lines) {
      page.drawText(ln, { x: bx + 10, y: ly, size: bodySize, font, color: TEXT });
      ly -= lineH;
    }
    y -= bubbleH + 8;
  }

  // === SECTION: LOG ATTIVITÀ ===
  if (data.log && data.log.length) {
    ensure(40);
    y -= 10;
    page.drawText("Log Attività", { x: MARGIN_X, y, size: 14, font: fontBold, color: TEAL });
    page.drawLine({
      start: { x: MARGIN_X, y: y - 4 }, end: { x: PAGE_W - MARGIN_X, y: y - 4 },
      thickness: 1, color: TEAL,
    });
    y -= 18;
    for (const ev of data.log) {
      const ts = format(new Date(ev.data), "dd/MM/yyyy HH:mm");
      const line = sanitize(`• ${ts} — ${ev.evento}${ev.attore ? " (" + ev.attore + ")" : ""}`);
      const lines = wrap(line, font, 9, PAGE_W - 2 * MARGIN_X - 10);
      ensure(lines.length * 12 + 4);
      for (const l of lines) {
        page.drawText(l, { x: MARGIN_X + 4, y, size: 9, font, color: TEXT });
        y -= 12;
      }
    }
  }

  drawFooter(page, pageNum);

  const bytes = await pdf.save();
  const blob = new Blob([bytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (data.canaleNome || "chat").replace(/[^\w\-]+/g, "_").slice(0, 60);
  a.download = `chat_${safe}_${format(exportTs, "yyyyMMdd_HHmm")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawBadge(p: PDFPage, font: PDFFont, text: string, x: number, y: number, bg: any, fg: any) {
  const w = font.widthOfTextAtSize(text, 9) + 12;
  p.drawRectangle({ x, y: y - 4, width: w, height: 16, color: bg });
  p.drawText(text, { x: x + 6, y: y + 1, size: 9, font, color: fg });
}
