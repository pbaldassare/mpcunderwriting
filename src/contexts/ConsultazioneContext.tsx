import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  clearConsultazioneSession,
  CONSULTAZIONE_DISCLAIMER_VERSION,
  isConsultazioneEmailAllowed,
  normalizeConsultazioneEmail,
  readConsultazioneSession,
  writeConsultazioneSession,
  type ConsultazioneSession,
} from "@/lib/consultazioneSession";
import { supabase } from "@/integrations/supabase/client";

type ConsultazioneContextType = {
  session: ConsultazioneSession | null;
  email: string | null;
  loading: boolean;
  login: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  logRicerca: (query: string, percorso?: string) => void;
};

const ConsultazioneContext = createContext<ConsultazioneContextType>({
  session: null,
  email: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: () => {},
  logRicerca: () => {},
});

export function useConsultazione() {
  return useContext(ConsultazioneContext);
}

export function ConsultazioneProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ConsultazioneSession | null>(() => readConsultazioneSession());
  const [loading] = useState(false);

  const login = useCallback(async (email: string) => {
    const normalized = normalizeConsultazioneEmail(email);
    if (!isConsultazioneEmailAllowed(normalized)) {
      return { ok: false, error: "Email non autorizzata. Usa la tua email aziendale del partner." };
    }
    const next = writeConsultazioneSession(normalized);
    setSession(next);
    try {
      await (supabase as any).rpc("log_consultazione_accesso", {
        p_email: normalized,
        p_disclaimer_version: CONSULTAZIONE_DISCLAIMER_VERSION,
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
      });
    } catch {
      // audit best-effort
    }
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    clearConsultazioneSession();
    setSession(null);
  }, []);

  const logRicerca = useCallback(
    (query: string, percorso?: string) => {
      const email = session?.email;
      const q = query.trim();
      if (!email || !q) return;
      void (supabase as any).rpc("log_consultazione_ricerca", {
        p_email: email,
        p_query: q,
        p_percorso: percorso ?? null,
      });
    },
    [session?.email],
  );

  const value = useMemo(
    () => ({
      session,
      email: session?.email ?? null,
      loading,
      login,
      logout,
      logRicerca,
    }),
    [session, loading, login, logout, logRicerca],
  );

  return <ConsultazioneContext.Provider value={value}>{children}</ConsultazioneContext.Provider>;
}
