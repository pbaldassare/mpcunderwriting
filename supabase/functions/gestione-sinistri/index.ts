import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Normalizza payload client (RHF invia spesso "" su campi number/uuid opzionali). */
function sanitizeEdgePayload(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const o = { ...(body as Record<string, unknown>) };
  const uuidKeys = [
    "titolo_id", "cliente_id", "compagnia_id", "responsabile_id", "liquidatore_id",
    "ufficio_id", "user_id", "cliente_anagrafica_id", "sinistro_id", "assegnato_a",
  ];
  const numberKeys = [
    "importo_riserva", "costo_preventivato", "costo_effettivo", "franchigia", "importo_liquidato",
    "anni_prescrizione",
  ];
  for (const k of uuidKeys) {
    if (o[k] === "") o[k] = undefined;
  }
  for (const k of numberKeys) {
    if (o[k] === "") o[k] = undefined;
  }
  return o;
}

/** Allineato a src/lib/sinistriStati.ts — slug persistiti in sinistri.stato. */
const SINISTRO_STATI_NOTI = new Set([
  "apertura_cautelativa", "apertura_sinistro", "archiviato", "atto_di_citazione",
  "card_attivo", "card_passivo", "chiuso", "chiuso_card_passivo",
  "chiuso_senza_responsabilita", "chiuso_senza_seguito",
  "chiuso_senza_seguito_fuori_garanzia", "chiuso_senza_seguito_in_franchigia",
  "chiuso_senza_seguito_prescritto", "contenzioso",
  "i_sollecito_doc_cliente", "ii_sollecito_doc_cliente",
  "in_attesa_di_perizia", "in_attesa_di_sviluppi",
  "in_attesa_documentazione_da_cliente", "in_attesa_documentazione_da_ctp",
  "in_attesa_documentazione_fiscale_per_iva", "in_attesa_liquidazione_franchigia_rct",
  "in_attesa_nomina_perito", "in_attesa_pagamento_da_compagnia",
  "in_attesa_quietanza_da_cliente", "in_attesa_quietanza_da_compagnia",
  "inviata_relazione_tecnica_a_compagnia",
  "invio_atto_liquidazione_amichevole_cliente",
  "invio_atto_liquidazione_amichevole_compagnia",
  "invio_atto_liquidazione_amichevole_perito",
  "invio_citazione_in_compagnia_causa", "invio_documentazione_a_compagnia",
  "invio_quietanza_a_compagnia", "invio_quietanza_al_cliente",
  "liquidato", "liquidato_parziale", "liquidazione_transattiva",
  "mediazione", "non_denunciato_a_compagnia", "operazioni_peritali_in_corso",
  "passaggio_ad_altro_broker", "procedimento_giudizio_concluso",
  "bozza", "in_valutazione", "aperto", "in_lavorazione",
  "in_attesa_documenti", "in_liquidazione", "respinto",
]);

const SINISTRO_STATI_CHIUSURA = new Set([
  "archiviato", "chiuso", "chiuso_card_passivo", "chiuso_senza_responsabilita",
  "chiuso_senza_seguito", "chiuso_senza_seguito_fuori_garanzia",
  "chiuso_senza_seguito_in_franchigia", "chiuso_senza_seguito_prescritto",
  "liquidato", "passaggio_ad_altro_broker", "procedimento_giudizio_concluso",
  "respinto",
]);

