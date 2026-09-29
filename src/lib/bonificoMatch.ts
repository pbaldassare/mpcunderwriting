/**
 * Matching bonifico ↔ quietanza/cliente.
 * Regole prodotto:
 * - match SOLO su ordinante / descrizione vs nome cliente (niente importo)
 * - ambito: sede (ufficio) e/o conti abilitati
 */

export function normalizeNomeMatch(s: string): string {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefissi tipici enti/comuni da strippare per confronto più tollerante. */
const PREFISSI_ENTE =
  /^(COMUNE DI|COMUNE DEL|COMUNE DELLA|COMUNE DELLO|CITTA DI|CITTA METROPOLITANA DI|PROVINCIA DI|CONSORZIO DI|CONSORZIO DEL|CONSORZIO|AZIENDA|ENTE)\s+/i;

/**
 * Varianti del nome cliente usate nel matching (nome pieno + senza prefisso ente).
 */
export function nomeVariantsForMatch(nome: string): string[] {
  const full = normalizeNomeMatch(nome);
  if (!full) return [];
  const out = new Set<string>([full]);
  let rest = full;
  // strip ripetuto (es. "COMUNE DI COMUNE DI …" improbabile ma harmless)
  for (let i = 0; i < 2; i++) {
    const next = rest.replace(PREFISSI_ENTE, "").trim();
    if (!next || next === rest) break;
    out.add(next);
    rest = next;
  }
  return Array.from(out).filter((v) => v.length >= 3);
}

/** Score 0–100: ordinante/descrizione vs uno o più nomi cliente. */
export function scoreOrdinanteVsNomi(
  ordinante: string | null | undefined,
  descrizione: string | null | undefined,
  nomi: string[],
): number {
  const hay = normalizeNomeMatch(`${ordinante || ""} ${descrizione || ""}`);
  if (!hay) return 0;
  let best = 0;
  for (const nome of nomi) {
    for (const n of nomeVariantsForMatch(nome)) {
      if (hay.includes(n) || n.includes(hay)) {
        best = Math.max(best, 100);
        continue;
      }
      const tokens = n.split(" ").filter((t) => t.length >= 3);
      if (tokens.length === 0) continue;
      // Ignora token generici che da soli danno falsi positivi
      const meaningful = tokens.filter((t) => !["COMUNE", "CITTA", "PROVINCIA", "CONSORZIO", "ENTE"].includes(t));
      const use = meaningful.length > 0 ? meaningful : tokens;
      const hit = use.filter((t) => hay.includes(t)).length;
      if (hit > 0) best = Math.max(best, Math.round((hit / use.length) * 80));
    }
  }
  return best;
}

/** Soglia minima per considerare un suggerimento “utile”. */
export const BONIFICO_MATCH_MIN_SCORE = 50;

export type BonificoAperto = {
  id: string;
  data_movimento: string;
  importo: number;
  ordinante: string | null;
  descrizione: string | null;
  stato: string;
  cliente_id: string | null;
  ufficio_id: string | null;
  conto_bancario_id: string | null;
  conto_etichetta?: string | null;
};

export type BonificoSuggerito = BonificoAperto & {
  score: number;
  matchReason: "cliente" | "ordinante";
};

export function isBonificoNameMatch(reason: string | null | undefined): boolean {
  return reason === "cliente" || reason === "ordinante";
}

/**
 * Tra i bonifici aperti, quelli suggeribili per un cliente (solo nome / cliente_id).
 * Importo ignorato deliberatamente.
 */
export function suggestBonificiPerCliente(
  bonifici: BonificoAperto[],
  opts: { clienteId?: string | null; clienteNome?: string | null; clienteNomi?: string[] },
): BonificoSuggerito[] {
  const nomi = [
    ...(opts.clienteNomi || []),
    ...(opts.clienteNome ? [opts.clienteNome] : []),
  ]
    .map((n) => n.trim())
    .filter(Boolean);
  const out: BonificoSuggerito[] = [];

  for (const b of bonifici) {
    if (opts.clienteId && b.cliente_id === opts.clienteId) {
      out.push({ ...b, score: 200, matchReason: "cliente" });
      continue;
    }
    const score = scoreOrdinanteVsNomi(b.ordinante, b.descrizione, nomi);
    if (score >= BONIFICO_MATCH_MIN_SCORE) {
      out.push({ ...b, score, matchReason: "ordinante" });
    }
  }

  out.sort((a, b) => b.score - a.score || b.data_movimento.localeCompare(a.data_movimento));
  return out;
}
