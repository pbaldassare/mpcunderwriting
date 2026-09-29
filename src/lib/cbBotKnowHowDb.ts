import { supabase } from "@/integrations/supabase/client";
import {
  normalizeKnowHowDomanda,
  pairUserAssistant,
  type KnowHowTipo,
} from "@/lib/cbBotKnowHow";

const TABLE = "cb_bot_know_how";

export async function upsertKnowHowStaff(opts: {
  tipo: KnowHowTipo;
  domanda: string;
  risposta: string;
  fonti?: unknown;
  conversazioneId?: string | null;
  messaggioId?: string | null;
  userId?: string | null;
}): Promise<"ok" | "skip"> {
  const domanda_norm = normalizeKnowHowDomanda(opts.domanda);
  if (!domanda_norm || !opts.risposta.trim()) return "skip";
  const { error } = await (supabase.from(TABLE) as any).upsert(
    {
      tipo: opts.tipo,
      domanda: opts.domanda.trim(),
      domanda_norm,
      risposta: opts.risposta.trim(),
      fonti: opts.fonti ?? [],
      conversazione_id: opts.conversazioneId ?? null,
      messaggio_id: opts.messaggioId ?? null,
      salvata_da: opts.userId ?? null,
      attiva: true,
    },
    { onConflict: "tipo,domanda_norm" },
  );
  if (error) throw error;
  return "ok";
}

export async function promoteKnowHowFromConversazione(
  conversazioneId: string,
  tipo: KnowHowTipo,
  userId: string | null,
): Promise<number> {
  const { data, error } = await supabase
    .from("garanzie_chat_messaggi")
    .select("id, role, content, fonti")
    .eq("conversazione_id", conversazioneId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  let saved = 0;
  for (const pair of pairUserAssistant(data ?? [])) {
    const res = await upsertKnowHowStaff({
      tipo,
      domanda: pair.domanda,
      risposta: pair.risposta,
      fonti: pair.fonti,
      conversazioneId,
      messaggioId: pair.messaggioId ?? null,
      userId,
    });
    if (res === "ok") saved += 1;
  }
  return saved;
}

export async function promoteKnowHowConsultazione(
  email: string,
  conversazioneId: string,
  tipo: KnowHowTipo,
): Promise<number> {
  const { data, error } = await supabase.rpc("garanzie_chat_list_messages_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
  });
  if (error) throw error;

  let saved = 0;
  for (const pair of pairUserAssistant((data ?? []) as { id?: string; role: string; content: string; fonti?: unknown }[])) {
    const { error: insErr } = await supabase.rpc("cb_bot_insert_know_how_consultazione", {
      p_email: email,
      p_tipo: tipo,
      p_domanda: pair.domanda,
      p_domanda_norm: normalizeKnowHowDomanda(pair.domanda),
      p_risposta: pair.risposta,
      p_fonti: pair.fonti ?? [],
      p_conversazione_id: conversazioneId,
      p_messaggio_id: pair.messaggioId ?? null,
    });
    if (insErr) throw insErr;
    saved += 1;
  }
  return saved;
}
