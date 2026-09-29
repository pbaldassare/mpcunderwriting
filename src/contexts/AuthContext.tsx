import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { resolveProfileAfterFetch, shouldRefetchProfileOnAuthEvent } from "@/lib/authProfile";
import { isSedeSistemaRole } from "@/lib/sistemaSede";

export interface UserProfile {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  permessi_json: Record<string, boolean> | null;
  attivo: boolean | null;
  telefono: string | null;
  avatar_url: string | null;
  note: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  /** true solo se la riga `profiles` manca davvero (non su errore rete). */
  profileMissing: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  profileMissing: false,
  loading: true,
  signOut: async () => {},
  hasPermission: () => false,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cognome, email, ruolo, ufficio_id, permessi_json, attivo, telefono, avatar_url, note")
      .eq("id", userId)
      .maybeSingle();

    if (error) console.error("[AuthContext] fetchProfile error:", error);
    setProfile((current) => {
      const next = resolveProfileAfterFetch(current, data as UserProfile | null, error);
      setProfileMissing(next.confirmedMissing);
      return next.profile;
    });
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setProfileMissing(false);
          setLoading(false);
          return;
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (!currentUser) {
          setProfile(null);
          setProfileMissing(false);
          setLoading(false);
          return;
        }
        // TOKEN_REFRESHED (anche da getUser/upload) non deve rifetchare il profilo:
        // un errore transitorio azzerava profile e AuthGuard faceva signOut.
        if (!shouldRefetchProfileOnAuthEvent(_event)) return;
        setTimeout(() => fetchProfile(currentUser.id), 0);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn("[AuthContext] getSession error, clearing stale tokens:", error.message);
          supabase.auth.signOut().finally(() => {
            setUser(null);
            setProfile(null);
            setProfileMissing(false);
            setLoading(false);
          });
          return;
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[AuthContext] getSession exception:", err);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = profile?.ruolo === "admin";

  const hasPermission = (key: string): boolean => {
    if (!profile) return false;
    if (profile.ruolo === "admin") return true;

    const perms = profile.permessi_json;
    const read = (k: string) => !!(perms && typeof perms === "object" && perms[k]);

    // Alias chiavi sidebar non sempre presenti in permessi_json
    if (key === "dashboard") return true;
    if (key === "portafoglio") return read("documentale") || read("titoli");
    if (key === "impostazioni") {
      return isSedeSistemaRole(profile.ruolo) || read("impostazioni") || read("tabelle_base") || read("template");
    }

    if (profile.ruolo === "cfo") {
      if (perms && key in perms) return !!perms[key];
      return !["manutenzione", "uffici", "tabelle_base"].includes(key);
    }
    return read(key);
  };

  return (
    <AuthContext.Provider value={{ user, profile, profileMissing, loading, signOut, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
