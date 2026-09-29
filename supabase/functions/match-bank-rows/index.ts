import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletions, hasAiCredentials } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function daysDiff(d1: string, d2: string): number {
  return Math.abs((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000);
}

function fuzzyMatch(a: string, b: string): number {
  const wa = a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  const wb = b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (wa.length === 0 || wb.length === 0) return 0;
  const matched = wa.filter(w => wb.some(w2 => w2.includes(w) || w.includes(w2))).length;
  return (matched / Math.max(wa.length, wb.length)) * 100;
}

/**
 * AI assist per match banca borderline.
 * Chiama Lovable AI Gateway con structured output: restituisce best candidate
 * (movimento_id | titolo_id), score 0..100 e motivazione. Limitato al perimetro
 * (stesso ufficio, candidati pre-filtrati) — niente full-scan globale.
 */
async function aiAssistMatch(
  estratto: any,
  candidatesMov: any[],
  candidatesTitoli: any[],
): Promise<{ kind: "movimento" | "titolo"; id: string; score: number; motivazione: string } | null> {
  if (!hasAiCredentials()) return null;
  if (candidatesMov.length === 0 && candidatesTitoli.length === 0) return null;

  const compact = (m: any) => ({
    id: m.id,
    importo: m.importo ?? m.importo_incassato ?? m.premio_lordo,
    data: m.data_movimento ?? m.data_incasso,
    descrizione: (m.descrizione ?? m.numero_titolo ?? "").toString().slice(0, 120),
  });

  const payload = {
    estratto: {
      importo: estratto.importo,
      data: estratto.data_operazione,
      descrizione: (estratto.descrizione ?? "").toString().slice(0, 200),
    },
    movimenti: candidatesMov.slice(0, 15).map(compact),
    titoli: candidatesTitoli.slice(0, 15).map(compact),
  };

  try {
    const res = await aiChatCompletions({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Sei un assistente di riconciliazione bancaria italiana. Confronta una riga di estratto conto con una lista limitata di candidati (movimenti contabili e titoli incassati) tutti appartenenti allo stesso ufficio. Scegli il miglior match valutando importo (peso forte), data (entro pochi giorni), e descrizione/numero titolo. Restituisci null se nessun candidato è plausibile.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "best_match",
              description: "Best matching candidate or none",
              parameters: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["movimento", "titolo", "none"] },
                  id: { type: "string", description: "UUID del candidato scelto, vuoto se kind=none" },
                  score: { type: "number", description: "Confidenza 0..100" },
                  motivazione: { type: "string" },
                },
                required: ["kind", "score", "motivazione"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "best_match" } },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return null;
    const args = JSON.parse(tc.function.arguments);
    if (args.kind === "none" || !args.id) return null;
    return { kind: args.kind, id: args.id, score: Number(args.score) || 0, motivazione: args.motivazione || "" };
  } catch (e) {
    console.error("aiAssistMatch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documento_id, ufficio_id, user_id } = await req.json();
    if (!documento_id && !ufficio_id) throw new Error("documento_id o ufficio_id richiesto");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log start
    if (user_id) {
      await supabaseAdmin.from("log_attivita").insert({
        user_id,
        azione: "avvio_matching",
        entita_tipo: "banca_documento",
        entita_id: documento_id || ufficio_id,
        dettagli_json: { documento_id, ufficio_id },
      });
    }

    // Fetch estratti da verificare
    let query = supabaseAdmin.from("estratti_conto").select("*").eq("stato", "da_verificare");
    if (documento_id) query = query.eq("documento_id", documento_id);
    if (ufficio_id) query = query.eq("ufficio_id", ufficio_id);

    const { data: estratti, error: eErr } = await query;
    if (eErr) throw eErr;
    if (!estratti || estratti.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matched: 0, message: "Nessuna riga da verificare" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the ufficio_id from first estratto if not provided
    const targetUfficioId = ufficio_id || estratti[0].ufficio_id;

    // Fetch movimenti contabili for matching
    const { data: movimenti } = await supabaseAdmin
      .from("movimenti_contabili")
      .select("*")
      .eq("ufficio_id", targetUfficioId);

    // Fetch titoli incassati for matching
    const { data: titoli } = await supabaseAdmin
      .from("titoli")
      .select("*")
      .eq("ufficio_id", targetUfficioId)
      .eq("stato", "incassato");

    // Get already matched movimento IDs
    const { data: existingIncroci } = await supabaseAdmin
      .from("incroci_bancari")
      .select("movimento_id")
      .not("movimento_id", "is", null);
    const usedMovIds = new Set((existingIncroci || []).map((i: any) => i.movimento_id));

    const availableMovimenti = (movimenti || []).filter((m: any) => !usedMovIds.has(m.id));

    let totalOk = 0;
    let totalKo = 0;
    let totalParziale = 0;

    for (const estratto of estratti) {
      let bestScore = 0;
      let bestMatch: any = null;
      let bestMetodo = "";
      let bestDiff = 0;

      const absImporto = Math.abs(estratto.importo);

      // Step 1: Match against movimenti_contabili
      for (const mov of availableMovimenti) {
        let score = 0;

        // Importo match (strongest signal)
        if (Math.abs(mov.importo - absImporto) < 0.01) {
          score += 50;
        } else if (Math.abs(mov.importo - absImporto) / Math.max(absImporto, 0.01) < 0.05) {
          score += 30; // Within 5%
        } else {
          continue; // Skip if importo is too different
        }

        // Date match
        const dd = daysDiff(estratto.data_operazione, mov.data_movimento);
        if (dd === 0) score += 30;
        else if (dd <= 2) score += 20;
        else if (dd <= 5) score += 10;
        else score += 0;

        // Description match
        if (estratto.descrizione && mov.descrizione) {
          const descScore = fuzzyMatch(estratto.descrizione, mov.descrizione);
          score += Math.min(descScore * 0.2, 20);
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = mov;
          bestMetodo = dd <= 2 ? "importo_data" : "importo_descrizione";
          bestDiff = Math.abs(mov.importo - absImporto);
        }
      }

      // Step 2: Match against titoli
      for (const titolo of (titoli || [])) {
        let score = 0;
        const titoloImporto = titolo.importo_incassato || titolo.premio_lordo || 0;

        if (Math.abs(titoloImporto - absImporto) < 0.01) {
          score += 50;
        } else if (titoloImporto > 0 && Math.abs(titoloImporto - absImporto) / titoloImporto < 0.05) {
          score += 30;
        } else {
          continue;
        }

        // Date match
        if (titolo.data_incasso) {
          const dd = daysDiff(estratto.data_operazione, titolo.data_incasso);
          if (dd === 0) score += 30;
          else if (dd <= 2) score += 20;
          else if (dd <= 5) score += 10;
        }

        // Description: check for numero titolo
        if (estratto.descrizione && titolo.numero_titolo) {
          if (estratto.descrizione.toLowerCase().includes(titolo.numero_titolo.toLowerCase())) {
            score += 20;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = titolo;
          bestMetodo = "titolo_incassato";
          bestDiff = Math.abs(titoloImporto - absImporto);
        }
      }

      // AI assist solo per casi borderline (>=60 e <85) e quando non già "ok perfetto".
      // Output: pre-compilato, NON auto-confermato (stato resta da_verificare).
      let aiNote: string | null = null;
      let aiSuggerimento: { kind: "movimento" | "titolo"; id: string; score: number; motivazione: string } | null = null;
      if (bestScore >= 60 && bestScore < 85) {
        // Restringiamo i candidati a quelli con importo plausibile (entro 5%)
        const candMov = availableMovimenti.filter(
          (m: any) => Math.abs((m.importo ?? 0) - absImporto) / Math.max(absImporto, 0.01) < 0.05,
        );
        const candTit = (titoli || []).filter((t: any) => {
          const ti = t.importo_incassato || t.premio_lordo || 0;
          return ti > 0 && Math.abs(ti - absImporto) / Math.max(absImporto, 0.01) < 0.05;
        });
        aiSuggerimento = await aiAssistMatch(estratto, candMov, candTit);
        if (aiSuggerimento) {
          aiNote = `AI assist: ${aiSuggerimento.motivazione} (conf ${aiSuggerimento.score})`;
        }
      }

      // Determine outcome
      let esito: string;
      let nuovoStato: string;

      if (bestScore >= 85) {
        esito = "ok";
        nuovoStato = "ok";
        totalOk++;
      } else if (bestScore >= 60) {
        esito = "ko";
        nuovoStato = "da_verificare";
        totalParziale++;
      } else {
        esito = "ko";
        nuovoStato = "ko";
        totalKo++;
      }

      // Update estratto stato
      await supabaseAdmin.from("estratti_conto").update({ stato: nuovoStato }).eq("id", estratto.id);

      // Create incrocio (precompilato; la conferma definitiva avviene in UI)
      const movimentoIdFinal = bestMatch && bestMetodo !== "titolo_incassato" ? bestMatch.id : null;
      const noteParts: string[] = [];
      if (bestScore >= 60 && bestScore < 85) noteParts.push(`Match parziale (score ${bestScore})`);
      if (aiNote) noteParts.push(aiNote);

      await supabaseAdmin.from("incroci_bancari").insert({
        estratto_id: estratto.id,
        movimento_id: movimentoIdFinal,
        esito,
        differenza: bestDiff,
        matching_score: bestScore,
        matching_metodo: aiSuggerimento ? `${bestMetodo || "ai"}+ai_assist` : (bestMetodo || null),
        note: noteParts.length ? noteParts.join(" • ") : null,
      });

      // If matched a movimento, mark as used
      if (bestMatch && bestMetodo !== "titolo_incassato" && bestScore >= 85) {
        await supabaseAdmin.from("movimenti_contabili").update({ stato: "verificato" }).eq("id", bestMatch.id);
        // Remove from available
        const idx = availableMovimenti.findIndex((m: any) => m.id === bestMatch.id);
        if (idx >= 0) availableMovimenti.splice(idx, 1);
      }
    }

    // Log completion
    if (user_id) {
      await supabaseAdmin.from("log_attivita").insert({
        user_id,
        azione: "matching_completato",
        entita_tipo: "banca_documento",
        entita_id: documento_id || ufficio_id,
        dettagli_json: { ok: totalOk, ko: totalKo, parziale: totalParziale, totale: estratti.length },
      });
    }

    return new Response(
      JSON.stringify({ success: true, ok: totalOk, ko: totalKo, parziale: totalParziale, totale: estratti.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("match-bank-rows error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
