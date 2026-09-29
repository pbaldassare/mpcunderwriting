import { useEffect, useRef } from "react";

const PREFIX = "lov-draft:";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

type DraftEnvelope<T> = {
  v: number;
  ts: number;
  data: T;
};

export function loadDraft<T = any>(key: string, ttlMs: number = DEFAULT_TTL_MS): { data: T; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as DraftEnvelope<T>;
    if (!env || typeof env !== "object" || !("data" in env)) return null;
    if (ttlMs > 0 && Date.now() - env.ts > ttlMs) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { data: env.data, ts: env.ts };
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* no-op */
  }
}

export function saveDraft<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    const env: DraftEnvelope<T> = { v: 1, ts: Date.now(), data };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch {
    /* quota / serialization → silenzioso */
  }
}

/**
 * Autosave debounced di un oggetto snapshot su localStorage.
 * - `key`: chiave logica (verrà prefissata). Cambiare key cambia il "documento".
 * - `snapshot`: oggetto serializzabile da persistere.
 * - `enabled`: per ritardare il salvataggio finché i dati iniziali non sono pronti.
 */
export function useDraftPersistence<T>(
  key: string | null | undefined,
  snapshot: T,
  options?: { debounceMs?: number; enabled?: boolean },
) {
  const { debounceMs = 600, enabled = true } = options || {};
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    lastKeyRef.current = key;
    const t = setTimeout(() => {
      saveDraft(key, snapshot);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key, snapshot, enabled, debounceMs]);
}
