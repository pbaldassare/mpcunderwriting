// Edge function: parse-polizza-completa
// Estrae dati completi di una scheda di polizza italiana (qualsiasi ramo) via Gemini.
// Per RCA Auto estrae anche dati veicolo + conducente.
// Include matching fuzzy lato server per i sottorami (synonyms + token-overlap).

import { requireAi, aiChatCompletions, buildDocumentUserContent } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "extract_polizza_completa",
  description:
    "Estrae i dati completi di una scheda di polizza assicurativa italiana: contraente, compagnia, dati polizza, premi, ramo, garanzie. Per RCA Auto include dati veicolo e conducente.",
  parameters: {
    type: "object",
    properties: {
      // Compagnia / intermediario
      compagnia: { type: "string", description: "Denominazione completa della compagnia assicuratrice (es. 'AmTrust Assicurazioni S.p.A.')" },
      intermediario: { type: "string", description: "Nome del broker/intermediario se indicato (es. 'CONSULBROKERS S.P.A.')" },
      codice_nodo: { type: "string", description: "Codice nodo dell'intermediario" },

      // Contraente
      contraente_nome: { type: "string", description: "Nome e cognome OPPURE ragione sociale del contraente" },
      contraente_codice_fiscale: { type: "string", description: "Codice fiscale del contraente (16 caratteri o 11 per persona giuridica)" },
      contraente_partita_iva: { type: "string" },
      contraente_indirizzo: { type: "string", description: "Indirizzo (via e numero civico)" },
      contraente_comune: { type: "string" },
      contraente_provincia: { type: "string", description: "Sigla provincia (2 lettere)" },
      contraente_cap: { type: "string" },
      contraente_nazione: { type: "string", description: "Codice ISO nazione (es. IT)" },
      contraente_email: { type: "string" },
      contraente_telefono: { type: "string" },

      // Polizza
      numero_polizza: { type: "string" },
      polizza_sostituita: { type: "string", description: "Numero della polizza sostituita se presente" },
      prodotto: { type: "string", description: "Nome/descrizione del prodotto assicurativo" },
      ramo_descrizione: { type: "string", description: "Descrizione del ramo assicurativo dedotto dal documento" },

      // Periodo
      decorrenza: { type: "string", description: "Data inizio copertura YYYY-MM-DD" },
      scadenza: { type: "string", description: "Data fine copertura YYYY-MM-DD" },
      prossima_quietanza: { type: "string", description: "Data prossima quietanza YYYY-MM-DD" },
      frazionamento: { type: "string", description: "Annuale | Semestrale | Quadrimestrale | Trimestrale | Mensile | Poliennale" },
      tacito_rinnovo: { type: "boolean" },

      // Premi alla firma
      premio_firma_netto: { type: "number" },
      premio_firma_accessori: { type: "number" },
      premio_firma_imposte: { type: "number" },
      premio_firma_lordo: { type: "number" },

      // Premi rate future / quietanza
      premio_quietanza_netto: { type: "number" },
      premio_quietanza_accessori: { type: "number" },
      premio_quietanza_imposte: { type: "number" },
      premio_quietanza_lordo: { type: "number" },

      // RCA-specifici (opzionali)
      targa: { type: "string", description: "Targa veicolo (anche se RCA Auto compila SEMPRE anche il blocco veicolo)" },

      // Blocco VEICOLO completo (compilare SOLO se polizza RCA Auto / ramo ZQ)
      veicolo: {
        type: "object",
        description:
          "Compila SOLO se la polizza è RCA Auto o ramo veicoli (ZQ). Estrai dalla sezione 'Dati veicolo' / 'Identificativi veicolo' / 'Caratteristiche veicolo'.",
        properties: {
          targa: { type: "string", description: "Targa (maiuscolo, senza spazi)" },
          telaio: { type: "string", description: "Numero di telaio / VIN" },
          marca: { type: "string", description: "Marca veicolo (es. FIAT, FORD)" },
          modello: { type: "string", description: "Modello (es. PANDA, FOCUS)" },
          versione: { type: "string" },
          descrizione: { type: "string", description: "Descrizione completa veicolo se separata da marca/modello" },
          tipo_veicolo: {
            type: "string",
            description: "Uno tra: AUTOVETTURA, AUTOTASSAMETRO, AUTOBUS, AUTOCARRO, CICLOMOTORE, MOTOCICLO, MACCHINA OPERATRICE, MACCHINA AGRICOLA, NATANTE, RIMORCHIO, CARRELLO, AUTOARTICOLATO, CAMPER, QUADRICICLO",
          },
          uso_descrizione: { type: "string", description: "Descrizione dell'uso veicolo (es. 'USO PRIVATO', 'TRASPORTO COSE IN CONTO PROPRIO', 'AUTOSCUOLA')" },
          data_immatricolazione: { type: "string", description: "Data prima immatricolazione YYYY-MM-DD" },
          anno_acquisto: { type: "string", description: "Anno di acquisto (YYYY)" },
          provincia_circolazione: { type: "string", description: "Sigla provincia 2 lettere maiuscole" },
          classe_bm: { type: "string", description: "Classe Bonus/Malus CU (1-18)" },
          cv: { type: "number" },
          kw: { type: "number" },
          cc: { type: "number", description: "Cilindrata cm³" },
          posti: { type: "number" },
          peso_motrice: { type: "number" },
          peso_rimorchio: { type: "number" },
          peso_totale: { type: "number" },
          alimentazione: {
            type: "string",
            description: "BENZINA | DIESEL | GPL | METANO | ELETTRICA | IBRIDA | IBRIDA_BENZINA | IBRIDA_DIESEL",
          },
          tipologia_guida: { type: "string", description: "Es: ESPERTA, LIBERA, ESCLUSIVA" },
          franchigia: { type: "number", description: "Importo franchigia RCA in euro" },
          massimale_1: { type: "number", description: "Massimale principale RCA (es. 6.450.000)" },
          massimale_2: { type: "number", description: "Massimale persone (se distinto)" },
          massimale_3: { type: "number", description: "Massimale cose (se distinto)" },
          peius: { type: "boolean", description: "Clausola peius presente" },
          temporanea: { type: "boolean", description: "Polizza temporanea" },
          carico_scarico: { type: "boolean", description: "Rischio carico/scarico operante" },
          competizione: { type: "boolean", description: "Veicolo da competizione" },
          rimorchio: { type: "boolean", description: "Con rimorchio" },
        },
        additionalProperties: false,
      },


      // Blocco CONDUCENTE (solo RCA Auto)
      conducente: {
        type: "object",
        description: "Compila SOLO se la polizza è RCA Auto e i dati del conducente abituale sono presenti.",
        properties: {
          nome: { type: "string" },
          cognome: { type: "string" },
          codice_fiscale: { type: "string" },
          indirizzo: { type: "string" },
          cap: { type: "string" },
          citta: { type: "string" },
          provincia: { type: "string", description: "Sigla 2 lettere" },
          data_nascita: { type: "string", description: "YYYY-MM-DD" },
          tipo_patente: { type: "string", description: "Es: A, B, C, D, BE, CE" },
          data_rilascio_patente: { type: "string", description: "YYYY-MM-DD" },
          note: { type: "string" },
        },
        additionalProperties: false,
      },

      // Garanzie operanti
      garanzie: {
        type: "array",
        description:
          "Elenco voci di garanzia OPERANTI con premio (flag = SI / Operante). Ogni voce verrà mappata a un Sottoramo del catalogo. Ignora garanzie non attive.",
        items: {
          type: "object",
          properties: {
            descrizione: { type: "string", description: "Descrizione della garanzia esattamente come sul documento" },
            codice_sottoramo: {
              type: "string",
              description:
                "OBBLIGATORIO mappare al `codice` di uno dei sottorami ammessi forniti nel prompt utente. Se non sei sicuro, OMETTI il campo: non inventare codici.",
            },
            premio_netto: { type: "number" },
            premio_imposte: { type: "number", description: "Imposte/tasse della singola voce, se indicate" },
            aliquota_tasse_pct: { type: "number", description: "Aliquota imposte % della voce" },
            ssn: { type: "number", description: "Contributo SSN della voce in €, se esplicitamente presente" },
          },
          required: ["descrizione"],
          additionalProperties: false,
        },
      },
    },
    required: ["numero_polizza"],
    additionalProperties: false,
  },
};

