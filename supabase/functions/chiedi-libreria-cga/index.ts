// Edge function: chiedi-libreria-cga
// Risposte su garanzie/condizioni dalla Libreria CGA condivisa (prodotti_cga).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAi, callKimiText } from "../_shared/aiProvider.ts";
import { bumpKnowHowHit, findKnowHowHit, knowHowFonti } from "../_shared/cbBotKnowHowDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PRODOTTI = 6;
const MAX_GARANZIE_PER_PRODOTTO = 25;
const MAX_CONDIZIONI_PER_PRODOTTO = 15;

type StoricoMsg = { role: string; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const domanda = String(body?.domanda ?? "").trim();
    const storico: StoricoMsg[] = Array.isArray(body?.storico) ? body.storico.slice(-8) : [];
    const compagnia = body?.compagnia ? String(body.compagnia).trim() : null;
    const ramo = body?.ramo ? String(body.ramo).trim() : null;
    const prodotto_cga_id = body?.prodotto_cga_id ?? null;

    if (!domanda) {
      return new Response(JSON.stringify({ error: "domanda richiesta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const knowHow = await findKnowHowHit("cga", domanda);
    if (knowHow) {
      await bumpKnowHowHit(knowHow.id);
      return new Response(
        JSON.stringify({
          ok: true,
          risposta: knowHow.risposta,
          fonti: knowHowFonti(knowHow),
          via: "know-how",
          know_how_id: knowHow.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let prodottiQuery = supabase
      .from("prodotti_cga")
      .select("id, nome_prodotto, compagnia, ramo, edizione, sommario_ai, created_at")
      .order("created_at", { ascending: false });

    if (prodotto_cga_id) {
      prodottiQuery = prodottiQuery.eq("id", prodotto_cga_id);
    } else {
      if (compagnia) prodottiQuery = prodottiQuery.ilike("compagnia", compagnia);
      if (ramo) prodottiQuery = prodottiQuery.ilike("ramo", `%${ramo}%`);
      prodottiQuery = prodottiQuery.limit(MAX_PRODOTTI * 3);
    }

    const { data: prodottiRaw, error: errP } = await prodottiQuery;
    if (errP) throw errP;

    let prodotti = prodottiRaw ?? [];

    // Dedup: ultima edizione per compagnia+nome+ramo
    if (!prodotto_cga_id && prodotti.length > 0) {
      const seen = new Map<string, typeof prodotti[0]>();
      for (const p of prodotti) {
        const key = `${(p.compagnia ?? "").toLowerCase()}|${(p.nome_prodotto ?? "").toLowerCase()}|${(p.ramo ?? "").toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, p);
      }
      prodotti = Array.from(seen.values()).slice(0, MAX_PRODOTTI);
    }

    // Se nessun filtro e pochi risultati, cerca per keyword nella domanda
    if (!prodotto_cga_id && !compagnia && !ramo && prodotti.length === 0) {
      const words = domanda.split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
      if (words.length > 0) {
        const orParts = words.flatMap((w) => [
          `nome_prodotto.ilike.%${w}%`,
          `compagnia.ilike.%${w}%`,
          `ramo.ilike.%${w}%`,
        ]);
        const { data: byKw } = await supabase
          .from("prodotti_cga")
          .select("id, nome_prodotto, compagnia, ramo, edizione, sommario_ai, created_at")
          .or(orParts.join(","))
          .order("created_at", { ascending: false })
          .limit(MAX_PRODOTTI * 2);
        const seen = new Map<string, NonNullable<typeof byKw>[0]>();
        for (const p of byKw ?? []) {
          const key = `${(p.compagnia ?? "").toLowerCase()}|${(p.nome_prodotto ?? "").toLowerCase()}`;
          if (!seen.has(key)) seen.set(key, p);
        }
        prodotti = Array.from(seen.values()).slice(0, MAX_PRODOTTI);
      }
    }

    if (prodotti.length === 0) {
      const { data: catalogo } = await supabase
        .from("prodotti_cga")
        .select("compagnia, ramo, nome_prodotto")
        .limit(50);
      return new Response(
        JSON.stringify({
          ok: true,
          risposta:
            "Non ho trovato prodotti CGA corrispondenti ai filtri. Prova a selezionare una **Compagnia** o un **Ramo**, oppure indica il nome prodotto nella domanda.\n\n" +
            "Catalogo parziale disponibile: " +
            [...new Set((catalogo ?? []).map((c) => c.compagnia).filter(Boolean))].slice(0, 10).join(", "),
          fonti: [],
          prodotti_trovati: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contestoProdotti = [];
    const fonti: { prodotto_id: string; nome_prodotto: string; compagnia: string | null; ramo: string | null }[] = [];

    for (const p of prodotti) {
      const [{ data: garanzie }, { data: condizioni }] = await Promise.all([
        supabase
          .from("prodotti_garanzie")
          .select("garanzia, massimale_standard, franchigia_standard, scoperto_percentuale, note")
          .eq("prodotto_id", p.id)
          .limit(MAX_GARANZIE_PER_PRODOTTO),
        supabase
          .from("prodotti_condizioni")
          .select("tipo, titolo, testo, rilevante_sinistri")
          .eq("prodotto_id", p.id)
          .limit(MAX_CONDIZIONI_PER_PRODOTTO),
      ]);

      contestoProdotti.push({
        id: p.id,
        nome_prodotto: p.nome_prodotto,
        compagnia: p.compagnia,
        ramo: p.ramo,
        edizione: p.edizione,
        sommario: p.sommario_ai,
        garanzie: garanzie ?? [],
        condizioni: condizioni ?? [],
      });

      fonti.push({
        prodotto_id: p.id,
        nome_prodotto: p.nome_prodotto ?? "",
        compagnia: p.compagnia,
        ramo: p.ramo,
      });
    }

    const systemPrompt =
      "Sei **Consul Assicurativo**, assistente tecnico di un broker italiano. Rispondi SOLO usando il contesto JSON (Libreria CGA — garanzie, massimali, franchigie, condizioni, esclusioni già estratte). " +
      "Non inventare clausole. Se l'informazione non c'è, dillo chiaramente. " +
      "Cita sempre la fonte: **Compagnia · Prodotto · Ramo** (edizione se presente). " +
      "Usa linguaggio professionale ma chiaro. Per confronti tra prodotti, struttura la risposta in elenco puntato. " +
      "Argomenti: garanzie, massimali, franchigie, scoperti, esclusioni, definizioni assicurative, coperture, sinistri.";

    const userContent =
      "CONTESTO LIBRERIA CGA (JSON):\n" +
      JSON.stringify({ prodotti: contestoProdotti, filtri: { compagnia, ramo, prodotto_cga_id } }, null, 2) +
      "\n\nDOMANDA: " +
      domanda;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...storico.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    requireAi();

    let risposta: string;
    try {
      risposta = await callKimiText(messages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore di ricerca";
      console.error("CB Bot search error", msg);
      if (msg.includes("429")) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        risposta,
        fonti,
        prodotti_trovati: prodotti.length,
        via: "kimi",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chiedi-libreria-cga error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
