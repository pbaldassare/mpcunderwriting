// Svuota la coda «messa a cassa serale» e invia con notifica-messa-cassa-agenzia.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CodaRow = { id: string; titolo_ids: string[] | null };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data, error } = await supabase.rpc("claim_messa_cassa_notifiche_coda");
    if (error) throw error;

    const claimed = (data || []) as CodaRow[];
    const titoloIds = [...new Set(claimed.flatMap((r) => r.titolo_ids || []).filter(Boolean))];
    const rowIds = claimed.map((r) => r.id);

    if (titoloIds.length === 0) {
      if (rowIds.length > 0) {
        await supabase
          .from("messa_cassa_notifiche_coda")
          .update({
            status: "sent",
            processed_at: new Date().toISOString(),
            result_json: { skipped: true, reason: "coda_vuota" },
          })
          .in("id", rowIds);
      }
      return new Response(
        JSON.stringify({ ok: true, skipped: true, coda: claimed.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = titoloIds.length === 1 ? { titolo_id: titoloIds[0] } : { titolo_ids: titoloIds };
    const { data: sendData, error: sendErr } = await supabase.functions.invoke(
      "notifica-messa-cassa-agenzia",
      { body },
    );

    const failed = !!sendErr || (sendData && sendData.ok === false && !sendData.skipped);
    await supabase
      .from("messa_cassa_notifiche_coda")
      .update({
        status: failed ? "error" : "sent",
        processed_at: new Date().toISOString(),
        error_message: sendErr?.message ?? sendData?.error ?? null,
        result_json: sendData ?? { error: sendErr?.message ?? "invoke failed" },
      })
      .in("id", rowIds);

    return new Response(
      JSON.stringify({
        ok: !failed,
        coda: claimed.length,
        titoli: titoloIds.length,
        data: sendData,
        error: sendErr?.message ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error)?.message ?? String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
