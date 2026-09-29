// Edge function: notifica messa a cassa all'agenzia (rapporto).
// Stesso template per incasso diretto e Garantito; niente seconda mail se già notificato.
// Invia email via Resend, genera PDF archivio e collega documenti a ogni titolo coinvolto.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_EMAIL = "pscarpelli@consulbrokers.it";
const FROM_EMAIL = "ConsulNet <noreply@cbnet.it>";
const DOC_BUCKET = "documenti_titoli";
const DOC_CATEGORIA = "notifica_messa_cassa";

const TITOLI_SELECT = `
  id, numero_titolo, riga, sostituisce_polizza,
  premio_lordo, importo_incassato,
  provvigioni_firma, provvigioni_quietanza,
  data_messa_cassa, data_copertura, data_pagamento, tipo_pagamento, banca_pagamento,
  conferimento_gestito, fondi_ricevuti,
  garanzia_da, garanzia_a, data_competenza, data_scadenza,
  compagnia_id, compagnia_rapporto_id, ramo_id, ufficio_id, ae_anagrafica_id,
  cliente_anagrafica_id,
  clienti!titoli_cliente_anagrafica_id_fkey(id, cognome, nome, ragione_sociale, codice_fiscale, partita_iva),
  compagnie(id, nome, email_messe_a_cassa),
  compagnia_rapporti(id, nome_rapporto, codice_rapporto, sede_denominazione, sede_citta, email_messe_a_cassa, referente_compagnia),
  rami(id, descrizione, codice),
  uffici(id, nome_ufficio)
`;

type TitoloRow = Record<string, unknown>;

function fmtEuro(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return "—";
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("it-IT");
  } catch {
    return String(s);
  }
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveImportoEmail(t: TitoloRow): number | null {
  const incassato = t.importo_incassato != null ? Number(t.importo_incassato) : null;
  const lordo = t.premio_lordo != null ? Number(t.premio_lordo) : null;
  const isGarantito = !!t.conferimento_gestito || String(t.tipo_pagamento || "").toLowerCase() === "garantito";
  if (isGarantito && (incassato == null || incassato === 0)) return lordo;
  if (incassato != null && incassato > 0) return incassato;
  return lordo;
}

/** Stessa logica di src/lib/getProvvigioneEC.ts (quietanza vs firma, no doppio conteggio). */
function provvigioneMaturata(t: TitoloRow): number {
  const firma = Number(t.provvigioni_firma) || 0;
  const quietanza = Number(t.provvigioni_quietanza) || 0;
  if (t.sostituisce_polizza) return quietanza;
  return quietanza > 0 ? quietanza : firma;
}

function totaleProvvigioniMaturate(titoli: TitoloRow[]): number {
  return titoli.reduce((s, t) => s + provvigioneMaturata(t), 0);
}

function clienteNome(t: TitoloRow): string {
  const cliente = t.clienti as Record<string, unknown> | null;
  return (
    (cliente?.ragione_sociale as string) ||
    `${cliente?.cognome ?? ""} ${cliente?.nome ?? ""}`.trim() ||
    "—"
  );
}

function ramoLabel(t: TitoloRow): string {
  const ramo = t.rami as Record<string, unknown> | null;
  if (!ramo) return "—";
  return `${ramo.descrizione || ""}${ramo.codice ? ` (${ramo.codice})` : ""}`.trim() || "—";
}

function agenziaGroupKey(t: TitoloRow): string {
  const rapId = t.compagnia_rapporto_id ? String(t.compagnia_rapporto_id) : "";
  if (rapId) return `rapporto:${rapId}`;
  const compId = t.compagnia_id ? String(t.compagnia_id) : "";
  if (compId) return `compagnia:${compId}`;
  return `titolo:${t.id}`;
}

function agenziaNome(t: TitoloRow): string {
  const rapporto = t.compagnia_rapporti as Record<string, unknown> | null;
  const compagnia = t.compagnie as Record<string, unknown> | null;
  return (
    (rapporto?.nome_rapporto && String(rapporto.nome_rapporto).trim()) ||
    (rapporto?.sede_denominazione && String(rapporto.sede_denominazione).trim()) ||
    (compagnia?.nome && String(compagnia.nome).trim()) ||
    "Agenzia"
  );
}

