import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletions, hasAiCredentials, buildDocumentUserContent } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hashRow(data: string, importo: number, desc: string): string {
  const normalized = `${data}|${importo.toFixed(2)}|${desc.replace(/\s+/g, " ").trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const chr = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseCSV(text: string): Array<{ data_operazione: string; descrizione: string; importo: number; saldo: number | null }> {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const sep = header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map(c => c.trim().replace(/"/g, ""));

  const dataIdx = cols.findIndex(c => /data|date/i.test(c));
  const descIdx = cols.findIndex(c => /descri|causale|riferimento|note/i.test(c));
  const importoIdx = cols.findIndex(c => /importo|amount|dare|avere/i.test(c));
  const saldoIdx = cols.findIndex(c => /saldo|balance/i.test(c));

  const results: Array<{ data_operazione: string; descrizione: string; importo: number; saldo: number | null }> = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ""));
    if (vals.length < 2) continue;

    const rawData = dataIdx >= 0 ? vals[dataIdx] : "";
    const rawDesc = descIdx >= 0 ? vals[descIdx] : vals.slice(1).join(" ");
    const rawImporto = importoIdx >= 0 ? vals[importoIdx] : "0";
    const rawSaldo = saldoIdx >= 0 ? vals[saldoIdx] : null;

    const importo = parseImporto(rawImporto);
    if (importo === 0 && !rawDesc) continue;

    results.push({
      data_operazione: parseData(rawData),
      descrizione: rawDesc,
      importo,
      saldo: rawSaldo ? parseImporto(rawSaldo) : null,
    });
  }
  return results;
}

function parseImporto(raw: string): number {
  if (!raw) return 0;
  let s = raw.replace(/[€$\s]/g, "").trim();
  // Handle European format: 1.234,56 -> 1234.56
  if (/^\-?\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseData(raw: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];
  // Try dd/mm/yyyy
  const m1 = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // Try yyyy-mm-dd
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return raw;
  return new Date().toISOString().split("T")[0];
}

async function parseWithAI(text: string): Promise<Array<{ data_operazione: string; descrizione: string; importo: number; saldo: number | null }>> {
  const response = await aiChatCompletions({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You extract bank transactions from text. Return ONLY a JSON array of objects with these fields:
- data_operazione: date in YYYY-MM-DD format
- descrizione: transaction description
- importo: numeric amount (positive for credits, negative for debits)
- saldo: balance after transaction (null if not available)
Parse all amounts correctly handling European format (comma as decimal separator, dots as thousands).
Return [] if no transactions found.`,
        },
        { role: "user", content: text.substring(0, 15000) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_transactions",
          description: "Extract bank transactions from document text",
          parameters: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    data_operazione: { type: "string" },
                    descrizione: { type: "string" },
                    importo: { type: "number" },
                    saldo: { type: ["number", "null"] },
                  },
                  required: ["data_operazione", "descrizione", "importo"],
                  additionalProperties: false,
                },
              },
            },
            required: ["transactions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_transactions" } },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  const parsed = JSON.parse(toolCall.function.arguments);
  return (parsed.transactions || []).map((t: any) => ({
    data_operazione: t.data_operazione || new Date().toISOString().split("T")[0],
    descrizione: t.descrizione || "",
    importo: typeof t.importo === "number" ? t.importo : parseImporto(String(t.importo)),
    saldo: typeof t.saldo === "number" ? t.saldo : null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documento_id, user_id } = await req.json();
    if (!documento_id) throw new Error("documento_id richiesto");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get document record
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("banca_documenti")
      .select("*")
      .eq("id", documento_id)
      .single();
    if (docErr || !doc) throw new Error("Documento non trovato");

    // Update status
    await supabaseAdmin.from("banca_documenti").update({ stato: "in_elaborazione" }).eq("id", documento_id);

    // Log start
    if (user_id) {
      await supabaseAdmin.from("log_attivita").insert({
        user_id,
        azione: "avvio_parsing",
        entita_tipo: "banca_documento",
        entita_id: documento_id,
      });
    }

    // Download file from storage
    const { data: fileData, error: fileErr } = await supabaseAdmin.storage
      .from("documenti_banca")
      .download(doc.path_storage);
    if (fileErr || !fileData) throw new Error("Impossibile scaricare il file: " + (fileErr?.message || ""));

    let rows: Array<{ data_operazione: string; descrizione: string; importo: number; saldo: number | null }> = [];

    if (doc.tipo_documento === "csv") {
      const text = await fileData.text();
      rows = parseCSV(text);
    } else {
      // For PDF/images, use AI to extract text and parse
      if (!hasAiCredentials()) throw new Error("API IA non configurata");

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const mimeType = doc.tipo_documento === "pdf" ? "application/pdf" : `image/${doc.tipo_documento === "jpg" ? "jpeg" : doc.tipo_documento}`;
      const userContent = await buildDocumentUserContent({
        mimeType,
        fileBase64: base64,
        instruction: "Estrai tutti i movimenti bancari da questo documento. Restituisci solo il JSON array.",
        filename: doc.tipo_documento === "pdf" ? "estratto.pdf" : "estratto.jpg",
      });

      const response = await aiChatCompletions({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You extract bank transactions from bank statements. Return ONLY a JSON array of objects.
Each object must have: data_operazione (YYYY-MM-DD), descrizione (string), importo (number, positive=credit, negative=debit), saldo (number or null).
Parse European number formats (comma=decimal, dot=thousands).
Return [] if no transactions found.`,
            },
            { role: "user", content: userContent },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_transactions",
              description: "Extract bank transactions from document",
              parameters: {
                type: "object",
                properties: {
                  transactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        data_operazione: { type: "string" },
                        descrizione: { type: "string" },
                        importo: { type: "number" },
                        saldo: { type: ["number", "null"] },
                      },
                      required: ["data_operazione", "descrizione", "importo"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["transactions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_transactions" } },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI OCR error:", response.status, errText);
        if (response.status === 429) throw new Error("Rate limit AI superato, riprovare più tardi");
        if (response.status === 402) throw new Error("Crediti AI esauriti");
        throw new Error(`Errore AI: ${response.status}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        rows = (parsed.transactions || []).map((t: any) => ({
          data_operazione: t.data_operazione || new Date().toISOString().split("T")[0],
          descrizione: t.descrizione || "",
          importo: typeof t.importo === "number" ? t.importo : 0,
          saldo: typeof t.saldo === "number" ? t.saldo : null,
        }));
      }
    }

    // Insert rows into estratti_conto
    let inserted = 0;
    for (const row of rows) {
      const hash = hashRow(row.data_operazione, row.importo, row.descrizione);
      const { error: insErr } = await supabaseAdmin.from("estratti_conto").insert({
        ufficio_id: doc.ufficio_id,
        documento_id,
        data_operazione: row.data_operazione,
        descrizione: row.descrizione,
        importo: row.importo,
        saldo: row.saldo,
        stato: "da_verificare",
        hash_riga: hash,
      });
      if (!insErr) inserted++;
      // Skip duplicates silently (unique constraint on hash_riga)
    }

    // Update document
    await supabaseAdmin.from("banca_documenti").update({
      stato: "elaborato",
      righe_estratte: inserted,
    }).eq("id", documento_id);

    // Log completion
    if (user_id) {
      await supabaseAdmin.from("log_attivita").insert({
        user_id,
        azione: "parsing_completato",
        entita_tipo: "banca_documento",
        entita_id: documento_id,
        dettagli_json: { righe_estratte: inserted, totale_righe: rows.length },
      });
    }

    return new Response(
      JSON.stringify({ success: true, righe_estratte: inserted, totale_righe: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("parse-bank-document error:", err);

    // Try to update document status to error
    try {
      const { documento_id, user_id } = await (req.clone()).json();
      if (documento_id) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin.from("banca_documenti").update({
          stato: "errore",
          error_message: err.message,
        }).eq("id", documento_id);

        if (user_id) {
          await supabaseAdmin.from("log_attivita").insert({
            user_id,
            azione: "parsing_errore",
            entita_tipo: "banca_documento",
            entita_id: documento_id,
            dettagli_json: { error: err.message },
          });
        }
      }
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
