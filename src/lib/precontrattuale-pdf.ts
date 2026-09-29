import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

export interface PrecontrattualeData {
  // Cliente
  clienteNomeRagSoc: string;
  clienteCF: string;
  clientePIVA: string;
  clienteIndirizzo: string;
  clienteCap: string;
  clienteCitta: string;
  clienteProvincia: string;
  // Polizza
  polizzaNumero: string;
  polizzaRiferimento: string;
  polizzaCompagniaTesto: string; // es: "GENERALI ITALIA SPA Agenzia Generale Venezia San Marco"
  polizzaRamo: string;
  polizzaAppendice?: string;
  polizzaDataDecorrenza?: string;
  polizzaDataScadenza?: string;
  polizzaFrazionamento?: string;
  polizzaPremioLordo?: string;
  // Intermediario - Specialist
  specialistNomeCognome: string;
  specialistSezioneRui: string;
  specialistNumeroRui: string;
  specialistDataIscrizione: string;
  specialistEmail: string;
  specialistTelefono: string;
  specialistIndirizzo: string;
  // Sede operativa (ufficio dell'compagnia)
  sedeNome?: string;
  sedeIndirizzoCompleto?: string;
  sedeEmail?: string;
  sedeTelefono?: string;
  // Sezioni dinamiche
  modelloDistribuzione: string;
  collaborazioneAltri: boolean;
  sezioneII_testo: string; // testo radio scelto
  tipoRemunerazione: string;
  sezioneIV_testo: string;
  pagamentoNonLiberatorio: boolean;
  // Data documento
  dataOggi: string;
}

// ---------- Costanti CONSULBROKERS ----------
const CB_RAGSOC = "CONSULBROKERS S.p.A.";
const CB_SEDE = "Corso di Porta Nuova, 16 20121 MILANO";
const CB_PIVA = "14003610962";
const CB_TEL = "0817648268";
const CB_FAX = "0817648685";
const CB_EMAIL = "info@consulbrokers.it";
const CB_PEC = "consulbrokers@pec-mail.it";
const CB_SITO = "www.consulbrokers.it";
const CB_RUI_SEZ = "B";
const CB_RUI_NUM = "B000778092";
const CB_RUI_DATA = "23/04/2025";
const CB_LEGALE = "Antonio Perretti nato a Potenza il 11/04/1959 C.F. PRRTNT59D11G942E";

// ---------- Layout ----------
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = { top: 50, right: 45, bottom: 50, left: 45 };
const CONTENT_W = A4.w - MARGIN.left - MARGIN.right;

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

const COLOR = {
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.35, 0.35, 0.35),
  line: rgb(0.6, 0.6, 0.6),
  headerBg: rgb(0.85, 0.88, 0.87),
  headerText: rgb(0.05, 0.25, 0.22),
};

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.y = A4.h - MARGIN.top;
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN.bottom) newPage(ctx);
}

// Wrap text by width
function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(candidate, size) > maxW && line) {
        out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { size?: number; bold?: boolean; italic?: boolean; color?: any; x?: number; maxW?: number; lineGap?: number; align?: "left" | "center" | "right" } = {}
) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : opts.italic ? ctx.italic : ctx.font;
  const color = opts.color ?? COLOR.text;
  const x = opts.x ?? MARGIN.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const lineGap = opts.lineGap ?? 2;
  const lines = wrap(text, f, size, maxW);
  for (const ln of lines) {
    ensureSpace(ctx, size + lineGap);
    let drawX = x;
    if (opts.align === "center") {
      const w = f.widthOfTextAtSize(ln, size);
      drawX = x + (maxW - w) / 2;
    } else if (opts.align === "right") {
      const w = f.widthOfTextAtSize(ln, size);
      drawX = x + maxW - w;
    }
    ctx.page.drawText(ln, { x: drawX, y: ctx.y - size, size, font: f, color });
    ctx.y -= size + lineGap;
  }
}

function spacer(ctx: Ctx, h: number) {
  ensureSpace(ctx, h);
  ctx.y -= h;
}

