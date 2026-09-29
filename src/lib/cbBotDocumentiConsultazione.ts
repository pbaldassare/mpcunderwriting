import { supabase } from "@/integrations/supabase/client";

export type CbBotDocRow = {
  id: string;
  titolo: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  analisi: string | null;
  created_at: string;
};

export type CbBotConfrontoRow = {
  id: string;
  titolo: string;
  documento_ids: string[];
  risultato: string;
  created_at: string;
};

export async function listDocumentiConsultazione(email: string): Promise<CbBotDocRow[]> {
  const { data, error } = await supabase.rpc("cb_bot_list_documenti_consultazione" as never, {
    p_email: email,
  } as never);
  if (error) throw error;
  return (data ?? []) as CbBotDocRow[];
}

export async function listConfrontiConsultazione(email: string): Promise<CbBotConfrontoRow[]> {
  const { data, error } = await supabase.rpc("cb_bot_list_confronti_consultazione" as never, {
    p_email: email,
  } as never);
  if (error) throw error;
  return (data ?? []) as CbBotConfrontoRow[];
}

export async function insertDocumentoConsultazione(
  email: string,
  row: {
    titolo: string;
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    testo_estratto: string;
    analisi: string;
  },
): Promise<string> {
  const { data, error } = await supabase.rpc("cb_bot_insert_documento_consultazione" as never, {
    p_email: email,
    p_titolo: row.titolo,
    p_file_name: row.file_name,
    p_storage_path: row.storage_path,
    p_mime_type: row.mime_type,
    p_size_bytes: row.size_bytes,
    p_testo_estratto: row.testo_estratto,
    p_analisi: row.analisi,
  } as never);
  if (error) throw error;
  return data as string;
}

export async function insertConfrontoConsultazione(
  email: string,
  titolo: string,
  documentoIds: string[],
  risultato: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("cb_bot_insert_confronto_consultazione" as never, {
    p_email: email,
    p_titolo: titolo,
    p_documento_ids: documentoIds,
    p_risultato: risultato,
  } as never);
  if (error) throw error;
  return data as string;
}

export async function deleteDocumentoConsultazione(email: string, id: string): Promise<void> {
  const { error } = await supabase.rpc("cb_bot_delete_documento_consultazione" as never, {
    p_email: email,
    p_id: id,
  } as never);
  if (error) throw error;
}
