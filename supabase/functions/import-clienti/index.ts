import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_UFFICIO_CODICE = "SDO";
const DEFAULT_SPECIALIST_EMAIL = "mmidena@consulbrokers.it";

function resolveTipoCliente(fg: string, gruFin: string): "privato" | "azienda" | "ente" {
  const gf = (gruFin || "").trim().toUpperCase();
  if (fg === "F" || gf === "LINEA PERSONA") return "privato";
  if (
    gf.includes("ENTE") ||
    gf.includes("PUBBLIC") ||
    gf.includes("COMUNE") ||
    gf.includes("ASL") ||
    gf.includes("OSPEDALE") ||
    gf.includes("SCUOLA") ||
    gf.includes("UNIVERSIT")
  ) {
    return "ente";
  }
  return "azienda";
}

function sanitizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 20000 && n <= 60000) {
    const utc = Date.UTC(1899, 11, 30) + n * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  return null;
}

function mapClienteRecord(c: any, ufficioId: string, gfMap: Record<string, string>) {
  const isGiuridico = c.tipo === "G";
  const tipoCliente = resolveTipoCliente(c.tipo || "", c.gru_fin || "");
  const gfId = c.gru_fin ? gfMap[(c.gru_fin).trim().toUpperCase()] || null : null;

  const record: any = {
    codice_ricerca: c.codice || null,
    tipo_cliente: tipoCliente,
    ufficio_id: ufficioId,
    attivo: c.stato !== "non attivo",
    stato_cliente: c.stato || "Attivo",
    telefono: c.tel || null,
    email: c.email || null,
    attenzione_di: c.atten_di || null,
    codice_fiscale: (!isGiuridico && c.cf) ? c.cf : null,
    codice_fiscale_azienda: (isGiuridico && c.cf) ? c.cf : null,
    partita_iva: c.piva || null,
    gruppo_statistico: c.gru_stat || null,
    gruppo_finanziario_id: gfId,
    indotto: c.indotto || null,
    zona: c.zona || null,
    attivita: c.attivita || null,
    spec_sx_danni: c.specialist_sx || null,
    fatturato: c.fatturato || null,
    fascia_dipendenti: c.dipendenti || null,
  };

  if (isGiuridico) {
    record.ragione_sociale = c.nome || null;
    record.indirizzo_sede = c.indirizzo || null;
    record.cap_sede = c.cap || null;
    record.citta_sede = c.comune || null;
    record.provincia_sede = c.prov || null;
  } else {
    const parts = (c.nome || "").trim().split(/\s+/);
    record.cognome = parts[0] || null;
    record.nome = parts.slice(1).join(" ") || null;
    record.indirizzo_residenza = c.indirizzo || null;
    record.cap_residenza = c.cap || null;
    record.citta_residenza = c.comune || null;
    record.provincia_residenza = c.prov || null;
  }

  return record;
}

async function resolveGruppiFinanziari(supabase: any, clienti: any[]) {
  const { data: existingGF } = await supabase.from("gruppi_finanziari").select("id, nome");
  const gfMap: Record<string, string> = {};
  for (const gf of (existingGF || [])) {
    gfMap[gf.nome.trim().toUpperCase()] = gf.id;
  }

  const neededGF = new Set<string>();
  for (const c of clienti) {
    if (c.gru_fin && c.gru_fin.trim()) neededGF.add(c.gru_fin.trim());
  }

  let gfCreated = 0;
  for (const nome of neededGF) {
    if (!gfMap[nome.toUpperCase()]) {
      const codice = `GF${String(Object.keys(gfMap).length + 1).padStart(3, "0")}`;
      const { data, error } = await supabase
        .from("gruppi_finanziari")
        .insert({ codice, nome, descrizione: nome, attivo: true })
        .select("id")
        .single();
      if (!error && data) {
        gfMap[nome.toUpperCase()] = data.id;
        gfCreated++;
      } else {
        console.error(`GF create error for ${nome}:`, error?.message);
      }
    }
  }

  return { gfMap, gfCreated };
}