function sectionTitle(ctx: Ctx, title: string) {
  ensureSpace(ctx, 22);
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

function hLine(ctx: Ctx) {
  ensureSpace(ctx, 6);
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: ctx.y - 2 },
    end: { x: MARGIN.left + CONTENT_W, y: ctx.y - 2 },
    thickness: 0.5,
    color: COLOR.line,
  });
  ctx.y -= 6;
}

function checkbox(ctx: Ctx, label: string, checked: boolean) {
  ensureSpace(ctx, 14);
  const boxY = ctx.y - 10;
  ctx.page.drawRectangle({
    x: MARGIN.left,
    y: boxY,
    width: 9,
    height: 9,
    borderColor: COLOR.text,
    borderWidth: 0.6,
  });
  if (checked) {
    ctx.page.drawText("X", { x: MARGIN.left + 1.5, y: boxY + 1, size: 8, font: ctx.bold, color: COLOR.text });
  }
  ctx.y -= 0;
  drawText(ctx, label, { x: MARGIN.left + 14, maxW: CONTENT_W - 14, size: 9 });
}

function signatureLine(ctx: Ctx) {
  spacer(ctx, 14);
  ensureSpace(ctx, 16);
  ctx.page.drawText("Data, luogo ___________________________", {
    x: MARGIN.left, y: ctx.y - 9, size: 9, font: ctx.font, color: COLOR.text,
  });
  ctx.page.drawText("Timbro, firma ___________________________", {
    x: MARGIN.left + CONTENT_W / 2 + 10, y: ctx.y - 9, size: 9, font: ctx.font, color: COLOR.text,
  });
  ctx.y -= 18;
}

