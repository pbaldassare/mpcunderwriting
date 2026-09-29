/**
 * Mapping anagrafiche gestionale sede Campobasso → clienti CBnet.
 *
 * Decisioni chiuse con il broker (2026-09-25):
 * - Nuovi si creano; esistenti Campobasso / 3G SPA / De Polo Anna si collegano.
 * - Omonimi con CF diverso = clienti nuovi.
 * - Non attivi (006931, 016962) esclusi da questo carico.
 * - Mail mancante → mail sede Campobasso.
 * - Melanitto specialist = corrispondente, non profilo backoffice.
 * - CF/P.IVA: padding zeri, CF troncato si importa comunque.
 * - codice_ricerca = codice gestionale; codice_cliente lo genera CBnet.
 * - Unit strani (Napoli / MFB) restano sulla sede Campobasso (Filiale).
 * - Gruppo statistico testuale, niente nidificazione in questo giro.
 * - Sui già presenti: solo codice_ricerca, niente tel/email/P.IVA.
 */

import { inferFormaGiuridica, splitNomeCognome } from "@/lib/romaExeClienti";
import { validatePIVA } from "@/lib/validatePIVA";

export const CAMPOBASSO_UFFICIO_CODICE = "CB";
export const CAMPOBASSO_SEDE_EMAIL = "campobasso@consulbrokers.it";
export const CAMPOBASSO_UFFICIO_ID = "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c";

export const CAMPOBASSO_SKIP_CODICI = new Set(["006931", "016962"]);

export type TipoClienteCBnet = "privato" | "azienda" | "ente";

export type CampobassoRiga = {
  Codice?: string | number | null;
  Nome?: string | null;
  Indirizzo?: string | null;
  Cap?: string | null;
  Comune?: string | null;
  Prov?: string | null;
  Tel?: string | null;
  Email?: string | null;
  AttenDi?: string | null;
  "F/G"?: string | null;
  CF?: string | null;
  PIva?: string | null;
  Brand?: string | null;
  Unit?: string | null;
  Specialist?: string | null;
  GruStat?: string | null;
  GruFin?: string | null;
  Prod1?: string | null;
  Indotto?: string | null;
  Filiale?: string | null;
  Zona?: string | null;
  Attivita?: string | null;
  SpecialistSX?: string | null;
  Stato?: string | null;
  Acquisito?: string | Date | number | null;
};

export type CatalogoClienteCBnet = {
  id: string;
  ufficio_id?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  codice_fiscale_azienda?: string | null;
  codice_ricerca?: string | null;
  codice_cliente?: string | null;
  nome_norm?: string | null;
};

export type CampobassoEsito = "da_creare" | "collegare" | "saltato";

export type CampobassoRisolto = {
  codice: string;
  tipoCliente: TipoClienteCBnet;
  ragioneSociale: string | null;
  nome: string | null;
  cognome: string | null;
  codiceFiscale: string | null;
  partitaIva: string | null;
  codiceFiscaleAzienda: string | null;
  formaGiuridica: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  email: string;
  pec: string | null;
  telefono: string | null;
  attenzioneDi: string | null;
  gruppoFinanziarioKey: "linea_persona" | "aziende_private" | "enti_territoriali" | "enti_no_lucro";
  gruppoStatistico: string | null;
  indotto: string | null;
  zona: string | null;
  attivita: string | null;
  specSx: string | null;
  brand: string;
  unit: string | null;
  specialist: string | null;
  prod1: string | null;
  dataAcquisito: string | null;
  esito: CampobassoEsito;
  clienteId: string | null;
  motivo: string;
  pivaPadded: boolean;
};

const CF16_RE =
  /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

