import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { estratto_id, user_id } = await req.json();
    if (!estratto_id) throw new Error("estratto_id richiesto");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch estratto
    const { data: estratto, error: eErr } = await supabaseAdmin
      .from("estratti_conto")
      .select("*")
      .eq("id", estratto_id)
      .single();
    if (eErr || !estratto) throw new Error("Estratto conto non trovato");

    // Find matching movimenti by exact importo and same ufficio
    const { data: movimenti } = await supabaseAdmin
      .from("movimenti_contabili")
      .select("*")
      .eq("ufficio_id", estratto.ufficio_id)
      .eq("importo", Math.abs(estratto.importo));

    // Filter out movimenti already matched
    const { data: existingIncroci } = await supabaseAdmin
      .from("incroci_bancari")
      .select("movimento_id")
      .not("movimento_id", "is", null);
    const usedIds = new Set((existingIncroci || []).map((i: any) => i.movimento_id));

    const available = (movimenti || []).filter((m: any) => !usedIds.has(m.id));

    let esito: string;
    let movimentoId: string | null = null;
    let differenza = 0;

    if (available.length > 0) {
      // Match found - take first
      const match = available[0];
      movimentoId = match.id;
      differenza = Math.abs(estratto.importo) - match.importo;
      esito = "ok";

      // Update estratto stato
      await supabaseAdmin.from("estratti_conto").update({ stato: "ok" }).eq("id", estratto_id);
      // Update movimento stato
      await supabaseAdmin.from("movimenti_contabili").update({ stato: "verificato" }).eq("id", match.id);
    } else {
      esito = "ko";
      await supabaseAdmin.from("estratti_conto").update({ stato: "ko" }).eq("id", estratto_id);
    }

    // Create incrocio
    const { data: incrocio, error: iErr } = await supabaseAdmin
      .from("incroci_bancari")
      .insert({
        movimento_id: movimentoId,
        estratto_id,
        esito,
        differenza,
      })
      .select()
      .single();
    if (iErr) throw iErr;

    // Log
    if (user_id) {
      await supabaseAdmin.from("log_attivita").insert({
        user_id,
        azione: "incrocio_bancario",
        entita_tipo: "incrocio_bancario",
        entita_id: incrocio.id,
        dettagli_json: { esito, estratto_id, movimento_id: movimentoId, differenza },
      });
    }

    return new Response(
      JSON.stringify({ incrocio, esito }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
