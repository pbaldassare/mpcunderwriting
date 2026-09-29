import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const xmlEscape = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const cleanIban = (s: string) => String(s ?? "").replace(/\s+/g, "").toUpperCase();
const fmtAmt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("metti_in_pagamento"),
    compagnia_id: z.string().uuid(),
    ufficio_id: z.string().uuid().nullable().optional(),
    created_by: z.string().uuid().nullable().optional(),
    data_da: z.string().optional(),
    data_a: z.string().optional(),
    titoli_ids: z.array(z.string().uuid()).optional(),
    note: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("assegna_mittente"),
    rimessa_id: z.string().uuid(),
    conto_bancario_mittente_id: z.string().uuid(),
    iban_utilizzato: z.string().optional(),
  }),
  z.object({
    action: z.literal("rimuovi_titolo"),
    rimessa_id: z.string().uuid(),
    titolo_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("genera_xml_sepa"),
    rimessa_ids: z.array(z.string().uuid()),
    conto_bancario_mittente_id: z.string().uuid(),
    execution_date: z.string().optional(),
    created_by: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("conferma_pagamento"),
    rimessa_ids: z.array(z.string().uuid()).optional(),
    rimessa_id: z.string().uuid().optional(),
    data_valuta: z.string().optional(),
    created_by: z.string().uuid().nullable().optional(),
  }),
  z.object({
    action: z.literal("crea"),
    compagnia_id: z.string().uuid(),
    ufficio_id: z.string().uuid().nullable().optional(),
    created_by: z.string().uuid().nullable().optional(),
    data_da: z.string().optional(),
    data_a: z.string().optional(),
    titoli_ids: z.array(z.string().uuid()).optional(),
    importo_pagato: z.union([z.number(), z.string()]).optional(),
    iban_utilizzato: z.string().nullable().optional(),
    conto_bancario_mittente_id: z.string().uuid().nullable().optional(),
    note: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("annulla"),
    rimessa_id: z.string().uuid(),
    created_by: z.string().uuid().nullable().optional(),
  })
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return json({ error: "Payload non valido" }, 400);
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return json({
        error: "Payload non valido",
        details: parsed.error.flatten(),
      }, 400);
    }

    const {
      action,
      rimessa_id,
      rimessa_ids,
      compagnia_id,
      ufficio_id,
      created_by,
      data_da,
      data_a,
      titoli_ids,
      titolo_id,
      iban_utilizzato,
      importo_pagato,
      note,
      conto_bancario_mittente_id,
      data_valuta,
      execution_date,
    } = parsed.data as any;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ============================================================
    // METTI IN PAGAMENTO (E/C Agenzie → bozza in pagamento)
    // ============================================================
    if (action === "metti_in_pagamento") {
      if (!compagnia_id) throw new Error("compagnia_id richiesto");

      let titoliQ = supabaseAdmin
        .from("titoli")
        .select("id, importo_incassato, premio_lordo")
        .eq("stato", "incassato")
        .eq("compagnia_id", compagnia_id)
        // Pagamento diretto compagnia: il premio è già stato pagato dal cliente
        // alla compagnia → nessun premio da rimettere (resta solo la provvigione).
        .not("pag_diretto_compagnia", "is", true);
      if (titoli_ids && Array.isArray(titoli_ids) && titoli_ids.length > 0) {
        titoliQ = titoliQ.in("id", titoli_ids);
      } else {
        if (data_da) titoliQ = titoliQ.gte("data_messa_cassa", data_da);
        if (data_a) titoliQ = titoliQ.lte("data_messa_cassa", data_a);
      }
      const { data: titoli, error: tErr } = await titoliQ;
      if (tErr) throw tErr;

      const { data: usedTitoli } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .select("titolo_id, rimessa_premi!inner(stato)")
        .neq("rimessa_premi.stato", "annullata");
      const usedIds = new Set((usedTitoli || []).map((r: any) => r.titolo_id));
      const available = (titoli || [])
        .filter((t: any) => !usedIds.has(t.id))
        .map((t: any) => ({
          id: t.id,
          importo: Number(t.importo_incassato ?? t.premio_lordo) || 0,
        }));

      if (available.length === 0) {
        return json({ error: "Nessun titolo disponibile (già incluso in altra rimessa o non incassato)" }, 400);
      }

      const totale = available.reduce((s: number, t: any) => s + t.importo, 0);
      const today = new Date().toISOString().slice(0, 10);

      const { data: rimessa, error: rErr } = await supabaseAdmin
        .from("rimessa_premi")
        .insert({
          compagnia_id,
          ufficio_id: ufficio_id || null,
          created_by: created_by || null,
          totale_importi: Math.round(totale * 100) / 100,
          stato: "in_pagamento",
          data_messa_in_pagamento: today,
          note: note || null,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      const titoloIds = available.map((t: any) => t.id);
      const { data: qMap } = await supabaseAdmin
        .from("quietanze")
        .select("id, titolo_id")
        .in("titolo_id", titoloIds);
      const qByTitolo = new Map<string, string>((qMap || []).map((q: any) => [q.titolo_id, q.id]));
      const dettagli = available.map((t: any) => ({
        rimessa_id: rimessa.id,
        titolo_id: t.id,
        quietanza_id: qByTitolo.get(t.id) ?? null,
        importo: t.importo,
      }));
      const { error: dErr } = await supabaseAdmin.from("rimessa_dettaglio").insert(dettagli);
      if (dErr) throw dErr;


      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "rimessa_in_pagamento",
          entita_tipo: "rimessa_premi",
          entita_id: rimessa.id,
          dettagli_json: { compagnia_id, titoli_count: available.length, totale },
        });
      }

      return json({ rimessa, titoli_count: available.length });
    }

    // ============================================================
    // ASSEGNA MITTENTE (conto Consulbrokers + IBAN destinazione)
    // ============================================================
    if (action === "assegna_mittente") {
      if (!rimessa_id) throw new Error("rimessa_id richiesto");
      if (!conto_bancario_mittente_id) throw new Error("conto_bancario_mittente_id richiesto");

      const { data: conto, error: cErr } = await supabaseAdmin
        .from("conti_bancari")
        .select("id, iban")
        .eq("id", conto_bancario_mittente_id)
        .single();
      if (cErr || !conto) throw new Error("Conto mittente non trovato");

      const update: any = {
        conto_bancario_mittente_id,
        updated_at: new Date().toISOString(),
      };
      if (iban_utilizzato) update.iban_utilizzato = cleanIban(iban_utilizzato);

      const { error: uErr } = await supabaseAdmin
        .from("rimessa_premi")
        .update(update)
        .eq("id", rimessa_id)
        .eq("stato", "in_pagamento");
      if (uErr) throw uErr;

      return json({ success: true });
    }

    // ============================================================
    // RIMUOVI TITOLO da rimessa in_pagamento
    // ============================================================
    if (action === "rimuovi_titolo") {
      if (!rimessa_id || !titolo_id) throw new Error("rimessa_id e titolo_id richiesti");

      const { data: rim } = await supabaseAdmin
        .from("rimessa_premi")
        .select("stato")
        .eq("id", rimessa_id)
        .single();
      if (!rim || rim.stato !== "in_pagamento") {
        throw new Error("Solo rimesse 'in_pagamento' possono essere modificate");
      }

      const { error: dErr } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .delete()
        .eq("rimessa_id", rimessa_id)
        .eq("titolo_id", titolo_id);
      if (dErr) throw dErr;

      // Ricalcola totale
      const { data: dettagli } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .select("importo")
        .eq("rimessa_id", rimessa_id);
      const tot = (dettagli || []).reduce((s: number, r: any) => s + (Number(r.importo) || 0), 0);

      if (!dettagli || dettagli.length === 0) {
        // Nessun titolo rimasto → annulla
        await supabaseAdmin
          .from("rimessa_premi")
          .update({ stato: "annullata", updated_at: new Date().toISOString() })
          .eq("id", rimessa_id);
        return json({ success: true, annullata: true });
      }

      await supabaseAdmin
        .from("rimessa_premi")
        .update({ totale_importi: Math.round(tot * 100) / 100, updated_at: new Date().toISOString() })
        .eq("id", rimessa_id);

      return json({ success: true, totale_importi: tot });
    }

    // ============================================================
    // GENERA XML SEPA SCT pain.001.001.03 per batch (un conto mittente)
    // ============================================================
    if (action === "genera_xml_sepa") {
      const ids: string[] = Array.isArray(rimessa_ids) ? rimessa_ids : [];
      if (ids.length === 0) throw new Error("rimessa_ids richiesto");
      if (!conto_bancario_mittente_id) throw new Error("conto_bancario_mittente_id richiesto");

      const { data: conto, error: cErr } = await supabaseAdmin
        .from("conti_bancari")
        .select("*")
        .eq("id", conto_bancario_mittente_id)
        .single();
      if (cErr || !conto) throw new Error("Conto mittente non trovato");

      const { data: rimesse, error: rErr } = await supabaseAdmin
        .from("rimessa_premi")
        .select("id, totale_importi, iban_utilizzato, note, compagnie(nome, iban, intestato_a, bic)")
        .in("id", ids)
        .eq("stato", "in_pagamento");
      if (rErr) throw rErr;
      if (!rimesse || rimesse.length === 0) throw new Error("Nessuna rimessa eleggibile");

      // Validazioni minime
      for (const r of rimesse) {
        const ibanDest = cleanIban((r as any).iban_utilizzato || (r as any).compagnie?.iban || "");
        if (!ibanDest) throw new Error(`Rimessa ${r.id.slice(0, 8)} senza IBAN destinazione`);
      }

      const msgId = `RIM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const creDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, "");
      const reqdExctnDt = (execution_date || new Date().toISOString().slice(0, 10));
      const ctrlSum = rimesse.reduce((s: number, r: any) => s + (Number(r.totale_importi) || 0), 0);
      const nbOfTxs = rimesse.length;

      const dbtrName = xmlEscape(conto.intestato_a || conto.etichetta || "Consulbrokers");
      const dbtrIban = cleanIban(conto.iban || "");
      const dbtrBic = conto.bic ? xmlEscape(conto.bic) : "";

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n`;
      xml += `  <CstmrCdtTrfInitn>\n`;
      xml += `    <GrpHdr>\n`;
      xml += `      <MsgId>${msgId}</MsgId>\n`;
      xml += `      <CreDtTm>${creDtTm}</CreDtTm>\n`;
      xml += `      <NbOfTxs>${nbOfTxs}</NbOfTxs>\n`;
      xml += `      <CtrlSum>${fmtAmt(ctrlSum)}</CtrlSum>\n`;
      xml += `      <InitgPty><Nm>${dbtrName}</Nm></InitgPty>\n`;
      xml += `    </GrpHdr>\n`;
      xml += `    <PmtInf>\n`;
      xml += `      <PmtInfId>${msgId}-PMT</PmtInfId>\n`;
      xml += `      <PmtMtd>TRF</PmtMtd>\n`;
      xml += `      <BtchBookg>true</BtchBookg>\n`;
      xml += `      <NbOfTxs>${nbOfTxs}</NbOfTxs>\n`;
      xml += `      <CtrlSum>${fmtAmt(ctrlSum)}</CtrlSum>\n`;
      xml += `      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>\n`;
      xml += `      <ReqdExctnDt>${reqdExctnDt}</ReqdExctnDt>\n`;
      xml += `      <Dbtr><Nm>${dbtrName}</Nm></Dbtr>\n`;
      xml += `      <DbtrAcct><Id><IBAN>${dbtrIban}</IBAN></Id></DbtrAcct>\n`;
      xml += dbtrBic
        ? `      <DbtrAgt><FinInstnId><BIC>${dbtrBic}</BIC></FinInstnId></DbtrAgt>\n`
        : `      <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>\n`;
      xml += `      <ChrgBr>SLEV</ChrgBr>\n`;

      let i = 0;
      for (const r of rimesse as any[]) {
        i++;
        const cdtrName = xmlEscape(r.compagnie?.intestato_a || r.compagnie?.nome || "Beneficiario");
        const cdtrIban = cleanIban(r.iban_utilizzato || r.compagnie?.iban || "");
        const cdtrBic = r.compagnie?.bic ? xmlEscape(r.compagnie.bic) : "";
        const amt = fmtAmt(r.totale_importi);
        const endToEnd = `RIM-${r.id.slice(0, 8).toUpperCase()}`;
        const rmtInf = xmlEscape(r.note || `Rimessa premi ${r.compagnie?.nome || ""}`).slice(0, 140);

        xml += `      <CdtTrfTxInf>\n`;
        xml += `        <PmtId><EndToEndId>${endToEnd}</EndToEndId></PmtId>\n`;
        xml += `        <Amt><InstdAmt Ccy="EUR">${amt}</InstdAmt></Amt>\n`;
        xml += cdtrBic
          ? `        <CdtrAgt><FinInstnId><BIC>${cdtrBic}</BIC></FinInstnId></CdtrAgt>\n`
          : `        <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>\n`;
        xml += `        <Cdtr><Nm>${cdtrName}</Nm></Cdtr>\n`;
        xml += `        <CdtrAcct><Id><IBAN>${cdtrIban}</IBAN></Id></CdtrAcct>\n`;
        xml += `        <RmtInf><Ustrd>${rmtInf}</Ustrd></RmtInf>\n`;
        xml += `      </CdtTrfTxInf>\n`;
        void i;
      }

      xml += `    </PmtInf>\n`;
      xml += `  </CstmrCdtTrfInitn>\n`;
      xml += `</Document>\n`;

      // Salva file su storage 'rimesse-pdf' (riusiamo bucket esistente)
      const fileName = `${msgId}.xml`;
      const filePath = `flussi-sepa/${fileName}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("rimesse-pdf")
        .upload(filePath, new Blob([xml], { type: "application/xml" }), {
          upsert: true,
          contentType: "application/xml",
        });
      if (upErr) throw upErr;

      const { data: signed } = await supabaseAdmin.storage
        .from("rimesse-pdf")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      // Inserisci documento "Flusso SEPA"
      const { data: doc, error: docErr } = await supabaseAdmin
        .from("documenti")
        .insert({
          nome_file: fileName,
          path_storage: filePath,
          bucket_name: "rimesse-pdf",
          categoria: "Flusso SEPA",
          entita_tipo: "rimessa_premi",
          entita_id: ids[0],
          visibile_al_cliente: false,
          caricato_da: created_by || null,
        } as any)
        .select("id")
        .single();
      if (docErr) throw docErr;

      // Aggiorna ogni rimessa: stato pronta, xml_output, flusso_xml_id
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("rimessa_premi")
        .update({
          stato: "pronta",
          xml_output: xml,
          flusso_xml_id: doc?.id || null,
          updated_at: nowIso,
        })
        .in("id", ids);

      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "genera_xml_sepa",
          entita_tipo: "rimessa_premi",
          entita_id: ids[0],
          dettagli_json: { rimessa_ids: ids, msg_id: msgId, totale: ctrlSum, conto_bancario_mittente_id },
        });
      }

      return json({
        success: true,
        msg_id: msgId,
        xml,
        file_url: signed?.signedUrl || null,
        file_path: filePath,
        documento_id: doc?.id || null,
      });
    }

    // ============================================================
    // CONFERMA PAGAMENTO (rimesse pronta → pagata)
    // ============================================================
    if (action === "conferma_pagamento") {
      const ids: string[] = Array.isArray(rimessa_ids) ? rimessa_ids : (rimessa_id ? [rimessa_id] : []);
      if (ids.length === 0) throw new Error("rimessa_ids richiesto");

      const dataPagamento = data_valuta || new Date().toISOString().slice(0, 10);

      const { data: rimesse } = await supabaseAdmin
        .from("rimessa_premi")
        .select("id, totale_importi, stato")
        .in("id", ids);

      for (const r of rimesse || []) {
        if (!["in_pagamento", "pronta"].includes((r as any).stato)) continue;
        await supabaseAdmin
          .from("rimessa_premi")
          .update({
            stato: "pagata",
            data_pagamento_rimessa: dataPagamento,
            importo_pagato: (r as any).totale_importi,
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.id);
      }

      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "conferma_pagamento_rimessa",
          entita_tipo: "rimessa_premi",
          entita_id: ids[0],
          dettagli_json: { rimessa_ids: ids, data_valuta: dataPagamento },
        });
      }

      return json({ success: true, count: ids.length });
    }

    // ============================================================
    // CREA (legacy: paga immediato — usato da E/C Compagnia)
    // ============================================================
    if (action === "crea") {
      if (!compagnia_id) throw new Error("compagnia_id richiesto");

      let available: { id: string; importo: number }[] = [];

      let q = supabaseAdmin
        .from("titoli")
        .select("id, importo_incassato, premio_lordo")
        .eq("stato", "incassato")
        .eq("compagnia_id", compagnia_id)
        // Pagamento diretto compagnia: nessun premio da rimettere.
        .not("pag_diretto_compagnia", "is", true);
      if (titoli_ids && Array.isArray(titoli_ids) && titoli_ids.length > 0) {
        q = q.in("id", titoli_ids);
      } else {
        if (data_da) q = q.gte("data_messa_cassa", data_da);
        if (data_a) q = q.lte("data_messa_cassa", data_a);
      }
      const { data: titoli, error: tErr } = await q;
      if (tErr) throw tErr;

      const { data: usedTitoli } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .select("titolo_id, rimessa_premi!inner(stato)")
        .neq("rimessa_premi.stato", "annullata");
      const usedIds = new Set((usedTitoli || []).map((r: any) => r.titolo_id));
      available = (titoli || [])
        .filter((t: any) => !usedIds.has(t.id))
        .map((t: any) => ({
          id: t.id,
          importo: Number(t.importo_incassato ?? t.premio_lordo) || 0,
        }));

      if (available.length === 0) return json({ error: "Nessun titolo disponibile" }, 400);

      const totale = available.reduce((s: number, t: any) => s + t.importo, 0);
      const totalePagato = importo_pagato != null ? Number(importo_pagato) : totale;
      const today = new Date().toISOString().slice(0, 10);

      const { data: rimessa, error: rErr } = await supabaseAdmin
        .from("rimessa_premi")
        .insert({
          compagnia_id,
          ufficio_id: ufficio_id || null,
          created_by: created_by || null,
          totale_importi: Math.round(totale * 100) / 100,
          importo_pagato: Math.round(totalePagato * 100) / 100,
          stato: "pagata",
          iban_utilizzato: iban_utilizzato || null,
          conto_bancario_mittente_id: conto_bancario_mittente_id || null,
          data_pagamento_rimessa: today,
          note: note || null,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      const titoloIdsB = available.map((t: any) => t.id);
      const { data: qMapB } = await supabaseAdmin
        .from("quietanze")
        .select("id, titolo_id")
        .in("titolo_id", titoloIdsB);
      const qByTitoloB = new Map<string, string>((qMapB || []).map((q: any) => [q.titolo_id, q.id]));
      const dettagli = available.map((t: any) => ({
        rimessa_id: rimessa.id,
        titolo_id: t.id,
        quietanza_id: qByTitoloB.get(t.id) ?? null,
        importo: t.importo,
      }));
      const { error: dErr } = await supabaseAdmin.from("rimessa_dettaglio").insert(dettagli);
      if (dErr) throw dErr;


      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "pagamento_rimessa",
          entita_tipo: "rimessa_premi",
          entita_id: rimessa.id,
          dettagli_json: { compagnia_id, titoli_count: available.length, totale, importo_pagato: totalePagato },
        });
      }

      return json({ rimessa, titoli_count: available.length });
    }

    // ============================================================
    // ANNULLA
    // ============================================================
    if (action === "annulla") {
      if (!rimessa_id) throw new Error("rimessa_id richiesto");

      const { error: delErr } = await supabaseAdmin
        .from("rimessa_dettaglio")
        .delete()
        .eq("rimessa_id", rimessa_id);
      if (delErr) throw delErr;

      const { error: updErr } = await supabaseAdmin
        .from("rimessa_premi")
        .update({ stato: "annullata", updated_at: new Date().toISOString() })
        .eq("id", rimessa_id);
      if (updErr) throw updErr;

      if (created_by) {
        await supabaseAdmin.from("log_attivita").insert({
          user_id: created_by,
          azione: "annullamento_rimessa",
          entita_tipo: "rimessa_premi",
          entita_id: rimessa_id,
        });
      }

      return json({ success: true, stato: "annullata" });
    }

    throw new Error(`Azione non valida: ${action}`);
  } catch (err: any) {
    return json({ error: err.message || String(err) }, 400);
  }
});
