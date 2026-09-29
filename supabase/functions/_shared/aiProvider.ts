/**
 * Gateway IA CBnet: Moonshot/Kimi (preferito) con fallback Lovable Gemini.
 * La chiave vive solo nei secret Edge — mai nel client Vite.
 *
 * Alias env: MOONSHOT_API_KEY | MOONSHINE_API_KEY (stesso provider Kimi).
 */

const MOONSHOT_BASE = "https://api.moonshot.ai/v1";
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";

export type AiProviderName = "moonshot" | "lovable";

export type AiConfig = {
  provider: AiProviderName;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
};

function moonshotKey(): string | undefined {
  return Deno.env.get("MOONSHOT_API_KEY") || Deno.env.get("MOONSHINE_API_KEY") || undefined;
}

export function hasAiCredentials(): boolean {
  return Boolean(moonshotKey() || Deno.env.get("LOVABLE_API_KEY"));
}

export function getAiConfig(): AiConfig {
  const moon = moonshotKey();
  if (moon) {
    return {
      provider: "moonshot",
      apiKey: moon,
      baseUrl: (Deno.env.get("MOONSHOT_BASE_URL") || MOONSHOT_BASE).replace(/\/$/, ""),
      chatModel: Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.6",
    };
  }
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (lovable) {
    return {
      provider: "lovable",
      apiKey: lovable,
      baseUrl: LOVABLE_BASE,
      chatModel: "google/gemini-2.5-flash",
    };
  }
  throw new Error("API IA non configurata: imposta MOONSHOT_API_KEY (Kimi) nei secret Supabase.");
}

export function requireAi(): AiConfig {
  return getAiConfig();
}

export function mapAiModel(requested?: string): string {
  const cfg = getAiConfig();
  if (cfg.provider === "lovable") {
    return requested || "google/gemini-2.5-flash";
  }
  return cfg.chatModel;
}

export function getAiModelChain(requested?: string[]): string[] {
  const cfg = getAiConfig();
  if (cfg.provider === "moonshot") return [cfg.chatModel];
  return requested && requested.length > 0
    ? requested
    : ["google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
}

export function aiHttpErrorMessage(status: number): string {
  if (status === 429) return "Rate limit AI superato, riprovare più tardi.";
  if (status === 402) {
    return getAiConfig().provider === "lovable"
      ? "Crediti AI esauriti. Aggiungi crediti in Settings > Workspace > Usage."
      : "Servizio temporaneamente non disponibile. Riprovare più tardi.";
  }
  return `Errore AI (${status}).`;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Estrae testo da PDF/DOC via Files API Moonshot (purpose=file-extract). */
export async function extractMoonshotFileText(
  fileBase64: string,
  filename: string,
): Promise<string> {
  const cfg = getAiConfig();
  if (cfg.provider !== "moonshot") {
    throw new Error("extractMoonshotFileText richiede MOONSHOT_API_KEY");
  }
  const bytes = base64ToBytes(fileBase64);
  const form = new FormData();
  form.append("purpose", "file-extract");
  form.append(
    "file",
    new File([bytes], filename, { type: filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" }),
  );

  const up = await fetch(`${cfg.baseUrl}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!up.ok) {
    const t = await up.text();
    throw new Error(`Upload file Moonshot ${up.status}: ${t.slice(0, 300)}`);
  }
  const meta = await up.json() as { id?: string };
  const id = meta.id;
  if (!id) throw new Error("Upload Moonshot senza file id");

  try {
    let last = "";
    for (let i = 0; i < 8; i++) {
      const content = await fetch(`${cfg.baseUrl}/files/${id}/content`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      last = await content.text();
      if (content.ok && last.trim().length > 20) return last;
      if (content.status === 404 || content.status === 409 || last.includes("processing")) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      if (!content.ok) throw new Error(`Lettura file Moonshot ${content.status}: ${last.slice(0, 300)}`);
      if (last.trim().length > 0) return last;
      await new Promise((r) => setTimeout(r, 700));
    }
    return last;
  } finally {
    await fetch(`${cfg.baseUrl}/files/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    }).catch(() => undefined);
  }
}

export type DocumentUserContent = string | Array<Record<string, unknown>>;

export async function buildDocumentUserContent(opts: {
  mimeType: string;
  fileBase64: string;
  instruction: string;
  filename?: string;
}): Promise<DocumentUserContent> {
  const { mimeType, fileBase64, instruction } = opts;
  const filename = opts.filename || (mimeType.includes("pdf") ? "documento.pdf" : "documento.bin");
  const dataUrl = `data:${mimeType};base64,${fileBase64}`;
  const cfg = getAiConfig();
  const isPdf = mimeType.includes("pdf");

  if (cfg.provider === "moonshot" && isPdf) {
    try {
      const text = await extractMoonshotFileText(fileBase64, filename);
      const trimmed = text.slice(0, 180_000);
      if (trimmed.trim().length >= 40) {
        return `${instruction}\n\n--- INIZIO DOCUMENTO ---\n${trimmed}\n--- FINE DOCUMENTO ---`;
      }
    } catch (e) {
      console.error("Moonshot file-extract fallback a unpdf/immagine", e);
    }
  }

  if (isPdf && cfg.provider === "lovable") {
    return [
      { type: "text", text: instruction },
      { type: "file", file: { filename, file_data: dataUrl } },
    ];
  }

  return [
    { type: "text", text: instruction },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
}

export async function aiChatCompletions(
  body: Record<string, unknown>,
  init?: { signal?: AbortSignal },
): Promise<Response> {
  const cfg = getAiConfig();
  const requested = typeof body.model === "string" ? body.model : undefined;
  const payload: Record<string, unknown> = { ...body, model: mapAiModel(requested) };
  if (cfg.provider === "moonshot") {
    // Kimi accetta solo temperature 0.6; thinking on brucia token e timeout Edge.
    if (payload.temperature === undefined) payload.temperature = 0.6;
    payload.thinking = { type: "disabled" };
  }
  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: init?.signal,
  });
}

/** Chat testuale via Kimi (Moonshot). Nessun modello Gemini. */
export async function callKimiText(
  messages: { role: string; content: string }[],
): Promise<string> {
  const cfg = getAiConfig();
  if (cfg.provider !== "moonshot") {
    throw new Error("Servizio di ricerca non configurato.");
  }
  const resp = await aiChatCompletions({ messages }, { signal: AbortSignal.timeout(35_000) });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Ricerca non disponibile (${resp.status}).`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}
