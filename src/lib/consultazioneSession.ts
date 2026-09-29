/** Sessione soft area consultazione (nessuna auth Supabase). */

export const CONSULTAZIONE_DISCLAIMER_VERSION = "2026-08-03";

/** Domini email autorizzati per area consultazione / Assistente Web. */
export const CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS = [
  "consulbrokers.it",
  "cbdigital.tech",
  "etisicura.it",
  "mpcunderwriting.it",
  "interfidi.net",
  "gbintermediazioni.it",
  "exebroker.it",
  "igbsrl.it",
  "probroker.it",
  "dibroker.it",
] as const;

export const CONSULTAZIONE_STORAGE_KEY = "cbnet_consultazione_session_v1";

/** @deprecated Usare CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS */
export const CONSULTAZIONE_EMAIL_DOMAIN = "@consulbrokers.it";

export type ConsultazioneSession = {
  email: string;
  acceptedAt: string;
  disclaimerVersion: string;
};

export function normalizeConsultazioneEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailDomain(email: string): string | null {
  const e = normalizeConsultazioneEmail(email);
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  return e.slice(at + 1);
}

export function isConsultazioneEmailAllowed(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return (CONSULTAZIONE_ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export function readConsultazioneSession(): ConsultazioneSession | null {
  try {
    const raw = localStorage.getItem(CONSULTAZIONE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsultazioneSession;
    if (!parsed?.email || !parsed?.acceptedAt || !parsed?.disclaimerVersion) return null;
    if (!isConsultazioneEmailAllowed(parsed.email)) return null;
    if (parsed.disclaimerVersion !== CONSULTAZIONE_DISCLAIMER_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsultazioneSession(email: string): ConsultazioneSession {
  const session: ConsultazioneSession = {
    email: normalizeConsultazioneEmail(email),
    acceptedAt: new Date().toISOString(),
    disclaimerVersion: CONSULTAZIONE_DISCLAIMER_VERSION,
  };
  localStorage.setItem(CONSULTAZIONE_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearConsultazioneSession(): void {
  localStorage.removeItem(CONSULTAZIONE_STORAGE_KEY);
}

export const CONSULTAZIONE_DISCLAIMER_TEXT = `
Dichiaro di accedere a quest'area esclusivamente per finalità professionali nel settore assicurativo e brokeraggio.

Sono consapevole che:
• i dati consultati e le ricerche effettuate possono essere registrati e condivisi con soggetti autorizzati;
• l'Assistente Web cerca informazioni sul web e non accede al portafoglio polizze o ai dati interni del gestionale;
• l'uso è riservato all'attività professionale con email aziendale del partner autorizzato.

Accettando, confermo di aver letto e compreso queste condizioni.
`.trim();
