/**
 * Mapping compagnie gestionale EXE (Roma EXE) → catalogo CBnet.
 *
 * Scelte chiuse con il broker:
 * - La ragione sociale EXE è la compagnia (non l'agenzia di sede).
 * - La ragione sociale aggiuntiva è la controparte EXE: non si importa.
 * - Non si creano direzioni fittizie se manca il gruppo madre.
 * - Niente doppioni: stesso brand → stessa compagnia CBnet.
 * - Le agenzie restano visibili a tutte le sedi.
 */

export type CatalogoCompagniaCBnet = {
  id: string;
  nome: string;
  codice?: string | null;
  tipo?: string | null;
  gruppo_compagnia_id?: string | null;
};

export type CatalogoGruppoCompagnia = {
  id: string;
  descrizione: string;
};

export type CompagniaTipoCBnet = "direzione" | "agenzia" | "broker" | "plurimandataria";

export type RomaExeCompagniaCanon = {
  canonical: string;
  brand: string;
  skip?: boolean;
  motivoSkip?: string;
};

export type RomaExeCompagniaRisolta = RomaExeCompagniaCanon & {
  compagniaId: string | null;
  codiceCBnet: string | null;
  tipo: CompagniaTipoCBnet;
  gruppoCompagniaId: string | null;
  esito: "esistente" | "da_creare" | "saltata";
  motivo: string;
};

type AliasDef = {
  keys: string[];
  canonical: string;
  brand: string;
  skip?: boolean;
  motivoSkip?: string;
};

