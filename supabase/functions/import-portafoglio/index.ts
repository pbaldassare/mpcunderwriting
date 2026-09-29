import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function num(v: any): number | null {
  if (v === null || v === undefined || v === "" || (typeof v === "string" && v.trim() === "")) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { records, action } = await req.json();
    if (!records || !Array.isArray(records)) throw new Error("Missing 'records' array");

    // Build lookup maps
    const [clientiRes, compagnieRes, ramiRes, ufficiRes] = await Promise.all([
      supabase.from("clienti").select("id, codice_ricerca"),
      supabase.from("compagnie").select("id, codice"),
      supabase.from("rami").select("id, codice"),
      supabase.from("uffici").select("id, nome_ufficio, codice"),
    ]);

    const clientiMap: Record<string, string> = {};
    (clientiRes.data || []).forEach((c: any) => {
      if (c.codice_ricerca) clientiMap[c.codice_ricerca] = c.id;
    });

    const compagnieMap: Record<string, string> = {};
    (compagnieRes.data || []).forEach((c: any) => {
      if (c.codice) compagnieMap[c.codice] = c.id;
    });

    const ramiMap: Record<string, string> = {};
    (ramiRes.data || []).forEach((r: any) => {
      if (r.codice) ramiMap[r.codice] = r.id;
    });

    const ufficiMap: Record<string, string> = {};
    (ufficiRes.data || []).forEach((u: any) => {
      if (u.codice) ufficiMap[u.codice] = u.id;
      if (u.nome_ufficio) {
        // Map filiale codes to ufficio IDs
        const nome = u.nome_ufficio.toUpperCase();
        if (nome.includes("NAPOLI")) ufficiMap["NA"] = u.id;
        if (nome.includes("ROMA")) ufficiMap["RM"] = u.id;
      }
    });

    // If replace_all, delete existing data
    if (action === "replace_all") {
      console.log("Deleting all existing movimenti_polizza and titoli...");
      await supabase.from("movimenti_polizza").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("dettaglio_riparto").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("titoli").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      console.log("Existing data deleted.");
    }

    // Group records by polizza+riga to identify unique titoli
    // Key: polizza_numero + "_" + riga
    const grouped: Record<string, any[]> = {};
    for (const r of records) {
      const key = `${r.polizza || ""}_${r.riga ?? 0}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    let titoliCreated = 0;
    let movimentiCreated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Process each unique polizza
    for (const [key, rows] of Object.entries(grouped)) {
      // Find the PI row or the first row for titolo data
      const piRow = rows.find((r: any) => r.tipo_doc === "PI") || rows[0];
      const latestRow = rows.reduce((a: any, b: any) => {
        const da = a.scad_gar || a.iniz_gar || "";
        const db = b.scad_gar || b.iniz_gar || "";
        return db > da ? b : a;
      }, rows[0]);

      // Use PI for base data, latest for current state
      const baseRow = piRow;
      const stateRow = latestRow;

      // Resolve FKs
      const clienteCode = String(baseRow.cd_clie || "").padStart(6, "0");
      const clienteId = clientiMap[clienteCode] || null;
      const compagniaId = compagnieMap[baseRow.cd_comp || ""] || null;
      const ramoId = ramiMap[baseRow.cd_ramo || ""] || null;
      const uffId = ufficiMap[baseRow.fil || ""] || null;

      // Determine stato from latest row's 'st' field
      let stato = "attivo";
      const stField = String(stateRow.st || "").toUpperCase();
      if (stField === "A") stato = "attivo";
      else if (stField === "Z") stato = "sospeso";
      else if (stField === "X" || stField === "S") stato = "scaduto";
      else if (stField === "N") stato = "annullato";

      const titolo = {
        numero_titolo: baseRow.polizza || null,
        riga: baseRow.riga ?? 0,
        appendice: stateRow.appendice || null,
        cliente_anagrafica_id: clienteId,
        compagnia_id: compagniaId,
        ramo_id: ramoId,
        ufficio_id: uffId,
        gruppo_ramo: baseRow.gruppo_ramo || null,
        descrizione_polizza: baseRow.descrizione || null,
        cig_rif: baseRow.rif_cig || null,
        durata_da: baseRow.iniz_pol || null,
        durata_a: baseRow.scad_pol || null,
        data_scadenza: stateRow.scad_pol || null,
        garanzia_da: baseRow.iniz_gar || null,
        garanzia_a: stateRow.scad_gar || null,
        valuta: baseRow.valuta || "EURO",
        cambio: num(baseRow.cambio) ?? 1,
        premio_lordo: num(stateRow.premio),
        premio_netto: num(stateRow.imponibile),
        tasse: num(stateRow.tasse_val),
        provvigioni_firma: num(baseRow.attive),
        provvigioni_quietanza: num(stateRow.passive),
        data_competenza: stateRow.dt_copertura || null,
        data_incasso: stateRow.dt_incasso || null,
        rate: num(stateRow.rate),
        tipo_rinnovo: stateRow.rinnovo || null,
        disdetta_giorni: (() => {
          const mesi = num(stateRow.mesi_disd);
          return mesi == null ? null : mesi <= 12 ? mesi * 30 : mesi;
        })(),
        specialist: baseRow.nome_specialist || null,
        tipo_portafoglio: baseRow.tipo_portafoglio || null,
        stato: stato,
        // New fields
        percentuale_riparto: num(stateRow.perc_riparto),
        tipo_mandatario: baseRow.tipo_mand || null,
        risk_type: baseRow.risk_type || null,
        prodotto_nome: baseRow.prodotto || null,
        comp_contabile: stateRow.comp_contabile || null,
        comp_assicurativa: stateRow.comp_assicurativa || null,
        tipo_incasso: stateRow.tipo_inc || null,
        conto_incasso: stateRow.conto_inc || null,
        id_legacy: baseRow.id_legacy ?? null,
        produttore_nome: baseRow.nome_produttore || null,
        ae_nome: baseRow.nome_ae || null,
        filiale: baseRow.fil || null,
      };

      // Insert titolo
      const { data: insertedTitolo, error: titoloErr } = await supabase
        .from("titoli")
        .insert(titolo)
        .select("id")
        .single();

      if (titoloErr) {
        errors++;
        errorDetails.push(`Titolo ${key}: ${titoloErr.message}`);
        continue;
      }
      titoliCreated++;

      // Create movimenti for each row
      const movimenti = rows.map((r: any) => ({
        titolo_id: insertedTitolo.id,
        riga: r.riga ?? 0,
        appendice: r.appendice || null,
        data_effetto: r.iniz_gar || null,
        data_scadenza: r.scad_gar || null,
        data_rinnovo: r.scad_pol || null,
        tipo_rinnovo: r.rinnovo || null,
        descrizione: r.descrizione || null,
        valuta: r.valuta || "EURO",
        premio: num(r.premio),
        provvigioni: num(r.attive),
        tipo: r.tipo_doc === "PI" ? "Polizza Base" : r.tipo_doc === "PQ" ? "Rinnovo" : r.tipo_doc === "AM" ? "Appendice" : r.tipo_doc || "Altro",
        incassato: String(r.stato_row || "").toUpperCase() === "S",
        data_copertura: r.dt_copertura || null,
        data_incasso: r.dt_incasso || null,
        stato: String(r.stato_row || "").toUpperCase() === "S" ? "incassato" : "attivo",
        ufficio_id: ufficiMap[r.fil || ""] || uffId,
        tipo_documento: r.tipo_doc || null,
        premio_netto: num(r.imponibile),
        tasse: num(r.tasse_val),
        provvigioni_attive: num(r.attive),
        provvigioni_passive: num(r.passive),
        stato_incasso: r.stato_row || null,
      }));

      const batchSize = 50;
      for (let i = 0; i < movimenti.length; i += batchSize) {
        const batch = movimenti.slice(i, i + batchSize);
        const { error: movErr } = await supabase.from("movimenti_polizza").insert(batch);
        if (movErr) {
          errors++;
          errorDetails.push(`Movimenti batch ${key}[${i}]: ${movErr.message}`);
        } else {
          movimentiCreated += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        titoli_created: titoliCreated,
        movimenti_created: movimentiCreated,
        errors,
        error_details: errorDetails.slice(0, 20),
        total_groups: Object.keys(grouped).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Import error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
