// Edge function: AI matching per movimenti_bancari → clienti
// Combina logica di match-bank-rows (fuzzy + AI assist) per assegnare cliente_id
// e ufficio_id ai movimenti con stato='importato'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletions, hasAiCredentials } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyScore(ordinante: string, cliente: any): number {
  const a = normalize(ordinante);
  if (!a) return 0;
  const candidates = [
    cliente.ragione_sociale,
    [cliente.nome, cliente.cognome].filter(Boolean).join(" "),
    [cliente.cognome, cliente.nome].filter(Boolean).join(" "),
  ].filter(Boolean).map((s: string) => normalize(s));

  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    if (a === c) { best = Math.max(best, 100); continue; }
    if (a.includes(c) || c.includes(a)) { best = Math.max(best, 90); continue; }
    const wa = a.split(" ").filter((w) => w.length > 2);
    const wc = c.split(" ").filter((w) => w.length > 2);
    if (wa.length === 0 || wc.length === 0) continue;
    const matched = wa.filter((w) => wc.some((w2) => w2.includes(w) || w.includes(w2))).length;
    best = Math.max(best, (matched / Math.max(wa.length, wc.length)) * 100);
  }
  return Math.round(best);
}

function extractOrdinante(descrizione: string): string {
  if (!descrizione) return "";
  const m = descrizione.match(/ORDINANTE[:\s]+([^/\n]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/i);
  if (m) return m[1].trim();
  const m2 = descrizione.match(/DA\s+([A-Z][A-Z\s&.]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/);
  if (m2) return m2[1].trim();
  return descrizione.split(/\s{2,}|;|\|/)[0].slice(0, 80).trim();
}

async function aiPickBest(
  movimento: { ordinante: string; descrizione: string; importo: number; data_movimento: string },
  candidates: Array<{ id: string; label: string; ufficio_id: string | null }>,
): Promise<{ cliente_id: string; ufficio_id: string | null; score: number; motivazione: string } | null> {
  if (!hasAiCredentials() || candidates.length === 0) return null;

  try {
    const res = await aiChatCompletions({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Sei un assistente di riconciliazione bancaria italiana. Confronta l'ordinante e la descrizione di un bonifico con una lista limitata di nominativi clienti. Scegli il miglior match valutando nome/ragione sociale. Restituisci kind='none' se nessuno è plausibile.",
          },
          {
            role: "user",
            content: JSON.stringify({
              movimento: {
                ordinante: movimento.ordinante,
                descrizione: (movimento.descrizione || "").slice(0, 200),
                importo: movimento.importo,
                data: movimento.data_movimento,
              },
              candidati: candidates.slice(0, 20).map((c) => ({ id: c.id, nome: c.label })),
            }),
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "best_match",
            description: "Cliente più probabile o nessuno",
            parameters: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["cliente", "none"] },
                id: { type: "string" },
                score: { type: "number" },
                motivazione: { type: "string" },
              },
              required: ["kind"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "best_match" } },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    const parsed = JSON.parse(args);
    if (parsed.kind !== "cliente" || !parsed.id) return null;
    const cand = candidates.find((c) => c.id === parsed.id);
    if (!cand) return null;
    return {
      cliente_id: cand.id,
      ufficio_id: cand.ufficio_id,
      score: Number(parsed.score) || 75,
      motivazione: String(parsed.motivazione || ""),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const onlyIds: string[] | undefined = body.movimento_ids;
    const useAi: boolean = body.use_ai !== false;
    const fuzzyThreshold: number = Number(body.fuzzy_threshold ?? 70);

    // Carica movimenti da matchare
    let mvq = supabase
      .from("movimenti_bancari")
      .select("id, data_movimento, importo, ordinante, descrizione")
      .eq("stato", "importato")
      .limit(500);
    if (onlyIds && onlyIds.length) mvq = mvq.in("id", onlyIds);

    const { data: movimenti, error: eMov } = await mvq;
    if (eMov) throw eMov;
    if (!movimenti || movimenti.length === 0) {
      return new Response(JSON.stringify({ processed: 0, matched: 0, ai_used: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carica universo clienti (limit 5000)
    const { data: clienti, error: eCli } = await supabase
      .from("clienti")
      .select("id, ragione_sociale, nome, cognome, ufficio_id")
      .limit(5000);
    if (eCli) throw eCli;

    let matched = 0;
    let aiUsed = 0;
    const details: Array<{ movimento_id: string; cliente_id: string | null; score: number; via: string }> = [];

    for (const m of movimenti) {
      const ordinante: string = m.ordinante || extractOrdinante(m.descrizione || "");
      if (!ordinante) {
        details.push({ movimento_id: m.id, cliente_id: null, score: 0, via: "no-ordinante" });
        continue;
      }

      // 1) Fuzzy scoring locale
      let best: { id: string; score: number; ufficio_id: string | null } = { id: "", score: 0, ufficio_id: null };
      const scored: Array<{ id: string; score: number; ufficio_id: string | null; label: string }> = [];
      for (const c of clienti || []) {
        const s = fuzzyScore(ordinante, c);
        if (s > 0) {
          const label = (c as any).ragione_sociale || [(c as any).nome, (c as any).cognome].filter(Boolean).join(" ");
          scored.push({ id: (c as any).id, score: s, ufficio_id: (c as any).ufficio_id ?? null, label });
        }
        if (s > best.score) best = { id: (c as any).id, score: s, ufficio_id: (c as any).ufficio_id ?? null };
      }

      let chosen: { cliente_id: string; ufficio_id: string | null; score: number; via: string } | null = null;
      if (best.score >= fuzzyThreshold && best.id) {
        chosen = { cliente_id: best.id, ufficio_id: best.ufficio_id, score: best.score, via: "fuzzy" };
      } else if (useAi) {
        // 2) AI assist sui top 20 candidati
        const top = scored.sort((a, b) => b.score - a.score).slice(0, 20);
        if (top.length > 0) {
          const ai = await aiPickBest(m as any, top);
          if (ai) {
            chosen = { cliente_id: ai.cliente_id, ufficio_id: ai.ufficio_id, score: ai.score, via: "ai" };
            aiUsed++;
          }
        }
      }

      if (chosen) {
        const { error: uErr } = await supabase
          .from("movimenti_bancari")
          .update({
            cliente_id: chosen.cliente_id,
            ufficio_id: chosen.ufficio_id,
            stato: "matchato",
          })
          .eq("id", m.id);
        if (!uErr) {
          matched++;
          details.push({ movimento_id: m.id, cliente_id: chosen.cliente_id, score: chosen.score, via: chosen.via });
        }
      } else {
        details.push({ movimento_id: m.id, cliente_id: null, score: best.score, via: "no-match" });
      }
    }

    return new Response(
      JSON.stringify({ processed: movimenti.length, matched, ai_used: aiUsed, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
