/**
 * AI Entity Context
 * ------------------------------------------------------------------
 * Pattern condiviso per limitare il contesto AI ai dati pertinenti
 * all'entità correntemente in uso (Cliente / Polizza / Sinistro / ...).
 *
 * Uso tipico:
 *  - Una pagina entità (es. ClienteDetail) chiama `pushAiEntityContext({...})`
 *    quando l'utente clicca "Chiedi all'AI" prima di navigare verso
 *    /ai-assistant.
 *  - La pagina AiAssistantPage chiama `consumeAiEntityContext()` al mount
 *    per leggere (e rimuovere) il contesto messo dal chiamante.
 *  - Il contesto viene poi inviato all'edge function `ai-assistant`
 *    insieme ai messaggi: il prompt di sistema viene arricchito così
 *    che le query SELECT vengano filtrate sull'entità corrente.
 *
 * Le RLS continuano a fare da rete di sicurezza (visibilità commerciale
 * per Sede / Specialist / Produttore via `get_my_ufficio_id()`).
 */

import { useEffect, useState } from "react";

export type AiEntityType =
  | "cliente"
  | "polizza"
  | "sinistro"
  | "trattativa"
  | "compagnia"
  | "prospect";

export interface AiEntityContext {
  /** Tipo entità (mappato a tabella DB). */
  entityType: AiEntityType;
  /** UUID record. */
  entityId: string;
  /** Etichetta leggibile (es. "Mario Rossi (CF RSSMRA…)"). */
  scopeHint: string;
  /** Ufficio_id (Sede) di pertinenza, se nota. Usato come ulteriore filtro. */
  ufficioId?: string | null;
  /**
   * Suggerimento esplicito di colonna WHERE per le query SELECT del tool
   * `query_database`. Es: `cliente_anagrafica_id = '<uuid>'`.
   * Lascialo vuoto per i contesti non filtrabili in SQL.
   */
  sqlFilterHint?: string;
}

const SESSION_KEY = "ai.entityContext";
const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minuti — il tempo di navigare

interface StoredEntry {
  ctx: AiEntityContext;
  expiresAt: number;
}

/**
 * Memorizza un contesto entità in sessionStorage con TTL breve.
 * Pensato per il pattern "click su 'Chiedi all'AI' → naviga a /ai-assistant".
 */
export function pushAiEntityContext(ctx: AiEntityContext): void {
  try {
    const entry: StoredEntry = { ctx, expiresAt: Date.now() + SESSION_TTL_MS };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entry));
  } catch {
    /* sessionStorage non disponibile — ignora */
  }
}

/**
 * Legge il contesto entità memorizzato (se ancora valido) e lo rimuove.
 * Da chiamare al mount della pagina/dialog che apre l'AI.
 */
export function consumeAiEntityContext(): AiEntityContext | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SESSION_KEY);
    const entry = JSON.parse(raw) as StoredEntry;
    if (!entry?.ctx || !entry.expiresAt || entry.expiresAt < Date.now()) return null;
    return entry.ctx;
  } catch {
    return null;
  }
}

/**
 * Hook che ritorna il contesto entità una sola volta al mount e poi `null`
 * finché il caller non lo reimposta. Utile per AiAssistantPage.
 */
export function useConsumedAiEntityContext(): AiEntityContext | null {
  const [ctx] = useState<AiEntityContext | null>(() => consumeAiEntityContext());
  // useEffect vuoto per evitare warning sulla referenziabilità del valore iniziale
  useEffect(() => {
    /* no-op */
  }, []);
  return ctx;
}

/**
 * Costruisce uno scopeHint sintetico per un cliente.
 */
export function buildClienteScopeHint(c: {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
}): string {
  const nome =
    (c.ragione_sociale && c.ragione_sociale.trim()) ||
    `${(c.cognome ?? "").trim()} ${(c.nome ?? "").trim()}`.trim() ||
    "Cliente";
  const id = c.codice_fiscale || c.partita_iva;
  return id ? `${nome} (${id})` : nome;
}
