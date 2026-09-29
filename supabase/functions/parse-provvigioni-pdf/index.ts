import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAi, aiChatCompletions, buildDocumentUserContent } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

interface CategoriaEsistente {
  id: string;
  nome: string;
}

interface RigaEstratta {
  nome_categoria: string;
  percentuale: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pdf_base64, categorie_esistenti } = await req.json() as {
      pdf_base64: string;
      categorie_esistenti: CategoriaEsistente[];
    };

    if (!pdf_base64) throw new Error("pdf_base64 è obbligatorio");

    requireAi();

    const userContent = await buildDocumentUserContent({
      mimeType: "application/pdf",
      fileBase64: pdf_base64,
      instruction:
        "Estrai tutte le righe di provvigioni da questo documento PDF. Per ogni riga estrai il nome della categoria/ramo e la percentuale di provvigione.",
      filename: "provvigioni.pdf",
    });
    const aiResponse = await aiChatCompletions({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Sei un assistente specializzato nell'estrazione di tabelle provvigioni da documenti PDF di compagnie assicurative.
Devi estrarre ogni riga che contiene un ramo/categoria di prodotto assicurativo e la relativa percentuale di provvigione.
Restituisci i dati usando la funzione extract_provvigioni.`
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_provvigioni",
              description: "Estrae le righe di provvigioni dal documento",
              parameters: {
                type: "object",
                properties: {
                  righe: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome_categoria: { type: "string", description: "Nome del ramo/categoria assicurativa" },
                        percentuale: { type: "number", description: "Percentuale di provvigione (es. 12.5 per 12,5%)" }
                      },
                      required: ["nome_categoria", "percentuale"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["righe"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_provvigioni" } }
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra qualche secondo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Ricarica il workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA non ha restituito risultati strutturati");

    const parsed = JSON.parse(toolCall.function.arguments) as { righe: RigaEstratta[] };
    const righe = parsed.righe || [];

    // Match each extracted row against existing categories
    const risultati = righe.map((riga) => {
      const normName = normalize(riga.nome_categoria);

      // Exact match
      const exactMatch = categorie_esistenti.find(c => normalize(c.nome) === normName);
      if (exactMatch) {
        return {
          nome_originale: riga.nome_categoria,
          percentuale: riga.percentuale,
          match_esatto: { id: exactMatch.id, nome: exactMatch.nome },
          match_simili: [],
          suggerimento: "usa_esistente" as const
        };
      }

      // Fuzzy matches
      const simili = categorie_esistenti
        .map(c => ({ id: c.id, nome: c.nome, score: similarity(riga.nome_categoria, c.nome) }))
        .filter(m => m.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        nome_originale: riga.nome_categoria,
        percentuale: riga.percentuale,
        match_esatto: null,
        match_simili: simili,
        suggerimento: simili.length > 0 && simili[0].score >= 0.7 ? "usa_esistente" as const : "crea_nuova" as const
      };
    });

    return new Response(JSON.stringify({ risultati }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("parse-provvigioni-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
