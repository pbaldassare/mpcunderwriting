import { supabase } from "@/integrations/supabase/client";
import {
  assertFonteSuSitiAutorizzati,
  extractWebFonti,
  type WebFonteHit,
} from "@/lib/cbBotFonti";

export async function loadDominiAutorizzati(): Promise<string[]> {
  const { data, error } = await supabase
    .from("cb_bot_siti_autorizzati")
    .select("dominio")
    .eq("attivo", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.dominio).filter(Boolean);
}

export async function insertCbBotFonte(opts: {
  hit: WebFonteHit;
  userId: string | null;
  origine?: "ricerca" | "manuale";
  conversazioneId?: string | null;
  messaggioId?: string | null;
}): Promise<"ok" | "duplicata"> {
  const domains = await loadDominiAutorizzati();
  const checked = assertFonteSuSitiAutorizzati(opts.hit.url, domains);
  if (!checked.ok) throw new Error(checked.error);

  const { error } = await supabase.from("cb_bot_fonti").insert({
    titolo: opts.hit.title?.trim() || checked.dominio,
    url: checked.url,
    snippet: opts.hit.snippet?.slice(0, 400) ?? null,
    dominio: checked.dominio,
    origine: opts.origine ?? "ricerca",
    conversazione_id: opts.conversazioneId ?? null,
    messaggio_id: opts.messaggioId ?? null,
    salvata_da: opts.userId,
  });
  if (error) {
    if (error.code === "23505") return "duplicata";
    throw error;
  }
  return "ok";
}

export async function promoteFontiFromConversazione(
  conversazioneId: string,
  userId: string | null,
): Promise<number> {
  const { data, error } = await supabase
    .from("garanzie_chat_messaggi")
    .select("id, fonti")
    .eq("conversazione_id", conversazioneId)
    .eq("role", "assistant");
  if (error) throw error;

  let saved = 0;
  for (const msg of data ?? []) {
    const hits = extractWebFonti(msg.fonti);
    for (const hit of hits) {
      const res = await insertCbBotFonte({
        hit,
        userId,
        origine: "ricerca",
        conversazioneId,
        messaggioId: msg.id,
      });
      if (res === "ok") saved += 1;
    }
  }
  return saved;
}