function normalizzaStatoEdge(stato?: string | null): string {
  return String(stato || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`´’]/g, "")
    .replace(/[\s\-–—/]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function isStatoChiusuraArchivio(stato?: string | null): boolean {
  const s = normalizzaStatoEdge(stato);
  if (!s) return false;
  if (SINISTRO_STATI_CHIUSURA.has(s)) return true;
  return s === "chiuso" || s.startsWith("chiuso_");
}

function puoRiaprireSinistro(ruolo: string | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!isStatoChiusuraArchivio(from)) return true;
  if (isStatoChiusuraArchivio(to)) return true;
  return String(ruolo || "").toLowerCase() === "admin";
}

const PRESCRIZIONE_ANNI = [1, 2, 5, 10] as const;
type PrescrizioneAnni = (typeof PRESCRIZIONE_ANNI)[number];

function normalizeAnniPrescrizione(value: unknown): PrescrizioneAnni {
  const n = typeof value === "string" ? Number(value) : value;
  return PRESCRIZIONE_ANNI.includes(n as PrescrizioneAnni) ? (n as PrescrizioneAnni) : 2;
}

function testoPrescrizioneLegale(anni: PrescrizioneAnni): { oggetto: string; corpo: string } {
  if (anni === 2) {
    return {
      oggetto: "Termine di prescrizione biennale (art. 2952 c.c.)",
      corpo: "Prescrizione biennale dalla data di accadimento del sinistro.",
    };
  }
  const label = anni === 1 ? "annuale" : anni === 5 ? "quinquennale" : "decennale";
  return {
    oggetto: `Termine di prescrizione ${label} (${anni} ${anni === 1 ? "anno" : "anni"})`,
    corpo: `Prescrizione ${label} dalla data di accadimento del sinistro.`,
  };
}

function calcScadenzaPrescrizioneIso(dataIso: string, anni: number): string {
  const d = new Date(dataIso);
  d.setFullYear(d.getFullYear() + anni);
  return d.toISOString().split("T")[0];
}

async function insertPrescrizioneLegaleAgenzia(opts: {
  supabase: ReturnType<typeof createClient>;
  sinistroId: string;
  userId: string;
  dataEvento?: string | null;
  dataDenuncia?: string | null;
  fallbackOggi: string;
  anni: unknown;
  titoloId?: string | null;
  compagniaId?: string | null;
}) {
  const anni = normalizeAnniPrescrizione(opts.anni);
  const base = String(opts.dataEvento || opts.dataDenuncia || opts.fallbackOggi).trim();
  const scadenza = calcScadenzaPrescrizioneIso(base, anni);
  const testi = testoPrescrizioneLegale(anni);

  let agenziaLabel: string | null = null;
  if (opts.titoloId) {
    const { data: titoloRow } = await opts.supabase
      .from("titoli")
      .select("compagnia_id, compagnie:compagnia_id(nome)")
      .eq("id", opts.titoloId)
      .maybeSingle();
    const nome = (titoloRow as { compagnie?: { nome?: string } } | null)?.compagnie?.nome;
    if (nome && String(nome).trim()) agenziaLabel = String(nome).trim();
  }
  if (!agenziaLabel && opts.compagniaId) {
    const { data: ag } = await opts.supabase
      .from("compagnie")
      .select("nome")
      .eq("id", opts.compagniaId)
      .maybeSingle();
    if (ag?.nome?.trim()) agenziaLabel = ag.nome.trim();
  }

  const { error } = await opts.supabase.from("sinistro_prescrizioni").insert({
    sinistro_id: opts.sinistroId,
    creato_da: opts.userId,
    destinatario_tipo: "compagnia",
    destinatario_label: agenziaLabel,
    oggetto: testi.oggetto,
    corpo: testi.corpo,
    data_scadenza_risposta: scadenza,
    stato: "bozza",
  });
  if (error) throw error;
}

const payloadSchema = z.discriminatedUnion("azione", [
  z.object({
    azione: z.literal("crea"),
    numero_sinistro: z.string().min(1).optional(),
    titolo_id: z.string().uuid().nullable().optional(),
    sinistro_terzi: z.boolean().optional(),
    cliente_id: z.string().uuid().nullable().optional(),
    compagnia_id: z.string().uuid().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    liquidatore_id: z.string().uuid().nullable().optional(),
    ufficio_id: z.string().uuid().nullable().optional(),
    descrizione: z.string().optional().nullable(),
    user_id: z.string().uuid().optional(),
    cliente_anagrafica_id: z.string().uuid().nullable().optional(),
    numero_polizza: z.string().optional().nullable(),
    ramo_sinistro: z.string().optional().nullable(),
    prodotto_sinistro: z.string().optional().nullable(),
    tipo_sinistro: z.string().optional().nullable(),
    tipo_sinistro_personalizzato: z.string().max(500).optional().nullable(),
    luogo_sinistro: z.string().optional().nullable(),
    data_evento: z.string().optional(),
    data_denuncia: z.string().optional(),
    data_apertura: z.string().optional(),
    numero_sinistro_compagnia: z.string().optional().nullable(),
    importo_riserva: z.number().nullable().optional(),
    controparte: z.string().optional().nullable(),
    targa_veicolo: z.string().optional().nullable(),
    dinamica: z.string().optional().nullable(),
    indirizzo_sinistro: z.string().optional().nullable(),
    citta_sinistro: z.string().optional().nullable(),
    cap_sinistro: z.string().optional().nullable(),
    provincia_sinistro: z.string().optional().nullable(),
    costo_preventivato: z.number().nullable().optional(),
    costo_effettivo: z.number().nullable().optional(),
    franchigia: z.number().nullable().optional(),
    importo_liquidato: z.number().nullable().optional(),
    stato_iniziale: z.enum(['bozza','in_valutazione','aperto']).optional(),
    bozza_wizard_json: z.record(z.unknown()).optional().nullable(),
    priorita: z.string().optional(),
    note_interne: z.string().optional().nullable(),
    anni_prescrizione: z.number().int().optional(),
    prescrizioni_iniziali: z.array(z.object({
      destinatario_tipo: z.enum(['cliente', 'compagnia', 'perito', 'controparte', 'altro']).optional(),
      destinatario_label: z.string().optional().nullable(),
      oggetto: z.string().min(1),
      corpo: z.string().optional().nullable(),
      data_scadenza_risposta: z.string(),
      canale: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    })).optional(),
    reminder_iniziali: z.array(z.object({
      testo: z.string().min(1),
      data_scadenza: z.string().optional().nullable(),
      data_promemoria: z.string().optional().nullable(),
      categoria: z.enum(["documenti", "follow_up", "perizia", "contatto_cliente", "altro"]).optional(),
      assegnato_a: z.string().uuid().optional().nullable(),
    })).optional(),
  }),
  z.object({
    azione: z.literal("aggiorna"),
    sinistro_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    sinistro_terzi: z.boolean().optional(),
    titolo_id: z.string().uuid().nullable().optional(),
    data_evento: z.string().optional().nullable(),
    data_denuncia: z.string().optional().nullable(),
    tipo_sinistro: z.string().optional().nullable(),
    tipo_sinistro_personalizzato: z.string().max(500).optional().nullable(),
    numero_sinistro_compagnia: z.string().optional().nullable(),
    descrizione: z.string().optional().nullable(),
    dinamica: z.string().optional().nullable(),
    luogo_sinistro: z.string().optional().nullable(),
    indirizzo_sinistro: z.string().optional().nullable(),
    citta_sinistro: z.string().optional().nullable(),
    cap_sinistro: z.string().optional().nullable(),
    provincia_sinistro: z.string().optional().nullable(),
    controparte: z.string().optional().nullable(),
    targa_veicolo: z.string().optional().nullable(),
    importo_riserva: z.number().nullable().optional(),
    costo_preventivato: z.number().nullable().optional(),
    costo_effettivo: z.number().nullable().optional(),
    franchigia: z.number().nullable().optional(),
    importo_liquidato: z.number().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    liquidatore_id: z.string().uuid().nullable().optional(),
    note_interne: z.string().optional().nullable(),
    note_importanti: z.string().optional().nullable(),
    bozza_wizard_json: z.record(z.unknown()).optional().nullable(),
    compagnia_id: z.string().uuid().nullable().optional(),
    ufficio_id: z.string().uuid().nullable().optional(),
    numero_polizza: z.string().optional().nullable(),
    ramo_sinistro: z.string().optional().nullable(),
    prodotto_sinistro: z.string().optional().nullable(),
  }),
  z.object({
    azione: z.literal("finalizza_bozza"),
    sinistro_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    sinistro_terzi: z.boolean().optional(),
    titolo_id: z.string().uuid().nullable().optional(),
    cliente_anagrafica_id: z.string().uuid().nullable().optional(),
    compagnia_id: z.string().uuid().nullable().optional(),
    ufficio_id: z.string().uuid().nullable().optional(),
    numero_polizza: z.string().optional().nullable(),
    ramo_sinistro: z.string().optional().nullable(),
    prodotto_sinistro: z.string().optional().nullable(),
    descrizione: z.string().optional().nullable(),
    tipo_sinistro: z.string().optional().nullable(),
    tipo_sinistro_personalizzato: z.string().max(500).optional().nullable(),
    luogo_sinistro: z.string().optional().nullable(),
    data_evento: z.string().optional(),
    data_denuncia: z.string().optional(),
    numero_sinistro_compagnia: z.string().optional().nullable(),
    importo_riserva: z.number().nullable().optional(),
    controparte: z.string().optional().nullable(),
    targa_veicolo: z.string().optional().nullable(),
    dinamica: z.string().optional().nullable(),
    indirizzo_sinistro: z.string().optional().nullable(),
    citta_sinistro: z.string().optional().nullable(),
    cap_sinistro: z.string().optional().nullable(),
    provincia_sinistro: z.string().optional().nullable(),
    costo_preventivato: z.number().nullable().optional(),
    costo_effettivo: z.number().nullable().optional(),
    franchigia: z.number().nullable().optional(),
    importo_liquidato: z.number().nullable().optional(),
    responsabile_id: z.string().uuid().nullable().optional(),
    liquidatore_id: z.string().uuid().nullable().optional(),
    note_interne: z.string().optional().nullable(),
    priorita: z.string().optional(),
    anni_prescrizione: z.number().int().optional(),
    prescrizioni_iniziali: z.array(z.object({
      destinatario_tipo: z.enum(['cliente', 'compagnia', 'perito', 'controparte', 'altro']).optional(),
      destinatario_label: z.string().optional().nullable(),
      oggetto: z.string().min(1),
      corpo: z.string().optional().nullable(),
      data_scadenza_risposta: z.string(),
      canale: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    })).optional(),
    reminder_iniziali: z.array(z.object({
      testo: z.string().min(1),
      data_scadenza: z.string().optional().nullable(),
      data_promemoria: z.string().optional().nullable(),
      categoria: z.enum(["documenti", "follow_up", "perizia", "contatto_cliente", "altro"]).optional(),
      assegnato_a: z.string().uuid().optional().nullable(),
    })).optional(),
  }),
  z.object({
    azione: z.literal("cambia_stato"),
    sinistro_id: z.string().uuid(),
    nuovo_stato: z.string().min(1),
    user_id: z.string().uuid().optional(),
    note: z.string().optional(),
  }),
  z.object({
    azione: z.literal("aggiorna_scaduti"),
  })
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Payload non valido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = payloadSchema.safeParse(sanitizeEdgePayload(body));
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { azione } = parsed.data;

    if (azione === "crea") {
      const {
        numero_sinistro, titolo_id, sinistro_terzi, cliente_id, compagnia_id, responsabile_id, liquidatore_id,
        ufficio_id, descrizione, user_id, numero_polizza, ramo_sinistro, prodotto_sinistro,
        cliente_anagrafica_id, tipo_sinistro, tipo_sinistro_personalizzato, luogo_sinistro, data_evento,
        data_denuncia, data_apertura, numero_sinistro_compagnia, importo_riserva,
        controparte, targa_veicolo, dinamica, indirizzo_sinistro, citta_sinistro, cap_sinistro, provincia_sinistro,
        costo_preventivato, costo_effettivo, franchigia, importo_liquidato,
        stato_iniziale, priorita, note_interne, bozza_wizard_json,
        anni_prescrizione, prescrizioni_iniziali, reminder_iniziali,
      } = parsed.data;

      const isBozza = stato_iniziale === "bozza";
      const numero = numero_sinistro
        ?? (isBozza
          ? `BOZZA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
          : `SIN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      const stato = stato_iniziale ?? "aperto";
      const oggi = new Date().toISOString().split("T")[0];
      const descrizioneTesto = descrizione ?? dinamica ?? null;
      const isTerzi = sinistro_terzi === true;

      const { data: sinistro, error } = await supabase.from("sinistri").insert({
        numero_sinistro: numero,
        titolo_id: isTerzi ? null : (titolo_id ?? null),
        sinistro_terzi: isTerzi,
        cliente_id: cliente_id ?? null,
        compagnia_id: compagnia_id ?? null,
        responsabile_id: responsabile_id ?? null,
        liquidatore_id: liquidatore_id ?? null,
        ufficio_id: ufficio_id ?? null,
        numero_polizza: numero_polizza?.trim() || null,
        ramo_sinistro: ramo_sinistro?.trim() || null,
        prodotto_sinistro: prodotto_sinistro?.trim() || null,
        descrizione: descrizioneTesto,
        dinamica: dinamica ?? descrizioneTesto,
        cliente_anagrafica_id: cliente_anagrafica_id ?? null,
        tipo_sinistro: tipo_sinistro ?? null,
        tipo_sinistro_personalizzato: tipo_sinistro_personalizzato?.trim() || null,
        luogo_sinistro: luogo_sinistro ?? null,
        indirizzo_sinistro: indirizzo_sinistro ?? null,
        citta_sinistro: citta_sinistro ?? null,
        cap_sinistro: cap_sinistro ?? null,
        provincia_sinistro: provincia_sinistro ?? null,
        controparte: controparte?.trim() || null,
        targa_veicolo: targa_veicolo?.trim() || null,
        data_evento: data_evento ?? null,
        data_denuncia: isBozza ? (data_denuncia ?? null) : (data_denuncia ?? oggi),
        data_apertura: isBozza ? null : (data_apertura ?? oggi),
        numero_sinistro_compagnia: numero_sinistro_compagnia ?? null,
        importo_riserva: importo_riserva ?? null,
        costo_preventivato: costo_preventivato ?? null,
        costo_effettivo: costo_effettivo ?? null,
        franchigia: franchigia ?? null,
        importo_liquidato: importo_liquidato ?? null,
        note_interne: note_interne?.trim() || null,
        bozza_wizard_json: isBozza ? (bozza_wizard_json ?? null) : null,
        stato,
        aperto_da_cliente: stato === "in_valutazione",
        aperto_da_user_id: user_id ?? null,
      }).select().single();

      if (error) throw error;

      if (isBozza) {
        if (user_id) {
          await supabase.from("log_attivita").insert({
            user_id, azione: "creazione_bozza_sinistro", entita_tipo: "sinistro", entita_id: sinistro.id,
            ufficio_id: sinistro.ufficio_id ?? null,
            dettagli_json: { numero, stato: "bozza" },
            severity: "info",
          });
        }
        return new Response(JSON.stringify({ success: true, sinistro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Evento timeline apertura
      await supabase.from("sinistro_eventi").insert({
        sinistro_id: sinistro.id,
        tipo_evento: "apertura",
        data_scadenza: oggi,
        stato: "completato",
        note: `Apertura sinistro ${numero}${priorita ? ` · Priorità: ${priorita}` : ""}${note_interne ? ` · ${note_interne}` : ""}`,
      });

      // Log
      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id, azione: "creazione_sinistro", entita_tipo: "sinistro", entita_id: sinistro.id,
          ufficio_id: sinistro.ufficio_id ?? null,
          dettagli_json: { numero, tipo_sinistro, stato },
          severity: "info",
        });
      }

      // Prescrizione legale automatica verso l'agenzia di riferimento (data accadimento + N anni)
      if (user_id) {
        const titoloIdEff = isTerzi ? null : (titolo_id ?? null);
        await insertPrescrizioneLegaleAgenzia({
          supabase,
          sinistroId: sinistro.id,
          userId: user_id,
          dataEvento: data_evento,
          dataDenuncia: data_denuncia,
          fallbackOggi: oggi,
          anni: anni_prescrizione,
          titoloId: titoloIdEff,
          compagniaId: compagnia_id,
        });
      }

      // Prescrizioni perentorie aggiuntive (opzionali dal wizard)
      if (prescrizioni_iniziali?.length && user_id) {
        const rows = prescrizioni_iniziali.map((p) => ({
          sinistro_id: sinistro.id,
          creato_da: user_id,
          destinatario_tipo: p.destinatario_tipo ?? "compagnia",
          destinatario_label: p.destinatario_label?.trim() || null,
          oggetto: p.oggetto.trim(),
          corpo: p.corpo?.trim() || null,
          data_scadenza_risposta: p.data_scadenza_risposta,
          canale: p.canale?.trim() || null,
          note: p.note?.trim() || null,
          stato: "bozza",
        }));
        const { error: prescErr } = await supabase.from("sinistro_prescrizioni").insert(rows);
        if (prescErr) throw prescErr;
      }

      // Reminder iniziali opzionali (assegnati al responsabile sinistro)
      if (reminder_iniziali?.length && user_id) {
        const rows = reminder_iniziali.map((r) => {
          const scadenza = r.data_scadenza || r.data_promemoria || null;
          return {
            sinistro_id: sinistro.id,
            user_id,
            creato_da: user_id,
            assegnato_a: r.assegnato_a ?? responsabile_id ?? user_id,
            titolo_id: titolo_id ?? null,
            cliente_id: cliente_anagrafica_id ?? null,
            testo: r.testo.trim(),
            categoria: r.categoria ?? "altro",
            data_scadenza: scadenza,
            data_promemoria: scadenza,
            stato: "attivo",
            letto: false,
            completato: false,
          };
        });
        const { error: remErr } = await supabase.from("sinistro_reminder").insert(rows);
        if (remErr) throw remErr;
      }

      return new Response(JSON.stringify({ success: true, sinistro }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "aggiorna") {
      const {
        sinistro_id, user_id, sinistro_terzi, titolo_id, data_evento, data_denuncia, tipo_sinistro, tipo_sinistro_personalizzato,
        numero_sinistro_compagnia, descrizione, dinamica, luogo_sinistro, indirizzo_sinistro,
        citta_sinistro, cap_sinistro, provincia_sinistro, controparte, targa_veicolo,
        importo_riserva, costo_preventivato, costo_effettivo, franchigia, importo_liquidato,
        responsabile_id, liquidatore_id, note_interne, note_importanti, bozza_wizard_json,
        compagnia_id, ufficio_id, numero_polizza, ramo_sinistro, prodotto_sinistro,
      } = parsed.data;

      const { data: prev, error: prevErr } = await supabase
        .from("sinistri")
        .select("stato, ufficio_id, numero_sinistro")
        .eq("id", sinistro_id)
        .maybeSingle();
      if (prevErr) throw prevErr;
      if (!prev) {
        return new Response(JSON.stringify({ success: false, error: "Sinistro non trovato" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const descrizioneTesto = descrizione ?? dinamica ?? null;
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (data_evento !== undefined) updateData.data_evento = data_evento;
      if (data_denuncia !== undefined) updateData.data_denuncia = data_denuncia;
      if (tipo_sinistro !== undefined) updateData.tipo_sinistro = tipo_sinistro;
      if (tipo_sinistro_personalizzato !== undefined) {
        updateData.tipo_sinistro_personalizzato = tipo_sinistro_personalizzato?.trim() || null;
      }
      if (numero_sinistro_compagnia !== undefined) updateData.numero_sinistro_compagnia = numero_sinistro_compagnia;
      if (descrizione !== undefined || dinamica !== undefined) {
        updateData.descrizione = descrizioneTesto;
        updateData.dinamica = dinamica ?? descrizioneTesto;
      }
      if (luogo_sinistro !== undefined) updateData.luogo_sinistro = luogo_sinistro;
      if (indirizzo_sinistro !== undefined) updateData.indirizzo_sinistro = indirizzo_sinistro;
      if (citta_sinistro !== undefined) updateData.citta_sinistro = citta_sinistro;
      if (cap_sinistro !== undefined) updateData.cap_sinistro = cap_sinistro;
      if (provincia_sinistro !== undefined) updateData.provincia_sinistro = provincia_sinistro;
      if (controparte !== undefined) updateData.controparte = controparte?.trim() || null;
      if (targa_veicolo !== undefined) updateData.targa_veicolo = targa_veicolo?.trim() || null;
      if (importo_riserva !== undefined) updateData.importo_riserva = importo_riserva;
      if (costo_preventivato !== undefined) updateData.costo_preventivato = costo_preventivato;
      if (costo_effettivo !== undefined) updateData.costo_effettivo = costo_effettivo;
      if (franchigia !== undefined) updateData.franchigia = franchigia;
      if (importo_liquidato !== undefined) updateData.importo_liquidato = importo_liquidato;
      if (responsabile_id !== undefined) updateData.responsabile_id = responsabile_id;
      if (liquidatore_id !== undefined) updateData.liquidatore_id = liquidatore_id;
      if (note_interne !== undefined) updateData.note_interne = note_interne?.trim() || null;
      if (note_importanti !== undefined) updateData.note_importanti = note_importanti?.trim() || null;
      if (bozza_wizard_json !== undefined) updateData.bozza_wizard_json = bozza_wizard_json;
      if (compagnia_id !== undefined) updateData.compagnia_id = compagnia_id;
      if (ufficio_id !== undefined) updateData.ufficio_id = ufficio_id;
      if (numero_polizza !== undefined) updateData.numero_polizza = numero_polizza?.trim() || null;
      if (ramo_sinistro !== undefined) updateData.ramo_sinistro = ramo_sinistro?.trim() || null;
      if (prodotto_sinistro !== undefined) updateData.prodotto_sinistro = prodotto_sinistro?.trim() || null;
      if (sinistro_terzi !== undefined) {
        updateData.sinistro_terzi = sinistro_terzi;
        if (sinistro_terzi === true) updateData.titolo_id = null;
      }
      if (titolo_id !== undefined && sinistro_terzi !== true) {
        updateData.titolo_id = titolo_id;
        if (titolo_id) updateData.sinistro_terzi = false;
        // Allinea compagnia/ufficio alla polizza collegata
        if (titolo_id) {
          const { data: titoloRow } = await supabase
            .from("titoli")
            .select("compagnia_id, ufficio_id")
            .eq("id", titolo_id)
            .maybeSingle();
          if (titoloRow?.compagnia_id) updateData.compagnia_id = titoloRow.compagnia_id;
          if (titoloRow?.ufficio_id) updateData.ufficio_id = titoloRow.ufficio_id;
        }
      }

      const { data: sinistro, error } = await supabase
        .from("sinistri")
        .update(updateData)
        .eq("id", sinistro_id)
        .select()
        .single();
      if (error) throw error;

      if (prev.stato !== "bozza") {
        await supabase.from("sinistro_eventi").insert({
          sinistro_id,
          tipo_evento: "modifica_dati",
          stato: "completato",
          note: `Aggiornamento dati pratica${prev.numero_sinistro ? ` — ${prev.numero_sinistro}` : ""}`,
        });
      }

      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id,
          azione: prev.stato === "bozza" ? "aggiornamento_bozza_sinistro" : "modifica_sinistro",
          entita_tipo: "sinistro",
          entita_id: sinistro_id,
          ufficio_id: prev.ufficio_id ?? null,
          dettagli_json: { campi_aggiornati: Object.keys(updateData).filter((k) => k !== "updated_at") },
          severity: "info",
        });
      }

      return new Response(JSON.stringify({ success: true, sinistro }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (azione === "finalizza_bozza") {
      const {
        sinistro_id, user_id, sinistro_terzi, titolo_id, cliente_anagrafica_id, compagnia_id, ufficio_id,
        numero_polizza, ramo_sinistro, prodotto_sinistro,
        descrizione, tipo_sinistro, tipo_sinistro_personalizzato, luogo_sinistro, data_evento, data_denuncia,
        numero_sinistro_compagnia, importo_riserva, controparte, targa_veicolo, dinamica,
        indirizzo_sinistro, citta_sinistro, cap_sinistro, provincia_sinistro,
        costo_preventivato, costo_effettivo, franchigia, importo_liquidato,
        responsabile_id, liquidatore_id, note_interne, priorita,
        anni_prescrizione, prescrizioni_iniziali, reminder_iniziali,
      } = parsed.data;

      const { data: prev, error: prevErr } = await supabase
        .from("sinistri")
        .select("stato, ufficio_id, numero_sinistro, titolo_id, compagnia_id")
        .eq("id", sinistro_id)
        .maybeSingle();
      if (prevErr) throw prevErr;
      if (!prev) {
        return new Response(JSON.stringify({ success: false, error: "Sinistro non trovato" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (prev.stato !== "bozza") {
        return new Response(JSON.stringify({ success: false, error: "La pratica non è in stato bozza" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const oggi = new Date().toISOString().split("T")[0];
      const isTerzi = sinistro_terzi === true;
      const descrizioneTesto = descrizione ?? dinamica ?? null;
      const numeroFinale = prev.numero_sinistro?.startsWith("BOZZA-")
        ? `SIN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        : (prev.numero_sinistro ?? `SIN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);

      const updateData: Record<string, unknown> = {
        numero_sinistro: numeroFinale,
        stato: "aperto",
        data_apertura: oggi,
        data_denuncia: data_denuncia ?? oggi,
        bozza_wizard_json: null,
        updated_at: new Date().toISOString(),
        sinistro_terzi: isTerzi,
        titolo_id: isTerzi ? null : (titolo_id ?? null),
        cliente_anagrafica_id: cliente_anagrafica_id ?? null,
        compagnia_id: compagnia_id ?? null,
        ufficio_id: ufficio_id ?? null,
        numero_polizza: numero_polizza?.trim() || null,
        ramo_sinistro: ramo_sinistro?.trim() || null,
        prodotto_sinistro: prodotto_sinistro?.trim() || null,
        responsabile_id: responsabile_id ?? null,
        liquidatore_id: liquidatore_id ?? null,
        descrizione: descrizioneTesto,
        dinamica: dinamica ?? descrizioneTesto,
        tipo_sinistro: tipo_sinistro ?? null,
        tipo_sinistro_personalizzato: tipo_sinistro_personalizzato?.trim() || null,
        luogo_sinistro: luogo_sinistro ?? null,
        indirizzo_sinistro: indirizzo_sinistro ?? null,
        citta_sinistro: citta_sinistro ?? null,
        cap_sinistro: cap_sinistro ?? null,
        provincia_sinistro: provincia_sinistro ?? null,
        controparte: controparte?.trim() || null,
        targa_veicolo: targa_veicolo?.trim() || null,
        data_evento: data_evento ?? null,
        numero_sinistro_compagnia: numero_sinistro_compagnia ?? null,
        importo_riserva: importo_riserva ?? null,
        costo_preventivato: costo_preventivato ?? null,
        costo_effettivo: costo_effettivo ?? null,
        franchigia: franchigia ?? null,
        importo_liquidato: importo_liquidato ?? null,
        note_interne: note_interne?.trim() || null,
      };

      const { data: sinistro, error } = await supabase
        .from("sinistri")
        .update(updateData)
        .eq("id", sinistro_id)
        .select()
        .single();
      if (error) throw error;

      // Checklist default (trigger AFTER INSERT non scatta su UPDATE)
      const { data: existingChecklist } = await supabase
        .from("sinistro_checklist")
        .select("id")
        .eq("sinistro_id", sinistro_id)
        .limit(1);
      if (!existingChecklist?.length) {
        await supabase.from("sinistro_checklist").insert([
          { sinistro_id, descrizione: "Denuncia sinistro compilata", obbligatorio: true },
          { sinistro_id, descrizione: "Documentazione fotografica", obbligatorio: true },
          { sinistro_id, descrizione: "Copia polizza allegata", obbligatorio: true },
          { sinistro_id, descrizione: "Modulo CID/CAI compilato", obbligatorio: false },
        ]);
      }

      await supabase.from("sinistro_eventi").insert({
        sinistro_id,
        tipo_evento: "apertura",
        data_scadenza: oggi,
        stato: "completato",
        note: `Apertura sinistro ${numeroFinale}${priorita ? ` · Priorità: ${priorita}` : ""}${note_interne ? ` · ${note_interne}` : ""}`,
      });

      const titoloIdEff = isTerzi ? null : (titolo_id ?? null);
      if (user_id) {
        await insertPrescrizioneLegaleAgenzia({
          supabase,
          sinistroId: sinistro_id,
          userId: user_id,
          dataEvento: data_evento,
          dataDenuncia: data_denuncia,
          fallbackOggi: oggi,
          anni: anni_prescrizione,
          titoloId: titoloIdEff,
          compagniaId: compagnia_id,
        });
      }

      if (prescrizioni_iniziali?.length && user_id) {
        const rows = prescrizioni_iniziali.map((p) => ({
          sinistro_id,
          creato_da: user_id,
          destinatario_tipo: p.destinatario_tipo ?? "compagnia",
          destinatario_label: p.destinatario_label?.trim() || null,
          oggetto: p.oggetto.trim(),
          corpo: p.corpo?.trim() || null,
          data_scadenza_risposta: p.data_scadenza_risposta,
          canale: p.canale?.trim() || null,
          note: p.note?.trim() || null,
          stato: "bozza",
        }));
        const { error: prescErr } = await supabase.from("sinistro_prescrizioni").insert(rows);
        if (prescErr) throw prescErr;
      }

      if (reminder_iniziali?.length && user_id) {
        const rows = reminder_iniziali.map((r) => {
          const scadenza = r.data_scadenza || r.data_promemoria || null;
          return {
            sinistro_id,
            user_id,
            creato_da: user_id,
            assegnato_a: r.assegnato_a ?? responsabile_id ?? user_id,
            titolo_id: titoloIdEff,
            cliente_id: cliente_anagrafica_id ?? null,
            testo: r.testo.trim(),
            categoria: r.categoria ?? "altro",
            data_scadenza: scadenza,
            data_promemoria: scadenza,
            stato: "attivo",
            letto: false,
            completato: false,
          };
        });
        const { error: remErr } = await supabase.from("sinistro_reminder").insert(rows);
        if (remErr) throw remErr;
      }

      if (user_id) {
        await supabase.from("log_attivita").insert({
          user_id,
          azione: "finalizzazione_bozza_sinistro",
          entita_tipo: "sinistro",
          entita_id: sinistro_id,
          ufficio_id: sinistro.ufficio_id ?? null,
          dettagli_json: { numero: numeroFinale, stato: "aperto" },
          severity: "info",
        });
      }

      return new Response(JSON.stringify({ success: true, sinistro }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (azione === "cambia_stato") {
      const { sinistro_id, nuovo_stato, user_id, note } = parsed.data;
      const nuovoNorm = normalizzaStatoEdge(nuovo_stato);
      if (!SINISTRO_STATI_NOTI.has(nuovoNorm)) {
        return new Response(JSON.stringify({ success: false, error: "Stato non valido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stato precedente per log
      const { data: prev } = await supabase
        .from("sinistri")
        .select("stato, ufficio_id")
        .eq("id", sinistro_id)
        .maybeSingle();
      const stato_precedente = prev?.stato ?? null;

      let ruolo: string | null = null;
      if (user_id) {
        const { data: prof } = await supabase.from("profiles").select("ruolo").eq("id", user_id).maybeSingle();
        ruolo = (prof as { ruolo?: string } | null)?.ruolo ?? null;
      }
      if (!puoRiaprireSinistro(ruolo, stato_precedente, nuovoNorm)) {
        return new Response(JSON.stringify({
          success: false,
          error: "Solo un amministratore può riaprire una pratica chiusa o archiviata.",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (nuovo_stato === "chiuso") {
        const { data: checklistPending } = await supabase
          .from("sinistro_checklist")
          .select("id")
          .eq("sinistro_id", sinistro_id)
          .eq("obbligatorio", true)
          .eq("completato", false);

        if (checklistPending && checklistPending.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Impossibile chiudere: ${checklistPending.length} checklist obbligatorie non completate`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: eventiAttivi } = await supabase
          .from("sinistro_eventi")
          .select("id")
          .eq("sinistro_id", sinistro_id)
          .eq("stato", "attivo");

        if (eventiAttivi && eventiAttivi.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `Impossibile chiudere: ${eventiAttivi.length} eventi ancora attivi`,
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const updateData: Record<string, unknown> = { stato: nuovoNorm, updated_at: new Date().toISOString() };
      if (isStatoChiusuraArchivio(nuovoNorm)) updateData.data_chiusura = new Date().toISOString().split("T")[0];
      else updateData.data_chiusura = null;

      const { error } = await supabase.from("sinistri").update(updateData).eq("id", sinistro_id);
      if (error) throw error;

      // Evento timeline
      await supabase.from("sinistro_eventi").insert({
        sinistro_id,
        tipo_evento: "cambio_stato",
        stato: "completato",
        note: `Stato ${stato_precedente ?? "—"} → ${nuovoNorm}${note ? ` · ${note}` : ""}`,
      });

      // Log attività
      await supabase.from("log_attivita").insert({
        user_id: user_id ?? null,
        azione: isStatoChiusuraArchivio(nuovoNorm) && !isStatoChiusuraArchivio(stato_precedente)
          ? "chiusura_sinistro"
          : "cambio_stato_sinistro",
        entita_tipo: "sinistro",
        entita_id: sinistro_id,
        ufficio_id: prev?.ufficio_id ?? null,
        dettagli_json: { stato_precedente, nuovo_stato: nuovoNorm, note: note ?? null },
        severity: "info",
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (azione === "aggiorna_scaduti") {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sinistro_eventi")
        .update({ stato: "scaduto" })
        .eq("stato", "attivo")
        .lt("data_scadenza", today)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, aggiornati: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
