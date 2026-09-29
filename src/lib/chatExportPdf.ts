import { supabase } from "@/integrations/supabase/client";
import { exportChatToPdf } from "@/lib/chat-pdf";

interface ExportStaffChatPdfOptions {
  canaleId: string;
  profileId: string;
  profileNome?: string | null;
  profileCognome?: string | null;
}

export async function exportStaffChatToPdf({
  canaleId,
  profileId,
  profileNome,
  profileCognome,
}: ExportStaffChatPdfOptions): Promise<void> {
  const { data: canale } = await supabase
    .from("chat_canali")
    .select("id, nome, entita_tipo, entita_id, created_at, ambito")
    .eq("id", canaleId)
    .maybeSingle();
  if (!canale) throw new Error("Canale non trovato");

  const { data: msgs } = await supabase
    .from("chat_messaggi_interni")
    .select("id, created_at, messaggio, mittente_id, profiles:mittente_id(nome, cognome, ruolo)")
    .eq("canale_id", canaleId)
    .order("created_at", { ascending: true });

  const { data: mems } = await supabase
    .from("chat_canali_membri")
    .select("user_id, profiles:user_id(nome, cognome, ruolo)")
    .eq("canale_id", canaleId);

  let entitaLabel: string | null = null;
  let entitaNumero: string | null = null;
  let statoLabel: string | null = null;

  if (canale.entita_tipo === "titolo" && canale.entita_id) {
    const { data: t } = await supabase
      .from("titoli")
      .select("numero_titolo")
      .eq("id", canale.entita_id)
      .maybeSingle();
    entitaLabel = "Polizza";
    entitaNumero = (t as { numero_titolo?: string } | null)?.numero_titolo || null;
  } else if (canale.entita_tipo === "sinistro" && canale.entita_id) {
    const { data: s } = await supabase
      .from("sinistri")
      .select("numero_sinistro, stato")
      .eq("id", canale.entita_id)
      .maybeSingle();
    entitaLabel = "Sinistro";
    entitaNumero = (s as { numero_sinistro?: string } | null)?.numero_sinistro || null;
    statoLabel = (s as { stato?: string } | null)?.stato || null;
  } else if (canale.entita_tipo === "cliente") {
    entitaLabel = "Cliente";
  } else if (canale.entita_tipo === "trattativa") {
    entitaLabel = "Trattativa";
  } else if (canale.entita_tipo === "argomento") {
    entitaLabel = "Argomento";
  }

  const staffNome = `${profileNome || ""} ${profileCognome || ""}`.trim() || "Staff CBnet";

  const log: { data: string; evento: string; attore?: string | null }[] = [];
  log.push({ data: canale.created_at as string, evento: "Conversazione creata" });
  for (const m of msgs || []) {
    const p = (m as { profiles?: { nome?: string; cognome?: string } }).profiles;
    const who = p ? `${p.nome || ""} ${p.cognome || ""}`.trim() : "";
    log.push({ data: m.created_at as string, evento: "Messaggio inviato", attore: who || null });
  }

  await exportChatToPdf({
    canaleNome: canale.nome || entitaLabel || "Conversazione",
    canaleTipo: canale.entita_tipo || canale.ambito || "interno",
    entitaLabel,
    entitaNumero,
    statoLabel,
    createdAt: canale.created_at,
    clienteNome: staffNome,
    membri: (mems || []).map((x: { profiles?: { nome?: string; cognome?: string; ruolo?: string } }) => ({
      nome: x.profiles?.nome,
      cognome: x.profiles?.cognome,
      ruolo: x.profiles?.ruolo,
    })),
    messaggi: (msgs || []).map((m: {
      id: string;
      created_at: string;
      messaggio: string;
      mittente_id: string;
      profiles?: { nome?: string; cognome?: string; ruolo?: string };
    }) => ({
      id: m.id,
      created_at: m.created_at,
      messaggio: m.messaggio || "",
      mittente_nome: m.profiles?.nome,
      mittente_cognome: m.profiles?.cognome,
      mittente_ruolo: m.profiles?.ruolo,
      is_self: m.mittente_id === profileId,
    })),
    log,
  });
}
