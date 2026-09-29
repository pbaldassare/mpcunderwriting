import { useCallback, useEffect, useState } from "react";

export type EntityKind = "cliente" | "prospect" | "polizza" | "sinistro" | "trattativa" | "compagnia";

export interface RecentEntity {
  kind: EntityKind;
  id: string;
  label: string;
  sub?: string;
  path: string;
  ts: number;
}

const RECENT_KEY = "cbnet:recent-entities";
const PINNED_KEY = "cbnet:pinned-entities";
const MAX_RECENT = 8;
const MAX_PINNED = 12;

const EVT = "cbnet:recent-entities:changed";

function read(key: string): RecentEntity[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(key: string, list: RecentEntity[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* noop */
  }
}

export function useRecentEntities() {
  const [recent, setRecent] = useState<RecentEntity[]>(() => read(RECENT_KEY));
  const [pinned, setPinned] = useState<RecentEntity[]>(() => read(PINNED_KEY));

  useEffect(() => {
    const sync = () => {
      setRecent(read(RECENT_KEY));
      setPinned(read(PINNED_KEY));
    };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addRecent = useCallback((e: Omit<RecentEntity, "ts">) => {
    const list = read(RECENT_KEY).filter(
      (x) => !(x.kind === e.kind && x.id === e.id)
    );
    list.unshift({ ...e, ts: Date.now() });
    write(RECENT_KEY, list.slice(0, MAX_RECENT));
  }, []);

  const togglePin = useCallback((e: Omit<RecentEntity, "ts">) => {
    const list = read(PINNED_KEY);
    const idx = list.findIndex((x) => x.kind === e.kind && x.id === e.id);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({ ...e, ts: Date.now() });
    }
    write(PINNED_KEY, list.slice(0, MAX_PINNED));
  }, []);

  const isPinned = useCallback(
    (kind: EntityKind, id: string) =>
      read(PINNED_KEY).some((x) => x.kind === kind && x.id === id),
    []
  );

  const removeRecent = useCallback((kind: EntityKind, id: string) => {
    write(RECENT_KEY, read(RECENT_KEY).filter((x) => !(x.kind === kind && x.id === id)));
  }, []);

  return { recent, pinned, addRecent, togglePin, isPinned, removeRecent };
}
