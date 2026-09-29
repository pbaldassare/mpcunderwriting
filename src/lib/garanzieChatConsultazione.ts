import { supabase } from "@/integrations/supabase/client";
import type { GaranzieConv, GaranzieMsg } from "@/hooks/useGaranzieChat";

type CreateFields = {
  compagnia?: string | null;
  ramo?: string | null;
  prodotto_cga_id?: string | null;
};

export async function listMieConsultazione(email: string, tipo: string): Promise<GaranzieConv[]> {
  const { data, error } = await (supabase as any).rpc("garanzie_chat_list_mie_consultazione", {
    p_email: email,
    p_tipo: tipo,
  });
  if (error) throw error;
  return (data ?? []) as GaranzieConv[];
}

export async function createConsultazione(
  email: string,
  tipo: string,
  titolo: string,
  fields: CreateFields = {},
): Promise<string> {
  const { data, error } = await (supabase as any).rpc("garanzie_chat_create_consultazione", {
    p_email: email,
    p_tipo: tipo,
    p_titolo: titolo,
    p_compagnia: fields.compagnia ?? null,
    p_ramo: fields.ramo ?? null,
    p_prodotto_cga_id: fields.prodotto_cga_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function insertMsgConsultazione(
  email: string,
  conversazioneId: string,
  role: "user" | "assistant",
  content: string,
  fonti?: unknown,
): Promise<void> {
  const { error } = await (supabase as any).rpc("garanzie_chat_insert_msg_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
    p_role: role,
    p_content: content,
    p_fonti: fonti ?? null,
  });
  if (error) throw error;
}

export async function touchConsultazione(
  email: string,
  conversazioneId: string,
  titolo?: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("garanzie_chat_touch_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
    p_titolo: titolo ?? null,
  });
  if (error) throw error;
}

export async function shareConsultazione(email: string, conversazioneId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("garanzie_chat_share_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
  });
  if (error) throw error;
}

export async function deleteConsultazione(email: string, conversazioneId: string): Promise<void> {
  const { error } = await (supabase as any).rpc("garanzie_chat_delete_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
  });
  if (error) throw error;
}

export async function listMessagesConsultazione(
  email: string,
  conversazioneId: string,
): Promise<GaranzieMsg[]> {
  const { data, error } = await (supabase as any).rpc("garanzie_chat_list_messages_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
  });
  if (error) throw error;
  return (data ?? []) as GaranzieMsg[];
}

export async function salvaConsultazione(
  email: string,
  conversazioneId: string,
  salvata: boolean,
): Promise<void> {
  const { error } = await (supabase as any).rpc("garanzie_chat_salva_consultazione", {
    p_email: email,
    p_conversazione_id: conversazioneId,
    p_salvata: salvata,
  });
  if (error) throw error;
}

export async function azzeraCronologiaConsultazione(email: string, tipo: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc("garanzie_chat_azzera_cronologia_consultazione", {
    p_email: email,
    p_tipo: tipo,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
