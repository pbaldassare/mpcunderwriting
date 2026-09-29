import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { getDefaultRoute } from "@/lib/getDefaultRoute";
import {
  CONSULTAZIONE_DISCLAIMER_TEXT,
  isConsultazioneEmailAllowed,
} from "@/lib/consultazioneSession";
import { cn } from "@/lib/utils";
import logoCbnet from "@/assets/logo-cbnet-transparent.png.asset.json";

type LoginMode = "gestionale" | "consultazione";

const LoginPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { session: consultazioneSession, login: loginConsultazione } = useConsultazione();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode: LoginMode = useMemo(() => {
    const m = (searchParams.get("mode") || "").toLowerCase();
    return m === "consultazione" ? "consultazione" : "gestionale";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const setMode = (next: LoginMode) => {
    setResetMode(false);
    setDisclaimerAccepted(false);
    if (next === "consultazione") {
      setSearchParams({ mode: "consultazione" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Sessione consultazione già attiva → area documentale
  if (mode === "consultazione" && consultazioneSession) {
    return <Navigate to="/consultazione/documentale" replace />;
  }

  // Già loggato gestionale + profilo → rotta di default
  if (mode === "gestionale" && !authLoading && user && profile) {
    const route = getDefaultRoute(profile) || "/";
    return <Navigate to={route === "/login" ? "/" : route} replace />;
  }

  // Bootstrap auth gestionale in corso
  if (mode === "gestionale" && (authLoading || (user && !profile))) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(199 58% 14%), hsl(199 50% 24%), hsl(170 55% 32%))" }}
      >
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const handleLoginGestionale = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      console.error("[LoginPage] signIn error:", error);
      toast.error("Accesso fallito", { description: error.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Inserisci la tua email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Errore", { description: error.message });
    } else {
      toast.success("Email inviata", { description: "Controlla la tua casella per il link di reset." });
      setResetMode(false);
    }
  };

  const handleLoginConsultazione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disclaimerAccepted) {
      toast.error("Devi accettare le condizioni per continuare");
      return;
    }
    if (!isConsultazioneEmailAllowed(email)) {
      toast.error("Email non autorizzata. Usa la tua email aziendale del partner.");
      return;
    }
    setLoading(true);
    const res = await loginConsultazione(email);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error || "Accesso non riuscito");
      return;
    }
    toast.success("Accesso all'area consultazione");
    navigate("/consultazione/documentale", { replace: true });
  };

  const isConsultazione = mode === "consultazione";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, hsl(199 58% 14%), hsl(199 50% 24%), hsl(170 55% 32%))",
      }}
    >
      <div className={cn("w-full", isConsultazione ? "max-w-md" : "max-w-sm")}>
        <div className="bg-card/95 backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center -mt-2 mb-2">
            <img src={logoCbnet.url} alt="CBnet" className="w-full max-w-[260px] h-auto" />
          </div>

          {!resetMode && (
            <div className="mt-3 mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("gestionale")}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !isConsultazione
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Gestionale
              </button>
              <button
                type="button"
                onClick={() => setMode("consultazione")}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isConsultazione
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Consultazione
              </button>
            </div>
          )}

          <h2 className="text-base font-semibold text-foreground text-center mt-2 mb-1">
            {resetMode
              ? "Recupera Password"
              : isConsultazione
                ? "Area consultazione"
                : "Accedi"}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {resetMode
              ? "Inserisci la tua email per ricevere il link di reset"
              : isConsultazione
                ? "Accesso con email aziendale autorizzata"
                : "Inserisci le tue credenziali per accedere"}
          </p>

          {isConsultazione ? (
            <form onSubmit={handleLoginConsultazione} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome.cognome@azienda.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                  {CONSULTAZIONE_DISCLAIMER_TEXT}
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={disclaimerAccepted}
                  onCheckedChange={(v) => setDisclaimerAccepted(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm leading-snug">
                  Ho letto e accetto le condizioni sopra indicate
                </span>
              </label>

              <Button
                type="submit"
                className="w-full btn-primary-gradient"
                disabled={loading || !disclaimerAccepted}
              >
                {loading ? "Attendere..." : "Entra in consultazione"}
              </Button>
            </form>
          ) : (
            <>
              <form
                onSubmit={resetMode ? handleResetPassword : handleLoginGestionale}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@esempio.it"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                {!resetMode && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full btn-primary-gradient" disabled={loading}>
                  {loading ? "Attendere..." : resetMode ? "Invia link di reset" : "Accedi"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setResetMode(!resetMode)}
                  className="text-sm text-primary hover:underline"
                >
                  {resetMode ? "Torna al login" : "Password dimenticata?"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
