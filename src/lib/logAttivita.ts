import { supabase } from "@/integrations/supabase/client";

export const logAttivita = async (params: {
  azione: string;
  entita_tipo: string;
  entita_id: string;
  dettagli_json?: Record<string, unknown>;
  severity?: "info" | "warning" | "critical";
  ufficio_id?: string;
}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  // Auto-resolve ufficio_id from profile if not provided
  let ufficio_id = params.ufficio_id || null;
  if (!ufficio_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ufficio_id")
      .eq("id", user.id)
      .single();
    ufficio_id = profile?.ufficio_id || null;
  }

  await supabase.from("log_attivita").insert([{
    user_id: user.id,
    azione: params.azione,
    entita_tipo: params.entita_tipo,
    entita_id: params.entita_id,
    dettagli_json: (params.dettagli_json as any) || null,
    severity: params.severity || "info",
    ufficio_id,
  }]);
};
