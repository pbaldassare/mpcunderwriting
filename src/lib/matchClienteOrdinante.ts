import { supabase } from "@/integrations/supabase/client";
import {
  BONIFICO_MATCH_MIN_SCORE,
  normalizeNomeMatch,
  scoreOrdinanteVsNomi,
} from "@/lib/bonificoMatch";

/** Soglia per auto-assegnare cliente/sede in import (più alta del semplice suggerimento UI). */
export const CLIENTE_MATCH_AUTO_MIN = 80;

export type ClienteOrdinanteMatch = {
  cliente_id: string;
  ufficio_id: string | null;
  score: number;
  label: string;
};

function clienteLabel(c: {
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
}): string {
  return (
    (c.ragione_sociale || "").trim() ||
    [c.nome, c.cognome].filter(Boolean).join(" ").trim()
  );
}

/** Token utili per ricerca (skip parole troppo generiche). */
export function tokensRicercaOrdinante(ordinante: string): string[] {
  const stop = new Set([
    "COMUNE",
    "DELL",
    "DELLA",
    "DELLE",
    "DEGLI",
    "SOCIETA",
    "SRL",
    "SPA",
    "SAS",
    "SNC",
    "DI",
    "DA",
    "DE",
    "E",
    "THE",
    "AND",
  ]);
  return normalizeNomeMatch(ordinante)
    .split(" ")
    .filter((t) => t.length >= 4 && !stop.has(t))
    .slice(0, 4);
}

/**
 * Trova il miglior cliente per un ordinante (e opz. descrizione).
 * Cerca per token su ragione_sociale/nome/cognome, poi score nominativo.
 */
export async function matchClienteDaOrdinante(
  ordinante: string | null | undefined,
  descrizione?: string | null,
  opts?: { minScore?: number },
): Promise<ClienteOrdinanteMatch | null> {
  const minScore = opts?.minScore ?? CLIENTE_MATCH_AUTO_MIN;
  const ord = String(ordinante || "").trim();
  if (ord.length < 3) return null;

  const tokens = tokensRicercaOrdinante(ord);
  const searchBits = tokens.length > 0 ? tokens : [normalizeNomeMatch(ord).slice(0, 24)].filter((t) => t.length >= 3);
  if (searchBits.length === 0) return null;

  const orParts = searchBits.flatMap((t) => [
    `ragione_sociale.ilike.%${t}%`,
    `cognome.ilike.%${t}%`,
    `nome.ilike.%${t}%`,
  ]);

  const { data, error } = await supabase
    .from("clienti")
    .select("id, ragione_sociale, nome, cognome, ufficio_id")
    .or(orParts.join(","))
    .limit(80);
  if (error) throw error;

  let best: ClienteOrdinanteMatch | null = null;
  let second = 0;
  for (const c of (data as any[]) || []) {
    const label = clienteLabel(c);
    if (!label) continue;
    const score = scoreOrdinanteVsNomi(ord, descrizione, [label]);
    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = {
        cliente_id: c.id,
        ufficio_id: c.ufficio_id ?? null,
        score,
        label,
      };
    } else if (score > second) {
      second = score;
    }
  }

  if (!best || best.score < minScore) return null;
  // Evita ambiguità: secondo vicino entro 10 punti
  if (second > 0 && best.score - second < 10 && best.score < 100) return null;
  return best;
}

/**
 * Match in batch con cache per ordinante normalizzato (import Excel/CSV).
 */
export async function matchClientiDaOrdinantiBatch(
  rows: Array<{ ordinante: string | null; descrizione: string | null }>,
  opts?: { minScore?: number },
): Promise<Map<string, ClienteOrdinanteMatch>> {
  const cache = new Map<string, ClienteOrdinanteMatch | null>();
  const out = new Map<string, ClienteOrdinanteMatch>();

  for (const r of rows) {
    const key = normalizeNomeMatch(r.ordinante || "");
    if (!key) continue;
    if (cache.has(key)) {
      const hit = cache.get(key);
      if (hit) out.set(key, hit);
      continue;
    }
    const m = await matchClienteDaOrdinante(r.ordinante, r.descrizione, opts);
    cache.set(key, m);
    if (m) out.set(key, m);
  }
  return out;
}

export { BONIFICO_MATCH_MIN_SCORE, normalizeNomeMatch };
