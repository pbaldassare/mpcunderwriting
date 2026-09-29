import { supabase } from "@/integrations/supabase/client";
import { classifyTipoVeicoloClientela, unwrapOne, type TipoClientelaRca } from "@/lib/rca/clientela";
import type { VoceGaranziaPolizza } from "@/lib/rca/garanzie";
import type { ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";

const CLIENTE_SELECT =
  "id, tipo_cliente, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, sesso, email, pec, telefono, cellulare, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_sede, cap_sede, citta_sede, provincia_sede, indirizzo_fiscale, cap_fiscale, citta_fiscale, provincia_fiscale";

export type RcaAnalisiContesto = {
  cliente: (ClienteEcAnagrafica & { id: string; cellulare?: string | null; telefono?: string | null; pec?: string | null; codice_fiscale?: string | null; partita_iva?: string | null; sesso?: string | null }) | null;
  titoloId: string | null;
  numeroPolizza: string | null;
  scadenzaIso: string | null;
  compagnia: string | null;
  veicoloId: string | null;
  targa: string | null;
  tipo: TipoClientelaRca | null;
  marca: string | null;
  modello: string | null;
  garanzie: VoceGaranziaPolizza[];
};

export async function fetchRcaAnalisiContesto(args: {
  targa?: string | null;
  clienteId?: string | null;
  titoloId?: string | null;
}): Promise<RcaAnalisiContesto> {
  const empty: RcaAnalisiContesto = {
    cliente: null,
    titoloId: args.titoloId || null,
    numeroPolizza: null,
    scadenzaIso: null,
    compagnia: null,
    veicoloId: null,
    targa: args.targa || null,
    tipo: null,
    marca: null,
    modello: null,
    garanzie: [],
  };

  let titoloId = args.titoloId || null;
  let veicolo: {
    id: string;
    targa: string | null;
    tipo_veicolo: string | null;
    marca: string | null;
    modello: string | null;
    titolo_id: string;
  } | null = null;

  if (titoloId) {
    const { data } = await supabase
      .from("veicoli_polizza")
      .select("id, targa, tipo_veicolo, marca, modello, titolo_id")
      .eq("titolo_id", titoloId)
      .maybeSingle();
    veicolo = data;
  }
  if (!veicolo && args.targa) {
    const { data } = await supabase
      .from("veicoli_polizza")
      .select("id, targa, tipo_veicolo, marca, modello, titolo_id")
      .ilike("targa", args.targa.trim())
      .limit(1)
      .maybeSingle();
    veicolo = data;
    if (veicolo && !titoloId) titoloId = veicolo.titolo_id;
  }

  let clienteId = args.clienteId || null;
  let numeroPolizza: string | null = null;
  let scadenzaIso: string | null = null;
  let compagnia: string | null = null;

  if (titoloId) {
    const { data: titolo } = await supabase
      .from("titoli")
      .select(
        "id, numero_titolo, data_scadenza, garanzia_a, cliente_anagrafica_id, compagnie:compagnie!titoli_compagnia_id_fkey(nome)",
      )
      .eq("id", titoloId)
      .maybeSingle();
    if (titolo) {
      numeroPolizza = titolo.numero_titolo;
      scadenzaIso = titolo.data_scadenza || titolo.garanzia_a;
      clienteId = clienteId || titolo.cliente_anagrafica_id;
      compagnia = unwrapOne(titolo.compagnie as { nome?: string } | { nome?: string }[] | null)?.nome || null;
    }
    const { data: voci } = await supabase
      .from("premi_garanzia_polizza")
      .select("codice_garanzia, garanzia")
      .eq("titolo_id", titoloId);
    empty.garanzie = (voci || []) as VoceGaranziaPolizza[];
  }

  let cliente = null;
  if (clienteId) {
    const { data } = await supabase.from("clienti").select(CLIENTE_SELECT).eq("id", clienteId).maybeSingle();
    cliente = data;
  }

  return {
    cliente,
    titoloId,
    numeroPolizza,
    scadenzaIso,
    compagnia,
    veicoloId: veicolo?.id || null,
    targa: veicolo?.targa || args.targa || null,
    tipo: classifyTipoVeicoloClientela(veicolo?.tipo_veicolo),
    marca: veicolo?.marca || null,
    modello: veicolo?.modello || null,
    garanzie: empty.garanzie,
  };
}
