/**
 * Mapping anagrafiche gestionale EXE (Roma EXE) → clienti CBnet.
 *
 * Scelte chiuse con il broker:
 * - Email obbligatoria = mail della sede ROMA 2 EXE (non si perdono le mail EXE: vanno in note/PEC).
 * - Specialist = profilo sede Roma EXE (codici_commerciali_cliente / Backoffice).
 * - Gruppo finanziario: Linea Persona / Aziende Private / Enti Pubblici Territoriali.
 * - Forma giuridica ricavata dal nome (SRL, SPA, condominio, …).
 * - Nome e cognome spezzati dalla ragione sociale (privati).
 * - Niente CF/P.IVA inventati. Dummy EXE (`00000000000`, `0`, `1`) → vuoto.
 * - Niente doppioni: se CF o P.IVA CBnet già esiste, si collega senza sovrascrivere.
 */

import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

export const ROMA_EXE_UFFICIO_CODICE = "RM2";
export const ROMA_EXE_SEDE_EMAIL = "romaexe@consulbrokers.it";
export const ROMA_EXE_SPECIALIST_EMAIL = "romaexe@consulbrokers.it";

export type TipoClienteCBnet = "privato" | "azienda" | "ente";

export type FormaGiuridicaCBnet =
  | "srl"
  | "spa"
  | "sas"
  | "snc"
  | "ditta_individuale"
  | "cooperativa"
  | "associazione"
  | "ente_pubblico"
  | "fondazione"
  | "consorzio"
  | "altro";

export type RomaExeClienteRiga = {
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  email1?: string | null;
  email2?: string | null;
  telefono1?: string | null;
  telefono2?: string | null;
  telefono3?: string | null;
  fax?: string | null;
  pec_o_nota?: string | null;
};

export type CatalogoClienteCBnet = {
  id: string;
  ufficio_id?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  codice_fiscale_azienda?: string | null;
};

export type RomaExeClienteRisolto = {
  exeCodice: string;
  codiceCliente: string;
  tipoCliente: TipoClienteCBnet;
  ragioneSociale: string;
  nome: string | null;
  cognome: string | null;
  titolo: string | null;
  codiceFiscale: string | null;
  partitaIva: string | null;
  codiceFiscaleAzienda: string | null;
  formaGiuridica: FormaGiuridicaCBnet | null;
  gruppoKey: "linea_persona" | "aziende_private" | "enti_territoriali";
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  indirizzoAlternativo: string | null;
  capAlternativo: string | null;
  cittaAlternativa: string | null;
  provinciaAlternativa: string | null;
  email: string;
  pec: string | null;
  telefono: string | null;
  cellulare: string | null;
  fax: string | null;
  note: string | null;
  esito: "esistente" | "da_creare";
  clienteId: string | null;
  motivo: string;
};

const TITOLI = [
  "DOTT.SSA",
  "DOTTSSA",
  "D.SSA",
  "AUT.SSA",
  "GEOM",
  "ARCH",
  "PROF",
  "AVV",
  "ING",
  "RAG",
  "CAV",
  "DON",
  "DR",
  "DOTT",
];

const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

