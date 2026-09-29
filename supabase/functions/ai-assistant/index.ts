import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SCHEMA_CONTEXT } from "./schema-context.ts";
import { aiChatCompletions } from "../_shared/aiProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_ITERATIONS = 10;
const MAX_ROWS = 100;

const SYSTEM_PROMPT = `Sei un assistente IA per un broker assicurativo italiano (CBnet/ConsulNet).
Rispondi in italiano, in modo conciso e professionale.

Hai 5 tool a disposizione:
1) "query_database"   — esegue SELECT in sola lettura (max ${MAX_ROWS} righe). Le RLS sono attive.
2) "describe_table"   — colonne reali di tabella/vista. USALO se hai dubbi sui nomi PRIMA di generare SQL.
3) "list_enum_values" — valori distinti realmente presenti per una colonna (whitelisted).
                        USALO PRIMA di filtrare per stato/categoria/tipo se non sei sicuro dei valori
                        ("indovinare" stati di solito ritorna 0 righe).
4) "render_chart"     — visualizza un grafico (bar/line/pie) per aggregazioni o serie temporali.
5) "render_table"     — tabella interattiva con righe cliccabili (deep-link entità).
6) "render_metrics"   — card di KPI sintetici (totali, percentuali, conteggi).

LINEE GUIDA:
- Per aggregati (totali, conteggi, medie) usa SUM/COUNT/AVG/GROUP BY, NON righe grezze.
- Per le polizze usa SEMPRE la vista v_portafoglio_titoli (più ricca e leggibile di "titoli").
- Per "le mie cose" filtra con auth.uid() (es. trattative.assegnato_a = auth.uid()).
- Se la prima query non torna risultati, prima di rispondere "nessun dato" prova varianti:
  list_enum_values per scoprire i valori reali, ILIKE più larghi, range date estesi.
- Se ricevi un errore SQL "column ... does not exist", chiama describe_table per la tabella.
- Massimo ${MAX_ITERATIONS} iterazioni di tool calls per domanda.

QUANDO RISPONDI:
- Cita i dati rilevanti: numeri polizza, date gg/mm/aaaa, importi in EUR con migliaia separate.
- Per liste lunghe o aggregazioni usa i tool di rendering invece di tabelle markdown.
- Quando citi UNA entità specifica usa link markdown ai path UI (vedi sezione "DEEP LINK").
- Se non vedi nulla, dillo onestamente ("Non risulta alcun dato visibile per questa ricerca.").

${SCHEMA_CONTEXT}`;

const tools = [
  {
    type: "function",
    function: {
      name: "query_database",
      description:
        "Esegue una query SELECT in sola lettura sul database. Restituisce JSON. Massimo " +
        MAX_ROWS +
        " righe. Usa nomi di colonna esatti — in caso di dubbio invoca prima describe_table.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "Query PostgreSQL SELECT (o WITH ... SELECT). Niente punto e virgola finale, niente DDL/DML.",
          },
          purpose: {
            type: "string",
            description: "Breve descrizione di cosa stai cercando (per logging).",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_table",
      description:
        "Restituisce le colonne reali (nome, tipo, nullable) di una tabella o vista pubblica. " +
        "Usalo PRIMA di generare SQL se non sei sicuro dei nomi delle colonne.",
      parameters: {
        type: "object",
        properties: {
          table_name: {
            type: "string",
            description:
              "Nome esatto della tabella o vista (schema public). Es: 'trattative', 'v_portafoglio_titoli'.",
          },
        },
        required: ["table_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_enum_values",
      description:
        "Restituisce i valori distinti realmente presenti in una colonna (whitelisted in ai_allowed_enums). " +
        "Usalo prima di filtrare per stato/categoria/tipo se non sei sicuro dei valori.",
      parameters: {
        type: "object",
        properties: {
          table_name: { type: "string", description: "Nome tabella (schema public)." },
          column_name: { type: "string", description: "Nome colonna." },
        },
        required: ["table_name", "column_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_chart",
      description: "Visualizza un grafico (bar/line/pie) nella risposta. Usalo per aggregazioni o serie temporali.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["bar", "line", "pie"] },
          title: { type: "string" },
          x_label: { type: "string" },
          y_label: { type: "string" },
          data: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "number" } },
              required: ["label", "value"],
            },
          },
        },
        required: ["kind", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_table",
      description:
        "Visualizza una tabella interattiva. Con link_template (es. '/titoli/{id}') le righe diventano cliccabili.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: { key: { type: "string" }, label: { type: "string" } },
              required: ["key", "label"],
            },
          },
          rows: { type: "array", items: { type: "object" } },
          link_template: { type: "string", description: "Pattern URL con segnaposto {colonna}." },
        },
        required: ["columns", "rows"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_metrics",
      description: "Visualizza una serie di KPI numerici (1-6 metriche).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: ["string", "number"] },
                hint: { type: "string" },
                tone: { type: "string", enum: ["default", "success", "warning", "danger"] },
              },
              required: ["label", "value"],
            },
          },
        },
        required: ["metrics"],
      },
    },
  },
];

