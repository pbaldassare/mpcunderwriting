import { isAppendice, isPolizzaMadre, isQuietanza, type TitoloLike } from "@/lib/quietanze";

/**
 * Copia frontespizio (polizza madre) → quietanza figlia.
 * La madre non si mette a cassa: la quietanza è la riga cassabile.
 * Non inventa rate extra: crea 1 figlia se manca, altrimenti aggiorna
 * la prima figlia ancora modificabile.
 */

export type CopiaDatiQuietanzaMadre = TitoloLike & {
  riga?: number | null;
  stato?: string | null;
  cliente_id?: string | null;
  cliente_anagrafica_id?: string | null;
  prodotto_id?: string | null;
  prodotto_nome?: string | null;
  ufficio_id?: string | null;
  produttore_id?: string | null;
  produttore_nome?: string | null;
  compagnia_id?: string | null;
  compagnia_rapporto_id?: string | null;
  codice_rapporto?: string | null;
  ramo_id?: string | null;
  specialist?: string | null;
  commerciale_id?: string | null;
  anagrafica_commerciale_id?: string | null;
  percentuale_commerciale?: number | null;
  percentuale_riparto?: number | null;
  percentuale_ae?: number | null;
  tipo_mandatario?: string | null;
  ae_anagrafica_id?: string | null;
  ae_nome?: string | null;
  anni_durata?: number | null;
  rate?: number | null;
  periodicita?: string | null;
  frazionamento?: string | null;
  tipo_rinnovo?: string | null;
  tacito_rinnovo?: boolean | null;
  disdetta_giorni?: number | null;
  descrizione_polizza?: string | null;
  targa_telaio?: string | null;
  risk_type?: string | null;
  valuta?: string | null;
  cambio?: number | null;
  indicizzata?: boolean | null;
  no_calcolo_tasse?: boolean | null;
  durata_da?: string | null;
  durata_a?: string | null;
  data_scadenza?: string | null;
  data_competenza?: string | null;
  premio_netto?: number | null;
  tasse?: number | null;
  ssn_firma?: number | null;
  addizionali?: number | null;
  provvigioni_firma?: number | null;
  premio_netto_quietanza?: number | null;
  tasse_quietanza?: number | null;
  ssn_quietanza?: number | null;
  addizionali_quietanza?: number | null;
  provvigioni_quietanza?: number | null;
  premio_lordo?: number | null;
  brokeraggio_firma?: number | null;
  brokeraggio_quietanza?: number | null;
  percentuale_brokeraggio?: number | null;
  tipo_portafoglio?: string | null;
  polizza_temporanea?: boolean | null;
  polizza_rateo?: boolean | null;
  cig_rif?: string | null;
  cig_temporaneo?: boolean | null;
  vincolo?: string | null;
  vincolo_attivo?: boolean | null;
  note?: string | null;
  emittenda?: boolean | null;
  formato_elettronico?: boolean | null;
  rimborso?: boolean | null;
  coassicurazione?: boolean | null;
};

export type CopiaDatiQuietanzaFiglia = TitoloLike & {
  riga?: number | null;
  stato?: string | null;
  data_messa_cassa?: string | null;
};

export type CopiaDatiQuietanzaDecision =
  | { action: "create" }
  | { action: "update"; target: CopiaDatiQuietanzaFiglia }
  | { action: "blocked"; reason: string };

const CASSA_STATI = new Set(["incassato", "stornato", "annullato"]);

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

export function isQuietanzaFigliaBloccata(q: CopiaDatiQuietanzaFiglia): boolean {
  if (isAppendice(q)) return true;
  if (q.data_messa_cassa) return true;
  return CASSA_STATI.has(String(q.stato || "").toLowerCase());
}

export function canCopiaDatiInQuietanza(madre: CopiaDatiQuietanzaMadre): {
  ok: boolean;
  reason?: string;
} {
  if (!isPolizzaMadre(madre)) {
    return { ok: false, reason: "Si possono copiare i dati solo dalla polizza (frontespizio)." };
  }
  if (!String(madre.numero_titolo || "").trim()) {
    return { ok: false, reason: "Manca il numero polizza." };
  }
  const stato = String(madre.stato || "").toLowerCase();
  if (stato === "stornato" || stato === "annullato") {
    return { ok: false, reason: "Polizza stornata o annullata: copia non disponibile." };
  }
  return { ok: true };
}

