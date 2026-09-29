/**
 * Sanitizza un nome file per essere usato come chiave Supabase Storage.
 * Supabase rifiuta chiavi con caratteri non-ASCII o spazi ("Invalid key").
 * Il nome originale (con accenti) va conservato altrove (es. documenti.nome_file).
 */
export function sanitizeStorageFileName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // rimuove diacritici (ò → o)
      .replace(/[^a-zA-Z0-9._-]+/g, "_") // spazi e simboli → _
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "file"
  );
}

/** Nome file senza percorso ed estensione (per precompilare il campo "Nome documento"). */
export function fileBaseNameWithoutExt(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || name;
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0) return base;
  return base.slice(0, lastDot);
}

/** Garantisce che il nome visualizzato conservi l'estensione del file originale. */
export function ensureFileExtension(displayName: string, originalName: string): string {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
}