// ---------- PRIVACY (pp 1-3) ----------
function renderPrivacy(ctx: Ctx) {
  drawText(ctx, "INFORMATIVA RELATIVA AL TRATTAMENTO DEI DATI PERSONALI DEI CLIENTI", { size: 10, bold: true, align: "center" });
  drawText(ctx, "AI SENSI DELL'ART. 13 DEL REGOLAMENTO UE 2016/679 (\u201CGDPR\u201D)", { size: 9.5, bold: true, align: "center" });
  spacer(ctx, 6);

  drawText(ctx, "1. Titolare del trattamento e Responsabile per la protezione dei dati (DPO)", { bold: true, size: 9.5 });
  drawText(ctx,
    `Titolare del trattamento è ${CB_RAGSOC}, sita in ${CB_SEDE}, P. IVA ${CB_PIVA}, Tel: ${CB_TEL}, Fax: ${CB_FAX}, e-mail: ${CB_EMAIL}, in persona del legale rappresentante ${CB_LEGALE}.`
  );
  spacer(ctx, 4);

  drawText(ctx, "2. Finalità di trattamento e base giuridica e periodo di conservazione", { bold: true, size: 9.5 });
  spacer(ctx, 2);

  const finalita = [
    {
      f: "Finalità connesse all'instaurazione e all'esecuzione del rapporto contrattuale tra il Titolare e il Cliente.",
      g: "Esecuzione di un contratto/incarico di cui il Cliente è parte",
      p: "Durata del rapporto contrattuale e dopo la cessazione per un periodo di anche successivamente per l'espletamento degli obblighi di legge",
    },
    {
      f: "Adempimenti di obblighi previsti dalla normativa nazionale e da quella sovranzionale o internazionale, ivi compresa quella comunitaria.",
      g: "Necessità di assolvere obblighi di legge",
      p: "Durata del rapporto contrattuale e dopo la cessazione per un periodo di anche successivamente per l'espletamento degli obblighi di legge",
    },
    {
      f: "Tutela dei diritti del Titolare, sia in sede giudiziale che extragiudiziale, laddove dovessero presentarsene i presupposti (ad es. inadempimento del Cliente).",
      g: "Interesse legittimo",
      p: "Per la durata delle eventuali azioni giudiziali intraprese, sino allo scadere dei termini per proporre gravame, ai sensi della vigente normativa",
    },
    {
      f: "Finalità di profilazione, ovvero la raccolta di informazioni sui comportamenti e le abitudini commerciali, al fine di migliorare i servizi offerti.",
      g: "Consenso facoltativo e revocabile in ogni momento",
      p: "12 mesi",
    },
    {
      f: "Per attività di marketing, come ad esempio invio di comunicazioni promozionali e commerciali relative a servizi e/o prodotti offerti e/o distribuiti dal Titolare o segnalazione di eventi, iniziative e promozioni, nonché realizzazione di studi di mercato e analisi statistiche, con modalità automatizzate di contatto (sms, mms, e-mail) e tradizionali (telefonate, posta).",
      g: "Consenso facoltativo e revocabile in ogni momento",
      p: "24 mesi (termine massimo previsto dal Garante per il trattamento per finalità di marketing)",
    },
  ];

  const colW = (CONTENT_W - 8) / 2;
  for (let i = 0; i < finalita.length; i++) {
    const it = finalita[i];
    const fLines = wrap(`${i + 1}. ${it.f}`, ctx.font, 8.5, colW);
    const gLines = wrap("Base Giuridica: " + it.g, ctx.font, 8.5, colW);
    const pLines = wrap("Periodo conservazione: " + it.p, ctx.font, 8.5, colW);
    const blockH = Math.max(fLines.length, gLines.length + pLines.length + 1) * 11 + 4;
    ensureSpace(ctx, blockH);
    const startY = ctx.y;
    // colonna sinistra
    let yL = startY;
    for (const l of fLines) {
      ctx.page.drawText(l, { x: MARGIN.left, y: yL - 9, size: 8.5, font: ctx.font, color: COLOR.text });
      yL -= 11;
    }
    // colonna destra
    let yR = startY;
    for (const l of gLines) {
      ctx.page.drawText(l, { x: MARGIN.left + colW + 8, y: yR - 9, size: 8.5, font: ctx.font, color: COLOR.text });
      yR -= 11;
    }
    yR -= 3;
    for (const l of pLines) {
      ctx.page.drawText(l, { x: MARGIN.left + colW + 8, y: yR - 9, size: 8.5, font: ctx.font, color: COLOR.text });
      yR -= 11;
    }
    ctx.y = Math.min(yL, yR) - 4;
    ctx.page.drawLine({
      start: { x: MARGIN.left, y: ctx.y },
      end: { x: MARGIN.left + CONTENT_W, y: ctx.y },
      thickness: 0.3,
      color: COLOR.line,
    });
    ctx.y -= 4;
  }

  drawText(ctx, "Decorsi i termini di conservazione sopra indicati, i dati saranno distrutti, cancellati o resi anonimi, compatibilmente con le procedure tecniche di cancellazione e backup.", { italic: true, size: 8.5 });
  spacer(ctx, 4);

  drawText(ctx, "3. Natura obbligatoria e facoltativa del conferimento dei dati e conseguenze di un eventuale rifiuto", { bold: true, size: 9.5 });
  drawText(ctx, "Il conferimento dei dati da parte del Cliente è obbligatorio, in quanto necessario alla prestazione dei servizi richiesti. Pertanto, l'eventuale rifiuto, da parte del Cliente di fornire i dati può comportare la mancata prestazione del servizio, nella misura in cui tali dati siano necessari a tali fini.");
  spacer(ctx, 4);

  drawText(ctx, "4. Destinatari dei dati", { bold: true, size: 9.5 });
  drawText(ctx, "Nell'ambito delle finalità indicate sopra, i dati del Cliente potranno essere comunicati: a) ad Autorità ed organi di vigilanza e controllo; b) a Agenzie di assicurazione; c) a Periti e liquidatori; d) a Studi legali; e) ad altri intermediari assicurativi professionali; f) alle Aziende del Gruppo; g) a società ed operatori professionali che forniscono servizi di elaborazione elettronica dei dati e di consulenza informatica; h) a società per servizi di rilevazione statistica e/o ricerche di mercato; i) ad agenzie professionali di pubblicità, marketing e mailing.");
  spacer(ctx, 4);

  drawText(ctx, "5. Soggetti autorizzati al trattamento", { bold: true, size: 9.5 });
  drawText(ctx, "I dati potranno essere trattati dai dipendenti e collaboratori delle funzioni aziendali deputate al perseguimento delle finalità sopra indicate, espressamente autorizzati al trattamento.");
  spacer(ctx, 4);

  drawText(ctx, "6. Diritti dell'Interessato", { bold: true, size: 9.5 });
  drawText(ctx, "Il Cliente potrà, in qualsiasi momento, esercitare i diritti di accesso, rettifica, cancellazione, limitazione, opposizione, portabilità dei dati e revoca del consenso, nonché proporre reclamo all'Autorità di controllo (Garante per la protezione dei dati personali, www.garanteprivacy.it). Le richieste saranno evase entro un mese dalla domanda, prorogabile di ulteriori 2 mesi in casi di particolare complessità.");
}

