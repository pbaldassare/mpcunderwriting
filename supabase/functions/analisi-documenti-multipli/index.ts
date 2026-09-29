import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAi, aiChatCompletions, buildDocumentUserContent } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "estrai_preventivo_rca",
    description: "Estrai i dati strutturati da un documento di preventivo/polizza RCA auto",
    parameters: {
      type: "object",
      properties: {
        contraente: { type: "string", description: "Nome e cognome del contraente" },
        codice_fiscale: { type: "string", description: "Codice fiscale del contraente" },
        targa: { type: "string", description: "Targa del veicolo" },
        veicolo_marca_modello: { type: "string", description: "Marca e modello del veicolo" },
        data_effetto: { type: "string", description: "Data effetto polizza YYYY-MM-DD" },
        data_scadenza: { type: "string", description: "Data scadenza polizza YYYY-MM-DD" },
        premio_lordo_rca: { type: "number", description: "Premio lordo RCA" },
        premio_lordo_infortuni: { type: "number", description: "Premio lordo infortuni conducente" },
        premio_lordo_furto_incendio: { type: "number", description: "Premio lordo furto e incendio" },
        premio_lordo_kasko: { type: "number", description: "Premio lordo kasko" },
        premio_lordo_cristalli: { type: "number", description: "Premio lordo cristalli" },
        premio_lordo_assistenza: { type: "number", description: "Premio lordo assistenza stradale" },
        premio_lordo_tutela_legale: { type: "number", description: "Premio lordo tutela legale" },
        premio_lordo_altri: { type: "number", description: "Premio lordo altre garanzie non categorizzate" },
        premio_lordo_totale: { type: "number", description: "Premio lordo totale complessivo" },
        garanzie: {
          type: "array",
          description: "Elenco delle garanzie presenti nel documento",
          items: {
            type: "object",
            properties: {
              nome_garanzia: { type: "string" },
              massimale: { type: "string" },
              franchigia: { type: "string" },
              premio: { type: "number" },
              inclusa: { type: "boolean" },
            },
            required: ["nome_garanzia", "premio", "inclusa"],
          },
        },
      },
      required: ["contraente", "premio_lordo_totale", "garanzie"],
    },
  },
};

async function analyzeFile(
  file: { base64: string; mime_type: string; nome_file: string },
): Promise<{ nome_file: string; risultato?: Record<string, unknown>; errore?: string }> {
  const systemPrompt = `Sei un esperto analizzatore di documenti assicurativi RCA auto italiani. Analizza il documento fornito ed estrai tutti i dati strutturati: dati del contraente, premi lordi per ogni garanzia, totale, e l'elenco completo delle garanzie con massimali e franchigie. Se un campo non è presente nel documento, omettilo. I premi devono essere numeri (senza simboli valuta).`;

  const userContent = await buildDocumentUserContent({
    mimeType: file.mime_type,
    fileBase64: file.base64,
    instruction: "Analizza questo documento assicurativo RCA e estrai tutti i dati.",
    filename: file.nome_file || "documento.pdf",
  });
  const response = await aiChatCompletions({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "estrai_preventivo_rca" } },
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    if (status === 429) return { nome_file: file.nome_file, errore: "Rate limit superato. Riprova tra poco." };
    if (status === 402) return { nome_file: file.nome_file, errore: "Crediti AI esauriti. Aggiungi fondi nel workspace." };
    console.error("AI error", status, text);
    return { nome_file: file.nome_file, errore: `Errore AI (${status})` };
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    return { nome_file: file.nome_file, errore: "Nessun dato estratto dal documento" };
  }

  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    return { nome_file: file.nome_file, risultato: parsed };
  } catch {
    return { nome_file: file.nome_file, errore: "Errore nel parsing della risposta AI" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { files } = await req.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "Nessun file fornito" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (files.length > 10) {
      return new Response(JSON.stringify({ error: "Massimo 10 file alla volta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    requireAi();

    const results = await Promise.all(files.map((f: any) => analyzeFile(f)));

    return new Response(JSON.stringify({ risultati: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analisi-documenti-multipli error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