// ===== Synonyms per sottorami ZQ (R.C.A.) =====
const ZQ_SYNONYMS: Array<{ re: RegExp; code: string }> = [
  { re: /cristall|vetri|rottura\s+vetr/i, code: "EC" },
  { re: /kasko|collision|garanzia\s+collision/i, code: "QK" },
  { re: /incend|furt|rapin/i, code: "QI" },
  { re: /grandin|eventi\s+(naturali|atmosfer|sociopolit)|atti\s+vandal|ricorso\s+terzi/i, code: "DRA" },
  { re: /a\.?\s?r\.?\s?d\.?|auto\s+rischi\s+divers/i, code: "DRA" },
  { re: /autocarr/i, code: "QC" },
  { re: /motociclo|motoveicolo|\bmoto\b|ciclomot/i, code: "QM" },
  { re: /responsabilit[àa]\s+civile|r\.?c\.?a|rca|r\.?c\.?\s*auto/i, code: "PI" },
];

// Generic token-overlap fuzzy match: trova il sottoramo ammesso con la descrizione più simile.
function fuzzyMatchSottoramo(
  desc: string,
  ammessi: Array<{ codice: string; descrizione: string }>,
): { codice: string; score: number } | null {
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
  const a = new Set(norm(desc));
  if (a.size === 0) return null;
  let best: { codice: string; score: number } | null = null;
  for (const s of ammessi) {
    const b = new Set(norm(s.descrizione));
    if (b.size === 0) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const score = inter / Math.max(a.size, b.size);
    if (!best || score > best.score) best = { codice: s.codice, score };
  }
  return best && best.score >= 0.34 ? best : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    requireAi();

    const { fileBase64, mimeType, gruppo_ramo, sottorami_ammessi, forza_veicolo } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gr = (gruppo_ramo as any) || {};
    const isZQ = String(gr?.codice || "").toUpperCase() === "ZQ";
    const shouldExtractVeicolo = isZQ || forza_veicolo === true;

    let ramoContext = "";
    if (gruppo_ramo && typeof gruppo_ramo === "object") {
      ramoContext +=
        `\n\nIl RAMO della polizza è già stato indicato dall'utente: ${gr.codice || ""} - ${gr.descrizione || ""}. ` +
        `NON cambiarlo: tutte le voci di garanzia devono appartenere a questo ramo.`;
    }
    if (Array.isArray(sottorami_ammessi) && sottorami_ammessi.length > 0) {
      const list = (sottorami_ammessi as Array<{ codice?: string; descrizione?: string }>)
        .map((s) => `  - ${s.codice} : ${s.descrizione}`)
        .join("\n");
      ramoContext +=
        `\n\nElenco SOTTORAMI AMMESSI (devi mappare ogni voce 'garanzie[].codice_sottoramo' SOLO a uno di questi codici. ` +
        `È LECITO e ATTESO riusare lo STESSO codice su più voci diverse del PDF. ` +
        `Solo se davvero nessun codice è applicabile, OMETTI il campo).\n${list}`;

      if (isZQ) {
        ramoContext +=
          `\n\nREGOLE DI MAPPING per ramo ZQ (R.C.A. / Auto):\n` +
          `- "Responsabilità civile auto", "RCA", "RC veicoli" → PI (autovetture) / QA / QC (autocarri) / QM (moto/ciclomotori) — scegli in base al tipo veicolo.\n` +
          `- "Incendio", "Furto", "Incendio e Furto", "Rapina" → QI (INCENDIO/FURTO).\n` +
          `- "Eventi atmosferici", "Grandine", "Eventi naturali", "Eventi sociopolitici", "Atti vandalici", "Ricorso terzi da incendio", "Auto Rischi Diversi", "A.R.D." → DRA.\n` +
          `- "Cristalli", "Rottura cristalli", "Vetri" → EC (CRISTALLI).\n` +
          `- "Kasko", "Collisione", "Mini-kasko", "Garanzia collisione" → QK (KASKO).\n` +
          `- "Tutela legale", "Assistenza stradale", "Soccorso", "Infortuni del conducente" → spesso NON hanno sottoramo dedicato in ZQ: OMETTI codice_sottoramo (l'utente lo sceglierà).\n` +
          `Riusa pure più volte lo stesso codice (es. più voci A.R.D. → tutte DRA).`;
      }
    }

    if (shouldExtractVeicolo) {
      ramoContext +=
        `\n\nDATI VEICOLO/CONDUCENTE — l'utente ha indicato che questa è una Polizza Auto. ` +
        `Compila il blocco 'veicolo' cercando i dati in QUALSIASI sezione del PDF (intestazione, tabelle "Veicolo", "Dati veicolo", "Identificativi veicolo", "Caratteristiche tecniche", "Dati assicurativi").\n\n` +
        `MAPPA SINONIMI ITALIANI (riconosci queste etichette esattamente come sono):\n` +
        `- "Targa", "Targa veicolo", "Targa / Telaio n.", header tipo "Polizza n. XXX Targa / Telaio n. AB123CD" → targa (es. "Targa / Telaio n. HD076XZ" → targa: "HD076XZ"). CERCA SEMPRE NELL'HEADER DI PAGINA se non la trovi nella sezione veicolo.\n` +
        `- "Telaio", "VIN", "N. telaio", "Numero telaio" → telaio\n` +
        `- "Tipologia", "Tipo veicolo", "Categoria", "Genere" → tipo_veicolo (es. AUTOVETTURA, AUTOCARRO, MOTOCICLO)\n` +
        `- "Uso", "Uso del veicolo", "Destinazione", "Uso veicolo" → uso_descrizione (es. "Privato", "Trasporto cose c/proprio")\n` +
        `- "Marca/Modello", "Marca e modello", "Modello" QUANDO È UNA COLONNA UNICA che contiene marca+modello+versione (es. "VOLKSWAGEN CRAFTER 35 2.0 BITDI 177CV 4M. PM-TA KOMBI"):\n` +
        `    * estrai il PRIMO TOKEN come 'marca' (es. "VOLKSWAGEN")\n` +
        `    * estrai TUTTO IL RESTO come 'modello' (es. "CRAFTER 35 2.0 BITDI 177CV 4M. PM-TA KOMBI")\n` +
        `    * copia la stringa COMPLETA anche in 'descrizione'\n` +
        `- "Data prima immatricolazione", "Immatricolazione", "Data immatricolazione" → data_immatricolazione (YYYY-MM-DD)\n` +
        `- "Alimentazione", "Carburante" → alimentazione (es. "Diesel", "Benzina", "Elettrico")\n` +
        `- "Cavalli fiscali", "CV fiscali", "CV" → cv (numero intero, senza unità)\n` +
        `- "Potenza in KW", "KW", "Potenza kW", "kW" → kw (numero intero, senza unità)\n` +
        `- "Cilindrata", "CC", "Cilindrata cm³", "cm3" → cc (numero intero)\n` +
        `- "Posti", "N. posti", "Posti a sedere", "Numero posti" → posti (numero intero)\n` +
        `- "Classe di merito universale", "CU", "Classe CU", "Classe Universale" → classe_bm (intero 1-18)\n` +
        `- "Tipo di guida", "Tipologia guida", "Guida" → tipologia_guida. VALORI AMMESSI: "Libera" o "Esperta". Mappa "Conducente qualsiasi"/"Guida libera" → "Libera"; "Esperta"/"Esclusiva"/"Conducente unico"/"Conducente esperto" → "Esperta".\n` +
        `- "Provincia di circolazione", "Provincia immatricolazione" → provincia_circolazione (2 lettere maiuscole)\n` +
        `- "Anno acquisto" → anno_acquisto; "Peso motrice/rimorchio/totale" → campi peso_* corrispondenti.\n` +
        `- "Massimale", "Somma assicurata RCA", "Massimale Unico" → massimale_1; massimali persone/cose distinti → massimale_2 e massimale_3.\n` +
        `- "Franchigia" → franchigia (numero in euro).\n` +
        `- Flag/clausole booleane: "Peius"/"Clausola Peius" → peius; "Polizza temporanea"/"Temporanea" → temporanea; "Carico e scarico"/"Operazioni carico/scarico" → carico_scarico; "Competizione"/"Veicolo da gara" → competizione; "Con rimorchio"/"Traino rimorchio" → rimorchio.\n\n` +

        `REGOLA TASSATIVA: compila SOLO i campi realmente presenti e leggibili nel PDF — se un'etichetta non compare, OMETTI il campo (non inventare, non dedurre, non mettere placeholder). ` +
        `Numeri SENZA unità di misura (es. "130", non "130 KW"). Date YYYY-MM-DD. Targa/telaio in MAIUSCOLO senza spazi.\n` +
        `Se è indicato un conducente abituale (diverso dal contraente), compila anche il blocco 'conducente' con la stessa regola di non invenzione.`;
    } else {
      ramoContext +=
        `\n\nNON compilare i blocchi 'veicolo' e 'conducente': questa polizza non è classificata come Auto.`;
    }


    const userContent = await buildDocumentUserContent({
      mimeType,
      fileBase64,
      instruction: "Analizza questa scheda di polizza ed estrai i dati richiesti." + ramoContext,
      filename: mimeType.includes("pdf") ? "polizza.pdf" : "polizza.jpg",
    });
    const messages = [
      {
        role: "system",
        content:
          "Sei un esperto di polizze assicurative italiane. Estrai TUTTI i dati strutturati dalla scheda di polizza fornita. " +
          "Date in formato YYYY-MM-DD. Importi numerici (usa il punto come separatore decimale). " +
          "Per le garanzie, includi SOLO quelle effettivamente operanti (flag SI/Operante). " +
          "Codice fiscale e partita IVA in maiuscolo. Provincia in 2 lettere maiuscole. Targa e telaio in maiuscolo senza spazi. " +
          "Se un campo non è chiaramente presente, ometterlo (non inventare).",
      },
      { role: "user", content: userContent },
    ];

    const resp = await aiChatCompletions({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{ type: "function", function: TOOL }],
        tool_choice: { type: "function", function: { name: TOOL.name } },
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit AI superato. Riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi credito al workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch (e) {
      console.error("parse args fail", e, args);
    }

    // === Post-processing sottorami ===
    try {
      const ammessiList: Array<{ codice: string; descrizione: string }> =
        (Array.isArray(sottorami_ammessi) ? sottorami_ammessi : [])
          .map((s: any) => ({ codice: String(s?.codice || "").toUpperCase(), descrizione: String(s?.descrizione || "") }))
          .filter((s) => s.codice);
      const ammessiSet = new Set(ammessiList.map((s) => s.codice));

      if (Array.isArray(parsed?.garanzie)) {
        parsed.garanzie = parsed.garanzie.map((g: any) => {
          const desc = String(g?.descrizione || "");
          let codice = String(g?.codice_sottoramo || "").toUpperCase().trim();
          let confidence: "alta" | "media" | "manuale" = "manuale";

          // 1. Se il codice dell'AI è valido → alta
          if (codice && ammessiSet.has(codice)) {
            confidence = "alta";
          } else {
            // Scarta codice errato
            if (codice && !ammessiSet.has(codice)) codice = "";

            // 2. Per ZQ prova prima le regole synonym (alta)
            if (!codice && isZQ) {
              for (const r of ZQ_SYNONYMS) {
                if (r.re.test(desc) && ammessiSet.has(r.code)) {
                  codice = r.code;
                  confidence = "alta";
                  break;
                }
              }
            }

            // 3. Fallback fuzzy token-overlap (media)
            if (!codice) {
              const m = fuzzyMatchSottoramo(desc, ammessiList);
              if (m) {
                codice = m.codice;
                confidence = m.score >= 0.6 ? "alta" : "media";
              }
            }
          }

          return {
            ...g,
            codice_sottoramo: codice || undefined,
            match_confidence: confidence,
          };
        });
      }
    } catch (e) {
      console.warn("post-process sottorami fail", e);
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-polizza-completa error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