// ---------- Pagina firma privacy ----------
function renderPrivacySignature(ctx: Ctx, d: PrecontrattualeData) {
  newPage(ctx);
  drawText(ctx, "DA RESTITUIRE FIRMATO", { bold: true, align: "center", size: 11 });
  spacer(ctx, 10);
  drawText(ctx, "Dati anagrafici del soggetto che rilascia il consenso", { bold: true, align: "center", size: 10 });
  spacer(ctx, 8);

  // tabella CF / PIVA
  const halfW = CONTENT_W / 2 - 4;
  drawText(ctx, "Codice Fiscale", { size: 8.5, bold: true });
  ctx.y += 12;
  drawText(ctx, "Partita IVA", { size: 8.5, bold: true, x: MARGIN.left + halfW + 8, maxW: halfW });
  ctx.y -= 2;
  // box
  ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - 16, width: halfW, height: 16, borderColor: COLOR.line, borderWidth: 0.5 });
  ctx.page.drawRectangle({ x: MARGIN.left + halfW + 8, y: ctx.y - 16, width: halfW, height: 16, borderColor: COLOR.line, borderWidth: 0.5 });
  ctx.page.drawText(d.clienteCF || "", { x: MARGIN.left + 4, y: ctx.y - 12, size: 9, font: ctx.font });
  ctx.page.drawText(d.clientePIVA || "", { x: MARGIN.left + halfW + 12, y: ctx.y - 12, size: 9, font: ctx.font });
  ctx.y -= 22;

  drawText(ctx, "Residenza o Sede Legale", { size: 8.5, bold: true, align: "center" });
  ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - 16, width: CONTENT_W, height: 16, borderColor: COLOR.line, borderWidth: 0.5 });
  const indir = [d.clienteIndirizzo, d.clienteCap, d.clienteCitta, d.clienteProvincia].filter(Boolean).join(" - ");
  ctx.page.drawText(indir || "-", { x: MARGIN.left + 4, y: ctx.y - 12, size: 9, font: ctx.font });
  ctx.y -= 24;

  drawText(ctx, "Con la sottoscrizione della presente, dichiaro di aver ricevuto e preso visione dell'Informativa relativa al trattamento dei dati personali ex art. 13 del GDPR.");
  signatureLine(ctx);
  drawText(ctx, "Presa visione dell'Informativa Privacy", { italic: true, size: 8.5 });

  // Consensi facoltativi
  spacer(ctx, 12);
  drawText(ctx, "CONSENSI FACOLTATIVI", { bold: true, align: "center", size: 11 });
  spacer(ctx, 6);
  drawText(ctx, "Profilazione - raccolta di informazioni sui comportamenti e abitudini commerciali al fine di migliorare i servizi offerti.", { size: 9 });
  spacer(ctx, 4);
  // ACC / NON ACC boxes
  const drawConsent = () => {
    ensureSpace(ctx, 16);
    const cx = MARGIN.left + 100;
    ctx.page.drawRectangle({ x: cx, y: ctx.y - 12, width: 12, height: 12, borderColor: COLOR.text, borderWidth: 0.6 });
    ctx.page.drawText("ACCONSENTO", { x: cx + 16, y: ctx.y - 10, size: 9, font: ctx.bold });
    ctx.page.drawRectangle({ x: cx + 110, y: ctx.y - 12, width: 12, height: 12, borderColor: COLOR.text, borderWidth: 0.6 });
    ctx.page.drawText("NON ACCONSENTO", { x: cx + 126, y: ctx.y - 10, size: 9, font: ctx.bold });
    ctx.y -= 18;
  };
  drawConsent();
  spacer(ctx, 6);
  drawText(ctx, "Marketing - invio di comunicazioni promozionali e commerciali relative a servizi e/o prodotti offerti e/o distribuiti dal Titolare, anche con modalità automatizzate (sms, mms, e-mail) e tradizionali (telefonate, posta).", { size: 9 });
  spacer(ctx, 4);
  drawConsent();
  signatureLine(ctx);
}

