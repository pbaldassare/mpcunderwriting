// Edge function: chiedi-mie-polizze
// Chat AI per il portale cliente. Aggrega TUTTE le polizze del cliente (titoli +
// polizze_cga approvate con garanzie, condizioni, articoli, definizioni, premi) e
// risponde alle domande citando la polizza di origine. Nessuna rilettura PDF.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAi, aiChatCompletions } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Msg = { role: "user" | "assistant" | "system"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    requireAi();

    const body = await req.json().catch(() => ({}));
    const domanda: string = (body?.domanda ?? "").toString().trim();
    const storico: Msg[] = Array.isArray(body?.storico) ? body.storico.slice(-10) : [];
    if (!domanda) {
      return new Response(JSON.stringify({ error: "Domanda mancante" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Autenticazione richiesta" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // 1. Risolvi clienti del chiamante via RLS
    const { data: clienteIdsRaw } = await supabase.rpc("get_my_cliente_ids");
    const clienteIds: string[] = (clienteIdsRaw || [])
      .map((x: any) => (typeof x === "string" ? x : x?.get_my_cliente_ids ?? x?.id ?? x))
      .filter(Boolean);
    if (!clienteIds.length) {
      return new Response(JSON.stringify({ ok: true, risposta: "Non risulti collegato ad alcun cliente. Non posso interrogare polizze." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Titoli (dati polizza personali)
    const { data: titoli } = await supabase
      .from("titoli")
      .select("id, numero_titolo, prodotto_nome, descrizione_polizza, stato, data_scadenza, durata_da, durata_a, premio_lordo, premio_netto, tasse, periodicita, cig_rif, targa_telaio, compagnie(nome), rami(descrizione)")
      .in("cliente_anagrafica_id", clienteIds)
      .order("data_scadenza", { ascending: false })
      .limit(200);

    // 3. Polizze CGA approvate per i miei clienti
    const { data: polizzeCga } = await supabase
      .from("polizza_cga")
      .select("id, prodotto_id, numero_polizza, sommario_personalizzato, data_decorrenza, data_scadenza, frazionamento, premio_lordo_totale, premio_imponibile_totale, premio_imposte_totale, prodotti_cga:prodotto_id(*)")
      .in("cliente_id", clienteIds)
      .eq("stato", "approvato");

    const polizzeCgaIds = (polizzeCga ?? []).map((p: any) => p.id);
    const prodottiIds = Array.from(new Set((polizzeCga ?? []).map((p: any) => p.prodotto_id).filter(Boolean)));

    const [garPers, garProd, condProd, artProd, defProd, premiGar] = await Promise.all([
      polizzeCgaIds.length ? supabase.from("polizza_garanzie_personali").select("*").in("polizza_cga_id", polizzeCgaIds) : Promise.resolve({ data: [] as any[] }),
      prodottiIds.length ? supabase.from("prodotti_garanzie").select("*").in("prodotto_id", prodottiIds) : Promise.resolve({ data: [] as any[] }),
      prodottiIds.length ? supabase.from("prodotti_condizioni").select("*").in("prodotto_id", prodottiIds) : Promise.resolve({ data: [] as any[] }),
      prodottiIds.length ? supabase.from("prodotti_articoli").select("*").in("prodotto_id", prodottiIds) : Promise.resolve({ data: [] as any[] }),
      prodottiIds.length ? supabase.from("prodotti_definizioni").select("*").in("prodotto_id", prodottiIds) : Promise.resolve({ data: [] as any[] }),
      polizzeCgaIds.length ? supabase.from("polizza_cga_premio_garanzia").select("*").in("polizza_cga_id", polizzeCgaIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    // 4. Costruisci contesto compatto, una entry per polizza CGA
    const polizzeContext = (polizzeCga ?? []).map((p: any) => {
      const prod = p.prodotti_cga ?? {};
      const chiave = `${prod.nome_prodotto ?? "Polizza"}${p.numero_polizza ? " · n° " + p.numero_polizza : ""}${prod.compagnia ? " · " + prod.compagnia : ""}`;
      return {
        polizza_cga_id: p.id,
        chiave_citazione: chiave,
        anagrafica_polizza: {
          numero_polizza: p.numero_polizza,
          decorrenza: p.data_decorrenza,
          scadenza: p.data_scadenza,
          frazionamento: p.frazionamento,
          premio_lordo_totale: p.premio_lordo_totale,
          premio_imponibile_totale: p.premio_imponibile_totale,
          premio_imposte_totale: p.premio_imposte_totale,
        },
        prodotto: prod,
        sommario_personalizzato_cliente: p.sommario_personalizzato,
        garanzie_di_prodotto: (garProd?.data ?? []).filter((g: any) => g.prodotto_id === p.prodotto_id),
        garanzie_personalizzate_cliente: (garPers?.data ?? []).filter((g: any) => g.polizza_cga_id === p.id),
        condizioni_prodotto: (condProd?.data ?? []).filter((c: any) => c.prodotto_id === p.prodotto_id),
        articoli_prodotto: (artProd?.data ?? []).filter((a: any) => a.prodotto_id === p.prodotto_id),
        definizioni_prodotto: (defProd?.data ?? []).filter((d: any) => d.prodotto_id === p.prodotto_id),
        premio_per_garanzia: (premiGar?.data ?? []).filter((g: any) => g.polizza_cga_id === p.id),
      };
    });

    const titoliContext = (titoli ?? []).map((t: any) => ({
      chiave_citazione: `${t.prodotto_nome ?? "Polizza"}${t.numero_titolo ? " · n° " + t.numero_titolo : ""}${t.compagnie?.nome ? " · " + t.compagnie.nome : ""}`,
      numero_titolo: t.numero_titolo,
      prodotto_nome: t.prodotto_nome,
      descrizione_polizza: t.descrizione_polizza,
      stato: t.stato,
      ramo: t.rami?.descrizione,
      compagnia: t.compagnie?.nome,
      decorrenza: t.durata_da,
      scadenza: t.data_scadenza,
      periodicita: t.periodicita,
      premio_lordo: t.premio_lordo,
      premio_netto: t.premio_netto,
      tasse: t.tasse,
      cig: t.cig_rif,
      targa_telaio: t.targa_telaio,
    }));

    const contesto = {
      polizze_amministrative: titoliContext,
      polizze_con_cga_analizzata: polizzeContext,
    };

    const systemPrompt =
      "Sei l'assistente assicurativo personale del cliente. Hai accesso al JSON con TUTTE le sue polizze: " +
      "dati amministrativi (numero, decorrenza, scadenza, premio) e — quando disponibile — i dati CGA strutturati " +
      "(garanzie, massimali, franchigie, condizioni, articoli, definizioni, premi per garanzia). " +
      "REGOLE: " +
      "1) Rispondi SEMPRE usando i dati del contesto. NON chiedere all'utente a quale polizza si riferisce: cerca tu stesso tra TUTTE le polizze quelle pertinenti e elencale. " +
      "2) Se l'utente menziona un evento o un rischio (es. 'grandine', 'furto', 'incendio', 'infortunio', 'cyber', 'RC', 'kasko'), analizza nome_prodotto, ramo, garanzie_di_prodotto, garanzie_personalizzate_cliente, condizioni, articoli e definizioni di OGNI polizza per individuare quelle che coprono quell'evento. Elenca TUTTE le polizze potenzialmente coinvolte con massimali, franchigie e scoperti. " +
      "3) Cita SEMPRE la fonte mettendo a fine frase la chiave_citazione tra parentesi quadre, es: [All Risks Property · n° K24IT018712 · AXA XL]. " +
      "4) Se una garanzia ha override personalizzato (garanzie_personalizzate_cliente) usa quello e segnala '(dato personalizzato)', altrimenti usa il dato di prodotto e indica '(dato di prodotto)'. " +
      "5) Per sinistri: spiega se la garanzia copre l'evento, indica massimali, franchigie, scoperti, eventuali esclusioni o condizioni, e cita l'articolo se presente. " +
      "6) Se l'utente fa una domanda generica (es. 'che polizze ho?'), elenca tutte le polizze del contesto con numero, compagnia, decorrenza e scadenza. " +
      "7) Chiedi chiarimenti SOLO se davvero impossibile rispondere coi dati disponibili (e in quel caso spiega cosa hai trovato e cosa manca). " +
      "8) Lingua: italiano. Tono professionale ma chiaro.";

    const messages: Msg[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: "CONTESTO POLIZZE CLIENTE (JSON):\n" + JSON.stringify(contesto) },
      ...storico,
      { role: "user", content: domanda },
    ];

    const resp = await aiChatCompletions({ model: "google/gemini-2.5-flash", messages });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const risposta = json?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({
      ok: true,
      risposta,
      stats: {
        polizze_amministrative: titoliContext.length,
        polizze_con_cga: polizzeContext.length,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("chiedi-mie-polizze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
