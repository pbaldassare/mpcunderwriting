import { supabase } from "@/integrations/supabase/client";
import {
  TIPI_CLIENTELA_RCA,
  mapRcaClientelaRow,
  sortRcaClientelaRows,
  type RcaClientelaRaw,
  type RcaClientelaRow,
} from "@/lib/rca/clientela";

export const RCA_CLIENTELA_SELECT = `
  id,
  targa,
  tipo_veicolo,
  marca,
  modello,
  titolo:titoli!veicoli_polizza_titolo_id_fkey(
    id,
    numero_titolo,
    data_scadenza,
    garanzia_a,
    stato,
    cliente_anagrafica_id,
    clienti:clienti!titoli_cliente_anagrafica_id_fkey(
      id, nome, cognome, ragione_sociale, tipo_cliente
    )
  )
`;

export async function fetchRcaClientela(): Promise<RcaClientelaRow[]> {
  const { data, error } = await supabase
    .from("veicoli_polizza")
    .select(RCA_CLIENTELA_SELECT)
    .in("tipo_veicolo", [...TIPI_CLIENTELA_RCA])
    .limit(1000);
  if (error) throw error;
  return sortRcaClientelaRows(
    ((data || []) as RcaClientelaRaw[])
      .map(mapRcaClientelaRow)
      .filter((r): r is RcaClientelaRow => r != null),
  );
}
