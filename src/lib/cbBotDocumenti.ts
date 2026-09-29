import { safeId } from "@/lib/safeId";

export const CB_BOT_DOC_BUCKET = "cb-bot-documenti";
export const CB_BOT_DOC_MAX_FILES = 5;
export const CB_BOT_DOC_MAX_BYTES = 12 * 1024 * 1024;
export const CB_BOT_DOC_ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

const ALLOWED_EXT = new Set(["pdf", "txt", "md"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/octet-stream",
]);

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function titoloFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  return (base || "Documento").slice(0, 160);
}

export function sanitizeStorageFileName(name: string): string {
  const ext = fileExtension(name);
  const stem = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const safe = stem.replace(/^_+|_+$/g, "") || "documento";
  return ext ? `${safe}.${ext}` : safe;
}

export function isCbBotDocFileAllowed(file: {
  name: string;
  type?: string;
  size: number;
}): { ok: true } | { ok: false; reason: string } {
  if (file.size <= 0) return { ok: false, reason: `${file.name}: file vuoto` };
  if (file.size > CB_BOT_DOC_MAX_BYTES) {
    return { ok: false, reason: `${file.name}: supera i 12 MB` };
  }
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext) && !ALLOWED_MIME.has(mime)) {
    return { ok: false, reason: `${file.name}: ammessi solo PDF e file di testo` };
  }
  return { ok: true };
}

export function validateCbBotDocFiles(files: { name: string; type?: string; size: number }[]): {
  ok: true;
  files: typeof files;
} | { ok: false; reason: string } {
  if (files.length === 0) return { ok: false, reason: "Seleziona almeno un documento" };
  if (files.length > CB_BOT_DOC_MAX_FILES) {
    return { ok: false, reason: `Massimo ${CB_BOT_DOC_MAX_FILES} documenti alla volta` };
  }
  for (const f of files) {
    const check = isCbBotDocFileAllowed(f);
    if (!check.ok) return check;
  }
  return { ok: true, files };
}

export function buildStoragePath(userId: string, fileName: string, id = safeId()): string {
  return `${userId}/${id}_${sanitizeStorageFileName(fileName)}`;
}

/** Cartella storage per upload da Area consultazione (niente auth.uid). */
export function consultazioneDocFolder(email: string): string {
  const slug = String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `c/${slug || "anon"}`;
}

export function isConsultazioneStoragePath(path: string, email: string): boolean {
  const folder = consultazioneDocFolder(email);
  return path === folder || path.startsWith(`${folder}/`);
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Impossibile leggere il file"));
    reader.readAsDataURL(file);
  });
}
