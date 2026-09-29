import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const payloadSchema = z.object({
  titolo_id: z.string().uuid("titolo_id deve essere un UUID valido"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { titolo_id } = parsed.data;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch titolo with all needed fields
    const { data: titolo, error: tErr } = await supabaseAdmin
      .from("titoli")
      .select("id, stato, provvigioni_quietanza, percentuale_commerciale, commerciale_id, produttore_id, prodotto_id, ufficio_id, premio_lordo, importo_incassato, anagrafica_commerciale_id, produttore_nome, ae_anagrafica_id, ae_nome, percentuale_ae")
      .eq("id", titolo_id)
      .single();
    if (tErr || !titolo) throw new Error("Titolo non trovato");
    if (titolo.stato !== "incassato") {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "titolo_non_incassato",
          message: "Le provvigioni vengono calcolate solo dopo l'incasso del titolo.",
          provvigioni: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old provvigioni for this titolo
    await supabaseAdmin.from("provvigioni_generate").delete().eq("titolo_id", titolo_id);

    // Fase 2: risolvi quietanza_id (nuovo modello) per agganciare le righe
    const { data: qLink } = await supabaseAdmin
      .from("quietanze")
      .select("id")
      .eq("titolo_id", titolo_id)
      .maybeSingle();
    const quietanzaIdResolved: string | null = qLink?.id ?? null;


    // Lookup admin (Consulbrokers SPA) anagrafica id from settings
    let adminAnagraficaId: string | null = null;
    {
      const { data: setting } = await supabaseAdmin
        .from("impostazioni_sistema")
        .select("valore_json")
        .eq("chiave", "admin_anagrafica_id")
        .maybeSingle();
      adminAnagraficaId = (setting?.valore_json as any)?.anagrafica_id ?? null;
    }

    const provvQuietanza = titolo.provvigioni_quietanza;

    // === PRIMARY PATH: use provvigioni_quietanza from titolo + multi-split ===
    if (provvQuietanza != null && provvQuietanza > 0) {
      const totale = Math.round(provvQuietanza * 100) / 100;
      const rows: any[] = [];

      // Carica split multipli; fallback al singolo commerciale legacy
      const { data: splits } = await supabaseAdmin
        .from("titoli_split_commerciali")
        .select("anagrafica_commerciale_id, commerciale_user_id, percentuale")
        .eq("titolo_id", titolo_id)
        .order("ordine", { ascending: true });

      let effectiveSplits: Array<{ anagrafica_commerciale_id: string | null; commerciale_user_id: string | null; percentuale: number }> = [];
      if (splits && splits.length > 0) {
        effectiveSplits = splits.map((s: any) => ({
          anagrafica_commerciale_id: s.anagrafica_commerciale_id,
          commerciale_user_id: s.commerciale_user_id,
          percentuale: Number(s.percentuale) || 0,
        }));
      } else if (titolo.anagrafica_commerciale_id || titolo.commerciale_id) {
        const pc = Number(titolo.percentuale_commerciale ?? 100);
        if (pc > 0) {
          effectiveSplits = [{
            anagrafica_commerciale_id: titolo.anagrafica_commerciale_id ?? null,
            commerciale_user_id: titolo.commerciale_id ?? null,
            percentuale: Math.min(pc, 100),
          }];
        }
      }

      const sumPerc = effectiveSplits.reduce((acc, s) => acc + s.percentuale, 0);

      // Account Executive: secondo intermediario provvigionato (riga distinta, residuo a Consul)
      const aeId = (titolo as any).ae_anagrafica_id as string | null;
      const aePerc = Math.max(0, Math.min(100, Number((titolo as any).percentuale_ae) || 0));
      const hasAE = !!aeId && aePerc > 0;
      const percAdmin = Math.max(0, Math.round((100 - sumPerc - (hasAE ? aePerc : 0)) * 100) / 100);

      // Righe commerciali (Produttori)
      for (const s of effectiveSplits) {
        const importo = Math.round((totale * s.percentuale) / 100 * 100) / 100;
        const isAdmin = adminAnagraficaId != null && s.anagrafica_commerciale_id === adminAnagraficaId;
        rows.push({
          titolo_id,
          user_id: s.commerciale_user_id || null,
          anagrafica_commerciale_id: s.anagrafica_commerciale_id || null,
          percentuale: s.percentuale,
          importo_provvigione: importo,
          tipo_destinatario: "commerciale",
          solo_statistico: isAdmin,
        });
      }

      // Riga Account Executive (se presente)
      if (hasAE) {
        const importoAE = Math.round((totale * aePerc) / 100 * 100) / 100;
        const aeIsAdmin = adminAnagraficaId != null && aeId === adminAnagraficaId;
        rows.push({
          titolo_id,
          user_id: null,
          anagrafica_commerciale_id: aeId,
          percentuale: aePerc,
          importo_provvigione: importoAE,
          tipo_destinatario: "ae",
          solo_statistico: aeIsAdmin,
        });
      }

      // Riga admin = residuo + (somma quote dei commerciali == admin + eventuale AE == admin, statistiche sopra)
      let importoAdmin = Math.round((totale * percAdmin) / 100 * 100) / 100;
      const adminCommercialeRows = effectiveSplits.filter(
        (s) => adminAnagraficaId != null && s.anagrafica_commerciale_id === adminAnagraficaId
      );
      const adminCommercialeImporto = adminCommercialeRows.reduce(
        (acc, s) => acc + Math.round((totale * s.percentuale) / 100 * 100) / 100,
        0
      );
      const aeAdminImporto = (hasAE && adminAnagraficaId != null && aeId === adminAnagraficaId)
        ? Math.round((totale * aePerc) / 100 * 100) / 100 : 0;
      const aeAdminPerc = (hasAE && adminAnagraficaId != null && aeId === adminAnagraficaId) ? aePerc : 0;
      const importoAdminTotale = Math.round((importoAdmin + adminCommercialeImporto + aeAdminImporto) * 100) / 100;
      const percAdminTotale = Math.round((percAdmin + adminCommercialeRows.reduce((a, s) => a + s.percentuale, 0) + aeAdminPerc) * 100) / 100;

      if (importoAdminTotale > 0 || (effectiveSplits.length === 0 && !hasAE)) {
        rows.push({
          titolo_id,
          user_id: null,
          percentuale: (effectiveSplits.length === 0 && !hasAE) ? 100 : percAdminTotale,
          importo_provvigione: (effectiveSplits.length === 0 && !hasAE) ? totale : importoAdminTotale,
          tipo_destinatario: "admin",
          solo_statistico: false,
        });
      }

      const rowsWithQ = rows.map((r) => ({ ...r, quietanza_id: quietanzaIdResolved }));
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("provvigioni_generate")
        .insert(rowsWithQ)
        .select();
      if (iErr) throw iErr;


      return new Response(
        JSON.stringify({ message: `Provvigioni generate: ${inserted.length}`, provvigioni: inserted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === FALLBACK PATH: use matrice_provvigioni (legacy) ===
    let produttoreRuolo: string | null = null;
    if (titolo.produttore_id) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("ruolo")
        .eq("id", titolo.produttore_id)
        .single();
      produttoreRuolo = prof?.ruolo ?? null;
    }

    const { data: regole } = await supabaseAdmin
      .from("matrice_provvigioni")
      .select("*")
      .eq("prodotto_id", titolo.prodotto_id)
      .eq("attiva", true);

    if (!regole || regole.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nessuna regola provvigionale trovata", provvigioni: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let bestRule = null;
    if (titolo.produttore_id) {
      bestRule = regole.find((r) => r.user_id === titolo.produttore_id) ?? null;
    }
    if (!bestRule && titolo.ufficio_id) {
      bestRule = regole.find((r) => !r.user_id && r.ufficio_id === titolo.ufficio_id) ?? null;
    }
    if (!bestRule && produttoreRuolo) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && r.ruolo === produttoreRuolo) ?? null;
    }
    if (!bestRule) {
      bestRule = regole.find((r) => !r.user_id && !r.ufficio_id && !r.ruolo) ?? null;
    }

    if (!bestRule) {
      return new Response(
        JSON.stringify({ message: "Nessuna regola applicabile", provvigioni: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const base = titolo.importo_incassato ?? titolo.premio_lordo ?? 0;
    let importo = 0;
    if (bestRule.tipo_calcolo === "percentuale") {
      importo = (base * bestRule.percentuale_provvigione) / 100;
    } else {
      importo = bestRule.percentuale_provvigione;
    }

    const { data: prov, error: pErr } = await supabaseAdmin
      .from("provvigioni_generate")
      .insert({
        titolo_id,
        quietanza_id: quietanzaIdResolved,
        user_id: titolo.produttore_id,
        percentuale: bestRule.percentuale_provvigione,
        importo_provvigione: Math.round(importo * 100) / 100,
        tipo_destinatario: titolo.produttore_id ? "commerciale" : "consul",
      })
      .select()
      .single();
    if (pErr) throw pErr;


    return new Response(
      JSON.stringify({ message: "Provvigione calcolata", provvigione: prov }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
