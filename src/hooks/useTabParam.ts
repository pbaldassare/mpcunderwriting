import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Persiste la tab attiva nella query string (?tab=...).
 * Se il valore in URL non è tra quelli validi, viene normalizzato
 * automaticamente al default (replace, non aggiunge entry alla history).
 */
export function useTabParam<T extends string>(validTabs: readonly T[], defaultTab: T) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") || "";
  const isValid = (validTabs as readonly string[]).includes(raw);
  const activeTab = (isValid ? raw : defaultTab) as T;

  // Normalizza valori non validi o mancanti nell'URL
  useEffect(() => {
    if (!raw || !isValid) {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", defaultTab);
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, isValid]);

  const setTab = useMemo(
    () => (v: string) => {
      const sp = new URLSearchParams(searchParams);
      sp.set("tab", v);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return [activeTab, setTab] as const;
}
