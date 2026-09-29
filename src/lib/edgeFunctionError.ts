/** Nasconde i nomi dei motori dai messaggi mostrati all'utente. */
export function hideAiVendorNames(msg: string): string {
  if (/kimi|gemini|moonshot|moonshine|lovable ai|openai|gpt-|claude/i.test(msg)) {
    return "Ricerca non disponibile. Riprovare tra poco.";
  }
  return msg;
}

type EdgeErrorBody = {
  success?: boolean;
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
};

/** Estrae un messaggio utile da invoke edge function ( anche su 4xx/5xx ). */
export function formatEdgeFunctionError(
  error: { message?: string } | null | undefined,
  data: EdgeErrorBody | null | undefined,
): string {
  const fieldErrors = data?.details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages[0]) {
        return `${field}: ${messages[0]}`;
      }
    }
  }

  const formErrors = data?.details?.formErrors;
  if (Array.isArray(formErrors) && formErrors[0]) {
    return formErrors[0];
  }

  if (data?.error && data.error !== "Payload non valido") return hideAiVendorNames(data.error);
  if (data?.details) return "Payload non valido per il server";

  const generic = error?.message || "";
  if (generic.includes("non-2xx")) {
    return "Errore del server durante l'operazione. Riprova o contatta l'assistenza.";
  }

  return hideAiVendorNames(generic) || "Errore sconosciuto";
}

/** Estrae il messaggio utile da supabase.functions.invoke (body JSON o FunctionsHttpError). */
export function edgeFunctionErrorMessage(
  data: unknown,
  error: { message?: string } | null | undefined,
): string | null {
  if (data && typeof data === "object" && "error" in data) {
    const raw = (data as { error: unknown }).error;
    if (typeof raw === "string" && raw.trim()) return hideAiVendorNames(raw.trim());
  }
  const msg = error?.message?.trim();
  return msg ? hideAiVendorNames(msg) : null;
}