/** Figlie cassabili (non appendici) della stessa polizza. */
export function filterQuietanzeFiglie(
  madre: CopiaDatiQuietanzaMadre,
  rows: CopiaDatiQuietanzaFiglia[],
): CopiaDatiQuietanzaFiglia[] {
  const numero = String(madre.numero_titolo || "").trim();
  return rows
    .filter((r) => r.id !== madre.id)
    .filter((r) => isQuietanza(r) || (!!r.sostituisce_polizza && !isAppendice(r)))
    .filter((r) => String(r.sostituisce_polizza || "").trim() === numero)
    .sort((a, b) => (Number(a.riga) || 0) - (Number(b.riga) || 0));
}

export function decideCopiaDatiInQuietanza(
  madre: CopiaDatiQuietanzaMadre,
  figlie: CopiaDatiQuietanzaFiglia[],
): CopiaDatiQuietanzaDecision {
  const gate = canCopiaDatiInQuietanza(madre);
  if (!gate.ok) return { action: "blocked", reason: gate.reason || "Copia non disponibile." };

  const rate = filterQuietanzeFiglie(madre, figlie);
  if (rate.length === 0) return { action: "create" };

  const sbloccata = rate.find((q) => !isQuietanzaFigliaBloccata(q));
  if (!sbloccata) {
    return { action: "blocked", reason: "La quietanza è già a cassa: non si può sovrascrivere." };
  }
  return { action: "update", target: sbloccata };
}

export function nextRigaQuietanza(
  madre: CopiaDatiQuietanzaMadre,
  figlie: CopiaDatiQuietanzaFiglia[],
): number {
  const rate = filterQuietanzeFiglie(madre, figlie);
  const max = Math.max(Number(madre.riga) || 0, ...rate.map((r) => Number(r.riga) || 0));
  return max + 1;
}

export type ImportiQuietanzaDaMadre = {
  premio_netto: number | null;
  tasse: number | null;
  ssn_firma: number | null;
  addizionali: number | null;
  provvigioni_firma: number | null;
  premio_netto_quietanza: number | null;
  tasse_quietanza: number | null;
  ssn_quietanza: number | null;
  addizionali_quietanza: number | null;
  provvigioni_quietanza: number | null;
  premio_lordo: number | null;
  brokeraggio_firma: number | null;
  brokeraggio_quietanza: number | null;
};

/** Premi cassabili: campi quietanza della madre, fallback firma. */
export function importiQuietanzaDaMadre(madre: CopiaDatiQuietanzaMadre): ImportiQuietanzaDaMadre {
  const netto = pickNum(madre.premio_netto_quietanza, madre.premio_netto);
  const tasse = pickNum(madre.tasse_quietanza, madre.tasse);
  const ssn = pickNum(madre.ssn_quietanza, madre.ssn_firma);
  const add = pickNum(madre.addizionali_quietanza, madre.addizionali);
  const provv = pickNum(madre.provvigioni_quietanza, madre.provvigioni_firma);
  const brok = pickNum(madre.brokeraggio_quietanza, madre.brokeraggio_firma);
  const parts = [netto, tasse, ssn, add].map((n) => n || 0);
  const lordoFromParts = parts.reduce((s, n) => s + n, 0);
  const lordo = lordoFromParts > 0 ? Math.round(lordoFromParts * 100) / 100 : pickNum(madre.premio_lordo);
  return {
    premio_netto: netto,
    tasse,
    ssn_firma: ssn,
    addizionali: add,
    provvigioni_firma: provv,
    premio_netto_quietanza: netto,
    tasse_quietanza: tasse,
    ssn_quietanza: ssn,
    addizionali_quietanza: add,
    provvigioni_quietanza: provv,
    premio_lordo: lordo,
    brokeraggio_firma: brok,
    brokeraggio_quietanza: brok,
  };
}

