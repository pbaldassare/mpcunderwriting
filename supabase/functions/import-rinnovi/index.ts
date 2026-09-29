import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PairRecord = {
  riga_excel?: number;
  numero_titolo: string;
  cliente_anagrafica_id: string;
  compagnia_id: string;
  compagnia_rapporto_id?: string | null;
  ramo_id: string;
  ufficio_id: string;
  ae_anagrafica_id?: string | null;
  specialist?: string | null;
  filiale?: string | null;
  descrizione_polizza?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
  tipo_rinnovo?: string | null;
  provvigioni_quietanza?: number | null;
  madre?: {
    azione?: "crea_nuovo" | "gia_presente" | "skip";
    premio_lordo?: number;
  };
  quietanza?: {
    azione?: "crea_nuovo" | "gia_presente" | "skip";
    premio_lordo?: number;
    incasso?: boolean;
    importo_incassato?: number | null;
    data_messa_cassa?: string | null;
    stato?: string | null;
  };
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeGaranzia(da: string | null | undefined, a: string | null | undefined) {
  const gDa = da || null;
  const gA = a || null;
  if (gDa && gA && gDa > gA) return { garanzia_da: gA, garanzia_a: gDa };
  return { garanzia_da: gDa, garanzia_a: gA };
}

function buildMadrePayload(rec: PairRecord, gar: { garanzia_da: string | null; garanzia_a: string | null }) {
  const durataDa = rec.durata_da || gar.garanzia_da;
  const durataA = rec.durata_a || rec.data_scadenza || gar.garanzia_a;
  return {
    numero_titolo: rec.numero_titolo,
    riga: 0,
    appendice: "000",
    sostituisce_polizza: null,
    cliente_anagrafica_id: rec.cliente_anagrafica_id,
    compagnia_id: rec.compagnia_id,
    compagnia_rapporto_id: rec.compagnia_rapporto_id || null,
    ramo_id: rec.ramo_id,
    ufficio_id: rec.ufficio_id,
    ae_anagrafica_id: rec.ae_anagrafica_id || null,
    specialist: rec.specialist || null,
    filiale: rec.filiale || "SD",
    descrizione_polizza: rec.descrizione_polizza || null,
    garanzia_da: gar.garanzia_da,
    garanzia_a: gar.garanzia_a,
    durata_da: durataDa,
    durata_a: durataA,
    data_scadenza: rec.data_scadenza || durataA,
    premio_netto: 0,
    tasse: 0,
    ssn_firma: 0,
    addizionali: 0,
    premio_lordo: 0,
    provvigioni_firma: null,
    importo_incassato: null,
    data_messa_cassa: null,
    data_incasso: null,
    tipo_rinnovo: rec.tipo_rinnovo || null,
    tacito_rinnovo: true,
    frazionamento: "Unica",
    anni_durata: 1,
    rate: 1,
    valuta: "EURO",
    cambio: 1,
    stato: "attivo",
    note: rec.riga_excel ? `[Import rinnovi Excel riga ${rec.riga_excel}]` : "[Import rinnovi Excel]",
  };
}

function buildQuietanzaPayload(
  rec: PairRecord,
  gar: { garanzia_da: string | null; garanzia_a: string | null },
  q: NonNullable<PairRecord["quietanza"]>,
) {
  const premio = num(q.premio_lordo) ?? 0;
  const incassato = !!q.incasso;
  const importoIncassato = incassato ? (num(q.importo_incassato) ?? premio) : null;
  const dataMc = q.data_messa_cassa || gar.garanzia_a || rec.data_scadenza || null;

  const payload: Record<string, unknown> = {
    numero_titolo: rec.numero_titolo,
    riga: 1,
    appendice: "000",
    sostituisce_polizza: rec.numero_titolo,
    sostituisce_riga: 0,
    cliente_anagrafica_id: rec.cliente_anagrafica_id,
    compagnia_id: rec.compagnia_id,
    compagnia_rapporto_id: rec.compagnia_rapporto_id || null,
    ramo_id: rec.ramo_id,
    ufficio_id: rec.ufficio_id,
    ae_anagrafica_id: rec.ae_anagrafica_id || null,
    specialist: rec.specialist || null,
    filiale: rec.filiale || "SD",
    descrizione_polizza: rec.descrizione_polizza || null,
    garanzia_da: gar.garanzia_da,
    garanzia_a: gar.garanzia_a,
    durata_da: rec.durata_da || gar.garanzia_da,
    durata_a: rec.durata_a || rec.data_scadenza || gar.garanzia_a,
    data_scadenza: rec.data_scadenza || gar.garanzia_a,
    premio_netto: premio,
    tasse: 0,
    ssn_firma: 0,
    addizionali: 0,
    premio_lordo: premio,
    provvigioni_quietanza: num(rec.provvigioni_quietanza),
    tipo_rinnovo: rec.tipo_rinnovo || "R",
    tacito_rinnovo: true,
    frazionamento: "Unica",
    anni_durata: 1,
    rate: 1,
    valuta: "EURO",
    cambio: 1,
    stato: incassato ? (q.stato || "incassato") : "attivo",
    note: rec.riga_excel ? `[Import rinnovi Excel riga ${rec.riga_excel} — quietanza]` : "[Import rinnovi Excel — quietanza]",
  };

  if (incassato && importoIncassato != null) {
    payload.importo_incassato = importoIncassato;
    payload.data_messa_cassa = dataMc;
    payload.data_incasso = dataMc;
    payload.data_copertura = dataMc;
    payload.data_pagamento = dataMc;
  }

  return payload;
}

async function findMadre(supabase: ReturnType<typeof createClient>, numero: string) {
  const { data } = await supabase
    .from("titoli")
    .select("id, riga")
    .eq("numero_titolo", numero)
    .is("sostituisce_polizza", null)
    .order("riga", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function findQuietanza(supabase: ReturnType<typeof createClient>, numero: string, riga = 1) {
  const { data } = await supabase
    .from("titoli")
    .select("id")
    .eq("numero_titolo", numero)
    .eq("riga", riga)
    .not("sostituisce_polizza", "is", null)
    .maybeSingle();
  if (data) return data;

  const { data: anyQ } = await supabase
    .from("titoli")
    .select("id")
    .eq("numero_titolo", numero)
    .eq("sostituisce_polizza", numero)
    .limit(1)
    .maybeSingle();
  return anyQ;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, records, options } = body;

    if (action !== "import_batch") {
      throw new Error("Azione non supportata. Usare action=import_batch.");
    }
    if (!records || !Array.isArray(records)) throw new Error("Missing records array");

    const skipExisting = options?.skip_existing !== false;
    const dryRun = options?.dry_run === true;

    const imported: unknown[] = [];
    const skipped: unknown[] = [];
    const failed: unknown[] = [];

    for (const rec of records as PairRecord[]) {
      const numero = String(rec.numero_titolo || "").trim();
      if (!numero) {
        failed.push({ riga_excel: rec.riga_excel, motivo: "numero_titolo mancante" });
        continue;
      }
      if (!rec.cliente_anagrafica_id || !rec.compagnia_id || !rec.ramo_id || !rec.ufficio_id) {
        failed.push({ numero_titolo: numero, riga_excel: rec.riga_excel, motivo: "FK mancanti" });
        continue;
      }

      const gar = normalizeGaranzia(rec.garanzia_da, rec.garanzia_a);
      const madrePlan = rec.madre || { azione: "crea_nuovo" };
      const quietPlan = rec.quietanza || { azione: "crea_nuovo" };

      try {
        let madreId: string | null = null;
        let madreAzione = "skip";

        const existingMadre = await findMadre(supabase, numero);
        if (existingMadre) {
          madreId = existingMadre.id;
          if (skipExisting || madrePlan.azione === "gia_presente") {
            madreAzione = "gia_presente";
            skipped.push({ numero_titolo: numero, ruolo: "madre", id: madreId, motivo: "Madre già presente" });
          }
        }

        if (!madreId && madrePlan.azione !== "skip" && madrePlan.azione !== "gia_presente") {
          const madrePayload = buildMadrePayload(rec, gar);
          if (dryRun) {
            madreAzione = "crea_nuovo_dry";
            madreId = "dry-run-madre";
          } else {
            const { data, error } = await supabase
              .from("titoli")
              .insert(madrePayload)
              .select("id")
              .single();
            if (error) throw new Error(`Madre: ${error.message}`);
            madreId = data.id;
            madreAzione = "crea_nuovo";
            imported.push({ numero_titolo: numero, ruolo: "madre", id: madreId, riga_excel: rec.riga_excel });
          }
        }

        let quietId: string | null = null;
        let quietAzione = "skip";
        const existingQuiet = await findQuietanza(supabase, numero);

        if (existingQuiet) {
          quietId = existingQuiet.id;
          if (skipExisting || quietPlan.azione === "gia_presente") {
            quietAzione = "gia_presente";
            skipped.push({ numero_titolo: numero, ruolo: "quietanza", id: quietId, motivo: "Quietanza già presente" });
          }
        }

        if (!quietId && quietPlan.azione !== "skip" && quietPlan.azione !== "gia_presente") {
          if (!madreId && !dryRun) {
            failed.push({
              numero_titolo: numero,
              riga_excel: rec.riga_excel,
              motivo: "Quietanza senza madre — madre non creata",
            });
            continue;
          }

          const quietPayload = buildQuietanzaPayload(rec, gar, quietPlan);
          if (dryRun) {
            quietAzione = "crea_nuovo_dry";
            quietId = "dry-run-quietanza";
          } else {
            const { data, error } = await supabase
              .from("titoli")
              .insert(quietPayload)
              .select("id")
              .single();
            if (error) throw new Error(`Quietanza: ${error.message}`);
            quietId = data.id;
            quietAzione = "crea_nuovo";
            imported.push({
              numero_titolo: numero,
              ruolo: "quietanza",
              id: quietId,
              incasso: !!quietPlan.incasso,
              riga_excel: rec.riga_excel,
            });
          }
        }

        if (dryRun && (madreAzione === "crea_nuovo_dry" || quietAzione === "crea_nuovo_dry")) {
          imported.push({
            numero_titolo: numero,
            riga_excel: rec.riga_excel,
            madre: madreAzione,
            quietanza: quietAzione,
            dry_run: true,
          });
        }
      } catch (e) {
        failed.push({
          numero_titolo: numero,
          riga_excel: rec.riga_excel,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        imported,
        skipped,
        failed,
        counts: {
          imported: imported.length,
          skipped: skipped.length,
          failed: failed.length,
          pairs: records.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
