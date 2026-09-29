import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { records, tipo } = await req.json();
    if (!tipo || !records) throw new Error("Missing 'tipo' or 'records' in request body");

    // Step 1: Nullify FK refs
    const { data: existingIds } = await supabase
      .from("anagrafiche_professionali")
      .select("id")
      .eq("tipo", tipo);
    
    if (existingIds && existingIds.length > 0) {
      for (const r of existingIds) {
        await supabase.from("codici_commerciali_cliente").update({ profilo_id: null }).eq("profilo_id", r.id);
      }
    }

    // Step 2: Delete existing records of this tipo
    const { error: delErr } = await supabase
      .from("anagrafiche_professionali")
      .delete()
      .eq("tipo", tipo);
    if (delErr) throw new Error(`Delete error: ${delErr.message}`);

    // Step 3: Insert in batches
    let inserted = 0;
    let errors = 0;
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase.from("anagrafiche_professionali").insert(batch);
      if (error) {
        errors += batch.length;
        console.error(`Batch ${i} error:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, tipo, inserted, errors, deleted: existingIds?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
