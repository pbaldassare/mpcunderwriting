/** Modalità incasso / provvigioni per singolo titolo. */
export type ModalitaIncasso = "standard" | "produttore_trattiene_provv";

export const MODALITA_INCASSO_OPTIONS: Array<{ value: ModalitaIncasso; label: string; description: string }> = [
  {
    value: "standard",
    label: "Standard",
    description: "Incasso integrale a Consulbrokers; provvigioni in E/C produttore da liquidare.",
  },
  {
    value: "produttore_trattiene_provv",
    label: "Produttore trattiene provvigioni",
    description: "Il produttore incassa dal cliente e trattiene la provvigione (netto RA). Esclusa dal conteggio E/C da pagare, voce separata.",
  },
];

export function defaultModalitaFromAnagrafica(trattenutaAnagrafica: boolean | null | undefined): ModalitaIncasso {
  return trattenutaAnagrafica ? "produttore_trattiene_provv" : "standard";
}

export function modalitaIncassoLabel(modalita: ModalitaIncasso | string | null | undefined): string {
  const opt = MODALITA_INCASSO_OPTIONS.find((o) => o.value === modalita);
  return opt?.label ?? "Standard";
}

export interface ModalitaIncassoRow {
  id: string;
  titolo_id: string;
  modalita: ModalitaIncasso;
  anagrafica_commerciale_id: string | null;
  importo_dovuto_lordo: number | null;
  importo_provvigione_lorda: number | null;
  importo_ra: number | null;
  importo_trattenuto_netto: number | null;
  importo_versato_consul: number | null;
  stato: string;
  note: string | null;
  applicata_il: string;
  produttore_nome?: string | null;
}