async function resolveUfficioAndSpecialist(
  supabase: any,
  ufficioCodice: string,
  specialistEmail: string,
) {
  const { data: ufficio, error: ufficioErr } = await supabase
    .from("uffici")
    .select("id, nome_ufficio, codice_ufficio")
    .eq("codice_ufficio", ufficioCodice)
    .maybeSingle();
  if (ufficioErr || !ufficio) {
    throw new Error(`Ufficio ${ufficioCodice} non trovato: ${ufficioErr?.message || "missing"}`);
  }

  const { data: specialist, error: specErr } = await supabase
    .from("profiles")
    .select("id, nome, cognome, email")
    .eq("email", specialistEmail)
    .maybeSingle();
  if (specErr || !specialist) {
    throw new Error(`Specialist ${specialistEmail} non trovato: ${specErr?.message || "missing"}`);
  }

  return { ufficio, specialist };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, records, gruppi_finanziari, ufficio, clienti, codici_commerciali, options } = body;

    if (action === "setup") {
      let ufficio_id = null;
      if (ufficio) {
        const { data: uf, error: ufErr } = await supabase
          .from("uffici")
          .insert({ nome_ufficio: ufficio, attivo: true })
          .select("id")
          .single();
        if (ufErr) throw new Error(`Ufficio error: ${ufErr.message}`);
        ufficio_id = uf.id;
      }
      const gf_map: Record<string, string> = {};
      if (gruppi_finanziari) {
        for (let i = 0; i < gruppi_finanziari.length; i++) {
          const nome = gruppi_finanziari[i];
          const codice = `GF${String(i + 1).padStart(2, "0")}`;
          const { data, error } = await supabase
            .from("gruppi_finanziari")
            .insert({ codice, nome, descrizione: nome, attivo: true })
            .select("id")
            .single();
          if (error) console.error(`GF error for ${nome}:`, error.message);
          else gf_map[nome] = data.id;
        }
      }
      return new Response(JSON.stringify({ success: true, ufficio_id, gf_map }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      if (!records) throw new Error("Missing records");
      let inserted = 0;
      let errors = 0;
      const batchSize = 50;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from("clienti").insert(batch);
        if (error) { errors += batch.length; console.error(`Batch ${i} error:`, error.message); }
        else inserted += batch.length;
      }
      return new Response(JSON.stringify({ success: true, inserted, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import_batch") {
      if (!clienti || !Array.isArray(clienti)) throw new Error("Missing clienti array");

      const ufficioCodice = options?.ufficio_codice ?? DEFAULT_UFFICIO_CODICE;
      const specialistEmail = options?.specialist_email ?? DEFAULT_SPECIALIST_EMAIL;
      const skipExisting = options?.skip_existing !== false;

      const { ufficio, specialist } = await resolveUfficioAndSpecialist(
        supabase,
        ufficioCodice,
        specialistEmail,
      );
      const { gfMap } = await resolveGruppiFinanziari(supabase, clienti);

      const codici = clienti.map((c: any) => c.codice).filter(Boolean);
      const existingMap: Record<string, string> = {};
      const lookupCodici = new Set<string>(codici);
      for (const cc of (codici_commerciali || [])) {
        if (cc.codice) lookupCodici.add(cc.codice);
      }
      if (lookupCodici.size > 0) {
        const { data: existing } = await supabase
          .from("clienti")
          .select("id, codice_ricerca")
          .in("codice_ricerca", Array.from(lookupCodici));
        for (const row of (existing || [])) {
          if (row.codice_ricerca) existingMap[row.codice_ricerca] = row.id;
        }
      }

      const imported: any[] = [];
      const failed: any[] = [];
      const skipped: any[] = [];
      const idMap: Record<string, string> = { ...existingMap };

      for (const c of clienti) {
        const codice = c.codice || "";
        if (skipExisting && codice && existingMap[codice]) {
          skipped.push({
            codice,
            nome: c.nome,
            motivo: "Codice già presente in anagrafica",
            cliente_id: existingMap[codice],
          });
          continue;
        }

        const record = mapClienteRecord(c, ufficio.id, gfMap);
        const { data, error } = await supabase
          .from("clienti")
          .insert(record)
          .select("id, codice_ricerca")
          .single();

        if (error) {
          failed.push({
            codice,
            nome: c.nome,
            tipo: c.tipo,
            cf: c.cf || null,
            piva: c.piva || null,
            email: c.email || null,
            gru_fin: c.gru_fin || null,
            motivo: error.message,
          });
        } else if (data) {
          imported.push({
            codice: data.codice_ricerca,
            id: data.id,
            nome: c.nome,
            tipo_cliente: record.tipo_cliente,
          });
          if (data.codice_ricerca) idMap[data.codice_ricerca] = data.id;
        }
      }

      let ccInserted = 0;
      let ccFailed = 0;
      const ccErrors: any[] = [];

      for (const c of (codici_commerciali || [])) {
        const clienteId = idMap[c.codice];
        if (!clienteId) continue;

        const ccRows: any[] = [{
          cliente_id: clienteId,
          ruolo: "Backoffice",
          profilo_id: specialist.id,
          societa_brand: c.brand || "Consulbrokers",
          filiale: c.unit || "SEDE SAN DONA' DI PIAVE",
          data_acquisito: sanitizeDate(c.acquisito),
          scadenza_mandato: sanitizeDate(c.scad_mandato),
          contatto: "Maria Midena",
        }];

        if (c.prod1) {
          ccRows.push({
            cliente_id: clienteId,
            ruolo: "corrispondente_1",
            profilo_id: null,
            societa_brand: c.brand || "Consulbrokers",
            contatto: c.prod1,
          });
        }

        const { error: ccErr } = await supabase.from("codici_commerciali_cliente").insert(ccRows);
        if (ccErr) {
          ccFailed += ccRows.length;
          ccErrors.push({ codice: c.codice, motivo: ccErr.message });
        } else {
          ccInserted += ccRows.length;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          ufficio: ufficio,
          specialist: specialist,
          imported,
          failed,
          skipped,
          cc_inserted: ccInserted,
          cc_failed: ccFailed,
          cc_errors: ccErrors,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "replace_all") {
      if (!clienti) throw new Error("Missing clienti");
      const { ufficio, specialist } = await resolveUfficioAndSpecialist(
        supabase,
        options?.ufficio_codice ?? DEFAULT_UFFICIO_CODICE,
        options?.specialist_email ?? DEFAULT_SPECIALIST_EMAIL,
      );
      const ufficio_id = ufficio.id;
      const log: string[] = [];
      log.push(`Ufficio: ${ufficio.nome_ufficio} (${ufficio.id})`);
      log.push(`Specialist: ${specialist.email} (${specialist.id})`);

      const { gfMap, gfCreated } = await resolveGruppiFinanziari(supabase, clienti);
      log.push(`Gruppi finanziari creati: ${gfCreated}`);

      const { error: delCC } = await supabase.from("codici_commerciali_cliente").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delCC) log.push(`Errore delete codici_commerciali: ${delCC.message}`);

      const { error: delRel } = await supabase.from("clienti_relazioni").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delRel) log.push(`Errore delete relazioni: ${delRel.message}`);

      const { error: delCli, count: delCount } = await supabase.from("clienti").delete({ count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (delCli) log.push(`Errore delete clienti: ${delCli.message}`);
      else log.push(`Clienti eliminati: ${delCount}`);

      const batchSize = 50;
      let insertedClienti = 0;
      let errorClienti = 0;
      const insertedIds: { codice: string; id: string }[] = [];
      const failedRows: any[] = [];

      for (let i = 0; i < clienti.length; i += batchSize) {
        const batch = clienti.slice(i, i + batchSize).map((c: any) => mapClienteRecord(c, ufficio_id, gfMap));
        const { data: inserted, error } = await supabase.from("clienti").insert(batch).select("id, codice_ricerca");
        if (error) {
          errorClienti += batch.length;
          failedRows.push({ batch: i, motivo: error.message });
          console.error(`Batch ${i} error:`, error.message);
        } else {
          insertedClienti += (inserted || []).length;
          for (const ins of (inserted || [])) {
            insertedIds.push({ codice: ins.codice_ricerca, id: ins.id });
          }
        }
      }
      log.push(`Clienti inseriti: ${insertedClienti}, errori: ${errorClienti}`);

      const idMap: Record<string, string> = {};
      for (const entry of insertedIds) {
        if (entry.codice) idMap[entry.codice] = entry.id;
      }

      let ccInserted = 0;
      let ccErrors = 0;
      const ccBatch: any[] = [];

      for (const c of (codici_commerciali || [])) {
        const clienteId = idMap[c.codice];
        if (!clienteId) continue;

        ccBatch.push({
          cliente_id: clienteId,
          ruolo: "Backoffice",
          profilo_id: specialist.id,
          societa_brand: c.brand || "Consulbrokers",
          filiale: c.unit || "SEDE SAN DONA' DI PIAVE",
          data_acquisito: sanitizeDate(c.acquisito),
          scadenza_mandato: sanitizeDate(c.scad_mandato),
          contatto: "Maria Midena",
        });

        if (c.prod1) {
          ccBatch.push({
            cliente_id: clienteId,
            ruolo: "corrispondente_1",
            profilo_id: null,
            societa_brand: c.brand || "Consulbrokers",
            contatto: c.prod1,
          });
        }
      }

      for (let i = 0; i < ccBatch.length; i += batchSize) {
        const batch = ccBatch.slice(i, i + batchSize);
        const { error } = await supabase.from("codici_commerciali_cliente").insert(batch);
        if (error) {
          ccErrors += batch.length;
          console.error(`CC Batch ${i} error:`, error.message);
        } else {
          ccInserted += batch.length;
        }
      }
      log.push(`Codici commerciali inseriti: ${ccInserted}, errori: ${ccErrors}`);

      return new Response(
        JSON.stringify({
          success: true,
          clienti_inseriti: insertedClienti,
          clienti_errori: errorClienti,
          cc_inseriti: ccInserted,
          cc_errori: ccErrors,
          gf_creati: gfCreated,
          failed_rows: failedRows,
          log,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "delete_fake") {
      const keepUfficio = "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a";
      const tables = ["clienti_relazioni", "codici_commerciali_cliente"];
      for (const t of tables) {
        const { error } = await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) console.error(`Delete ${t}:`, error.message);
      }
      const { error: delErr, count } = await supabase
        .from("clienti").delete({ count: "exact" }).neq("ufficio_id", keepUfficio);
      const { error: delErr2 } = await supabase
        .from("clienti").delete().is("ufficio_id", null);
      return new Response(
        JSON.stringify({ success: !delErr, deleted: count, error: delErr?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error("Unknown action");
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
