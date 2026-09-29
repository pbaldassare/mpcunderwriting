import { requireAi, aiChatCompletions, buildDocumentUserContent } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL_SCHEMAS: Record<string, { name: string; description: string; parameters: Record<string, unknown> }> = {
  carta_identita: {
    name: "extract_carta_identita",
    description: "Extract data from Italian identity card (Carta d'Identità)",
    parameters: {
      type: "object",
      properties: {
        nome: { type: "string", description: "First name" },
        cognome: { type: "string", description: "Last name" },
        codice_fiscale: { type: "string", description: "Italian fiscal code (16 chars)" },
        data_nascita: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
        luogo_nascita: { type: "string", description: "Place of birth" },
        indirizzo: { type: "string", description: "Residence address (street and number)" },
        cap: { type: "string", description: "Postal code (5 digits)" },
        citta: { type: "string", description: "City of residence" },
        provincia: { type: "string", description: "Province abbreviation (2 chars)" },
        numero_documento: { type: "string", description: "Document number" },
        scadenza_documento: { type: "string", description: "Expiry date in YYYY-MM-DD format" },
      },
      required: ["nome", "cognome"],
      additionalProperties: false,
    },
  },
  tessera_sanitaria: {
    name: "extract_tessera_sanitaria",
    description: "Extract data from Italian health card (Tessera Sanitaria / Codice Fiscale card)",
    parameters: {
      type: "object",
      properties: {
        codice_fiscale: { type: "string", description: "Italian fiscal code (16 chars)" },
        nome: { type: "string", description: "First name" },
        cognome: { type: "string", description: "Last name" },
        data_nascita: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
        luogo_nascita: { type: "string", description: "Place of birth" },
        sesso: { type: "string", description: "Gender M/F" },
      },
      required: ["codice_fiscale"],
      additionalProperties: false,
    },
  },
  visura_camerale: {
    name: "extract_visura_camerale",
    description: "Extract data from Italian company registration document (Visura Camerale)",
    parameters: {
      type: "object",
      properties: {
        ragione_sociale: { type: "string", description: "Company name" },
        partita_iva: { type: "string", description: "VAT number (11 digits)" },
        codice_fiscale: { type: "string", description: "Company fiscal code" },
        forma_giuridica: { type: "string", description: "Legal form (SRL, SPA, SNC, SAS, etc.)" },
        indirizzo_sede: { type: "string", description: "Registered office address" },
        cap: { type: "string", description: "Postal code" },
        citta: { type: "string", description: "City" },
        provincia: { type: "string", description: "Province abbreviation" },
        pec: { type: "string", description: "Certified email (PEC)" },
        codice_sdi: { type: "string", description: "SDI code for electronic invoicing" },
        rappresentante_legale: { type: "string", description: "Legal representative name" },
        data_iscrizione: { type: "string", description: "Registration date YYYY-MM-DD" },
      },
      required: ["ragione_sociale"],
      additionalProperties: false,
    },
  },
  copia_polizza: {
    name: "extract_copia_polizza",
    description: "Extract data from an insurance policy copy",
    parameters: {
      type: "object",
      properties: {
        numero_polizza: { type: "string", description: "Policy number" },
        compagnia: { type: "string", description: "Insurance company name" },
        prodotto: { type: "string", description: "Insurance product name" },
        contraente: { type: "string", description: "Policyholder full name" },
        codice_fiscale_contraente: { type: "string", description: "Policyholder fiscal code" },
        premio_annuo: { type: "number", description: "Annual premium amount" },
        data_effetto: { type: "string", description: "Effective date YYYY-MM-DD" },
        data_scadenza: { type: "string", description: "Expiry date YYYY-MM-DD" },
        ramo: { type: "string", description: "Insurance branch (e.g. RCA, Incendio, Vita)" },
      },
      required: ["numero_polizza"],
      additionalProperties: false,
    },
  },
  perizia: {
    name: "extract_perizia",
    description: "Extract data from an insurance expertise/appraisal report (Perizia)",
    parameters: {
      type: "object",
      properties: {
        numero_perizia: { type: "string", description: "Report number" },
        data_perizia: { type: "string", description: "Report date YYYY-MM-DD" },
        perito: { type: "string", description: "Expert/appraiser name" },
        descrizione_danno: { type: "string", description: "Damage description" },
        importo_stimato: { type: "number", description: "Estimated damage amount" },
        esito: { type: "string", description: "Outcome/result of the appraisal" },
        numero_sinistro: { type: "string", description: "Related claim number" },
        note: { type: "string", description: "Additional notes" },
      },
      required: ["descrizione_danno"],
      additionalProperties: false,
    },
  },
  referto_medico: {
    name: "extract_referto_medico",
    description: "Extract data from a medical report (Referto Medico)",
    parameters: {
      type: "object",
      properties: {
        data_referto: { type: "string", description: "Report date YYYY-MM-DD" },
        struttura: { type: "string", description: "Medical facility name" },
        medico: { type: "string", description: "Doctor name" },
        diagnosi: { type: "string", description: "Diagnosis" },
        prognosi_giorni: { type: "number", description: "Prognosis in days" },
        tipo_lesione: { type: "string", description: "Type of injury" },
        invalidita_percentuale: { type: "number", description: "Disability percentage if specified" },
        note: { type: "string", description: "Additional notes" },
      },
      required: ["diagnosi"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPTS: Record<string, string> = {
  carta_identita: `Sei un esperto in OCR di documenti italiani. Analizza questa immagine di una Carta d'Identità italiana (cartacea o elettronica CIE) e estrai tutti i dati anagrafici visibili. Il codice fiscale potrebbe essere presente sul retro o integrato nel documento. Restituisci le date in formato YYYY-MM-DD. La provincia va indicata con la sigla di 2 lettere.`,
  tessera_sanitaria: `Sei un esperto in OCR di documenti italiani. Analizza questa immagine di una Tessera Sanitaria / Carta del Codice Fiscale e estrai i dati visibili. Il codice fiscale è il dato principale (16 caratteri alfanumerici). Restituisci le date in formato YYYY-MM-DD.`,
  visura_camerale: `Sei un esperto in analisi di documenti camerali italiani. Analizza questa Visura Camerale e estrai tutti i dati societari rilevanti: ragione sociale, P.IVA, codice fiscale, forma giuridica, sede legale, PEC, codice SDI, rappresentante legale. Restituisci le date in formato YYYY-MM-DD. La forma giuridica va normalizzata (SRL, SRLS, SPA, SNC, SAS, ditta_individuale, cooperativa, altro).`,
  copia_polizza: `Sei un esperto in documenti assicurativi italiani. Analizza questa copia di polizza assicurativa e estrai: numero polizza, compagnia, prodotto/ramo, contraente, codice fiscale, premio annuo, date di effetto e scadenza. Gli importi vanno in formato numerico (es: 1234.56). Le date in formato YYYY-MM-DD.`,
  perizia: `Sei un esperto in documenti assicurativi italiani. Analizza questa perizia/relazione tecnica e estrai: numero perizia, data, perito incaricato, descrizione del danno, importo stimato, esito e eventuale numero sinistro di riferimento. Gli importi vanno in formato numerico. Le date in formato YYYY-MM-DD.`,
  referto_medico: `Sei un esperto in documenti medico-legali italiani. Analizza questo referto medico e estrai: data referto, struttura sanitaria, medico, diagnosi, prognosi in giorni, tipo di lesione, eventuale percentuale di invalidità e note. Le date in formato YYYY-MM-DD.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_base64, tipo_documento, mime_type, entity_context } = await req.json();

    if (!file_base64 || !tipo_documento) {
      throw new Error("file_base64 e tipo_documento sono obbligatori");
    }

    // Costruisce un blocco "contesto entità" che istruisce l'AI a privilegiare
    // i dati coerenti con l'entità corrente (es. CF/P.IVA del cliente di destinazione).
    // Non scarta i dati letti dal documento: se discordanti, vengono comunque restituiti
    // e l'utente li conferma/modifica nel form (pattern AiPrefilledForm).
    let entityContextBlock = "";
    if (entity_context && typeof entity_context === "object") {
      const { entityType, scopeHint, expectedCF, expectedPIVA } = entity_context as Record<string, unknown>;
      const lines: string[] = [];
      if (scopeHint) lines.push(`- Entità corrente: ${entityType ?? "?"} → ${scopeHint}`);
      if (expectedCF) lines.push(`- Codice fiscale atteso: ${expectedCF}`);
      if (expectedPIVA) lines.push(`- Partita IVA attesa: ${expectedPIVA}`);
      if (lines.length > 0) {
        entityContextBlock =
          `\n\nCONTESTO ENTITÀ ATTIVA (precompilazione mirata):\n${lines.join("\n")}\n` +
          `Se i dati letti dal documento corrispondono all'entità sopra indicata, estraili normalmente. ` +
          `Se invece il documento sembra appartenere a un soggetto diverso, estrai comunque i dati ` +
          `realmente presenti nel documento (sarà l'utente a confermare o scartare).`;
      }
    }

    const schema = TOOL_SCHEMAS[tipo_documento];
    if (!schema) {
      throw new Error(`tipo_documento non valido: ${tipo_documento}. Valori ammessi: ${Object.keys(TOOL_SCHEMAS).join(", ")}`);
    }

    requireAi();
    const contentMime = mime_type || "image/jpeg";
    const userContent = await buildDocumentUserContent({
      mimeType: contentMime,
      fileBase64: file_base64,
      instruction: "Analizza questo documento e estrai tutti i dati richiesti.",
      filename: contentMime.includes("pdf") ? "documento.pdf" : "documento.jpg",
    });

    const response = await aiChatCompletions({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[tipo_documento] + entityContextBlock },
          { role: "user", content: userContent },
        ],
        tools: [{ type: "function", function: schema }],
        tool_choice: { type: "function", function: { name: schema.name } },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato, riprovare più tardi" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Aggiungi crediti in Settings > Workspace > Usage" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Errore AI: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Nessun dato estratto dal documento");

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, tipo_documento, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("extract-document-data error:", err);
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
