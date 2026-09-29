export const KEYWORD_BROKERAGGIO = "Brokeraggio assicurativo";
export const KEYWORD_SERVIZI = "Servizi assicurativi";

export const KEYWORDS_RICERCA = [
  { value: "brokeraggio", label: KEYWORD_BROKERAGGIO },
  { value: "servizi", label: KEYWORD_SERVIZI },
  { value: "entrambe", label: "Entrambe" },
] as const;

export type KeywordRicerca = (typeof KEYWORDS_RICERCA)[number]["value"];

export const KEYWORD_RICERCA_DEFAULT: KeywordRicerca = "brokeraggio";

export const FILTRI_KEYWORD_LISTA = [
  { value: "tutte", label: "Tutte" },
  { value: "brokeraggio", label: KEYWORD_BROKERAGGIO },
  { value: "servizi", label: KEYWORD_SERVIZI },
] as const;

export type FiltroKeywordLista = (typeof FILTRI_KEYWORD_LISTA)[number]["value"];

export function isKeywordRicerca(value: string | null | undefined): value is KeywordRicerca {
  return KEYWORDS_RICERCA.some((k) => k.value === value);
}

export function parseKeywordRicerca(raw: unknown): KeywordRicerca {
  const v = String(raw || "").toLowerCase();
  if (v === "servizi" || v === "servizi_assicurativi") return "servizi";
  if (v === "entrambe" || v === "tutte" || v === "both") return "entrambe";
  return "brokeraggio";
}

export function labelKeywordRicerca(value: string | null | undefined): string {
  if (value === "entrambe") return "Brokeraggio e servizi assicurativi";
  return KEYWORDS_RICERCA.find((k) => k.value === value)?.label ?? KEYWORD_BROKERAGGIO;
}

/** Frasi da cercare sui portali. Default: solo brokeraggio. */
export function frasiKeywordRicerca(value: string | null | undefined): string[] {
  const mode = parseKeywordRicerca(value);
  if (mode === "servizi") return [KEYWORD_SERVIZI];
  if (mode === "entrambe") return [KEYWORD_BROKERAGGIO, KEYWORD_SERVIZI];
  return [KEYWORD_BROKERAGGIO];
}

export function includeBrokeraggio(value: string | null | undefined): boolean {
  const mode = parseKeywordRicerca(value);
  return mode === "brokeraggio" || mode === "entrambe";
}

export function includeServiziAssicurativi(value: string | null | undefined): boolean {
  const mode = parseKeywordRicerca(value);
  return mode === "servizi" || mode === "entrambe";
}

const BROKER_RE = /brokeraggio|broker assicur|intermediazione assicur/i;
const SERVIZI_RE = /servizi assicurativ|servizi di assicurazione|polizze assicur|coperture assicur|assicurativ/i;

export function isTestoBrokeraggio(text: string): boolean {
  return BROKER_RE.test(text);
}

export function isTestoServiziAssicurativi(text: string): boolean {
  return SERVIZI_RE.test(text) || isTestoBrokeraggio(text);
}

export function keywordDaTesto(text: string): typeof KEYWORD_BROKERAGGIO | typeof KEYWORD_SERVIZI {
  return isTestoBrokeraggio(text) ? KEYWORD_BROKERAGGIO : KEYWORD_SERVIZI;
}

export function matchesFiltroKeyword(
  keyword: string | null | undefined,
  titolo: string | null | undefined,
  filtro: string,
): boolean {
  if (!filtro || filtro === "tutte") return true;
  const hay = `${keyword || ""} ${titolo || ""}`;
  if (filtro === "brokeraggio") return isTestoBrokeraggio(hay) || keyword === KEYWORD_BROKERAGGIO;
  if (filtro === "servizi") {
    return keyword === KEYWORD_SERVIZI ||
      (isTestoServiziAssicurativi(hay) && !isTestoBrokeraggio(hay));
  }
  return true;
}