async function callGemini(messages: any[]) {
  const resp = await aiChatCompletions({
      model: "google/gemini-3-flash-preview",
      messages,
      tools,
      tool_choice: "auto",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Response(
      JSON.stringify({
        error:
          resp.status === 429
            ? "Limite richieste IA superato, riprova fra poco."
            : resp.status === 402
            ? "Crediti IA esauriti. Aggiungi credito al workspace Lovable."
            : `Errore AI gateway: ${text}`,
      }),
      { status: resp.status === 429 || resp.status === 402 ? resp.status : 500 },
    );
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userMessages: Array<{ role: string; content: string }> = body.messages ?? [];
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Entity context opzionale inviato dal frontend per restringere il
    // contesto AI ai dati pertinenti all'entità correntemente in uso.
    // Schema atteso (vedi src/lib/ai/context.ts):
    //   { entityType, entityId, scopeHint, ufficioId?, sqlFilterHint? }
    const entityContext = body.entity_context ?? null;

    let systemContent = SYSTEM_PROMPT;
    if (entityContext && typeof entityContext === "object" && entityContext.entityType && entityContext.entityId) {
      const scopeLine = entityContext.scopeHint
        ? `${entityContext.entityType} "${entityContext.scopeHint}" (id=${entityContext.entityId})`
        : `${entityContext.entityType} id=${entityContext.entityId}`;
      const sqlHint = entityContext.sqlFilterHint
        ? `\nQuando esegui SELECT, applica SEMPRE la clausola WHERE: ${entityContext.sqlFilterHint} a meno che l'utente non chieda esplicitamente dati globali ("totale agenzia", "tutti i clienti", ecc.).`
        : "";
      const ufficioHint = entityContext.ufficioId
        ? `\nL'utente opera sulla Sede (ufficio_id) = '${entityContext.ufficioId}'. Le RLS già filtrano per questa Sede, non duplicare il filtro in WHERE.`
        : "";
      systemContent =
        `${SYSTEM_PROMPT}\n\n=== CONTESTO ENTITÀ ATTIVO ===\nStai assistendo l'utente sulla pagina di ${scopeLine}.${sqlHint}${ufficioHint}\nSe l'utente fa una domanda generica (es. "mostrami le polizze"), interpretala come riferita a questa entità. Se ti chiede dati globali, allora ignora questo filtro.`;
    }

    const messages: any[] = [
      { role: "system", content: systemContent },
      ...userMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const toolCallsLog: Array<{
      tool: string;
      sql?: string;
      table?: string;
      purpose?: string;
      rows?: number;
      ms?: number;
      error?: string;
      block?: any;
    }> = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let aiResp;
      try {
        aiResp = await callGemini(messages);
      } catch (e) {
        if (e instanceof Response) {
          const txt = await e.text();
          return new Response(txt, {
            status: e.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }

      const choice = aiResp.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "Risposta IA vuota" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return new Response(
          JSON.stringify({
            content: msg.content ?? "",
            tool_calls: toolCallsLog,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let argsRaw = tc.function?.arguments ?? "{}";
        let args: any = {};
        try {
          args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
        } catch {
          args = {};
        }

        const t0 = performance.now();

        if (fnName === "describe_table") {
          const tableName: string = (args.table_name ?? "").trim();
          let payload: any;
          let err: string | null = null;

          if (!tableName) {
            err = "table_name mancante";
            payload = { error: err };
          } else {
            try {
              const { data, error: rpcError } = await supabase.rpc("ai_describe_table", {
                table_name: tableName,
              });
              if (rpcError) {
                err = rpcError.message;
                payload = { error: err };
              } else if (!data || (Array.isArray(data) && data.length === 0)) {
                err = `Tabella '${tableName}' non trovata o senza colonne visibili.`;
                payload = { error: err };
              } else {
                payload = { table: tableName, columns: data };
              }
            } catch (e) {
              err = e instanceof Error ? e.message : String(e);
              payload = { error: err };
            }
          }

          const ms = Math.round(performance.now() - t0);
          toolCallsLog.push({
            tool: "describe_table",
            table: tableName,
            rows: Array.isArray(payload?.columns) ? payload.columns.length : 0,
            ms,
            error: err ?? undefined,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(payload),
          });
          continue;
        }

        if (fnName === "list_enum_values") {
          const tn = (args.table_name ?? "").trim();
          const cn = (args.column_name ?? "").trim();
          let payload: any;
          let err: string | null = null;
          try {
            const { data, error: rpcError } = await supabase.rpc("ai_list_enum_values", {
              p_table: tn,
              p_column: cn,
            });
            if (rpcError) { err = rpcError.message; payload = { error: err }; }
            else payload = { table: tn, column: cn, values: data };
          } catch (e) {
            err = e instanceof Error ? e.message : String(e);
            payload = { error: err };
          }
          toolCallsLog.push({
            tool: "list_enum_values",
            table: `${tn}.${cn}`,
            rows: Array.isArray(payload?.values) ? payload.values.length : 0,
            ms: Math.round(performance.now() - t0),
            error: err ?? undefined,
          });
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(payload) });
          continue;
        }

        if (fnName === "render_chart" || fnName === "render_table" || fnName === "render_metrics") {
          // Tool di rendering: l'output è il payload stesso (echo).
          // Il frontend lo legge da tool_calls e lo renderizza come blocco.
          toolCallsLog.push({
            tool: fnName,
            block: args,
            ms: Math.round(performance.now() - t0),
          } as any);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true, rendered: fnName }),
          });
          continue;
        }

        if (fnName !== "query_database") {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `Tool sconosciuto: ${fnName}` }),
          });
          continue;
        }

        const sql: string = args.sql ?? "";
        const purpose: string | undefined = args.purpose;
        let rows: unknown = null;
        let error: string | null = null;

        try {
          const { data, error: rpcError } = await supabase.rpc("ai_exec_select", {
            query_text: sql,
          });
          if (rpcError) {
            error = rpcError.message;
          } else {
            rows = data;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        const rowCount = Array.isArray(rows) ? rows.length : 0;
        const ms = Math.round(performance.now() - t0);
        toolCallsLog.push({
          tool: "query_database",
          sql,
          purpose,
          rows: rowCount,
          ms,
          error: error ?? undefined,
        });

        // Se errore di colonna inesistente, suggerisci describe_table
        let toolContent: any;
        if (error) {
          const hint =
            /column .* does not exist/i.test(error) || /relation .* does not exist/i.test(error)
              ? " (suggerimento: usa describe_table per verificare i nomi reali delle colonne)"
              : "";
          toolContent = { error: error + hint };
        } else {
          toolContent = {
            rows: Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : rows,
            count: rowCount,
          };
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolContent),
        });
      }
    }

    return new Response(
      JSON.stringify({
        content:
          "Mi dispiace, la richiesta è troppo complessa per essere risolta in pochi passi. Prova a riformularla in modo più specifico.",
        tool_calls: toolCallsLog,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