function groupTitoliPerAgenzia(titoli: TitoloRow[]): TitoloRow[][] {
  const map = new Map<string, TitoloRow[]>();
  for (const t of titoli) {
    const key = agenziaGroupKey(t);
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.values()];
}

function resolveRecipient(t: TitoloRow): string {
  const rapporto = t.compagnia_rapporti as Record<string, unknown> | null;
  const compagnia = t.compagnie as Record<string, unknown> | null;
  return (
    (rapporto?.email_messe_a_cassa && String(rapporto.email_messe_a_cassa).trim()) ||
    (compagnia?.email_messe_a_cassa && String(compagnia.email_messe_a_cassa).trim()) ||
    FALLBACK_EMAIL
  );
}

function isGarantitoTitolo(t: TitoloRow): boolean {
  return !!t.conferimento_gestito || String(t.tipo_pagamento || "").toLowerCase() === "garantito";
}

function modalitaLabel(t: TitoloRow): string {
  const tipoPagLabels: Record<string, string> = {
    bonifico: "Bonifico bancario",
    contanti: "Contanti",
    assegno: "Assegno",
    pos: "POS / Carta",
    rid: "RID / Addebito SEPA",
    garantito: "Bonifico bancario",
    costi_consulbrokers: "Bonifico bancario",
    compensazione: "Bonifico bancario",
  };
  return tipoPagLabels[String(t.tipo_pagamento || "").toLowerCase()] || String(t.tipo_pagamento || "—");
}