// ---------- MUP (Modulo Unico Precontrattuale) ----------
function renderMUP(ctx: Ctx, d: PrecontrattualeData) {
  newPage(ctx);
  drawText(ctx, "MODULO UNICO PRECONTRATTUALE (MUP) PER I PRODOTTI ASSICURATIVI", { bold: true, align: "center", size: 11 });
  spacer(ctx, 8);

  // Cliente / Polizza header table — 4 righe x 2 colonne
  const cellH = 14;
  const colW = CONTENT_W / 2;
  const drawHeaderRow = (left: string, right: string, opts?: { bold?: boolean }) => {
    ctx.page.drawRectangle({ x: MARGIN.left, y: ctx.y - cellH, width: colW, height: cellH, borderColor: COLOR.line, borderWidth: 0.5 });
    ctx.page.drawRectangle({ x: MARGIN.left + colW, y: ctx.y - cellH, width: colW, height: cellH, borderColor: COLOR.line, borderWidth: 0.5 });
    const f = opts?.bold ? ctx.bold : ctx.font;
    ctx.page.drawText(left, { x: MARGIN.left + 4, y: ctx.y - 10, size: 8.5, font: f });
    ctx.page.drawText(right, { x: MARGIN.left + colW + 4, y: ctx.y - 10, size: 8.5, font: f });
    ctx.y -= cellH;
  };

  const polNum = d.polizzaNumero || "-";
  const polApp = d.polizzaAppendice ? `   App: ${d.polizzaAppendice}` : "";
  drawHeaderRow(`Cliente: ${d.clienteNomeRagSoc || "-"}`, `Polizza: ${polNum}${polApp}`, { bold: true });

  const cfPiva = [
    d.clienteCF ? `CF: ${d.clienteCF}` : "",
    d.clientePIVA ? `P.IVA: ${d.clientePIVA}` : "",
  ].filter(Boolean).join("   ") || "-";
  drawHeaderRow(cfPiva, `Agenzia: ${d.polizzaCompagniaTesto || "-"}`);

  const cliInd = [d.clienteIndirizzo, d.clienteCap, d.clienteCitta, d.clienteProvincia ? `(${d.clienteProvincia})` : ""].filter(Boolean).join(" ");
  const decScad = `Decorr: ${d.polizzaDataDecorrenza || "-"}   Scad: ${d.polizzaDataScadenza || "-"}`;
  drawHeaderRow(`Indirizzo: ${cliInd || "-"}`, decScad);

  const ramoFraz = `Ramo: ${d.polizzaRamo || "-"}   Frazion: ${d.polizzaFrazionamento || "-"}`;
  const premio = `Premio lordo: ${d.polizzaPremioLordo ? "€ " + d.polizzaPremioLordo : "-"}`;
  drawHeaderRow(ramoFraz, premio);

  ctx.y -= 4;
  if (d.polizzaRiferimento) {
    drawText(ctx, `Riferimento: ${d.polizzaRiferimento}`, { italic: true, size: 8.5 });
  }
  spacer(ctx, 4);


  drawText(ctx, "AVVERTENZA", { bold: true, align: "center", size: 9.5 });
  drawText(ctx, "Ai sensi della vigente normativa, il distributore ha l'obbligo di consegnare/trasmettere al contraente il presente modulo, prima della sottoscrizione della proposta o del contratto di assicurazione. Il documento può essere fornito con modalità non cartacea se appropriato rispetto alle modalità di distribuzione del prodotto assicurativo e il contraente lo consente (art. 120-quater del Codice delle Assicurazioni Private).", { size: 8.5 });
  spacer(ctx, 4);

  // SEZIONE I
  sectionTitle(ctx, "SEZIONE I - Informazioni generali sul distributore che entra in contatto con il contraente");
  drawText(ctx, "1. INTERMEDIARIO CHE ENTRA IN CONTATTO CON IL CLIENTE", { bold: true, size: 9 });
  drawText(ctx, "1.1 Intermediario iscritto in Sezione B/E", { italic: true, size: 9 });
  spacer(ctx, 2);
  drawText(ctx, `Nome e Cognome: ${d.specialistNomeCognome || "-"}`, { size: 9 });
  drawText(ctx, `Iscrizione RUI: Sezione ${d.specialistSezioneRui || "-"}   Numero ${d.specialistNumeroRui || "-"}   Data iscrizione ${d.specialistDataIscrizione || "-"}`, { size: 9 });
  drawText(ctx, `Telefono: ${d.specialistTelefono || "-"}   e-mail: ${d.specialistEmail || "-"}`, { size: 9 });
  drawText(ctx, `Indirizzo: ${d.specialistIndirizzo || "-"}`, { size: 9 });
  drawText(ctx, "Nella sua qualità di: Addetto all'intermediazione al di fuori dei locali del broker (dipendente/collaboratore)", { size: 9, italic: true });
  if (d.sedeNome) {
    spacer(ctx, 3);
    drawText(ctx, "SEDE OPERATIVA:", { bold: true, size: 9 });
    drawText(ctx, `${d.sedeNome}`, { size: 9 });
    if (d.sedeIndirizzoCompleto) drawText(ctx, `Indirizzo: ${d.sedeIndirizzoCompleto}`, { size: 9 });
    if (d.sedeTelefono || d.sedeEmail) {
      drawText(ctx, `Telefono: ${d.sedeTelefono || "-"}   e-mail: ${d.sedeEmail || "-"}`, { size: 9 });
    }
  }
  spacer(ctx, 4);
  drawText(ctx, "ATTIVITÀ SVOLTA PER CONTO DI:", { bold: true, size: 9 });
  drawText(ctx, `Nome e Cognome: ${CB_RAGSOC}`, { size: 9 });
  drawText(ctx, `Iscrizione RUI: Sezione: ${CB_RUI_SEZ}   Numero: ${CB_RUI_NUM}   Data iscrizione: ${CB_RUI_DATA}`, { size: 9 });
  drawText(ctx, `Telefono: ${CB_TEL}   e-mail: ${CB_EMAIL}`, { size: 9 });
  drawText(ctx, `Sede Legale: ${CB_SEDE}`, { size: 9 });
  drawText(ctx, `Sito Internet: ${CB_SITO}   PEC: ${CB_PEC}`, { size: 9 });

  // SEZIONE II
  sectionTitle(ctx, "SEZIONE II - Informazioni sul modello di distribuzione");
  drawText(ctx, d.modelloDistribuzione, { size: 9 });
  if (!d.collaborazioneAltri) {
    drawText(ctx, "Si rappresenta inoltre che tale attività di distribuzione non è svolta in collaborazione con altri intermediari ai sensi di quanto stabilito dall'art. 22, comma 10, del D.L. 18 ottobre 2012, n. 179, convertito nella L. 17 dicembre 2012, n. 221.", { size: 9 });
  } else {
    drawText(ctx, "L'attività di distribuzione è svolta in collaborazione con altri intermediari ai sensi dell'art. 22, comma 10, del D.L. 179/2012.", { size: 9 });
  }

  // SEZIONE III - conflitto interesse
  sectionTitle(ctx, "SEZIONE III - Informazioni relative a potenziali situazioni di conflitto interesse");
  drawText(ctx, "a. non detiene una partecipazione diretta o indiretta superiore al 10% del capitale sociale o dei diritti di voto dell'Impresa di assicurazione;", { size: 9 });
  drawText(ctx, "b. nessuna Impresa di assicurazione o impresa controllante di una Impresa di assicurazione è detentrice di una partecipazione diretta o indiretta superiore al 10% del capitale sociale o dei diritti di voto della società di intermediazione per la quale l'intermediario opera.", { size: 9 });

  // SEZIONE IV
  sectionTitle(ctx, "SEZIONE IV - Informazioni sull'attività di distribuzione e consulenza");
  drawText(ctx, "Con riferimento alla distribuzione del prodotto assicurativo:", { size: 9 });
  drawText(ctx, d.sezioneII_testo, { size: 9 });

  // SEZIONE V
  sectionTitle(ctx, "SEZIONE V - Informazioni relative alle remunerazioni");
  drawText(ctx, `Il compenso relativo all'attività svolta dal Broker ${CB_RAGSOC} per la distribuzione del presente contratto è rappresentato da: ${d.tipoRemunerazione}.`, { size: 9 });
  drawText(ctx, "Le provvigioni riconosciute per il contratto proposto cui la presente informativa si riferisce sono pari a Euro ____ in valore assoluto, pari al ____ per cento del premio lordo a carico del Cliente.", { size: 9 });
  drawText(ctx, "NOTA: i compensi di cui sopra già includono, ove applicabili, gli eventuali compensi all'intermediario iscritto alla lettera E) e/o al collaboratore indicato nella Sezione I, nonché i compensi percepiti dagli altri intermediari coinvolti nella distribuzione del prodotto assicurativo in caso di collaborazioni orizzontali.", { size: 8.5, italic: true });

  // SEZIONE VI
  sectionTitle(ctx, "SEZIONE VI - Informazioni sul pagamento dei premi");
  drawText(ctx, "Con riferimento al pagamento dei premi, il Broker informa:", { size: 9 });
  drawText(ctx, `a. ${d.sezioneIV_testo}`, { size: 9 });
  drawText(ctx, "b. le modalità di pagamento dei premi ammesse sono: 1) assegni bancari, postali o circolari muniti della clausola di non trasferibilità intestati o girati all'impresa di assicurazione oppure all'intermediario espressamente in tale qualità; 2) ordini di bonifico, altri mezzi di pagamento bancario o postale, inclusi gli strumenti di pagamento elettronici, anche on line, che abbiano quale beneficiario uno dei soggetti indicati al precedente punto 1; 3) denaro contante, esclusivamente per i contratti RC auto e relative garanzie accessorie, nonché per gli altri rami danni con il limite di settecentocinquanta euro annui per ciascun contratto.", { size: 8.5 });
  if (d.pagamentoNonLiberatorio) {
    drawText(ctx, "c. Il pagamento dei premi all'intermediario o a un suo collaboratore non ha effetto liberatorio ai sensi dell'art. 118 del Codice delle Assicurazioni Private.", { size: 9, bold: true });
  } else {
    drawText(ctx, `c. Con riferimento al contratto proposto, il rischio è collocato presso l'Impresa ${d.polizzaCompagniaTesto || "____"} per cui l'intermediario è autorizzato all'incasso ai sensi dell'accordo sottoscritto o ratificato dall'impresa e che il pagamento dei premi effettuato all'intermediario o a un suo collaboratore ha effetto liberatorio ai sensi dell'art. 118 del Codice delle Assicurazioni Private.`, { size: 9 });
  }

  // SEZIONE VII
  sectionTitle(ctx, "SEZIONE VII - Informazioni sugli strumenti di tutela del contraente");
  drawText(ctx, "a. L'attività di distribuzione è garantita da un contratto di assicurazione della responsabilità civile, che copre i danni arrecati ai contraenti da negligenze ed errori professionali dell'intermediario o da negligenze, errori professionali ed infedeltà dei dipendenti, dei collaboratori o delle persone del cui operato l'intermediario deve rispondere a norma di legge.", { size: 8.5 });
  drawText(ctx, `b. Ferma restando la possibilità di rivolgersi all'Autorità Giudiziaria, il contraente/assicurato o l'avente diritto, tramite consegna a mano, via posta o mediante supporto informatico ha facoltà di proporre reclamo per iscritto al Broker al seguente indirizzo: ${CB_RAGSOC} - ${CB_SEDE} - PEC: ${CB_PEC}.`, { size: 8.5 });
  drawText(ctx, "c. Nel caso di mancato accoglimento del reclamo, il contraente/assicurato può rivolgersi all'Arbitro Assicurativo (www.arbitroassicurativo.org), organismo autonomo ed imparziale costituito con il supporto dell'IVASS.", { size: 8.5 });
  drawText(ctx, "d. Il contraente ha la possibilità di rivolgersi al Fondo di Garanzia per l'attività dei mediatori di assicurazione e riassicurazione, istituito presso la Consap, Via Yser 14, 00198 Roma, telefono 06/85796538, e-mail: fondobrokers@consap.it, per chiedere il risarcimento del danno patrimoniale causato dall'esercizio dell'attività d'intermediazione, che non sia stato risarcito dall'intermediario stesso o non sia stato indennizzato attraverso la polizza di cui alla lettera a).", { size: 8.5 });

  // SEZIONE VIII
  sectionTitle(ctx, "SEZIONE VIII - Informazioni sul diritto all'oblio oncologico");
  drawText(ctx, "L'intermediario comunica che, nei casi in cui il prodotto assicurativo preveda la compilazione di una dichiarazione o di un questionario medico sullo stato di salute, il contraente può esercitare il diritto all'oblio oncologico inteso quale diritto delle persone guarite da una patologia oncologica di non fornire informazioni, né subire indagini o accertamenti, in merito alla propria pregressa condizione patologica, decorso un determinato periodo di tempo dalla conclusione del trattamento attivo. La nullità di clausole difformi opera soltanto a vantaggio del contraente o dell'assicurato ed è rilevabile d'ufficio in ogni stato e grado del procedimento.", { size: 8.5 });

  signatureLine(ctx);
}

