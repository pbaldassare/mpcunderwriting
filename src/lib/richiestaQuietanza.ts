import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export type RichiestaQuietanzaRiga = {
  id: string;
  numero_titolo: string | null;
  ramo_nome: string | null;
  cliente_nome_display: string | null;
  premio_lordo: number | null;
  garanzia_a: string | null;
  data_scadenza: string | null;
  tacito_rinnovo: boolean | null;
  compagnia_id: string | null;
  compagnia_nome: string | null;
};

export async function resolveAgenziaEmail(compagniaId: string): Promise<{
  email: string;
  nome: string;
}> {
  const { data: comp } = await supabase
    .from("compagnie")
    .select("nome, email_messe_a_cassa, mail, mail_avvisi, pec")
    .eq("id", compagniaId)
    .maybeSingle();

  const { data: rapp } = await supabase
    .from("compagnia_rapporti")
    .select("email_messe_a_cassa")
    .eq("compagnia_id", compagniaId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const email =
    (rapp as { email_messe_a_cassa?: string | null } | null)?.email_messe_a_cassa?.trim() ||
    (comp as any)?.email_messe_a_cassa?.trim() ||
    (comp as any)?.mail_avvisi?.trim() ||
    (comp as any)?.mail?.trim() ||
    (comp as any)?.pec?.trim() ||
    "";

  return {
    email,
    nome: ((comp as any)?.nome as string) || "",
  };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function fmtEuro(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

/** Converte testo normale in HTML minimale per Resend (a capo → paragrafi). */
export { plainTextToEmailHtml } from "@/lib/sendEmail";

export function defaultOggettoRichiestaQuietanza(agenziaNome: string): string {
  const oggi = format(new Date(), "dd/MM/yyyy");
  return `Richiesta Quietanza — ${agenziaNome || "Agenzia"} — ${oggi}`;
}

export function defaultCorpoRichiestaQuietanza(
  agenziaNome: string,
  righe: RichiestaQuietanzaRiga[],
): string {
  const elenco = righe
    .map((r, i) => {
      const scadenza = r.garanzia_a || r.data_scadenza;
      return [
        `${i + 1}) Polizza: ${r.numero_titolo || "—"}`,
        `   Ramo: ${r.ramo_nome || "—"}`,
        `   Cliente: ${r.cliente_nome_display || "—"}`,
        `   Premio: ${fmtEuro(r.premio_lordo)}`,
        `   Scadenza: ${fmtDate(scadenza)}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Spett.le ${agenziaNome || "Agenzia"},`,
    "",
    "con la presente chiediamo l'emissione delle quietanze relative alle polizze in scadenza elencate di seguito.",
    "",
    elenco,
    "",
    "Restiamo in attesa della documentazione e a disposizione per ogni chiarimento.",
    "",
    "Cordiali saluti,",
    "Consulbrokers",
  ].join("\n");
}
