import { format, parseISO } from "date-fns";

export function formatPolizzaRamo(titolo: {
  ramo?: { descrizione?: string | null; gruppo_ramo?: { descrizione?: string | null } | null } | null;
} | null | undefined): string {
  if (!titolo?.ramo) return "—";
  const gruppo = titolo.ramo.gruppo_ramo?.descrizione?.trim();
  const sottoramo = titolo.ramo.descrizione?.trim();
  if (gruppo && sottoramo && gruppo !== sottoramo) return `${gruppo} · ${sottoramo}`;
  return gruppo || sottoramo || "—";
}

export function formatPolizzaScadenza(titolo: {
  garanzia_a?: string | null;
  data_scadenza?: string | null;
} | null | undefined): string {
  const raw = titolo?.garanzia_a || titolo?.data_scadenza;
  if (!raw) return "—";
  try {
    return format(parseISO(raw.slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return raw.slice(0, 10);
  }
}

export function formatPolizzaDecorrenza(titolo: {
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
} | null | undefined): string {
  const raw = titolo?.garanzia_da || titolo?.durata_da || titolo?.data_decorrenza || titolo?.data_competenza;
  if (!raw) return "—";
  try {
    return format(parseISO(raw.slice(0, 10)), "dd/MM/yyyy");
  } catch {
    return raw.slice(0, 10);
  }
}

export function formatPolizzaProdotto(titolo: {
  prodotto_nome?: string | null;
  prodotti?: { nome_prodotto?: string | null } | null;
} | null | undefined): string {
  return titolo?.prodotto_nome?.trim() || titolo?.prodotti?.nome_prodotto?.trim() || "—";
}

export function formatPolizzaPeriodo(titolo: {
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
} | null | undefined): string {
  return `${formatPolizzaDecorrenza(titolo)} → ${formatPolizzaScadenza(titolo)}`;
}

/** Garanzie da premi, altrimenti ramo/sottoramo. */
export function formatPolizzaGaranzia(titolo: {
  premi_garanzia_polizza?: Array<{ garanzia?: string | null } | null> | null;
  ramo?: { descrizione?: string | null; gruppo_ramo?: { descrizione?: string | null } | null } | null;
} | null | undefined): string {
  const fromPremi = [
    ...new Set(
      (titolo?.premi_garanzia_polizza ?? [])
        .map((r) => r?.garanzia?.trim())
        .filter((g): g is string => Boolean(g)),
    ),
  ].join(", ");
  if (fromPremi) return fromPremi;
  return formatPolizzaRamo(titolo);
}

export function formatPolizzaCompagnia(titolo: {
  compagnia_diretta?: { nome?: string | null } | null;
  prodotti?: { compagnie?: { nome?: string | null } | null } | null;
} | null | undefined): string {
  return (
    titolo?.compagnia_diretta?.nome?.trim() ||
    titolo?.prodotti?.compagnie?.nome?.trim() ||
    "—"
  );
}

export type PolizzaSelectSource = {
  id: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  stato?: string | null;
  compagnia_diretta?: { nome?: string | null } | null;
  prodotti?: {
    nome_prodotto?: string | null;
    compagnie?: { nome?: string | null } | null;
  } | null;
  prodotto_nome?: string | null;
  garanzia_da?: string | null;
  durata_da?: string | null;
  data_decorrenza?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  data_scadenza?: string | null;
  ramo?: { descrizione?: string | null; gruppo_ramo?: { descrizione?: string | null } | null } | null;
  premi_garanzia_polizza?: Array<{ garanzia?: string | null } | null> | null;
};

/** Sottotitolo compatto: prodotto · garanzia · compagnia */
export function formatPolizzaOptionDescription(titolo: PolizzaSelectSource | null | undefined): string {
  const prodotto = formatPolizzaProdotto(titolo);
  const garanzia = formatPolizzaGaranzia(titolo);
  const compagnia = formatPolizzaCompagnia(titolo);
  return [prodotto, garanzia, compagnia].filter((v) => v && v !== "—").join(" · ") || "—";
}

export function buildPolizzaOptionDetails(titolo: PolizzaSelectSource | null | undefined) {
  return [
    { label: "Prodotto", value: formatPolizzaProdotto(titolo) },
    { label: "Garanzia", value: formatPolizzaGaranzia(titolo) },
    { label: "Compagnia", value: formatPolizzaCompagnia(titolo) },
    { label: "Periodo", value: formatPolizzaPeriodo(titolo) },
  ];
}

/** Opzione SearchableSelect per polizze (wizard sinistro, dettaglio pratica). */
export function buildPolizzaSelectOption(p: PolizzaSelectSource) {
  const details = buildPolizzaOptionDetails(p);
  return {
    value: p.id,
    label: `${p.numero_titolo ?? ""}${p.sostituisce_polizza ? " (quietanza)" : ""}`,
    description: formatPolizzaOptionDescription(p),
    details,
    searchText: [
      p.numero_titolo,
      formatPolizzaCompagnia(p),
      formatPolizzaProdotto(p),
      formatPolizzaGaranzia(p),
      p.stato || "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