const COMPANY_RE =
  /\b(S\.?R\.?L\.?S?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?|S\.?S\.?|COOP(?:ERATIVA)?|CONSORZIO|CONDOMINIO|COND\.|ASSOCIAZIONE|ASS\.NE|FONDAZIONE|SOCIETA'|SOCIETÀ|SOCIETA|SOC\.|LTD|LIMITED|GMBH|SGR|SPA)\b/i;

const ENTE_RE =
  /\b(COMUNE|PROVINCIA|PRELATURA|ENTE\b|ISTITUTO|UNIVERSIT|MINISTERO|REGIONE|ASL\b|USL\b|I\.?P\.?A\.?B)\b/i;

const COND_RE = /\b(COND\.|CONDOMINIO)\b/i;

export function normalizeTaxId(raw: string | null | undefined): string {
  return (raw || "").replace(/\s+/g, "").toUpperCase();
}

export function isDummyTaxId(raw: string | null | undefined): boolean {
  const v = normalizeTaxId(raw);
  if (!v) return true;
  if (v === "0" || v === "1" || v === "NO") return true;
  if (/^0+$/.test(v)) return true;
  return false;
}

export function cleanCodiceFiscalePersona(raw: string | null | undefined): string | null {
  const v = normalizeTaxId(raw);
  if (isDummyTaxId(v)) return null;
  if (v.length !== 16) return null;
  return v;
}

export function cleanPartitaIva(raw: string | null | undefined): string | null {
  const v = normalizeTaxId(raw).replace(/\D/g, "");
  if (isDummyTaxId(v)) return null;
  if (v.length !== 11) return null;
  return v;
}

export function extractEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const found = raw.match(EMAIL_RE) || [];
  const out: string[] = [];
  for (const e of found) {
    const low = e.toLowerCase();
    if (!out.includes(low)) out.push(low);
  }
  return out;
}

export function isPecNote(raw: string | null | undefined): boolean {
  return /no\s*pec/i.test(raw || "");
}

export function splitNomeCognome(ragioneSociale: string): {
  nome: string;
  cognome: string;
  titolo: string | null;
} {
  let t = (ragioneSociale || "").replace(/\s+/g, " ").trim();
  let titolo: string | null = null;
  for (const title of TITOLI) {
    const re = new RegExp(`\\b${title.replace(".", "\\.")}\\.?\\b`, "i");
    if (re.test(t)) {
      titolo = title.replace("DOTTSSA", "DOTT.SSA");
      t = t.replace(re, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }
  const parts = t.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return { nome: ragioneSociale.trim() || "—", cognome: ragioneSociale.trim() || "—", titolo };
  }
  if (parts.length === 1) {
    return { nome: parts[0], cognome: parts[0], titolo };
  }
  if (parts.length === 2) {
    return { cognome: parts[0], nome: parts[1], titolo };
  }
  const doubleNome = new Set([
    "MARIA", "ANNA", "GIAN", "GIOVAN", "GIOVANNI", "FRANCESCO", "PIER", "PIERO",
    "PIERA", "ROSA", "LUISA", "MARIE", "JORGE", "JEAN", "CARLO", "GIANNI",
    "FRANCESCOSAVERIO",
  ]);
  if (doubleNome.has(parts[parts.length - 2].toUpperCase())) {
    return {
      cognome: parts.slice(0, -2).join(" "),
      nome: parts.slice(-2).join(" "),
      titolo,
    };
  }
  return { cognome: parts.slice(0, -1).join(" "), nome: parts[parts.length - 1], titolo };
}

export function inferFormaGiuridica(ragione: string): FormaGiuridicaCBnet | null {
  const r = ragione || "";
  if (COND_RE.test(r)) return "altro";
  if (/\bS\.?R\.?L\.?S?\b/i.test(r) || /\bSRLS?\b/i.test(r)) return "srl";
  if (/\bS\.?P\.?A\.?\b/i.test(r) || /\bSPA\b/i.test(r)) return "spa";
  if (/\bS\.?A\.?S\.?\b/i.test(r) || /\bSAS\b/i.test(r)) return "sas";
  if (/\bS\.?N\.?C\.?\b/i.test(r) || /\bSNC\b/i.test(r)) return "snc";
  if (/\bCOOP(?:ERATIVA)?\b/i.test(r)) return "cooperativa";
  if (/\bFONDAZIONE\b/i.test(r)) return "fondazione";
  if (/\bCONSORZIO\b/i.test(r)) return "consorzio";
  if (/\bASSOCIAZIONE\b|\bASS\.NE\b/i.test(r)) return "associazione";
  if (ENTE_RE.test(r)) return "ente_pubblico";
  return null;
}

export function inferTipoCliente(
  ragione: string,
  cfPersona: string | null,
  piva: string | null,
  cfAzienda: string | null,
): TipoClienteCBnet {
  if (ENTE_RE.test(ragione) && !COND_RE.test(ragione)) return "ente";
  if (COND_RE.test(ragione) || COMPANY_RE.test(ragione)) return "azienda";
  if ((piva || cfAzienda) && !cfPersona) return "azienda";
  if (piva && cfPersona) return "azienda";
  if (cfPersona) return "privato";
  if (piva || cfAzienda) return "azienda";
  const words = ragione.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length >= 2 && words.length <= 4 && !COMPANY_RE.test(ragione)) return "privato";
  return "azienda";
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = (v || "").trim();
    if (t) return t;
  }
  return null;
}