/** Template unico: stesso avviso incasso per messa a cassa e per Garantito. */
function buildEmailContent(titoli: TitoloRow[], sentAt: Date) {
  const isBulk = titoli.length > 1;
  const primary = titoli[0];
  const recipient = resolveRecipient(primary);
  const nomeAgenzia = agenziaNome(primary);

  const clientiUnici = [...new Set(titoli.map(clienteNome))];
  const clienteLabel = clientiUnici.length === 1 ? clientiUnici[0] : `${clientiUnici.length} clienti`;

  const subject = isBulk
    ? `Comunicazione messa a cassa — ${nomeAgenzia} — ${titoli.length} polizze — ${clienteLabel}`
    : `Comunicazione messa a cassa — ${nomeAgenzia} — Polizza ${primary.numero_titolo || "—"} — ${clienteNome(primary)}`;

  const introBody = `<p style="margin:0 0 14px;">In data odierna abbiamo incassato per Vostro conto${isBulk ? " i seguenti premi" : " il seguente premio"}, come da accordi${isBulk ? "" : ` a mezzo <strong>${escapeHtml(modalitaLabel(primary))}</strong>`}:</p>`;

  const totProvv = totaleProvvigioniMaturate(titoli);
  const totPremi = titoli.reduce((s, t) => s + (resolveImportoEmail(t) || 0), 0);

  const righeTabella = titoli.map((t) => {
    const num = String(t.numero_titolo || "—");
    const cli = escapeHtml(clienteNome(t));
    const ramo = escapeHtml(ramoLabel(t));
    const dec = escapeHtml(fmtDate(t.garanzia_da as string | null));
    const imp = escapeHtml(fmtEuro(resolveImportoEmail(t)));
    const mod = escapeHtml(modalitaLabel(t));
    if (isBulk) {
      return `<tr>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;"><strong>${cli}</strong></td>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;">${ramo}</td>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;"><strong>${num}</strong></td>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;">${dec}</td>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;text-align:right;"><strong>${imp}</strong></td>
        <td style="padding:6px;border-bottom:1px solid #e0e6e4;">${mod}</td>
      </tr>`;
    }
    return "";
  }).join("");

  const tabellaSingola = !isBulk ? `
          <table role="presentation" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 18px;">
            <tr><td style="width:42%;color:#55615e;">Contraente</td><td><strong>${escapeHtml(clienteNome(primary))}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Ramo</td><td>${escapeHtml(ramoLabel(primary))}</td></tr>
            <tr><td style="color:#55615e;">Polizza</td><td><strong>${escapeHtml(String(primary.numero_titolo || "—"))}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Decorrenza</td><td>${escapeHtml(fmtDate(primary.garanzia_da as string | null))}</td></tr>
            <tr><td style="color:#55615e;">Premio</td><td><strong>${escapeHtml(fmtEuro(resolveImportoEmail(primary)))}</strong></td></tr>
            <tr style="background:#f7faf9;"><td style="color:#55615e;">Provvigioni maturate</td><td><strong>${escapeHtml(fmtEuro(provvigioneMaturata(primary)))}</strong></td></tr>
            <tr><td style="color:#55615e;">Modalità incasso</td><td>${escapeHtml(modalitaLabel(primary))}</td></tr>
          </table>
          <p style="margin:0 0 18px;font-size:14px;"><strong>Totale provvigioni maturate:</strong> ${escapeHtml(fmtEuro(totProvv))}</p>` : `
          <table role="presentation" cellpadding="6" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:13px;">
            <thead>
              <tr style="background:#f0f4f3;">
                <th style="padding:6px;text-align:left;">Contraente</th>
                <th style="padding:6px;text-align:left;">Ramo</th>
                <th style="padding:6px;text-align:left;">Polizza</th>
                <th style="padding:6px;text-align:left;">Decorrenza</th>
                <th style="padding:6px;text-align:right;">Premio</th>
                <th style="padding:6px;text-align:left;">Modalità</th>
              </tr>
            </thead>
            <tbody>${righeTabella}</tbody>
            <tfoot>
              <tr style="background:#f7faf9;">
                <td colspan="4" style="padding:8px 6px;text-align:right;font-weight:600;">Totale premi</td>
                <td style="padding:8px 6px;text-align:right;font-weight:600;">${escapeHtml(fmtEuro(totPremi))}</td>
                <td></td>
              </tr>
              <tr style="background:#eef5f3;">
                <td colspan="4" style="padding:8px 6px;text-align:right;font-weight:600;">Totale provvigioni maturate</td>
                <td style="padding:8px 6px;text-align:right;font-weight:600;">${escapeHtml(fmtEuro(totProvv))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>`;

  const html = `
<!doctype html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f7f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e6e4;">
        <tr><td style="background:#0d4f47;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:600;">
          Consulbrokers — Avviso incasso
        </td></tr>
        <tr><td style="padding:24px;font-size:14px;line-height:1.55;">
          <p style="margin:0 0 14px;">Spettabile ${escapeHtml(agenziaNome(primary))},</p>
          ${introBody}
          ${tabellaSingola}
          <p style="margin:0;">È gradita l'occasione per porgere cordiali saluti.</p>
        </td></tr>
        <tr><td style="background:#fafbfb;color:#7a8784;padding:14px 24px;font-size:11px;border-top:1px solid #e0e6e4;">
          Messaggio generato automaticamente dal gestionale CBnet il ${escapeHtml(fmtDateTime(sentAt))}. Non rispondere a questa email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, recipient, isBulk, clienteLabel };
}

async function buildArchivePdf(opts: {
  subject: string;
  recipient: string;
  sentAt: Date;
  sendId: string | null;
  titoli: TitoloRow[];
}): Promise<Uint8Array> {
  const { subject, recipient, sentAt, sendId, titoli } = opts;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595;
  const pageH = 842;
  const margin = 40;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const drawLine = (text: string, size = 10, f: PDFFont = font, indent = 0) => {
    const maxW = pageW - margin * 2 - indent;
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        if (y < margin + 14) {
          page = pdf.addPage([pageW, pageH]);
          y = pageH - margin;
        }
        page.drawText(line, { x: margin + indent, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
        y -= size + 4;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin + 14) {
        page = pdf.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      page.drawText(line, { x: margin + indent, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= size + 4;
    }
  };

  page.drawRectangle({ x: 0, y: pageH - 72, width: pageW, height: 72, color: rgb(0.05, 0.31, 0.28) });
  page.drawText("ARCHIVIO NOTIFICA AGENZIA", { x: margin, y: pageH - 42, size: 14, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Messa a cassa / incasso", {
    x: margin, y: pageH - 58, size: 9, font, color: rgb(0.85, 0.95, 0.92),
  });
  y = pageH - 96;

  drawLine("Metadati invio", 11, bold);
  y -= 4;
  drawLine(`Oggetto: ${subject}`, 9);
  drawLine(`Destinatario: ${recipient}`, 9);
  drawLine(`Mittente: ${FROM_EMAIL}`, 9);
  drawLine(`Inviato il: ${fmtDateTime(sentAt)}`, 9);
  if (sendId) drawLine(`ID messaggio Resend: ${sendId}`, 9);
  y -= 8;

  drawLine("Dettaglio polizze", 11, bold);
  y -= 4;
  for (const t of titoli) {
    drawLine(`• ${clienteNome(t)} — Polizza ${t.numero_titolo || "—"} — ${ramoLabel(t)}`, 9);
    drawLine(`  Decorrenza: ${fmtDate(t.garanzia_da as string | null)} | Premio: ${fmtEuro(resolveImportoEmail(t))} | Provv.: ${fmtEuro(provvigioneMaturata(t))} | ${modalitaLabel(t)}`, 8, font, 8);
    y -= 2;
  }
  y -= 6;
  drawLine(`Totale premi: ${fmtEuro(titoli.reduce((s, t) => s + (resolveImportoEmail(t) || 0), 0))}`, 10, bold);
  drawLine(`Totale provvigioni maturate: ${fmtEuro(totaleProvvigioniMaturate(titoli))}`, 10, bold);

  y -= 10;
  drawLine("Testo comunicazione inviata", 11, bold);
  y -= 4;
  const bodyIntro = `In data odierna abbiamo incassato per Vostro conto ${titoli.length > 1 ? "i premi indicati" : "il premio indicato"}.`;
  drawLine(bodyIntro, 9);
  drawLine("È gradita l'occasione per porgere cordiali saluti.", 9);

  page.drawText(`Documento archiviato automaticamente da CBnet — ${fmtDateTime(new Date())}`, {
    x: margin,
    y: margin - 10,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  return pdf.save();
}

/** Se il titolo è una quietanza, risolve l'id della polizza madre (stesso numero_titolo, riga madre). */
async function resolveMadreTitoloId(
  supabase: ReturnType<typeof createClient>,
  titoloId: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from("titoli")
    .select("id, numero_titolo, sostituisce_polizza")
    .eq("id", titoloId)
    .maybeSingle();
  if (error) throw error;
  if (!row || !row.sostituisce_polizza || !row.numero_titolo) return titoloId;

  const { data: madre, error: mErr } = await supabase
    .from("titoli")
    .select("id")
    .eq("numero_titolo", row.numero_titolo)
    .is("sostituisce_polizza", null)
    .order("riga", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  return (madre?.id as string) ?? titoloId;
}

async function archivePdfToTitoli(
  supabase: ReturnType<typeof createClient>,
  titoloIds: string[],
  pdfBytes: Uint8Array,
  fileName: string,
  userId: string | null,
): Promise<{ path: string; documentiIds: string[] }> {
  const batchId = crypto.randomUUID();
  const path = `incasso-notifiche/${batchId}/${fileName}`;

  const { error: upErr } = await supabase.storage.from(DOC_BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) throw upErr;

  const madreIds = [
    ...new Set(await Promise.all(titoloIds.map((tid) => resolveMadreTitoloId(supabase, tid)))),
  ];

  const rows = madreIds.map((tid) => ({
    nome_file: fileName,
    path_storage: path,
    bucket_name: DOC_BUCKET,
    entita_tipo: "titolo",
    entita_id: tid,
    caricato_da: userId,
    caricato_da_cliente: false,
    visibile_al_cliente: false,
    categoria: DOC_CATEGORIA,
  }));

  const { data: docs, error: insErr } = await supabase.from("documenti").insert(rows).select("id");
  if (insErr) throw insErr;

  return { path, documentiIds: (docs || []).map((d: { id: string }) => d.id) };
}

/** Titoli che hanno già ricevuto notifica agenzia (es. al Garantito). */
async function getAlreadyNotifiedTitoloIds(
  supabase: ReturnType<typeof createClient>,
  titoloIds: string[],
): Promise<Set<string>> {
  if (titoloIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("log_attivita")
    .select("entita_id")
    .eq("entita_tipo", "titolo")
    .eq("azione", "notifica_messa_cassa_inviata")
    .in("entita_id", titoloIds);
  if (error) throw error;
  return new Set((data || []).map((r: { entita_id: string }) => r.entita_id));
}

const payloadSchema = z.object({
  titolo_id: z.string().uuid().optional(),
  titolo_ids: z.array(z.string().uuid()).min(1).optional(),
  force: z.boolean().optional(),
  flush_coda: z.boolean().optional(),
}).refine(
  (d) =>
    !!d.flush_coda ||
    !!d.titolo_id ||
    (Array.isArray(d.titolo_ids) && d.titolo_ids.length > 0),
  { message: "Specificare titolo_id, titolo_ids o flush_coda" },
);

type CodaClaimRow = { id: string; titolo_ids: string[] | null };

async function claimDueCoda(
  supabase: ReturnType<typeof createClient>,
): Promise<CodaClaimRow[]> {
  const { data, error } = await supabase.rpc("claim_messa_cassa_notifiche_coda");
  if (error) {
    console.error("claim_messa_cassa_notifiche_coda:", error);
    return [];
  }
  return (data || []) as CodaClaimRow[];
}

async function markCoda(
  supabase: ReturnType<typeof createClient>,
  rowIds: string[],
  status: "sent" | "error",
  result: Record<string, unknown>,
): Promise<void> {
  if (rowIds.length === 0) return;
  await supabase
    .from("messa_cassa_notifiche_coda")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: status === "error" ? String(result.error ?? "errore") : null,
      result_json: result,
    })
    .in("id", rowIds);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { force = false, flush_coda: flushCoda = false } = parsed.data;
    let titoloIds = [...new Set(
      parsed.data.titolo_ids?.length
        ? parsed.data.titolo_ids
        : parsed.data.titolo_id
          ? [parsed.data.titolo_id]
          : [],
    )].sort();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    let codaRows: CodaClaimRow[] = [];
    if (flushCoda) {
      codaRows = await claimDueCoda(supabase);
      const codaIds = codaRows.flatMap((r) => r.titolo_ids || []).filter(Boolean);
      titoloIds = [...new Set([...titoloIds, ...codaIds])].sort();
    }

    if (titoloIds.length === 0) {
      if (codaRows.length > 0) {
        await markCoda(supabase, codaRows.map((r) => r.id), "sent", { skipped: true, reason: "coda_vuota" });
      }
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "nessun_titolo", coda_flush: codaRows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!force) {
      const alreadyNotified = await getAlreadyNotifiedTitoloIds(supabase, titoloIds);
      const pendingIds = titoloIds.filter((id) => !alreadyNotified.has(id));
      if (pendingIds.length === 0) {
        if (codaRows.length > 0) {
          await markCoda(supabase, codaRows.map((r) => r.id), "sent", { skipped: true, reason: "already_sent" });
        }
        return new Response(
          JSON.stringify({ ok: true, skipped: true, reason: "already_sent", coda_flush: codaRows.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      titoloIds = pendingIds;
    }

    const { data: titoliRaw, error: tErr } = await supabase
      .from("titoli")
      .select(TITOLI_SELECT)
      .in("id", titoloIds);
    if (tErr) throw tErr;

    const titoliMap = new Map((titoliRaw || []).map((t: TitoloRow) => [t.id as string, t]));
    const titoli = titoloIds.map((id) => titoliMap.get(id)).filter(Boolean) as TitoloRow[];
    if (titoli.length === 0) {
      if (codaRows.length > 0) {
        await markCoda(supabase, codaRows.map((r) => r.id), "error", { error: "titoli non trovati" });
      }
      return new Response(JSON.stringify({ error: "titoli non trovati" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gruppi = groupTitoliPerAgenzia(titoli);
    const sentAt = new Date();
    const invii: Array<Record<string, unknown>> = [];
    let documentiArchiviati = 0;
    let inviiOk = 0;
    let inviiKo = 0;
    const archiveErrors: string[] = [];
    const recipients: string[] = [];

    for (const gruppo of gruppi) {
      const ids = gruppo.map((t) => t.id as string);
      const isBulk = gruppo.length > 1;
      const bulkKey = ids.join(",");
      const auditGarantito = gruppo.some(isGarantitoTitolo);
      const { subject, html, recipient } = buildEmailContent(gruppo, sentAt);

      const { data: sendRes, error: sendErr } = await supabase.functions.invoke("send-email", {
        body: {
          to: recipient,
          subject,
          html,
          from: FROM_EMAIL,
          apply_branding: true,
        },
      });

      const sendId = (sendRes as { id?: string })?.id ?? null;

      if (sendErr) {
        console.error("send-email failed:", sendErr);
        inviiKo++;
        for (const tid of ids) {
          await supabase.from("log_attivita").insert({
            azione: "notifica_messa_cassa_errore",
            entita_tipo: "titolo",
            entita_id: tid,
            severity: "warning",
            user_id: userId,
            dettagli_json: {
              destinatario: recipient,
              oggetto: subject,
              errore: (sendErr as { message?: string })?.message ?? String(sendErr),
              garantito: auditGarantito,
              bulk: isBulk,
              bulk_key: isBulk ? bulkKey : undefined,
              agenzia: agenziaNome(gruppo[0]),
            },
          });
        }
        invii.push({
          ok: false,
          recipient,
          agenzia: agenziaNome(gruppo[0]),
          titolo_ids: ids,
          error: (sendErr as { message?: string })?.message ?? "send-email failed",
        });
        continue;
      }

      inviiOk++;
      recipients.push(recipient);
      const ts = sentAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = (agenziaNome(gruppo[0]) || "agenzia").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
      const fileName = `Avviso_incasso_${slug}_${ts}.pdf`;
      let archiveResult: { path: string; documentiIds: string[] } | null = null;
      let archiveError: string | null = null;

      try {
        const pdfBytes = await buildArchivePdf({
          subject,
          recipient,
          sentAt,
          sendId,
          titoli: gruppo,
        });
        archiveResult = await archivePdfToTitoli(supabase, ids, pdfBytes, fileName, userId);
        documentiArchiviati += archiveResult.documentiIds.length;
      } catch (archErr) {
        archiveError = (archErr as Error)?.message ?? String(archErr);
        archiveErrors.push(archiveError);
        console.error("archive PDF failed:", archErr);
      }

      const logPayload = {
        destinatario: recipient,
        oggetto: subject,
        send_id: sendId,
        garantito: auditGarantito,
        force,
        bulk: isBulk,
        bulk_key: isBulk ? bulkKey : undefined,
        titolo_ids: ids,
        agenzia: agenziaNome(gruppo[0]),
        path_storage: archiveResult?.path ?? null,
        documenti_ids: archiveResult?.documentiIds ?? [],
        archive_error: archiveError,
        inviato_il: sentAt.toISOString(),
      };

      for (const tid of ids) {
        await supabase.from("log_attivita").insert({
          azione: "notifica_messa_cassa_inviata",
          entita_tipo: "titolo",
          entita_id: tid,
          severity: archiveError ? "warning" : "info",
          user_id: userId,
          dettagli_json: logPayload,
        });
      }

      invii.push({
        ok: true,
        recipient,
        agenzia: agenziaNome(gruppo[0]),
        send_id: sendId,
        titolo_ids: ids,
        documenti_archiviati: archiveResult?.documentiIds.length ?? 0,
        path_storage: archiveResult?.path ?? null,
        archive_error: archiveError,
      });
    }

    const resultPayload = {
      ok: inviiOk > 0,
      recipient: recipients[0] ?? null,
      recipients,
      invii: inviiOk,
      invii_ok: inviiOk,
      invii_ko: inviiKo,
      agenzie: gruppi.length,
      garantito: titoli.some(isGarantitoTitolo),
      bulk: titoli.length > 1,
      documenti_archiviati: documentiArchiviati,
      archive_error: archiveErrors[0] ?? null,
      dettaglio_invii: invii,
      coda_flush: codaRows.length,
    };

    if (codaRows.length > 0) {
      await markCoda(
        supabase,
        codaRows.map((r) => r.id),
        inviiOk > 0 || inviiKo === 0 ? "sent" : "error",
        resultPayload,
      );
    }

    return new Response(
      JSON.stringify(resultPayload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notifica-messa-cassa-agenzia error:", err);
    return new Response(
      JSON.stringify({ ok: false, fallback: true, error: (err as Error)?.message ?? String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
