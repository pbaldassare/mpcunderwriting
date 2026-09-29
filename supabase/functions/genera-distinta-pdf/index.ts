import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function formatEur(n: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Se la richiesta è per la distinta provvigioni
    if (body.provvigioni_ids && Array.isArray(body.provvigioni_ids)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);

      // Fetch provvigioni generate con relazioni
      const { data: provs, error } = await admin
        .from("provvigioni_generate")
        .select(`
          id, 
          percentuale, 
          importo_provvigione, 
          calcolata_il, 
          user_id,
          titoli!provvigioni_generate_titolo_id_fkey(
            numero_titolo, 
            premio_lordo, 
            data_messa_cassa, 
            compagnie!titoli_compagnia_id_fkey(nome), 
            rami!titoli_ramo_id_fkey(descrizione)
          ),
          profiles!provvigioni_generate_user_id_fkey(nome, cognome)
        `)
        .in("id", body.provvigioni_ids);

      if (error) throw error;

      // Crea PDF
      const pdf = await PDFDocument.create();
      let page = pdf.addPage([595, 842]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const { width, height } = page.getSize();

      const left = 40;
      let y = height - 50;

      // Intestazione
      page.drawRectangle({
        x: 0,
        y: height - 80,
        width,
        height: 80,
        color: rgb(14 / 255, 116 / 255, 144 / 255), // Teal / Ocean color
      });

      page.drawText("DISTINTA PAGAMENTO PROVVIGIONI", {
        x: left,
        y: height - 48,
        size: 16,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(`Generato il ${new Date().toLocaleDateString("it-IT")} ${new Date().toLocaleTimeString("it-IT")}`, {
        x: left,
        y: height - 64,
        size: 9,
        font,
        color: rgb(0.9, 0.9, 0.9),
      });

      y = height - 110;

      // Sezione riassuntiva
      const totaleProvvigioni = (provs || []).reduce((sum, p: any) => sum + (p.importo_provvigione || 0), 0);
      const totaleLordo = (provs || []).reduce((sum, p: any) => sum + (p.titoli?.premio_lordo || 0), 0);

      page.drawText("RIEPILOGO DISTINTA", { x: left, y, size: 10, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
      y -= 6;
      page.drawLine({ start: { x: left, y }, end: { x: width - 40, y }, thickness: 0.8, color: rgb(14 / 255, 116 / 255, 144 / 255) });
      y -= 18;

      page.drawText("Totale Provvigioni da Liquidare:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
      page.drawText(formatEur(totaleProvvigioni), { x: left + 180, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
      y -= 16;

      page.drawText("Totale Premio Lordo Associato:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
      page.drawText(formatEur(totaleLordo), { x: left + 180, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
      y -= 16;

      page.drawText("Numero Provvigioni Incluse:", { x: left, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) });
      page.drawText(String(provs?.length || 0), { x: left + 180, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
      y -= 26;

      // Tabella provvigioni
      page.drawText("DETTAGLIO VOCI", { x: left, y, size: 10, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
      y -= 6;
      page.drawLine({ start: { x: left, y }, end: { x: width - 40, y }, thickness: 0.8, color: rgb(14 / 255, 116 / 255, 144 / 255) });
      y -= 18;

      for (const p of (provs || [])) {
        if (y < 80) {
          page = pdf.addPage([595, 842]);
          y = 780;
          page.drawText("DISTINTA DI PAGAMENTO (Continua)", { x: left, y, size: 8, font: fontBold, color: rgb(14 / 255, 116 / 255, 144 / 255) });
          y -= 15;
        }

        const destName = p.profiles ? `${p.profiles.cognome || ""} ${p.profiles.nome || ""}`.trim() : "—";
        const polText = `Polizza: ${p.titoli?.numero_titolo || "—"} | Beneficiario: ${destName}`;
        page.drawText(polText, { x: left, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.15) });
        y -= 12;

        const detailText = `Compagnia: ${p.titoli?.compagnie?.nome || "—"} | Ramo: ${p.titoli?.rami?.descrizione || "—"} | Premio: ${formatEur(p.titoli?.premio_lordo || 0)}`;
        page.drawText(detailText, { x: left, y, size: 8, font, color: rgb(0.4, 0.4, 0.45) });
        y -= 12;

        const provText = `Provvigione Liquidata: ${formatEur(p.importo_provvigione || 0)} (${p.percentuale || 0}%)`;
        page.drawText(provText, { x: left, y, size: 8, font: fontBold, color: rgb(21 / 255, 128 / 255, 61 / 255) }); // Green color
        y -= 18;
      }

      // Genera byte e ritorna base64
      const pdfBytes = await pdf.save();
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      return new Response(JSON.stringify({ success: true, filename: "distinta_provvigioni.pdf", content: base64 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Comportamento legacy (distinta giornaliera di cassa)
    const { data_distinta, ufficio_nome, totale_contanti, totale_assegni, totale_bonifici, totale_pos, totale_generale, saldo_cassa_atteso, differenza_cassa, righe, note } = body;

    const righeHtml = (righe || []).map((r: any, i: number) => `
      <tr style="${i % 2 === 0 ? 'background:#f9fafb;' : ''}">
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.tipo_pagamento || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${r.descrizione || '—'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-family:monospace;">${formatEur(r.importo || 0)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #1f2937; font-size: 13px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 20px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; flex: 1; }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .total { background: #f0f9ff; border-color: #3b82f6; }
  .total .kpi-value { color: #1d4ed8; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #1f2937; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  th:last-child { text-align: right; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign-block { border-top: 1px solid #1f2937; width: 200px; padding-top: 8px; text-align: center; font-size: 11px; color: #6b7280; }
  .note { margin-top: 20px; padding: 10px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; font-size: 12px; }
  .quadratura { margin-top: 16px; padding: 10px 16px; background: ${(differenza_cassa || 0) === 0 ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px; border: 1px solid ${(differenza_cassa || 0) === 0 ? '#86efac' : '#fca5a5'}; }
</style></head>
<body>
  <h1>Distinta Giornaliera</h1>
  <div class="subtitle">${data_distinta || '—'} — ${ufficio_nome || 'Ufficio'}</div>

  <div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Contanti</div><div class="kpi-value">${formatEur(totale_contanti || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">Assegni</div><div class="kpi-value">${formatEur(totale_assegni || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">Bonifici</div><div class="kpi-value">${formatEur(totale_bonifici || 0)}</div></div>
    <div class="kpi"><div class="kpi-label">POS</div><div class="kpi-value">${formatEur(totale_pos || 0)}</div></div>
    <div class="kpi total"><div class="kpi-label">Totale Generale</div><div class="kpi-value">${formatEur(totale_generale || 0)}</div></div>
  </div>

  <div class="quadratura">
    <strong>Quadratura Cassa:</strong> Saldo atteso ${formatEur(saldo_cassa_atteso || 0)} — Differenza: <strong>${formatEur(differenza_cassa || 0)}</strong>
  </div>

  <table>
    <thead><tr><th>Tipo Pagamento</th><th>Descrizione</th><th>Importo</th></tr></thead>
    <tbody>${righeHtml || '<tr><td colspan="3" style="text-align:center;padding:20px;color:#9ca3af;">Nessuna riga</td></tr>'}</tbody>
  </table>

  ${note ? `<div class="note"><strong>Note:</strong> ${note}</div>` : ''}

  <div class="footer">
    <div class="sign-block">Firma Operatore</div>
    <div class="sign-block">Firma Responsabile</div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
