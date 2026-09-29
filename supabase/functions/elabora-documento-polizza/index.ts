// Edge function: elabora-documento-polizza
// Estrae da un documento di polizza (PDF/immagine) i campi richiesti dal
// catalogo campi per Ramo. Usa Lovable AI Gateway (Gemini) con tool calling
// per ottenere un output strutturato chiave -> valore.

import { requireAi, aiChatCompletions, buildDocumentUserContent, getAiModelChain } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampoRichiesto {
  chiave: string;
  etichetta: string;
  tipo?: string; // text | number | date | boolean
  descrizione_ai?: string | null;
}

function jsonType(tipo?: string): string {
  switch (tipo) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "string";
  }
}

function buildTool(campi: CampoRichiesto[]) {
  const properties: Record<string, unknown> = {};
  for (const c of campi) {
    let desc = c.descrizione_ai || c.etichetta;
    if (c.tipo === "date") desc += " (formato ISO yyyy-mm-dd)";
    if (c.tipo === "number") desc += " (solo numero, senza simboli di valuta)";
    properties[c.chiave] = { type: jsonType(c.tipo), description: desc };
  }
  return {
    name: "estrai_campi_polizza",
    description:
      "Estrae i campi richiesti da un documento di polizza assicurativa italiana. Ometti i campi non presenti nel documento: non inventare valori.",
    parameters: {
      type: "object",
      properties: {
        campi: {
          type: "object",
          description: "Valori estratti, uno per chiave richiesta.",
          properties,
          additionalProperties: false,
        },
        note_estrazione: {
          type: "string",
          description: "Eventuali avvertenze sull'estrazione (campi ambigui o non trovati).",
        },
      },
      required: ["campi"],
      additionalProperties: false,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    requireAi();

    const body = await req.json();
    const fileBase64: string | undefined = body?.fileBase64;
    const mimeType: string = body?.mimeType || "application/pdf";
    const campi: CampoRichiesto[] = Array.isArray(body?.campi) ? body.campi : [];
    const contesto: string = typeof body?.contesto === "string" ? body.contesto : "";

    if (!fileBase64 || campi.length === 0) {
      return new Response(
        JSON.stringify({ error: "fileBase64 e almeno un campo sono richiesti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const TOOL = buildTool(campi);
    const istruzione =
      "Analizza questo documento di polizza ed estrai i campi richiesti." +
      (contesto ? `\n\nContesto noto (usalo solo come riferimento, non sovrascrivere il documento):\n${contesto}` : "");

    const userContent = await buildDocumentUserContent({
      mimeType,
      fileBase64,
      instruction: istruzione,
      filename: "polizza.pdf",
    });
    const messages: unknown[] = [
      {
        role: "system",
        content:
          "Sei un esperto di polizze assicurative italiane. Estrai con precisione i campi richiesti dal documento. Se un dato non è presente, ometti la chiave: non inventare mai valori. Importi come numeri puri, date in formato ISO yyyy-mm-dd.",
      },
      { role: "user", content: userContent },
    ];

    const callGateway = (model: string, msgs: unknown[]) =>
      aiChatCompletions({
          model,
          messages: msgs,
          tools: [{ type: "function", function: TOOL }],
          tool_choice: { type: "function", function: { name: TOOL.name } },
      });

    const modelChain = getAiModelChain(["google/gemini-3-flash-preview", "google/gemini-2.5-flash"]);
    let resp: Response | null = null;
    let lastStatus = 0;
    let lastErr = "";

    outer: for (const model of modelChain) {
      for (let attempt = 0; attempt < 2; attempt++) {
        resp = await callGateway(model, messages);
        if (resp.ok) break outer;
        lastStatus = resp.status;
        lastErr = await resp.text();
        console.error(`gateway ${model} status ${resp.status}`, lastErr.slice(0, 200));
        if (resp.status === 429 || resp.status === 402 || resp.status === 403) break outer;
        if (resp.status >= 500) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        break;
      }
    }

    // Fallback: estrazione testo lato server (PDF protetti o troppo lunghi)
    if ((!resp || !resp.ok) && mimeType === "application/pdf" && lastStatus !== 429 && lastStatus !== 402) {
      try {
        const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
        const bin = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const pdf = await getDocumentProxy(bin);
        const { text } = await extractText(pdf, { mergePages: true });
        const trimmed = String(text ?? "").slice(0, 180_000);
        if (trimmed.trim().length >= 50) {
          const textMessages = [
            messages[0],
            {
              role: "user",
              content: `${istruzione}\n\n--- INIZIO DOCUMENTO ---\n${trimmed}\n--- FINE DOCUMENTO ---`,
            },
          ];
          for (const model of modelChain) {
            resp = await callGateway(model, textMessages);
            if (resp.ok) break;
            lastStatus = resp.status;
            lastErr = await resp.text();
          }
        }
      } catch (e) {
        console.error("fallback unpdf error", e);
      }
    }

    if (!resp || !resp.ok) {
      const status = resp?.status ?? lastStatus ?? 500;
      const msg =
        status === 429
          ? "Limite di richieste AI raggiunto. Riprova tra poco."
          : status === 402
          ? "Crediti AI esauriti: aggiungi crediti nel workspace Lovable."
          : `Errore AI (${status}). ${lastErr.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Risposta AI senza dati strutturati" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { campi?: Record<string, unknown>; note_estrazione?: string } = {};
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "Output AI non valido" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        campi: parsed.campi ?? {},
        note: parsed.note_estrazione ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("elabora-documento-polizza error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
