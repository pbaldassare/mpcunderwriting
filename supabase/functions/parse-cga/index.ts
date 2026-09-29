// Edge function: parse-cga
// Estrae da un PDF di Condizioni Generali Assicurazione (CGA) i dati di
// PRODOTTO (condivisi tra clienti) e i DATI PERSONALI (override per cliente).
// Usa Lovable AI Gateway (Gemini) con tool calling per output strutturato.

import { requireAi, aiChatCompletions, buildDocumentUserContent, getAiModelChain } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOOL = {
  name: "extract_cga",
  description:
    "Estrae dati di prodotto (CGA standard) e dati personali (override cliente) da una scheda/CGA assicurativa italiana.",
  parameters: {
    type: "object",
    properties: {
      prodotto: {
        type: "object",
        description: "Identificazione del prodotto assicurativo (dati GENERICI condivisi)",
        properties: {
          nome_prodotto: { type: "string", description: "Es. 'REVO SpecialtyXCyber Risk'" },
          compagnia: { type: "string" },
          ramo: { type: "string", description: "Descrizione ramo (es. 'Cyber', 'Incendio')" },
          edizione: { type: "string", description: "Edizione/versione CGA (es. 'ed. 12/2025')" },
          codice_modello: { type: "string", description: "Codice modello sul PDF (es. 'Mod. R040 Ed. 01.2026')" },
          compagnia_email_servizio_clienti: { type: "string" },
          compagnia_url_area_personale: { type: "string" },
          compagnia_ivass_albo: { type: "string", description: "Numero iscrizione Albo IVASS" },
          compagnia_gruppo_ivass: { type: "string" },
          compagnia_pec: { type: "string" },
          compagnia_telefono: { type: "string" },
          compagnia_sede_legale: { type: "string" },
          compagnia_sede_operativa: { type: "string" },
          forma_copertura: {
            type: "string",
            enum: [
              "claims_made",
              "loss_occurrence",
              "primo_rischio_assoluto",
              "primo_rischio_relativo",
              "valore_intero",
              "valore_a_nuovo",
              "secondo_rischio",
              "altro",
            ],
          },
          periodo_retroattivita_mesi: { type: "number" },
          massimale_aggregato_annuo: { type: "number" },
          oggetto_assicurazione: { type: "string", description: "Cosa copre il prodotto in 1-3 frasi" },
          ambito_territoriale: { type: "string", description: "Es. 'Italia', 'UE', 'Mondo intero'" },
          termine_prescrizione_mesi: { type: "number" },
          termini_pagamento_premio_giorni: { type: "number", description: "Giorni di mora pagamento premio" },
          diritto_recesso_descrizione: { type: "string" },
          foro_competente: { type: "string" },
          regime_fiscale: { type: "string", description: "Es. aliquota imposta e SSN" },
          limiti_eta_assicurato_min: { type: "number" },
          limiti_eta_assicurato_max: { type: "number" },
          clausola_broker: { type: "string" },
          note_legali: { type: "string", description: "Riferimenti normativi sintetici" },
          sommario_ai: { type: "string", description: "Riassunto leggibile in 3-6 frasi del prodotto" },
        },
        required: ["nome_prodotto"],
      },
      articoli_prodotto: {
        type: "array",
        description: "Articoli normativi numerati (Norme comuni, Come è prestata l'assicurazione, ecc.)",
        items: {
          type: "object",
          properties: {
            sezione: { type: "string", description: "Es. 'Norme comuni', 'Come è prestata l'assicurazione'" },
            numero: { type: "string", description: "Es. '1.7', '2.11'" },
            titolo: { type: "string" },
            testo: { type: "string" },
            ordine: { type: "number" },
          },
          required: ["testo"],
        },
      },
      riferimenti_normativi: {
        type: "array",
        description: "Leggi, decreti, articoli di codice citati nel testo",
        items: {
          type: "object",
          properties: {
            riferimento: { type: "string", description: "Es. 'D.Lgs. 209/2005', 'art. 1917 c.c.'" },
            contesto: { type: "string", description: "Breve descrizione del perché è citato" },
          },
          required: ["riferimento"],
        },
      },
      garanzie_prodotto: {
        type: "array",
        description: "Garanzie standard previste dal prodotto",
        items: {
          type: "object",
          properties: {
            garanzia: { type: "string" },
            massimale_standard: { type: "number" },
            franchigia_standard: { type: "number" },
            scoperto_percentuale: { type: "number" },
            sottolimite: { type: "number" },
            franchigia_temporale_giorni: { type: "number" },
            aggregato_annuo: { type: "number" },
            ambito_territoriale: { type: "string" },
            note: { type: "string" },
          },
          required: ["garanzia"],
        },
      },
      condizioni_prodotto: {
        type: "array",
        description: "Condizioni generali rilevanti (esclusioni, apertura sinistro, obblighi, termini denuncia)",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: ["apertura_sinistro", "esclusione", "obbligo_assicurato", "termine_denuncia", "altro"],
            },
            titolo: { type: "string" },
            testo: { type: "string" },
            rilevante_sinistri: { type: "boolean" },
          },
          required: ["tipo", "testo"],
        },
      },
      definizioni_prodotto: {
        type: "array",
        description: "Glossario / definizioni dei termini chiave del prodotto",
        items: {
          type: "object",
          properties: {
            termine: { type: "string" },
            definizione: { type: "string" },
          },
          required: ["termine", "definizione"],
        },
      },
      dati_personali: {
        type: "object",
        description: "Dati specifici di QUESTA polizza/cliente (non condivisi)",
        properties: {
          sommario_personalizzato: { type: "string", description: "Riepilogo SOLO delle differenze rispetto allo standard" },
          numero_polizza: { type: "string" },
          contraente_ragione_sociale: { type: "string" },
          contraente_piva: { type: "string" },
          contraente_cf: { type: "string" },
          contraente_indirizzo: { type: "string" },
          contraente_cap: { type: "string" },
          contraente_comune: { type: "string" },
          contraente_provincia: { type: "string" },
          contraente_email: { type: "string" },
          assicurato_descrizione: { type: "string", description: "Solo se diverso dal contraente" },
          data_decorrenza: { type: "string", description: "ISO yyyy-mm-dd" },
          data_scadenza: { type: "string", description: "ISO yyyy-mm-dd" },
          data_emissione: { type: "string", description: "ISO yyyy-mm-dd" },
          tacito_rinnovo: { type: "boolean" },
          cig: { type: "string" },
          cup: { type: "string" },
          frazionamento: {
            type: "string",
            enum: ["Annuale", "Semestrale", "Quadrimestrale", "Trimestrale", "Bimestrale", "Mensile", "Poliennale", "Unica"],
          },
          intermediario_nome: { type: "string" },
          intermediario_indirizzo: { type: "string" },
          intermediario_telefono: { type: "string" },
          intermediario_email: { type: "string" },
          premio_imponibile_totale: { type: "number" },
          premio_imposte_totale: { type: "number" },
          premio_lordo_totale: { type: "number" },
          premio_rata_sottoscrizione_lordo: { type: "number" },
          premio_rate_successive_lordo: { type: "number" },
          forma_copertura: {
            type: "string",
            description: "Forma di copertura di QUESTA polizza (può differire dal prodotto)",
            enum: [
              "claims_made",
              "loss_occurrence",
              "primo_rischio_assoluto",
              "primo_rischio_relativo",
              "valore_intero",
              "valore_a_nuovo",
              "secondo_rischio",
              "altro",
            ],
          },
          forma_copertura_note: { type: "string", description: "Es. 'all risks salvo esclusioni'" },
        },
      },
      partite: {
        type: "array",
        description: "Partite del certificato con somme assicurate (Partita 1 Fabbricato, Partita 2 Contenuto, …)",
        items: {
          type: "object",
          properties: {
            numero: { type: "number" },
            codice: { type: "string" },
            descrizione: { type: "string" },
            tipo_bene: {
              type: "string",
              enum: ["fabbricato", "contenuto", "merci", "macchinari", "ricorso_terzi", "fermo", "altro"],
            },
            ubicazione: { type: "string" },
            somma_assicurata: { type: "number" },
            valuta: { type: "string" },
            forma_assicurazione: {
              type: "string",
              enum: ["valore_intero", "primo_rischio_assoluto", "primo_rischio_relativo", "valore_a_nuovo", "altro"],
            },
            percentuale_scoperto: { type: "number" },
            franchigia: { type: "number" },
            fonte_testo: { type: "string" },
          },
          required: ["descrizione"],
        },
      },
      beni_esclusi: {
        type: "array",
        description: "Beni / cose esplicitamente non coperti",
        items: {
          type: "object",
          properties: {
            partita_numero: { type: "number", description: "Numero partita se l'esclusione è solo su quella" },
            descrizione: { type: "string" },
            motivo: { type: "string" },
            fonte_testo: { type: "string" },
          },
          required: ["descrizione"],
        },
      },
      esclusioni_polizza: {
        type: "array",
        description: "Esclusioni di QUESTA polizza (generali, per garanzia o per partita). Non duplicare il solo catalogo CGA se identiche.",
        items: {
          type: "object",
          properties: {
            livello: { type: "string", enum: ["generale", "garanzia", "partita"] },
            partita_numero: { type: "number" },
            garanzia: { type: "string" },
            articolo: { type: "string" },
            titolo: { type: "string" },
            testo: { type: "string" },
            rilevante_sinistri: { type: "boolean" },
            fonte_testo: { type: "string" },
          },
          required: ["testo"],
        },
      },
      sottolimiti: {
        type: "array",
        description: "Sottolimiti di indennizzo (una riga per limite)",
        items: {
          type: "object",
          properties: {
            partita_numero: { type: "number" },
            garanzia: { type: "string" },
            voce: { type: "string", description: "Es. 'acqua condotta', 'furto con destrezza'" },
            importo: { type: "number" },
            percentuale: { type: "number" },
            base_calcolo: { type: "string", enum: ["somma_partita", "massimale", "danno", "altro"] },
            per: { type: "string", enum: ["sinistro", "anno", "ubicazione", "persona"] },
            franchigia: { type: "number" },
            scoperto_pct: { type: "number" },
            minimo: { type: "number" },
            massimo: { type: "number" },
            fonte_testo: { type: "string" },
          },
          required: ["voce"],
        },
      },
      premio_calcolo: {
        type: "array",
        description: "Calcolo premio voce per voce (tasso × somma, imposte, formula sul PDF)",
        items: {
          type: "object",
          properties: {
            partita_numero: { type: "number" },
            garanzia: { type: "string" },
            base_imponibile: { type: "number" },
            tasso: { type: "number" },
            tasso_unita: { type: "string", enum: ["per_mille", "percento"] },
            premio_imponibile: { type: "number" },
            aliquota_imposte_pct: { type: "number" },
            imposte: { type: "number" },
            ssn: { type: "number" },
            premio_lordo: { type: "number" },
            tipo_rata: { type: "string", enum: ["annuo", "sottoscrizione", "successiva"] },
            regolazione: { type: "boolean" },
            parametro_regolazione: { type: "string" },
            premio_minimo: { type: "number" },
            formula_fonte: { type: "string", description: "Es. '1,20‰ su € 1.500.000'" },
          },
        },
      },
      garanzie_personali: {
        type: "array",
        description: "Override per garanzia: includi SOLO le voci che differiscono dallo standard",
        items: {
          type: "object",
          properties: {
            garanzia: { type: "string", description: "Nome garanzia, deve combaciare con garanzie_prodotto" },
            massimale_personalizzato: { type: "number" },
            franchigia_personalizzata: { type: "number" },
            scoperto_personalizzato: { type: "number" },
            note_personali: { type: "string" },
          },
          required: ["garanzia"],
        },
      },
      premio_per_garanzia: {
        type: "array",
        description: "Composizione del premio voce per voce. Separa 'sottoscrizione' (rata alla firma) e 'successiva' (rate successive).",
        items: {
          type: "object",
          properties: {
            garanzia: { type: "string" },
            tipo_rata: { type: "string", enum: ["sottoscrizione", "successiva"] },
            imponibile: { type: "number" },
            imposte: { type: "number" },
            lordo: { type: "number" },
          },
          required: ["garanzia", "tipo_rata"],
        },
      },
      testo_completo: {
        type: "string",
        description: "Testo integrale del CGA estratto dal PDF (può essere lungo)",
      },
    },
    required: ["prodotto"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    requireAi();

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = await buildDocumentUserContent({
      mimeType,
      fileBase64,
      instruction: "Analizza questa polizza/CGA ed estrai i dati strutturati: prodotto, anagrafica, partite, somme assicurate, forma di copertura, beni esclusi, esclusioni, sottolimiti e calcolo premio.",
      filename: "cga.pdf",
    });
    const messages = [
      {
        role: "system",
        content:
          "Sei un esperto di polizze e CGA italiane. Estrai: 1) dati di PRODOTTO condivisi; 2) DATI PERSONALI di questa polizza; 3) scheda tecnica del certificato: partite, somme assicurate, forma di copertura, beni esclusi, esclusioni, sottolimiti di indennizzo, calcolo del premio (tasso × somma). Non inventare valori: se mancano, ometti il campo.",
      },
      { role: "user", content: userContent },
    ];

    const callGateway = async (model: string, msgs: unknown[]) => {
      return await aiChatCompletions({
          model,
          messages: msgs,
          tools: [{ type: "function", function: TOOL }],
          tool_choice: { type: "function", function: { name: TOOL.name } },
      });
    };

    const modelChain = getAiModelChain(["google/gemini-3-flash-preview", "google/gemini-2.5-flash"]);
    let resp: Response | null = null;
    let lastErrText = "";
    let lastStatus = 0;
    outer: for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        resp = await callGateway(model, messages);
        if (resp.ok) break outer;
        lastStatus = resp.status;
        lastErrText = await resp.text();
        console.error(`AI gateway ${model} attempt ${attempt + 1} status ${resp.status}`, lastErrText.slice(0, 200));
        if (resp.status === 429 || resp.status === 402) break outer;
        if (resp.status >= 500) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        break;
      }
    }

    // Tier 3 (fallback): estrai testo dal PDF lato server con unpdf e invia text-only.
    // Funziona anche su PDF cifrati "owner-only" (print:yes, copy:no) e su PDF molto lunghi.
    if ((!resp || !resp.ok) && mimeType === "application/pdf") {
      try {
        console.log("Fallback Tier 3: estrazione testo lato server con unpdf");
        const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
        const bin = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const pdf = await getDocumentProxy(bin);
        const { text } = await extractText(pdf, { mergePages: true });
        const trimmed = String(text ?? "").slice(0, 180_000); // ~180k chars per stare nel context
        if (trimmed.trim().length < 50) {
          throw new Error("Estrazione testo vuota (PDF scansionato o protetto)");
        }
        const textMessages = [
          messages[0],
          {
            role: "user",
            content: `Analizza il testo seguente di Condizioni Generali Assicurazione (CGA) ed estrai i dati strutturati richiesti.\n\n--- INIZIO CGA ---\n${trimmed}\n--- FINE CGA ---`,
          },
        ];
        const textModels = getAiModelChain(["google/gemini-3-flash-preview", "google/gemini-2.5-flash"]);
        for (const model of textModels) {
          resp = await callGateway(model, textMessages);
          if (resp.ok) break;
          lastStatus = resp.status;
          lastErrText = await resp.text();
          console.error(`Fallback text ${model} status ${resp.status}`, lastErrText.slice(0, 200));
        }
      } catch (fbErr) {
        console.error("Fallback unpdf error", fbErr);
      }
    }

    if (!resp || !resp.ok) {
      const status = resp?.status ?? lastStatus ?? 500;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato. Riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Aggiungi credito al workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        error: "Impossibile analizzare il PDF: il servizio AI è sovraccarico oppure il PDF è una scansione senza testo. Riprova tra qualche secondo o carica una versione con testo selezionabile.",
        details: lastErrText.slice(0, 300),
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : (args ?? {});
    } catch (e) {
      console.error("parse args fail", e);
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-cga error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
