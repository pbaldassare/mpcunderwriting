/** Cliente ha pagato il premio direttamente alla compagnia (broker incassa solo la logica di chiusura / provvigione). */
export const TIPO_PAGAMENTO_DIREITO_COMPAGNIA = "pagamento_diretto_compagnia";

/** Incasso registrato come costi Consulbrokers (interno); verso agenzia trattato come bonifico. */
export const TIPO_PAGAMENTO_COSTI_CONSULBROKERS = "costi_consulbrokers";

/** Incasso registrato come compensazione (interno); verso agenzia trattato come bonifico. */
export const TIPO_PAGAMENTO_COMPENSAZIONE = "compensazione";

export function isPagamentoDirettoCompagnia(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
}

export function isTipoPagamentoCostiConsulbrokers(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_COSTI_CONSULBROKERS;
}

export function isTipoPagamentoCompensazione(tipo: string | null | undefined): boolean {
  return (tipo || "").toLowerCase() === TIPO_PAGAMENTO_COMPENSAZIONE;
}

/**
 * Tipi che internamente hanno codice proprio ma verso agenzia/E/C/notifica
 * si comportano come bonifico (label "Bonifico", codice MI "B", niente conto obbligatorio).
 */
export function isTipoPagamentoAliasBonificoEsterno(tipo: string | null | undefined): boolean {
  const tp = (tipo || "").toLowerCase();
  return (
    tp === "bonifico" ||
    tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS ||
    tp === TIPO_PAGAMENTO_COMPENSAZIONE
  );
}

/** Label modalità incasso per email notifica agenzia. */
export function resolveTipoPagamentoPerNotificaAgenzia(tipo: string | null | undefined): string {
  const tp = (tipo || "").toLowerCase();
  if (
    tp === "bonifico" ||
    tp === "garantito" ||
    tp === TIPO_PAGAMENTO_COSTI_CONSULBROKERS ||
    tp === TIPO_PAGAMENTO_COMPENSAZIONE
  ) {
    return "Bonifico bancario";
  }
  const labels: Record<string, string> = {
    contanti: "Contanti",
    assegno: "Assegno",
    pos: "POS / Carta",
    carta_credito: "POS / Carta",
    rid: "RID / Addebito SEPA",
  };
  return labels[tp] || (tipo || "—");
}

/**
 * Risolve il tipo_pagamento da salvare su titoli in fase di messa a cassa.
 * Abbuono/compensazioni sono quadratura interna broker: non compaiono come
 * tipo_pagamento verso l'agenzia. Resta il mezzo reale (bonifico, contanti, …).
 */
export function resolveTipoPagamentoTitoloIncasso(opts: {
  dovuto: number;
  usatoAnticipi: number;
  residuoCash: number;
  haCompensazioni: boolean;
  tipoPagamentoPrincipale: string;
  /** true se gli acconti utilizzati provengono da conti bancari (incasso bonifico). */
  anticipiDaContoBancario?: boolean;
}): string {
  const { dovuto, usatoAnticipi, residuoCash, tipoPagamentoPrincipale, anticipiDaContoBancario } = opts;
  const principale = (tipoPagamentoPrincipale || "").toLowerCase();

  if (isPagamentoDirettoCompagnia(principale)) {
    return TIPO_PAGAMENTO_DIREITO_COMPAGNIA;
  }

  if (dovuto === 0 && usatoAnticipi === 0) {
    return "incasso_zero";
  }

  if (principale === "bonifico") {
    return "bonifico";
  }

  if (isTipoPagamentoCostiConsulbrokers(principale)) {
    return TIPO_PAGAMENTO_COSTI_CONSULBROKERS;
  }

  if (isTipoPagamentoCompensazione(principale)) {
    return TIPO_PAGAMENTO_COMPENSAZIONE;
  }

  if (usatoAnticipi > 0) {
    if (anticipiDaContoBancario && residuoCash === 0) {
      return "bonifico";
    }
    return residuoCash > 0 ? "anticipo_misto" : "anticipo";
  }

  return tipoPagamentoPrincipale || "contanti";
}
