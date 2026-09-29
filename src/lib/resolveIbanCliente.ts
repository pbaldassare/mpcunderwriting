import { supabase } from "@/integrations/supabase/client";

export type IbanFonte = "specialist" | "sede" | "default" | "nessuno";

export interface IbanRisolto {
  iban: string;
  intestato_a: string;
  banca: string;
  bic: string;
  fonte: IbanFonte;
}

/**
 * Restituisce l'IBAN da proporre al cliente applicando la catena:
 *   Specialist assegnato → Sede del cliente → Conto di default Consulbrokers.
 *
 * Il valore restituito è solo una *proposta*: il chiamante può sovrascriverlo
 * (es. campo editabile prima della stampa di un E/C).
 */
export async function resolveIbanCliente(clienteId: string): Promise<IbanRisolto> {
  const { data, error } = await supabase.rpc("get_iban_cliente" as any, { p_cliente_id: clienteId });
  if (error) {
    console.warn("[resolveIbanCliente] errore RPC, fallback vuoto:", error.message);
    return { iban: "", intestato_a: "", banca: "", bic: "", fonte: "nessuno" };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { iban: "", intestato_a: "", banca: "", bic: "", fonte: "nessuno" };
  return {
    iban: row.iban || "",
    intestato_a: row.intestato_a || "",
    banca: row.banca || "",
    bic: row.bic || "",
    fonte: (row.fonte as IbanFonte) || "nessuno",
  };
}