// ---------- Ricevuta finale ----------
function renderRicevuta(ctx: Ctx, d: PrecontrattualeData) {
  newPage(ctx);
  drawText(ctx, "RICEVUTA DEL CONTRAENTE, RELATIVA ALL'INFORMATIVA E ALLA CONSEGNA DELLA DOCUMENTAZIONE", { bold: true, align: "center", size: 10 });
  spacer(ctx, 8);
  drawText(ctx, "Dati anagrafici del contraente che rilascia la dichiarazione", { italic: true, align: "center", size: 9 });
  spacer(ctx, 6);

  drawText(ctx, `Cognome e Nome / Ragione Sociale: ${d.clienteNomeRagSoc || "-"}`, { size: 9 });
  drawText(ctx, `Codice Fiscale: ${d.clienteCF || "-"}    Partita IVA: ${d.clientePIVA || "-"}`, { size: 9 });
  drawText(ctx, "Residenza o sede legale:", { size: 9, bold: true });
  drawText(ctx, `Indirizzo: ${d.clienteIndirizzo || "-"}`, { size: 9 });
  drawText(ctx, `CAP: ${d.clienteCap || "-"}    Comune: ${d.clienteCitta || "-"}    Provincia: ${d.clienteProvincia || "-"}`, { size: 9 });
  spacer(ctx, 6);

  drawText(ctx, "In ottemperanza all'art. 56 comma 8 del Regolamento IVASS n. 40/2018 e successive modifiche, il sottoscritto contraente dichiara:", { size: 9 });
  spacer(ctx, 4);

  const dichiarazioni = [
    "Di aver ricevuto l'Allegato MUP",
    "Di aver ricevuto la dichiarazione di coerenza del contratto offerto",
    "Di avere ricevuto ed accettato la proposta assicurativa nonché tutta la documentazione precontrattuale",
    "Di aver ricevuto il testo contrattuale della polizza/appendice",
    "Di aver ricevuto l'informativa sulla privacy",
    "Di aver ricevuto e di aver accettato le condizioni del mandato di brokeraggio assicurativo",
    "Di accettare la trasmissione di tutta la documentazione pre-contrattuale e contrattuale in formato elettronico",
  ];
  for (const d of dichiarazioni) checkbox(ctx, d, false);

  signatureLine(ctx);
  spacer(ctx, 8);
  checkbox(ctx, "Ulteriore dichiarazione da sottoscrivere in caso di contratto RCA.", false);
  drawText(ctx, "Il sottoscritto contraente dichiara altresì di aver ricevuto la tabella contenente le informazioni sui livelli provvigionali (Regolamento IVASS 23/2008) dell'impresa di assicurazione o agenzia con cui ha i rapporti di affari nel ramo RCA, come indicato nell'Allegato 4.", { size: 8.5 });
}

export async function buildPrecontrattualePdf(d: PrecontrattualeData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN.top, font, bold, italic };

  renderPrivacy(ctx);
  renderPrivacySignature(ctx, d);
  renderMUP(ctx, d);
  renderRicevuta(ctx, d);

  return await doc.save();
}