function campiAnagraficiDaMadre(madre: CopiaDatiQuietanzaMadre): Record<string, unknown> {
  return {
    cliente_id: madre.cliente_id ?? null,
    cliente_anagrafica_id: madre.cliente_anagrafica_id ?? null,
    prodotto_id: madre.prodotto_id ?? null,
    prodotto_nome: madre.prodotto_nome ?? null,
    ufficio_id: madre.ufficio_id ?? null,
    produttore_id: madre.produttore_id ?? null,
    produttore_nome: madre.produttore_nome ?? null,
    compagnia_id: madre.compagnia_id ?? null,
    compagnia_rapporto_id: madre.compagnia_rapporto_id ?? null,
    codice_rapporto: madre.codice_rapporto ?? null,
    ramo_id: madre.ramo_id ?? null,
    specialist: madre.specialist ?? null,
    commerciale_id: madre.commerciale_id ?? null,
    anagrafica_commerciale_id: madre.anagrafica_commerciale_id ?? null,
    percentuale_commerciale: madre.percentuale_commerciale ?? null,
    percentuale_riparto: madre.percentuale_riparto ?? null,
    percentuale_ae: madre.percentuale_ae ?? null,
    tipo_mandatario: madre.tipo_mandatario ?? null,
    ae_anagrafica_id: madre.ae_anagrafica_id ?? null,
    ae_nome: madre.ae_nome ?? null,
    anni_durata: madre.anni_durata ?? null,
    rate: madre.rate ?? null,
    periodicita: madre.periodicita ?? null,
    frazionamento: madre.frazionamento ?? null,
    tipo_rinnovo: madre.tipo_rinnovo ?? null,
    tacito_rinnovo: !!madre.tacito_rinnovo,
    disdetta_giorni: madre.disdetta_giorni ?? null,
    descrizione_polizza: madre.descrizione_polizza ?? null,
    targa_telaio: madre.targa_telaio ?? null,
    risk_type: madre.risk_type ?? null,
    valuta: madre.valuta ?? "EUR",
    cambio: madre.cambio ?? 1,
    indicizzata: !!madre.indicizzata,
    no_calcolo_tasse: !!madre.no_calcolo_tasse,
    durata_da: madre.durata_da ?? madre.garanzia_da ?? null,
    durata_a: madre.durata_a ?? madre.garanzia_a ?? null,
    data_scadenza: madre.data_scadenza ?? madre.durata_a ?? madre.garanzia_a ?? null,
    data_competenza: madre.data_competenza ?? madre.durata_da ?? madre.garanzia_da ?? null,
    garanzia_da: madre.garanzia_da ?? madre.durata_da ?? null,
    garanzia_a: madre.garanzia_a ?? madre.durata_a ?? null,
    tipo_portafoglio: madre.tipo_portafoglio ?? null,
    polizza_temporanea: !!madre.polizza_temporanea,
    polizza_rateo: !!madre.polizza_rateo,
    cig_rif: madre.cig_rif ?? null,
    cig_temporaneo: !!madre.cig_temporaneo,
    vincolo: madre.vincolo ?? null,
    vincolo_attivo: !!madre.vincolo_attivo,
    note: madre.note ?? null,
    emittenda: !!madre.emittenda,
    formato_elettronico: !!madre.formato_elettronico,
    rimborso: !!madre.rimborso,
    coassicurazione: !!madre.coassicurazione,
    percentuale_brokeraggio: madre.percentuale_brokeraggio ?? null,
  };
}

/** Insert figlia: sostituisce_polizza valorizzato così il trigger non genera altre rate. */
export function buildQuietanzaFigliaInsertFromMadre(
  madre: CopiaDatiQuietanzaMadre,
  riga: number,
): Record<string, unknown> {
  const numero = String(madre.numero_titolo || "").trim();
  return {
    ...campiAnagraficiDaMadre(madre),
    ...importiQuietanzaDaMadre(madre),
    numero_titolo: numero,
    riga,
    stato: "attivo",
    sostituisce_polizza: numero,
    sostituisce_riga: madre.riga ?? 0,
    is_appendice_modifica: false,
    is_proroga: false,
    is_regolazione: false,
    data_messa_cassa: null,
    data_incasso: null,
    data_pagamento: null,
    data_copertura: null,
    importo_incassato: null,
  };
}

export function buildQuietanzaFigliaUpdateFromMadre(
  madre: CopiaDatiQuietanzaMadre,
): Record<string, unknown> {
  const numero = String(madre.numero_titolo || "").trim();
  return {
    ...campiAnagraficiDaMadre(madre),
    ...importiQuietanzaDaMadre(madre),
    numero_titolo: numero,
    sostituisce_polizza: numero,
    sostituisce_riga: madre.riga ?? 0,
  };
}
