import { canHaveDataCopertura, type TitoloLike } from "@/lib/quietanze";

type CoperturaCtx = TitoloLike & {
  conferimento_gestito?: boolean | null;
  data_copertura?: string | null;
  data_messa_cassa?: string | null;
  fondi_ricevuti?: boolean | null;
  tipo_pagamento?: string | null;
  stato?: string | null;
};

/**
 * Garantito ancora aperto (stato non "incassato"): copertura confermata,
 * indipendentemente da data_messa_cassa (ora valorizzata anche in fase garantito).
 */
export function isGarantitoAperto(t: CoperturaCtx): boolean {
  if (!canHaveDataCopertura(t)) return false;
  if (t.stato === "incassato" || t.stato === "annullato") return false;
  if (!t.conferimento_gestito) return false;
  return t.tipo_pagamento === "garantito" || !!t.data_copertura;
}

/** Titolo in copertura garantita: messa a cassa sì, fondi non ancora ricevuti. */
export function isInCoperturaGarantita(t: CoperturaCtx): boolean {
  return isGarantitoAperto(t) && !t.fondi_ricevuti;
}

/** Tab/filtro Garantiti: in copertura, fondi ancora da chiudere. */
export function isGarantitoDaIncassare(t: CoperturaCtx): boolean {
  return isInCoperturaGarantita(t);
}

/**
 * Quietanza ancora selezionabile per Incassa / lista pendenti:
 * mai messa a cassa, oppure garantito non ancora convertito in incasso pieno.
 */
export function isDaChiudereIncasso(t: CoperturaCtx): boolean {
  if (t.stato !== "attivo") return false;
  if (!t.data_messa_cassa) return true;
  return isGarantitoAperto(t);
}

/**
 * Filtro PostgREST per liste "pendenti / da chiudere":
 * attivo + (senza messa a cassa OPPURE garantito aperto).
 */
export const PENDENTI_OR_GARANTITO_APERTO_FILTER =
  "data_messa_cassa.is.null,and(conferimento_gestito.eq.true,or(tipo_pagamento.eq.garantito,data_copertura.not.is.null))";

export type GarantitoInput = {
  dataCopertura: string;
  dataDecorrenza: string;
};

type TitoloDateIncassoCtx = {
  conferimento_gestito?: boolean | null;
  data_copertura?: string | null;
  data_messa_cassa?: string | null;
};

/**
 * Incasso diretto: copertura = giorno messa a cassa.
 * Garantito già in copertura: mantiene data_copertura originale.
 */
export function resolveDataCoperturaOnIncasso(
  titolo: TitoloDateIncassoCtx,
  dataMessaCassa: string,
): string {
  if (titolo.conferimento_gestito && titolo.data_copertura) {
    return titolo.data_copertura;
  }
  return dataMessaCassa;
}

/**
 * Campi data su incasso completo (fondi ricevuti).
 * Se già messa a cassa in fase garantito, non cambia data_messa_cassa
 * (trigger anti-doppio); valorizza data_incasso con la data fondi.
 */
export function buildIncassoDateFields(
  titolo: TitoloDateIncassoCtx,
  dataMessaCassa: string,
): { data_messa_cassa: string; data_incasso: string; data_copertura: string } {
  const dataCopertura = resolveDataCoperturaOnIncasso(titolo, dataMessaCassa);
  const messaCassa =
    titolo.conferimento_gestito && titolo.data_messa_cassa
      ? titolo.data_messa_cassa
      : dataMessaCassa;
  return {
    data_messa_cassa: messaCassa,
    data_incasso: dataMessaCassa,
    data_copertura: dataCopertura,
  };
}

/**
 * Payload DB per conferma Garantito.
 * Imposta messa a cassa + copertura; differenza vs incasso pieno = niente soldi
 * (fondi_ricevuti false, importo/data_incasso null, stato resta attivo).
 */
export function buildGarantitoPayload(input: GarantitoInput): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  return {
    stato: "attivo",
    data_copertura: input.dataCopertura,
    data_decorrenza_rinnovo: input.dataDecorrenza,
    data_messa_cassa: input.dataCopertura,
    data_incasso: null,
    data_pagamento: null,
    importo_incassato: null,
    banca_pagamento: null,
    tipo_pagamento: "garantito",
    conferimento_gestito: true,
    fondi_ricevuti: false,
    data_conferimento_gestito: today,
    updated_at: new Date().toISOString(),
  };
}