const ALIAS: AliasDef[] = [
  {
    keys: ["EXE INSURANCE BROKER", "EXE INSURANCE", "CONSULBROKERS", "CONSULNET"],
    canonical: "EXE INSURANCE BROKER",
    brand: "EXE",
    skip: true,
    motivoSkip: "Siamo noi: non si crea una compagnia CBnet",
  },
  {
    keys: [
      "GENERALI ASSICURAZIONI",
      "GENERALI ASSICURAZIONI SPA",
      "GENERALI ASSICURAZIONI VITA",
      "GENERALI ITALIA SPA",
      "GENERALI ITALIA",
    ],
    canonical: "GENERALI ITALIA SPA",
    brand: "GENERALI ITALIA",
  },
  {
    keys: ["CATTOLICA ASSICURAZIONI", "CATTOLICA"],
    canonical: "CATTOLICA ASSICURAZIONI",
    brand: "CATTOLICA",
  },
  {
    keys: [
      "UNIPOL ASSICURAZIONI SPA",
      "UNIPOL ASSICURAZIONI SPA VITA",
      "UNIPOL ASSICURAZIONI SPA DG ENTI PUBBLICI",
      "UNIPOLSAI",
    ],
    canonical: "UNIPOL ASSICURAZIONI SPA",
    brand: "UNIPOLSAI",
  },
  { keys: ["UNISALUTE SPA", "UNISALUTE"], canonical: "UNISALUTE SPA", brand: "UNIPOLSAI" },
  { keys: ["ITAS", "ITAS MUTUA", "ITAS ASSICURAZIONI"], canonical: "ITAS MUTUA", brand: "ITAS" },
  {
    keys: ["CHUBB EUROPEAN GROUP LIMITED", "CHUBB EUROPEAN GROUP SE", "CHUBB"],
    canonical: "CHUBB EUROPEAN GROUP SE",
    brand: "CHUBB",
  },
  {
    keys: ["AIG EUROPE LIMITED", "AIG EUROPE LIMITED IN ITALIA", "AIG EUROPE SA", "AIG EUROPE", "AIG"],
    canonical: "AIG EUROPE S.A.",
    brand: "AIG",
  },
  { keys: ["AIG ADVISORS"], canonical: "AIG ADVISORS", brand: "AIG" },
  { keys: ["ALLIANZ SPA", "ALLIANZ DIREZIONE", "ALLIANZ"], canonical: "ALLIANZ SPA", brand: "ALLIANZ" },
  { keys: ["ALLIANZ NEXT SPA", "ALLIANZ NEXT"], canonical: "ALLIANZ NEXT SPA", brand: "ALLIANZ" },
  { keys: ["ALLIANZ CARE", "ALLIANZ WORLDWIDE CARE"], canonical: "ALLIANZ CARE", brand: "ALLIANZ" },
  { keys: ["ALLIANZ GLOBAL LIFE DAC", "ALLIANZ GLOBAL LIFE"], canonical: "ALLIANZ GLOBAL LIFE DAC", brand: "ALLIANZ" },
  {
    keys: ["AM TRUST EUROPE", "AMTRUST", "AMTRUST ASSICURAZIONI SEDE", "AMTRUST ASSICURAZIONI"],
    canonical: "AMTRUST ASSICURAZIONI",
    brand: "Amtrust Assicurazioni Spa",
  },
  {
    keys: ["AM TRUST INSURANCE AGENCY ITALY", "AMTRUST INSURANCE AGENCY ITALY SRL"],
    canonical: "AMTRUST INSURANCE AGENCY ITALY SRL",
    brand: "Amtrust Assicurazioni Spa",
  },
  { keys: ["ARAG", "ARAG SE"], canonical: "ARAG SE", brand: "ARAG" },
  { keys: ["ARCH INSURANCE"], canonical: "ARCH INSURANCE", brand: "DUAL AGENCY" },
  {
    keys: ["ARGOGLOBAL ASSICURAZIONI SPA", "ARGOGLOBAL SE", "ARGOGLOBAL"],
    canonical: "ARGOGLOBAL ASSICURAZIONI SPA",
    brand: "Argoglobal Assicurazioni Spa",
  },
  { keys: ["ASSICURATRICE MILANESE"], canonical: "ASSICURATRICE MILANESE", brand: "ASSICURATRICE MILANESE" },
  {
    keys: ["ATRADIUS CREDIT Y CAUCION SA", "ATRADIUS CREDITO Y CAUCION SA", "ATRADIUS"],
    canonical: "ATRADIUS CREDITO Y CAUCION SA",
    brand: "ATRADIUS",
  },
  { keys: ["AXA ART"], canonical: "AXA ART", brand: "AXA" },
  { keys: ["AXA QUIRINALE", "ASSICURAZIONI QUIRINALE"], canonical: "AXA QUIRINALE", brand: "AXA" },
  { keys: ["AXA VIMINALE"], canonical: "AXA VIMINALE", brand: "AXA" },
  { keys: ["BENE ASSICURAZIONI", "BENE ASSICURAZIONI SPA"], canonical: "BENE ASSICURAZIONI SPA", brand: "BENE" },
  {
    keys: ["BERKSHIRE HATHAWAY", "BERKSHIRE HATHAWAY INTERNATIONAL INSURANCE LIMITED"],
    canonical: "BERKSHIRE HATHAWAY INTERNATIONAL INSURANCE LIMITED",
    brand: "Berkshire Hathaway International Insurance Limite",
  },
  { keys: ["CNA"], canonical: "CNA INSURANCE COMPANY (EUROPE) S.A.", brand: "CNA" },
  { keys: ["COFACE ASSICURAZIONI", "COFACE ENTI PUBBLICI", "COFACE SPA", "COFACE"], canonical: "COFACE", brand: "COFACE" },
  { keys: ["DALLBOGG"], canonical: "DALLBOGG", brand: "DALLBOG" },
  {
    keys: ["DAS DIFESA LEGALE", "DAS DIF PENALE ENTI PUBBLICI", "DAS", "D A S DIFESA AUTOMOBILISTICA SPA"],
    canonical: "D.A.S. DIFESA AUTOMOBILISTICA SPA",
    brand: "DAS",
  },
  {
    keys: ["ELBA ASSICURAZIONI", "ELBA ASSICURAZIONI SPA", "REVO", "REVO INSURANCE SPA"],
    canonical: "REVO INSURANCE SPA",
    brand: "REVO",
  },
  { keys: ["EUROP ASSISTANCE ITALIA SPA"], canonical: "EUROP ASSISTANCE ITALIA SPA", brand: "EUROP ASSISTANCE ITALIA" },
  { keys: ["GLOBAL ASSISTANCE", "GLOBAL ASSISTANCE ENTI PUBBLICI"], canonical: "GLOBAL ASSISTANCE", brand: "GLOBAL ASSISTANCE" },
  { keys: ["GREAT LAKES INSURANCE SE", "GREAT LAKES"], canonical: "GREAT LAKES INSURANCE SE", brand: "Great Lakes Insurance Re" },
  { keys: ["GROUPAMA ASSICURAZIONI", "GROUPAMA"], canonical: "GROUPAMA ASSICURAZIONI SPA", brand: "Groupama Assicurazioni Spa" },
  { keys: ["HDI", "HDI ASSICURAZIONI SPA"], canonical: "HDI ASSICURAZIONI SPA", brand: "Hdi Assicurazioni Spa" },
  { keys: ["HELVETIA ASSICURAZIONI", "HELVETIA ASSICURAZIONI SA", "HELVETIA"], canonical: "HELVETIA ASSICURAZIONI", brand: "HELVETIA" },
  { keys: ["HELVETIA VITA SPA"], canonical: "HELVETIA VITA SPA", brand: "HELVETIA" },
  { keys: ["ITALIANA", "ITALIANA ASSICURAZIONI"], canonical: "ITALIANA ASSICURAZIONI", brand: "Italiana Assicurazioni" },
  {
    keys: [
      "LIBERTY MUTUAL INSURANCE EUROPE",
      "LIBERTY MUTUAL INSURANCE EUROPE SE",
      "LIBERTY MUTUAL INSURANCE LTD",
      "LIBERTY SPECIALTY MARKETS",
      "LIBERTY SPECIALTY MARKETS ENTI PUBBLICI",
      "LIBERTY",
    ],
    canonical: "LIBERTY MUTUAL INSURANCE EUROPE S.E.",
    brand: "LIBERTY",
  },
  {
    keys: [
      "LLOYDS",
      "LLOYDS OF LONDON",
      "LLOYDS OF LONDON LPS MILANO",
      "LLOYDS INSURANCE COMPANY",
      "LLOYDS INSURANCE COMPANY SA",
      "LLOYDS INSURANCE COMPANY S A",
      "LLOYDS INSURANCE COMPANY SA ENTI PUBBLICI",
      "LLOYDS INSURANCE COMPANY SA LPS",
      "LLOYDS INSURANCE COMPANY SA TYSER BELGIUM",
      "LLOYDS INSURNCE COMPANY SA",
    ],
    canonical: "LLOYD'S INSURANCE COMPANY S.A.",
    brand: "Lloyd's",
  },
  { keys: ["METLIFE EUROPE DAC", "METLIFE"], canonical: "METLIFE EUROPE DAC", brand: "METLIFE" },
  { keys: ["NOBIS"], canonical: "NOBIS", brand: "NOBIS" },
  { keys: ["QBE EUROPE"], canonical: "QBE EUROPE", brand: "QBE" },
  { keys: ["REALE MUTUA", "REALE MUTUA ASSICURAZIONI"], canonical: "REALE MUTUA", brand: "REALE MUTUA" },
  {
    keys: ["ROLAND", "ROLAND ASSICURAZIONI", "ROLAND RECHTSSCHUTZ VERSICHERUNGS AG"],
    canonical: "ROLAND RECHTSSCHUTZ VERSICHERUNGS AG",
    brand: "ROLAND RECHTSSCHUTZ VERSICHERUNGS AG",
  },
  { keys: ["S2C SPA", "S2C"], canonical: "S2C SPA", brand: "S2C" },
  { keys: ["SACE BT SPA", "SACE"], canonical: "SACE BT SPA", brand: "SACE" },
  { keys: ["SARA ASSICURAZIONI SPA", "SARA"], canonical: "SARA ASSICURAZIONI SPA", brand: "Sara Ass.ni" },
  { keys: ["TOKIO MARINE EUROPE SA", "TOKIO MARINE"], canonical: "TOKIO MARINE EUROPE SA", brand: "TOKIO MARINE" },
  { keys: ["TUA ASSICURAZIONI", "TUA ASSICURAZIONI SPA"], canonical: "TUA ASSICURAZIONI SPA", brand: "Da definire" },
  { keys: ["TUTELA LEGALE SPA"], canonical: "TUTELA LEGALE SPA", brand: "Tutela Legale Spa" },
  {
    keys: ["UCA SPA", "UCA ASSNE SPESE LEGALI E PERITALI", "UCA ASSICURAZIONI SPA"],
    canonical: "UCA ASSICURAZIONI S.P.A.",
    brand: "Uca Assicurazioni S.p.a.",
  },
  { keys: ["VITTORIA ASSICURAZIONI", "VITTORIA"], canonical: "VITTORIA ASSICURAZIONI", brand: "Vittoria Ass.ni" },
  { keys: ["VHV VERSICHERUNGEN", "VHV"], canonical: "VHV VERSICHERUNGEN", brand: "VHV" },
  { keys: ["XL INSURANCE COMPANY SE"], canonical: "XL INSURANCE COMPANY SE", brand: "XL INSURANCE COMPANY SE" },
  { keys: ["ZURICH", "ZURICH INSURANCE PLC"], canonical: "ZURICH INSURANCE PLC", brand: "Zurich Insurance Company Ltd" },
  { keys: ["ZURICH INVESTMENTS LIFE SPA"], canonical: "ZURICH INVESTMENTS LIFE SPA", brand: "Zurich Insurance Company Ltd" },
  { keys: ["ROYAL SUN ALLIACE SIM SPA", "ROYAL SUN ALLIANCE", "ROYAL E SUN A"], canonical: "ROYAL SUN ALLIANCE", brand: "ROYAL & SUN A." },
  { keys: ["GENCASSE SPA", "GENCASSE"], canonical: "GENCASSE SPA", brand: "Da definire" },
  { keys: ["CNA INSURANCE COMPANY EUROPE SA"], canonical: "CNA INSURANCE COMPANY (EUROPE) S.A.", brand: "CNA" },
];