function looksMobile(raw: string | null): boolean {
  if (!raw) return false;
  const d = raw.replace(/\D/g, "");
  return /^(3\d{8,9}|393\d{8,10})$/.test(d) || raw.trim().startsWith("3");
}

export function matchCatalogoCliente(
  tax: { cf?: string | null; piva?: string | null; cfAzienda?: string | null },
  catalogo: CatalogoClienteCBnet[],
  ufficioId?: string | null,
): CatalogoClienteCBnet | null {
  const keys = [tax.cf, tax.piva, tax.cfAzienda]
    .map((x) => normalizeTaxId(x))
    .filter((x) => x && !isDummyTaxId(x));
  if (!keys.length) return null;
  const hits = catalogo.filter((c) => {
    const vals = [c.codice_fiscale, c.partita_iva, c.codice_fiscale_azienda].map((x) => normalizeTaxId(x));
    return keys.some((k) => vals.includes(k));
  });
  if (!hits.length) return null;
  if (ufficioId) {
    const local = hits.find((h) => h.ufficio_id === ufficioId);
    if (local) return local;
  }
  return hits[0];
}

export function resolveRomaExeCliente(
  exeCodice: string | number,
  righe: RomaExeClienteRiga[],
  catalogo: CatalogoClienteCBnet[] = [],
  opts?: { ufficioId?: string | null; sedeEmail?: string },
): RomaExeClienteRisolto {
  const codice = String(exeCodice).trim();
  const rows = righe.length ? righe : [{}];
  const ragione = firstNonEmpty(rows.map((r) => r.ragione_sociale)) || `CLIENTE EXE ${codice}`;

  const cfRaw = firstNonEmpty(rows.map((r) => r.codice_fiscale));
  const pivaRaw = firstNonEmpty(rows.map((r) => r.partita_iva));

  const cfPersona = cleanCodiceFiscalePersona(cfRaw);
  const pivaFromCol = cleanPartitaIva(pivaRaw);
  const cf11 = cleanPartitaIva(cfRaw);
  const piva = pivaFromCol || (!cfPersona ? cf11 : null);
  const cfAzienda = cf11 && !cfPersona ? cf11 : piva;

  const tipo = inferTipoCliente(ragione, cfPersona, piva, cfAzienda);
  const formaNome = inferFormaGiuridica(ragione);
  const forma: FormaGiuridicaCBnet | null =
    tipo === "privato"
      ? null
      : formaNome || (tipo === "ente" ? "ente_pubblico" : piva && cfPersona ? "ditta_individuale" : "altro");

  const split = tipo === "privato" ? splitNomeCognome(ragione) : null;

  const addrs = rows
    .map((r) => ({
      indirizzo: (r.indirizzo || "").trim(),
      cap: (r.cap || "").trim(),
      citta: (r.citta || "").trim(),
      provincia: (r.provincia || "").trim().toUpperCase().slice(0, 2),
    }))
    .filter((a) => a.indirizzo);
  const primary = addrs[0] || { indirizzo: "", cap: "", citta: "", provincia: "" };
  const alt = addrs.find(
    (a) =>
      a.indirizzo &&
      a.indirizzo.toUpperCase() !== primary.indirizzo.toUpperCase(),
  );

  const mailExe: string[] = [];
  const pecs: string[] = [];
  for (const r of rows) {
    for (const e of extractEmails(r.email1)) mailExe.push(e);
    for (const e of extractEmails(r.email2)) mailExe.push(e);
    if (!isPecNote(r.pec_o_nota)) {
      for (const e of extractEmails(r.pec_o_nota)) pecs.push(e);
    }
  }
  const uniqueMail = [...new Set(mailExe)];
  const pec = pecs[0] || null;

  const tel = firstNonEmpty(rows.map((r) => r.telefono1));
  const tel2 = firstNonEmpty(rows.map((r) => r.telefono2));
  const tel3 = firstNonEmpty(rows.map((r) => r.telefono3));
  const cellulare = [tel2, tel3].find((t) => looksMobile(t)) || tel2 || null;
  const fax = firstNonEmpty(rows.map((r) => r.fax));

  const noteParts: string[] = [];
  if (uniqueMail.length) noteParts.push(`Mail gestionale EXE: ${uniqueMail.join(", ")}`);
  if (cfRaw && !cfPersona && !cf11 && !isDummyTaxId(cfRaw)) {
    noteParts.push(`CF EXE non importato (formato/checksum): ${normalizeTaxId(cfRaw)}`);
  }
  if (pivaRaw && !pivaFromCol && !isDummyTaxId(pivaRaw)) {
    noteParts.push(`P.IVA EXE non importata (formato/checksum): ${normalizeTaxId(pivaRaw)}`);
  }

  const email = opts?.sedeEmail || ROMA_EXE_SEDE_EMAIL;
  const gruppoKey =
    tipo === "privato" ? "linea_persona" : tipo === "ente" ? "enti_territoriali" : "aziende_private";

  const hit = matchCatalogoCliente(
    { cf: cfPersona, piva, cfAzienda },
    catalogo,
    opts?.ufficioId,
  );

  return {
    exeCodice: codice,
    codiceCliente: `RM2-${codice}`,
    tipoCliente: tipo,
    ragioneSociale: ragione,
    nome: split?.nome || null,
    cognome: split?.cognome || null,
    titolo: split?.titolo || null,
    codiceFiscale: tipo === "privato" ? cfPersona : null,
    partitaIva: tipo === "privato" ? null : piva,
    codiceFiscaleAzienda: tipo === "privato" ? null : cfAzienda || piva,
    formaGiuridica: forma,
    gruppoKey,
    indirizzo: primary.indirizzo || null,
    cap: primary.cap || null,
    citta: primary.citta || null,
    provincia: primary.provincia || null,
    indirizzoAlternativo: alt?.indirizzo || null,
    capAlternativo: alt?.cap || null,
    cittaAlternativa: alt?.citta || null,
    provinciaAlternativa: alt?.provincia || null,
    email,
    pec,
    telefono: tel,
    cellulare,
    fax,
    note: noteParts.length ? noteParts.join("\n") : null,
    esito: hit ? "esistente" : "da_creare",
    clienteId: hit?.id || null,
    motivo: hit ? "CF/P.IVA già in CBnet: collegato senza sovrascrivere" : "Nuova anagrafica Roma EXE",
  };
}

export function lookupRomaExeClienteId(
  exeCodice: string | number | null | undefined,
  map: Array<{ exe_codice: string; cliente_id: string | null }>,
): string | null {
  if (exeCodice == null || exeCodice === "") return null;
  const key = String(exeCodice).trim();
  return map.find((r) => r.exe_codice === key)?.cliente_id ?? null;
}

/** Solo per test / diagnostica: un CF 16 caratteri è accettabile in maschera? */
export function isCfPersonaValidoInMaschera(cf: string | null | undefined): boolean {
  if (!cf) return false;
  return validateCF(cf, { allowPIVAFormat: false }).valid;
}

export function isPivaValidaInMaschera(piva: string | null | undefined): boolean {
  if (!piva) return false;
  return validatePIVA(piva).valid;
}
