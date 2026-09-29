/** Score rilevanza ricerca clienti (allineato a RPC search_clienti_ranked). Più basso = migliore. */
export type ClienteSearchFields = {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  citta_residenza?: string | null;
  citta_sede?: string | null;
  citta_fiscale?: string | null;
  citta_alternativa?: string | null;
  indirizzo_residenza?: string | null;
  indirizzo_sede?: string | null;
  indirizzo_fiscale?: string | null;
  indirizzo_alternativo?: string | null;
  cap_residenza?: string | null;
  cap_sede?: string | null;
  cap_fiscale?: string | null;
  cap_alternativo?: string | null;
  provincia_residenza?: string | null;
  provincia_sede?: string | null;
  provincia_fiscale?: string | null;
  provincia_alternativa?: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function tokensAndMatch(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((tok) => haystack.includes(tok));
}

export function scoreClienteSearch(c: ClienteSearchFields, term: string): number {
  const t = collapseSpaces(norm(term));
  if (!t) return 99;

  const tokens = t.split(/\s+/).filter(Boolean);

  const cittaRes = norm(c.citta_residenza);
  const cittaSede = norm(c.citta_sede);
  const cittaFisc = norm(c.citta_fiscale);
  const cittaAlt = norm(c.citta_alternativa);
  const indirizzi = [
    c.indirizzo_residenza,
    c.indirizzo_sede,
    c.indirizzo_fiscale,
    c.indirizzo_alternativo,
  ].map(norm);
  if (cittaRes === t || cittaSede === t || cittaFisc === t || cittaAlt === t || indirizzi.includes(t)) return 1;

  const rs = norm(c.ragione_sociale);
  const cognome = norm(c.cognome);
  const nome = norm(c.nome);
  const displayCn = collapseSpaces(`${cognome} ${nome}`);
  const displayNc = collapseSpaces(`${nome} ${cognome}`);
  const indirizzoBlob = collapseSpaces(
    [
      c.indirizzo_residenza,
      c.indirizzo_sede,
      c.indirizzo_fiscale,
      c.indirizzo_alternativo,
      c.cap_residenza,
      c.cap_sede,
      c.cap_fiscale,
      c.cap_alternativo,
      cittaRes,
      cittaSede,
      cittaFisc,
      cittaAlt,
      c.provincia_residenza,
      c.provincia_sede,
      c.provincia_fiscale,
      c.provincia_alternativa,
    ]
      .map(norm)
      .join(" "),
  );
  const anagraficaBlob = collapseSpaces(`${cognome} ${nome} ${rs} ${indirizzoBlob}`);

  if (rs === t || cognome === t || nome === t || displayCn === t || displayNc === t) return 2;

  if (
    rs.startsWith(t) ||
    cognome.startsWith(t) ||
    nome.startsWith(t) ||
    displayCn.startsWith(t) ||
    displayNc.startsWith(t)
  ) {
    return 3;
  }

  if (
    rs.includes(t) ||
    cognome.includes(t) ||
    nome.includes(t) ||
    displayCn.includes(t) ||
    displayNc.includes(t) ||
    indirizzoBlob.includes(t) ||
    tokensAndMatch(anagraficaBlob, tokens)
  ) {
    return 4;
  }

  return 5;
}
