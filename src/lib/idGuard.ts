/** Helper ID Guard: target email/dominio, cooldown 24h, mapping esiti. Nessuna chiave API qui. */

export const IDGUARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type IdGuardCheckTipo = "email" | "domain";

export type IdGuardClienteInput = {
  tipo_cliente?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  email?: string | null;
  pec?: string | null;
  referente_email?: string | null;
};

export type IdGuardTarget =
  | { ok: true; tipo: IdGuardCheckTipo; target: string }
  | { ok: false; tipo: IdGuardCheckTipo; missing: "email" | "domain" };

export type IdGuardEsito = {
  is_pwned: boolean;
  mail_esposte: number;
  password_esposte: number;
  breach_count: number | null;
  explanation: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isPrivatoCliente(tipoCliente: string | null | undefined): boolean {
  return String(tipoCliente || "").trim().toLowerCase() === "privato";
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const v = String(value || "").trim().toLowerCase();
  if (!v || !EMAIL_RE.test(v)) return null;
  return v;
}

export function extractDomain(value: string | null | undefined): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  let host = raw;
  if (host.includes("@")) {
    host = host.slice(host.lastIndexOf("@") + 1);
  } else {
    host = host.replace(/^https?:\/\//, "").replace(/^\/\//, "");
  }
  host = host.split("/")[0].split("?")[0].split("#")[0].replace(/:\d+$/, "");
  host = host.replace(/^www\./, "");
  if (!host || host.includes("@") || !host.includes(".")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}

export function resolveClienteDisplayName(c: IdGuardClienteInput): string {
  if (isPrivatoCliente(c.tipo_cliente)) {
    return [c.cognome, c.nome].filter(Boolean).join(" ").trim() || "—";
  }
  return String(c.ragione_sociale || "").trim() || "—";
}

export function firstValidEmail(c: IdGuardClienteInput): string | null {
  return normalizeEmail(c.email) || normalizeEmail(c.referente_email) || normalizeEmail(c.pec);
}

export function resolveIdGuardTarget(c: IdGuardClienteInput): IdGuardTarget {
  if (isPrivatoCliente(c.tipo_cliente)) {
    const email = firstValidEmail(c);
    if (!email) return { ok: false, tipo: "email", missing: "email" };
    return { ok: true, tipo: "email", target: email };
  }
  const domain =
    extractDomain(c.email) || extractDomain(c.pec) || extractDomain(c.referente_email);
  if (!domain) return { ok: false, tipo: "domain", missing: "domain" };
  return { ok: true, tipo: "domain", target: domain };
}

export function nextVerificaAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + IDGUARD_COOLDOWN_MS);
}

export function isCooldownActive(prossimaVerificaAt: string | Date | null | undefined, now = new Date()): boolean {
  if (!prossimaVerificaAt) return false;
  const t = prossimaVerificaAt instanceof Date ? prossimaVerificaAt : new Date(prossimaVerificaAt);
  if (Number.isNaN(t.getTime())) return false;
  return t.getTime() > now.getTime();
}

export function formatDateTimeIT(iso: string | Date | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

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

export function isVerifyBlocked(
  prossimaVerificaAt: string | Date | null | undefined,
  opts?: { isAdmin?: boolean; now?: Date },
): boolean {
  if (opts?.isAdmin) return false;
  return isCooldownActive(prossimaVerificaAt, opts?.now);
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

export function webhookEventTipo(type: string | null | undefined): IdGuardCheckTipo | null {
  if (type === "check.email.completed") return "email";
  if (type === "check.domain.completed") return "domain";
  return null;
}

export function webhookTarget(tipo: IdGuardCheckTipo, data: Record<string, unknown>): string | null {
  if (tipo === "email") {
    const email = normalizeEmail(String(data.email || ""));
    return email;
  }
  return extractDomain(String(data.domain || ""));
}
