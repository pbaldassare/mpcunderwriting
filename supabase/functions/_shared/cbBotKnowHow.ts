/** Matching know-how CB Bot — tenuto allineato a src/lib/cbBotKnowHow.ts */

const STOP = new Set([
  "che", "come", "cosa", "quali", "quale", "per", "una", "uno", "dei", "delle",
  "del", "della", "gli", "il", "la", "lo", "le", "un", "di", "da", "in", "con",
  "sul", "sulla", "agli", "nel", "nella", "sono", "essere", "funziona", "spiegami",
  "differenza", "ultimo", "ultimi", "degli", "dello", "tra", "fra", "anche",
  "questo", "questa", "questi", "queste", "quello", "quella", "the", "and",
]);

export type KnowHowTipo = "web" | "cga";

export type KnowHowRow = {
  id: string;
  tipo: KnowHowTipo;
  domanda: string;
  domanda_norm: string;
  risposta: string;
  fonti: unknown;
};

export function tokenizeKnowHow(q: string): string[] {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export function normalizeKnowHowDomanda(q: string): string {
  return tokenizeKnowHow(q).join(" ");
}

export function scoreKnowHow(a: string, b: string): number {
  const A = new Set(tokenizeKnowHow(a));
  const B = new Set(tokenizeKnowHow(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function matchKnowHow<T extends { domanda: string; domanda_norm: string }>(
  items: T[],
  query: string,
  minScore = 0.62,
): T | null {
  const norm = normalizeKnowHowDomanda(query);
  if (!norm || items.length === 0) return null;
  const exact = items.find((i) => i.domanda_norm === norm);
  if (exact) return exact;

  let best: T | null = null;
  let bestScore = 0;
  for (const i of items) {
    const s = scoreKnowHow(query, i.domanda);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  if (best && bestScore >= minScore) return best;
  return null;
}