const COMPANY_RE =
  /\b(S\.?R\.?L\.?S?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?|COOP(?:ERATIVA)?|CONSORZIO|CONDOMINIO|COND\.|ASSOCIAZIONE|ASS\.NE|FONDAZIONE|SOCIETA'|SOCIETÀ|SOCIETA|SOC\.)\b/i;

const ENTE_RE =
  /\b(COMUNE|PROVINCIA|PRELATURA|ENTE\b|ISTITUTO|UNIVERSIT|MINISTERO|REGIONE|ASL\b|USL\b|I\.?P\.?A\.?B)\b/i;

export function trimTxt(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

export function normalizeNomeKey(raw: string | null | undefined): string {
  return trimTxt(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTaxId(raw: unknown): string {
  return trimTxt(raw).replace(/\s+/g, "").toUpperCase();
}

export function isDummyTaxId(raw: unknown): boolean {
  const v = normalizeTaxId(raw);
  if (!v) return true;
  if (v === "0" || v === "1" || v === "NO") return true;
  if (/^0+$/.test(v)) return true;
  if (/^X+$/i.test(v)) return true;
  if (v.includes("ERRORE") || v.includes("*")) return true;
  return false;
}

export function padPartitaIva(raw: unknown): { value: string | null; padded: boolean } {
  if (isDummyTaxId(raw)) return { value: null, padded: false };
  const digits = normalizeTaxId(raw).replace(/\D/g, "");
  if (!digits) return { value: null, padded: false };
  if (digits.length === 11) return { value: digits, padded: false };
  if (digits.length < 11 && digits.length >= 8) {
    const padded = digits.padStart(11, "0");
    return { value: padded, padded: true };
  }
  return { value: digits, padded: false };
}

export function interpretCodiceFiscale(raw: unknown): {
  persona: string | null;
  piva: string | null;
  troncato: string | null;
} {
  const v = normalizeTaxId(raw);
  if (isDummyTaxId(v)) return { persona: null, piva: null, troncato: null };
  if (CF16_RE.test(v)) return { persona: v, piva: null, troncato: null };
  const asPiva = padPartitaIva(v);
  if (asPiva.value && asPiva.value.length === 11 && /^\d+$/.test(v.replace(/\D/g, ""))) {
    return { persona: null, piva: asPiva.value, troncato: null };
  }
  return { persona: null, piva: null, troncato: v };
}

export function isPecAddress(raw: string | null | undefined): boolean {
  const s = trimTxt(raw).toLowerCase();
  if (!s.includes("@")) return false;
  return (
    s.includes("pec") ||
    s.includes("legalmail") ||
    s.includes("certificata") ||
    s.endsWith(".gov.it")
  );
}

export function resolveEmail(raw: string | null | undefined, sedeEmail = CAMPOBASSO_SEDE_EMAIL): {
  email: string;
  pec: string | null;
} {
  const v = trimTxt(raw).toLowerCase();
  const looksMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!looksMail) return { email: sedeEmail, pec: null };
  if (isPecAddress(v)) return { email: sedeEmail, pec: v };
  return { email: v, pec: null };
}

export function inferTipoCampobasso(opts: {
  nome: string;
  fg: string;
  gruFin: string;
  cfPersona: string | null;
  piva: string | null;
}): TipoClienteCBnet {
  const nome = opts.nome || "";
  const gf = (opts.gruFin || "").toUpperCase();
  if (
    gf.includes("ENTE") ||
    gf.includes("PUBBLIC") ||
    (ENTE_RE.test(nome) && !COMPANY_RE.test(nome))
  ) {
    return "ente";
  }
  if (COMPANY_RE.test(nome)) return "azienda";
  if (opts.fg === "F" || gf === "LINEA PERSONA") {
    if (opts.piva && !opts.cfPersona) return "azienda";
    return "privato";
  }
  if (opts.cfPersona && !opts.piva) return "privato";
  return "azienda";
}

export function gruppoFinanziarioKey(
  tipo: TipoClienteCBnet,
  gruFin: string,
): CampobassoRisolto["gruppoFinanziarioKey"] {
  const gf = (gruFin || "").trim().toUpperCase();
  if (gf.includes("SENZA SCOPO") || gf.includes("NO LUCRO")) return "enti_no_lucro";
  if (gf.includes("TERRITORIAL") || tipo === "ente") return "enti_territoriali";
  if (gf.includes("LINEA PERSONA") || tipo === "privato") return "linea_persona";
  return "aziende_private";
}

export function unitIsPersona(unit: string | null | undefined): boolean {
  const u = normalizeNomeKey(unit);
  if (!u) return false;
  if (u.includes("SEDE")) return false;
  if (u.includes("UFFICIO")) return false;
  if (u.includes("MFB")) return false;
  if (u.includes("UNDERWRITING")) return false;
  return true;
}

export function specialistIsBackoffice(specialist: string | null | undefined): "tallini" | "ferro" | null {
  const s = normalizeNomeKey(specialist);
  if (s.includes("TALLINI")) return "tallini";
  if (s.includes("FERRO") && s.includes("LOREDANA")) return "ferro";
  if (s === "FERRO LOREDANA" || s === "LOREDANA FERRO") return "ferro";
  return null;
}

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 20000 && n <= 60000) {
    const utc = Date.UTC(1899, 11, 30) + n * 86400000;
    return new Date(utc).toISOString().slice(0, 10);
  }
  return null;
}

export function matchCatalogoCampobasso(
  tax: { cf?: string | null; piva?: string | null; cfAzienda?: string | null; nome?: string | null },
  catalogo: CatalogoClienteCBnet[],
  ufficioId = CAMPOBASSO_UFFICIO_ID,
): CatalogoClienteCBnet | null {
  const keys = [tax.cf, tax.piva, tax.cfAzienda]
    .map((x) => normalizeTaxId(x))
    .filter((x) => x && !isDummyTaxId(x));
  const taxHits = keys.length
    ? catalogo.filter((c) => {
        const vals = [c.codice_fiscale, c.partita_iva, c.codice_fiscale_azienda].map((x) =>
          normalizeTaxId(x),
        );
        return keys.some((k) => vals.includes(k));
      })
    : [];
  if (taxHits.length) {
    return taxHits.find((h) => h.ufficio_id === ufficioId) || taxHits[0];
  }
  const nome = normalizeNomeKey(tax.nome);
  if (nome === "TAMMARO CARMELA" || nome === "CARMELA TAMMARO") {
    const hit = catalogo.find((c) => {
      const n = normalizeNomeKey(c.nome_norm);
      return n === "TAMMARO CARMELA" || n === "CARMELA TAMMARO";
    });
    if (hit) return hit;
  }
  return null;
}

export function resolveCampobassoCliente(
  riga: CampobassoRiga,
  catalogo: CatalogoClienteCBnet[] = [],
  opts?: { sedeEmail?: string; ufficioId?: string },
): CampobassoRisolto {
  const codice = trimTxt(riga.Codice);
  const nome = trimTxt(riga.Nome);
  const fg = trimTxt(riga["F/G"]).toUpperCase();
  const gruFin = trimTxt(riga.GruFin);
  const stato = trimTxt(riga.Stato).toUpperCase();
  const sedeEmail = opts?.sedeEmail || CAMPOBASSO_SEDE_EMAIL;

  const cfInfo = interpretCodiceFiscale(riga.CF);
  const pivaCol = padPartitaIva(riga.PIva);
  const piva = pivaCol.value || cfInfo.piva;
  const pivaPadded = pivaCol.padded || (!pivaCol.value && !!cfInfo.piva);
  const cfPersona = cfInfo.persona;
  const cfTroncato = cfInfo.troncato;

  const tipo = inferTipoCampobasso({
    nome,
    fg,
    gruFin,
    cfPersona,
    piva,
  });

  const codiceFiscale = tipo === "privato" ? cfPersona || cfTroncato : null;
  const codiceFiscaleAzienda =
    tipo === "privato" ? null : cfPersona || cfInfo.piva || piva || cfTroncato;
  const forma = tipo === "privato" ? null : inferFormaGiuridica(nome);
  const split = tipo === "privato" ? splitNomeCognome(nome) : null;
  const mail = resolveEmail(riga.Email, sedeEmail);

  const base: CampobassoRisolto = {
    codice,
    tipoCliente: tipo,
    ragioneSociale: tipo === "privato" ? null : nome || null,
    nome: split?.nome || null,
    cognome: split?.cognome || null,
    codiceFiscale,
    partitaIva: piva,
    codiceFiscaleAzienda,
    formaGiuridica: forma,
    indirizzo: trimTxt(riga.Indirizzo) || null,
    cap: trimTxt(riga.Cap) || null,
    citta: trimTxt(riga.Comune) || null,
    provincia: trimTxt(riga.Prov).toUpperCase() || null,
    email: mail.email,
    pec: mail.pec,
    telefono: trimTxt(riga.Tel) || null,
    attenzioneDi: trimTxt(riga.AttenDi) || null,
    gruppoFinanziarioKey: gruppoFinanziarioKey(tipo, gruFin),
    gruppoStatistico: trimTxt(riga.GruStat) || null,
    indotto: trimTxt(riga.Indotto) || null,
    zona: trimTxt(riga.Zona) || null,
    attivita: trimTxt(riga.Attivita) || null,
    specSx: trimTxt(riga.SpecialistSX) || null,
    brand: trimTxt(riga.Brand) || "Consulbrokers",
    unit: trimTxt(riga.Unit) || null,
    specialist: trimTxt(riga.Specialist) || null,
    prod1: trimTxt(riga.Prod1) || null,
    dataAcquisito: excelDateToIso(riga.Acquisito),
    esito: "da_creare",
    clienteId: null,
    motivo: "nuovo",
    pivaPadded,
  };

  if (!codice || CAMPOBASSO_SKIP_CODICI.has(codice) || stato === "NON ATTIVO") {
    return { ...base, esito: "saltato", motivo: "non_attivo_o_escluso" };
  }

  const hit = matchCatalogoCampobasso(
    { cf: codiceFiscale, piva, cfAzienda: codiceFiscaleAzienda, nome },
    catalogo,
    opts?.ufficioId || CAMPOBASSO_UFFICIO_ID,
  );
  if (hit) {
    return {
      ...base,
      esito: "collegare",
      clienteId: hit.id,
      motivo: hit.ufficio_id === (opts?.ufficioId || CAMPOBASSO_UFFICIO_ID)
        ? "gia_in_sede_campobasso"
        : "gia_in_altra_sede",
    };
  }

  return base;
}

export function pickKeepers(resolved: CampobassoRisolto[]): {
  keepers: CampobassoRisolto[];
  dups: CampobassoRisolto[];
} {
  const seenTax = new Set<string>();
  const keepers: CampobassoRisolto[] = [];
  const dups: CampobassoRisolto[] = [];

  const rank = (r: CampobassoRisolto) => {
    let n = 0;
    if (r.codiceFiscale) n += 3;
    if (r.partitaIva && validatePIVA(r.partitaIva).valid) n += 3;
    if (r.indirizzo) n += 1;
    if (r.email !== CAMPOBASSO_SEDE_EMAIL) n += 1;
    if (r.telefono) n += 1;
    return n;
  };

  const sorted = [...resolved].sort((a, b) => {
    if (a.esito !== b.esito) {
      if (a.esito === "collegare") return -1;
      if (b.esito === "collegare") return 1;
    }
    return rank(b) - rank(a) || a.codice.localeCompare(b.codice);
  });

  for (const r of sorted) {
    if (r.esito === "saltato") {
      dups.push(r);
      continue;
    }
    const keys = [r.codiceFiscale, r.partitaIva, r.codiceFiscaleAzienda]
      .map((x) => normalizeTaxId(x))
      .filter((x) => x.length >= 11);
    const clash = keys.find((k) => seenTax.has(k));
    if (clash && r.esito === "da_creare") {
      dups.push({ ...r, esito: "saltato", motivo: `doppione_file:${clash}` });
      continue;
    }
    for (const k of keys) seenTax.add(k);
    keepers.push(r);
  }

  return { keepers, dups };
}
