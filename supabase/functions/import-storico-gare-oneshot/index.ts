// Edge function una-tantum: riceve array di record già parsati e li inserisce in storico_gare
// Usa SERVICE_ROLE per bypassare RLS. NESSUNA AUTH (verify_jwt=false in config.toml).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { records, truncate } = await req.json();
    if (!Array.isArray(records)) {
      return new Response(JSON.stringify({ error: 'records must be an array' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (truncate) {
      const { error: trErr } = await supabase.rpc('exec_sql_truncate_storico_gare' as any, {});
      // se l'RPC non esiste, eseguiamo direttamente: facciamo una delete
      if (trErr) {
        const { error: dErr } = await supabase.from('storico_gare').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (dErr) console.warn('truncate via delete failed:', dErr.message);
      }
    }

    // Insert in batch da 200
    const BATCH = 200;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < records.length; i += BATCH) {
      const chunk = records.slice(i, i + BATCH);
      const { error, count } = await supabase.from('storico_gare').insert(chunk, { count: 'exact' });
      if (error) {
        errors.push(`batch ${i}-${i+chunk.length}: ${error.message}`);
        console.error(`Batch ${i} error:`, error);
      } else {
        inserted += chunk.length;
      }
    }

    // Stats finali
    const { count: total } = await supabase.from('storico_gare').select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      ok: errors.length === 0,
      inserted,
      total_in_db: total,
      errors: errors.slice(0, 5),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
