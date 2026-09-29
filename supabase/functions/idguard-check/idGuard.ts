export const IDGUARD_API_BASE =
  "https://zaefvbochhlfwpdvredn.supabase.co/functions/v1/api-v1";
export const IDGUARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type IdGuardCheckTipo = "email" | "domain";

export type IdGuardEsito = {
  is_pwned: boolean;
  mail_esposte: number;
  password_esposte: number;
  breach_count: number | null;
  explanation: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function countPasswordLeaks(leakedData: unknown): number {
  if (typeof leakedData === "number") return asNumber(leakedData);
  const rec = asRecord(leakedData);
  const fromCounts = asNumber(asRecord(rec.counts).passwords ?? rec.passwordCount ?? rec.password_count, -1);
  if (fromCounts >= 0) return fromCounts;
  if (Array.isArray(rec.passwords)) return rec.passwords.length;
  if (!Array.isArray(leakedData)) return 0;
  return leakedData.filter((item) => {
    const text =
      typeof item === "string"
        ? item
        : [asRecord(item).name, asRecord(item).type, asRecord(item).label]
            .filter(Boolean)
            .join(" ");
    return /password/i.test(String(text));
  }).length;
}

function unwrapCheckPayload(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  if (data.data && typeof data.data === "object") return asRecord(data.data);
  if (Object.keys(data).length > 0) return data;
  if (root.result && typeof root.result === "object") {
    const result = asRecord(root.result);
    if (result.data && typeof result.data === "object") return asRecord(result.data);
    return result;
  }
  return root;
}

export function mapIdGuardEmailResult(payload: unknown): IdGuardEsito {
  const data = unwrapCheckPayload(payload);
  const isPwned = data.isPwned === true || data.is_pwned === true;
  const breachCount = asNumber(data.breachCount ?? data.breach_count, isPwned ? 1 : 0);
  const explanation =
    typeof data.explanation === "string" && data.explanation.trim()
      ? data.explanation.trim()
      : null;
  return {
    is_pwned: isPwned,
    mail_esposte: breachCount,
    password_esposte: countPasswordLeaks(data.leakedData ?? data.leaked_data),
    breach_count: breachCount,
    explanation,
  };
}

export function mapIdGuardDomainResult(payload: unknown): IdGuardEsito {
  const data = unwrapCheckPayload(payload);
  const totalLeaks = asNumber(data.totalLeaks ?? data.total_leaks);
  const uniqueEmails = asNumber(data.uniqueEmails ?? data.unique_emails);
  const uniquePasswords = asNumber(data.uniquePasswords ?? data.unique_passwords);
  return {
    is_pwned: totalLeaks > 0 || uniqueEmails > 0,
    mail_esposte: uniqueEmails,
    password_esposte: uniquePasswords,
    breach_count: totalLeaks,
    explanation: null,
  };
}

export function mapIdGuardResult(tipo: IdGuardCheckTipo, payload: unknown): IdGuardEsito {
  return tipo === "email" ? mapIdGuardEmailResult(payload) : mapIdGuardDomainResult(payload);
}

export function nextVerificaAtIso(from = new Date()): string {
  return new Date(from.getTime() + IDGUARD_COOLDOWN_MS).toISOString();
}

export function isCooldownActive(prossimaVerificaAt: string | null | undefined, now = new Date()): boolean {
  if (!prossimaVerificaAt) return false;
  const t = new Date(prossimaVerificaAt);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() > now.getTime();
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function parseIdGuardSignature(header: string | null): { t: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return null;
  return { t, v1 };
}

export async function verifyIdGuardWebhook(
  secret: string,
  signatureHeader: string | null,
  rawBody: string,
  nowMs = Date.now(),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parsed = parseIdGuardSignature(signatureHeader);
  if (!parsed) return { ok: false, reason: "firma_assente" };
  const ts = Number(parsed.t);
  if (!Number.isFinite(ts)) return { ok: false, reason: "timestamp_invalido" };
  if (Math.abs(nowMs / 1000 - ts) > 300) return { ok: false, reason: "timestamp_scaduto" };
  const atteso = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`);
  if (!timingSafeEqual(atteso, parsed.v1.toLowerCase()) && !timingSafeEqual(atteso, parsed.v1)) {
    return { ok: false, reason: "firma_non_valida" };
  }
  return { ok: true };
}

export function webhookEventTipo(type: string | null | undefined): IdGuardCheckTipo | null {
  if (type === "check.email.completed") return "email";
  if (type === "check.domain.completed") return "domain";
  return null;
}

export function webhookTarget(tipo: IdGuardCheckTipo, data: Record<string, unknown>): string | null {
  if (tipo === "email") {
    const email = String(data.email || "").trim().toLowerCase();
    return email.includes("@") ? email : null;
  }
  const domain = String(data.domain || "").trim().toLowerCase().replace(/^www\./, "");
  return domain.includes(".") ? domain : null;
}