const ALIAS_BY_KEY = new Map<string, AliasDef>();
for (const a of ALIAS) {
  ALIAS_BY_KEY.set(normKey(a.canonical), a);
  for (const k of a.keys) ALIAS_BY_KEY.set(normKey(k), a);
}

export function normalizeCompagniaNome(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'/g, "")
    .toUpperCase()
    .replace(/ASS\.?\s*NI\.?/g, "ASSICURAZIONI")
    .replace(/\bASSNI\b/g, "ASSICURAZIONI")
    .replace(/S\.?\s*P\.?\s*A\.?/g, "SPA")
    .replace(/S\.?\s*R\.?\s*L\.?/g, "SRL")
    .replace(/\bS\.?\s*A\.?\b/g, "SA")
    .replace(/&/g, "E")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normKey(value: string | null | undefined): string {
  return normalizeCompagniaNome(value).replace(/\s+/g, "");
}

function stripSuffixes(normalized: string): string {
  return normalized
    .replace(/\bVITA\b/g, " ")
    .replace(/\bDG ENTI PUBBLICI\b/g, " ")
    .replace(/\bENTI PUBBLICI\b/g, " ")
    .replace(/\bLPS\b/g, " ")
    .replace(/\bTYSER BELGIUM\b/g, " ")
    .replace(/\bRAPPRESENTANZA( PER L.? ITALIA| IN ITALIA)?\b/g, " ")
    .replace(/\bIN ITALIA\b/g, " ")
    .replace(/\bDIREZIONE\b/g, " ")
    .replace(/\bINSURANCE\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonRomaExeCompagnia(nome: string | null | undefined): RomaExeCompagniaCanon {
  const raw = String(nome ?? "").trim();
  const normalized = normalizeCompagniaNome(raw);
  const stripped = stripSuffixes(normalized);
  const hit = ALIAS_BY_KEY.get(normKey(normalized)) ?? ALIAS_BY_KEY.get(normKey(stripped));
  if (hit) {
    return {
      canonical: hit.canonical,
      brand: hit.brand,
      skip: hit.skip,
      motivoSkip: hit.motivoSkip,
    };
  }
  return {
    canonical: raw.replace(/\s+/g, " ").trim() || normalized,
    brand: stripped || normalized,
  };
}

function hasAgencyMarker(n: string): boolean {
  if (/\bAGENZIA\b/.test(n) || /\bGERENZA\b/.test(n) || /\bQUIRINALE\b/.test(n) || /\bVIMINALE\b/.test(n)) {
    return true;
  }
  // "AG" = agenzia solo se non è la forma societaria tedesca in coda (VERSICHERUNGS AG)
  return /\bAG\b/.test(n) && !/\bAG$/.test(n);
}

export function isSedeLocaleNome(nome: string | null | undefined): boolean {
  const n = normalizeCompagniaNome(nome);
  if (!n) return false;
  return hasAgencyMarker(n) || /\bSAN DONA\b/.test(n) || /\bDI PIAVE\b/.test(n);
}

export function inferTipoCompagnia(nome: string | null | undefined): CompagniaTipoCBnet {
  const n = normalizeCompagniaNome(nome);
  if (/\bBROKER\b/.test(n)) return "broker";
  if (hasAgencyMarker(n)) return "agenzia";
  if (
    /\bDIREZIONE\b/.test(n) ||
    /\bSPA\b/.test(n) ||
    /\bSA\b/.test(n) ||
    /\bSE\b/.test(n) ||
    /\bDAC\b/.test(n) ||
    /\bPLC\b/.test(n) ||
    /\bMUTUA\b/.test(n) ||
    /\bLIMITED\b/.test(n) ||
    /\bLTD\b/.test(n) ||
    /\bNV\b/.test(n)
  ) {
    return "direzione";
  }
  return "plurimandataria";
}

export function resolveGruppoCompagnia(
  brand: string,
  gruppi: CatalogoGruppoCompagnia[],
): CatalogoGruppoCompagnia | null {
  const want = normKey(brand);
  if (!want || want === "DADEFINIRE") return null;
  const exact = gruppi.find((g) => normKey(g.descrizione) === want);
  if (exact) return exact;
  const contains = gruppi.filter((g) => {
    const gn = normKey(g.descrizione);
    if (gn.length < 5 || want.length < 5) return false;
    return gn.includes(want) || want.includes(gn);
  });
  if (contains.length === 1) return contains[0];
  const prefer = contains.find((g) => !/agenzia|ag\b|san dona/i.test(g.descrizione));
  return prefer ?? contains[0] ?? null;
}

function rankMatch(row: CatalogoCompagniaCBnet): number {
  let score = 0;
  if (row.tipo === "direzione") score += 40;
  if (row.tipo === "plurimandataria") score += 20;
  if (!isSedeLocaleNome(row.nome)) score += 30;
  score -= String(row.nome).length / 100;
  return score;
}

export function matchCatalogoCompagnia(
  nomeExe: string | null | undefined,
  catalogo: CatalogoCompagniaCBnet[],
): CatalogoCompagniaCBnet | null {
  const canon = canonRomaExeCompagnia(nomeExe);
  if (canon.skip) return null;
  const want = normKey(canon.canonical);
  const candidates = catalogo.filter((c) => {
    if (isSedeLocaleNome(c.nome)) return false;
    const cn = canonRomaExeCompagnia(c.nome);
    return normKey(cn.canonical) === want || normKey(c.nome) === want;
  });
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => rankMatch(b) - rankMatch(a))[0] ?? null;
}

export function resolveRomaExeCompagnia(
  nomeExe: string | null | undefined,
  catalogo: CatalogoCompagniaCBnet[],
  gruppi: CatalogoGruppoCompagnia[] = [],
): RomaExeCompagniaRisolta | null {
  const raw = String(nomeExe ?? "").trim();
  if (!raw) return null;
  const canon = canonRomaExeCompagnia(raw);
  if (canon.skip) {
    return {
      ...canon,
      compagniaId: null,
      codiceCBnet: null,
      tipo: "broker",
      gruppoCompagniaId: null,
      esito: "saltata",
      motivo: canon.motivoSkip ?? "Saltata",
    };
  }

  const gruppo = resolveGruppoCompagnia(canon.brand, gruppi);
  const inferred = inferTipoCompagnia(canon.canonical);
  const tipo: CompagniaTipoCBnet =
    (inferred === "direzione" || inferred === "agenzia") && !gruppo ? "plurimandataria" : inferred;

  const hit = matchCatalogoCompagnia(raw, catalogo);
  if (hit) {
    return {
      ...canon,
      compagniaId: hit.id,
      codiceCBnet: hit.codice ?? null,
      tipo: (hit.tipo as CompagniaTipoCBnet) || tipo,
      gruppoCompagniaId: hit.gruppo_compagnia_id ?? gruppo?.id ?? null,
      esito: "esistente",
      motivo: `Collegata a ${hit.nome} (${hit.codice ?? "senza codice"})`,
    };
  }

  return {
    ...canon,
    compagniaId: null,
    codiceCBnet: null,
    tipo,
    gruppoCompagniaId: gruppo?.id ?? null,
    esito: "da_creare",
    motivo: `Da creare come ${tipo}`,
  };
}

export function codiceRomaExeCompagnia(exeCodice: string | number | null | undefined): string {
  const n = String(exeCodice ?? "").replace(/\D/g, "");
  return `RM2${n.padStart(4, "0")}`.slice(0, 12);
}

export function splitExeEmail(raw: string | null | undefined): { mail: string | null; pec: string | null } {
  const text = String(raw ?? "");
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const pec = emails.find((e) => /pec|legalmail/i.test(e)) ?? emails.find((e) => /pec/i.test(text)) ?? null;
  const mail = emails.find((e) => e !== pec) ?? emails[0] ?? null;
  return { mail: mail?.toLowerCase() ?? null, pec: pec?.toLowerCase() ?? null };
}

export function normalizeIbanExe(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iban = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!iban || iban.includes("*")) return null;
  if (iban.startsWith("IT") && iban.length === 27) return iban;
  return null;
}

/** Anagrafica EXE si collega solo se non c'è una controparte (aggiuntiva). */
export function anagraficaCollegabile(aggiuntiva: string | null | undefined): boolean {
  return !String(aggiuntiva ?? "").trim();
}

export type RomaExeCompagniaMapRow = {
  exe_codice?: string | null;
  exe_nome?: string | null;
  compagnia_id?: string | null;
  esito?: string | null;
};

/** Lookup persistito: prima per codice EXE, poi per nome. */
export function lookupRomaExeCompagniaId(
  exeCodice: string | number | null | undefined,
  exeNome: string | null | undefined,
  mapRows: RomaExeCompagniaMapRow[],
): string | null {
  const codice = String(exeCodice ?? "").trim();
  if (codice) {
    const byCode = mapRows.find((r) => String(r.exe_codice ?? "").trim() === codice && r.compagnia_id);
    if (byCode?.compagnia_id) return byCode.compagnia_id;
  }
  const canon = canonRomaExeCompagnia(exeNome);
  if (canon.skip) return null;
  const want = normKey(canon.canonical);
  const byName = mapRows.find((r) => r.compagnia_id && (normKey(r.exe_nome) === want || normKey(canonRomaExeCompagnia(r.exe_nome).canonical) === want));
  return byName?.compagnia_id ?? null;
}
