import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAi, aiChatCompletions } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist delle RPC che l'AI può chiamare
const ALLOWED_RPCS: Record<string, string[]> = {
  cfo_kpi: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id", "_produttore_nome"],
  cfo_entrate_uscite_mensili: ["_data_da", "_data_a", "_ufficio_id"],
  cfo_premi_per_compagnia: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id", "_produttore_nome"],
  cfo_premi_per_ramo: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id", "_produttore_nome"],
  cfo_premi_per_produttore: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id"],
  cfo_redditivita_ufficio: ["_data_da", "_data_a"],
  cfo_provvigioni_mensili: ["_data_da", "_data_a", "_ufficio_id"],
  cfo_trend_mensile: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id", "_produttore_nome"],
  cfo_yoy_mensile: ["_ufficio_id", "_compagnia_id"],
  cfo_top_clienti: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id", "_limit"],
  cfo_distribuzione_clienti_fascia: ["_data_da", "_data_a"],
  cfo_premio_medio_ramo: ["_data_da", "_data_a", "_ufficio_id", "_compagnia_id"],
  cfo_premio_medio_compagnia: ["_data_da", "_data_a", "_ufficio_id"],
  cfo_distribuzione_stati: ["_ufficio_id"],
  cfo_matrice_sede_compagnia: ["_data_da", "_data_a"],
  cfo_matrice_produttore_ramo: ["_data_da", "_data_a"],
  cfo_loss_ratio_ramo: ["_data_da", "_data_a"],
  cfo_eta_sinistri_aperti: [],
  cfo_sinistri_per_compagnia: ["_data_da", "_data_a"],
};

const SYSTEM_PROMPT = `Sei l'Analista CFO di Consulnet, una società di brokeraggio assicurativo italiana.
Hai accesso a dati reali tramite tool calling. Rispondi in italiano, in modo conciso e professionale.

Strumento disponibile: \`query_cfo\` per chiamare RPC predefinite con filtri.

RPC disponibili (ognuna restituisce JSON):
- cfo_kpi: KPI totali (premi, provvigioni, entrate, uscite, sinistri)
- cfo_trend_mensile: serie mensile premi/provvigioni/margine
- cfo_yoy_mensile: confronto anno corrente vs precedente per mese
- cfo_top_clienti: top N clienti per premi/margine
- cfo_distribuzione_clienti_fascia: numero clienti per fascia di premio
- cfo_premio_medio_ramo / cfo_premio_medio_compagnia
- cfo_premi_per_ramo / cfo_premi_per_compagnia / cfo_premi_per_produttore
- cfo_distribuzione_stati: polizze per stato (attivo/sospeso/scaduto/incassato)
- cfo_matrice_sede_compagnia / cfo_matrice_produttore_ramo
- cfo_loss_ratio_ramo: rapporto sinistri/premi per ramo
- cfo_eta_sinistri_aperti / cfo_sinistri_per_compagnia
- cfo_redditivita_ufficio: entrate/uscite/margine per sede
- cfo_provvigioni_mensili / cfo_entrate_uscite_mensili

Filtri opzionali (sempre con _ prefix): _data_da, _data_a (formato YYYY-MM-DD), _ufficio_id (uuid), _compagnia_id (uuid), _produttore_nome (text), _limit (int).

Linee guida:
1. Quando l'utente chiede dati, chiama UNA O PIÙ RPC pertinenti.
2. Sintetizza i risultati in una risposta in linguaggio naturale, includendo cifre formattate in EUR (es. € 12.345,67).
3. Se utile, presenta i dati come tabella markdown.
4. Non inventare dati: se la RPC restituisce vuoto, dillo esplicitamente.
5. Mai eseguire SQL libero. Usa solo le RPC della lista.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: cErr } = await supabase.auth.getUser(token);
    if (cErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, filters } = await req.json();
    requireAi();

    const filterCtx = filters
      ? `\n\nFiltri attivi nella UI (usali se appropriati): ${JSON.stringify(filters)}`
      : "";

    const conversation = [
      { role: "system", content: SYSTEM_PROMPT + filterCtx },
      ...messages,
    ];

    const tools = [{
      type: "function",
      function: {
        name: "query_cfo",
        description: "Esegue una RPC CFO whitelisted con parametri opzionali. Restituisce JSON.",
        parameters: {
          type: "object",
          properties: {
            rpc: { type: "string", enum: Object.keys(ALLOWED_RPCS), description: "Nome della RPC" },
            params: { type: "object", description: "Parametri RPC (es. {_data_da:'2026-01-01'})", additionalProperties: true },
          },
          required: ["rpc"],
          additionalProperties: false,
        },
      },
    }];

    // Loop tool-calling (max 5 iterazioni)
    for (let iter = 0; iter < 5; iter++) {
      const aiResp = await aiChatCompletions({
          model: "google/gemini-2.5-flash",
          messages: conversation,
          tools,
          tool_choice: "auto",
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite di richieste superato, riprova tra poco." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Crediti AI esauriti. Aggiungere fondi al workspace Lovable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        return new Response(JSON.stringify({ error: "Errore AI gateway" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await aiResp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      conversation.push(msg);

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Risposta finale
        return new Response(JSON.stringify({ reply: msg.content || "" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Esegui ogni tool call
      for (const tc of toolCalls) {
        let toolResult: any;
        try {
          const args = JSON.parse(tc.function.arguments || "{}");
          const rpcName = args.rpc as string;
          const params = (args.params || {}) as Record<string, any>;

          if (!(rpcName in ALLOWED_RPCS)) {
            toolResult = { error: `RPC non autorizzata: ${rpcName}` };
          } else {
            // Sanitize params
            const allowed = ALLOWED_RPCS[rpcName];
            const cleanParams: Record<string, any> = {};
            for (const k of allowed) if (k in params && params[k] != null && params[k] !== "") cleanParams[k] = params[k];

            const { data: rpcData, error: rpcErr } = await supabase.rpc(rpcName, cleanParams);
            if (rpcErr) toolResult = { error: rpcErr.message };
            else toolResult = rpcData;
          }
        } catch (e: any) {
          toolResult = { error: String(e?.message || e) };
        }

        conversation.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult).slice(0, 30000),
        });
      }
    }

    return new Response(JSON.stringify({ reply: "Limite iterazioni raggiunto." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("cfo-ai-analyst error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Errore" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
