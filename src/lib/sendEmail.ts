import { supabase } from "@/integrations/supabase/client";

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  apply_branding?: boolean;
  template_id?: string;
  /** Sede per risolvere il branding (se assente si usa la sede del template). */
  ufficio_id?: string | null;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Invia un'email tramite Resend (edge function `send-email`).
 *
 * NOTA: con `onboarding@resend.dev` Resend permette invio solo verso l'email
 * dell'account proprietario della chiave. Per inviare a indirizzi reali serve
 * verificare un dominio su resend.com.
 */
export function plainTextToEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .split(/\r?\n/)
    .map((line) => (line.trim() === "" ? "<br/>" : `<p style="margin:0 0 8px 0;">${line}</p>`))
    .join("\n");
}

/** Se il testo contiene tag HTML, li rimuove lasciando testo leggibile. */
export function htmlToPlainText(html: string): string {
  if (!/[<>]/.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: params,
  });

  if (error) {
    console.error("sendEmail error:", error);
    return { success: false, error: error.message };
  }

  if (data?.error) {
    return { success: false, error: data.error };
  }

  return { success: true, id: data?.id };
}
