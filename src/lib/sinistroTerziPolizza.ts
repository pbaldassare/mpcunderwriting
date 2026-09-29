/** Campi polizza dichiarati su Sinistro Terzi (niente FK su titoli). */
export type SinistroTerziPolizzaValues = {
  numero_polizza?: string | null;
  compagnia_id?: string | null;
  ramo_sinistro?: string | null;
  prodotto_sinistro?: string | null;
  ufficio_id?: string | null;
};

export const emptySinistroTerziPolizza = (): Required<Record<keyof SinistroTerziPolizzaValues, string>> => ({
  numero_polizza: "",
  compagnia_id: "",
  ramo_sinistro: "",
  prodotto_sinistro: "",
  ufficio_id: "",
});

/** Obbligatori per avanzare / finalizzare un Sinistro Terzi. */
export function validateSinistroTerziObbligatori(
  values: SinistroTerziPolizzaValues,
): string | null {
  if (!values.numero_polizza?.trim()) {
    return "Inserisci il numero polizza";
  }
  if (!values.compagnia_id?.trim()) {
    return "Seleziona la compagnia";
  }
  if (!values.ramo_sinistro?.trim()) {
    return "Inserisci il ramo / garanzia";
  }
  return null;
}

export function terziPolizzaToDbPayload(values: SinistroTerziPolizzaValues) {
  return {
    numero_polizza: values.numero_polizza?.trim() || null,
    compagnia_id: values.compagnia_id?.trim() || null,
    ramo_sinistro: values.ramo_sinistro?.trim() || null,
    prodotto_sinistro: values.prodotto_sinistro?.trim() || null,
    ufficio_id: values.ufficio_id?.trim() || null,
  };
}

export function terziPolizzaFromRow(row: Record<string, unknown>): Required<Record<keyof SinistroTerziPolizzaValues, string>> {
  return {
    numero_polizza: typeof row.numero_polizza === "string" ? row.numero_polizza : "",
    compagnia_id: typeof row.compagnia_id === "string" ? row.compagnia_id : "",
    ramo_sinistro: typeof row.ramo_sinistro === "string" ? row.ramo_sinistro : "",
    prodotto_sinistro: typeof row.prodotto_sinistro === "string" ? row.prodotto_sinistro : "",
    ufficio_id: typeof row.ufficio_id === "string" ? row.ufficio_id : "",
  };
}
