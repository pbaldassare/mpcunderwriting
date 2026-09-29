/** Criterio data per filtrare l'estrazione Premi e Provvigioni (titoli sempre incassati). */
export type PremiProvvigioniCriterioData = "cassa" | "competenza" | "effetto" | "scadenza";

export const PREMI_PROVVIGIONI_CRITERIO_DATA: {
  value: PremiProvvigioniCriterioData;
  label: string;
  column: string;
}[] = [
  { value: "cassa", label: "Cassa", column: "data_messa_cassa" },
  { value: "competenza", label: "Competenza", column: "data_competenza" },
  { value: "effetto", label: "Data effetto", column: "durata_da" },
  { value: "scadenza", label: "Scadenza", column: "garanzia_a" },
];

export function resolvePremiProvvigioniDateColumn(
  criterio: PremiProvvigioniCriterioData = "cassa",
): string {
  return PREMI_PROVVIGIONI_CRITERIO_DATA.find((c) => c.value === criterio)?.column ?? "data_messa_cassa";
}

export function labelPremiProvvigioniCriterioData(
  criterio: PremiProvvigioniCriterioData = "cassa",
): string {
  return PREMI_PROVVIGIONI_CRITERIO_DATA.find((c) => c.value === criterio)?.label ?? "Cassa";
}

export function periodoConCriterioLabel(
  periodo: string,
  criterio: PremiProvvigioniCriterioData = "cassa",
): string {
  return `${periodo} · per ${labelPremiProvvigioniCriterioData(criterio).toLowerCase()}`;
}
