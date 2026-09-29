export type DateRangeLike = {
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
};

export type DatePolizzaGaranzia = {
  inizioPolizza: string | null;
  finePolizza: string | null;
  inizioGaranzia: string | null;
  fineGaranzia: string | null;
};

function nonemptyDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  return s === "" ? null : s;
}

export function extremaDate(
  dates: (string | null | undefined)[],
  mode: "min" | "max",
): string | null {
  const vals = dates.filter((d): d is string => !!d && String(d).trim() !== "");
  if (vals.length === 0) return null;
  vals.sort();
  return mode === "min" ? vals[0]! : vals[vals.length - 1]!;
}

/**
 * Periodo contratto (Inizio/Fine Polizza) = durata della testata, come in TitoloDetail.
 * Non estendere la fine con le garanzia_a delle quietanze: una rata oltre durata_a
 * non deve far comparire un anno in più in elenco (es. M16850989: durata 2029, rata 2030).
 * Se manca durata_da/a, fallback alle garanzie (testata + rate).
 * Inizio/Fine Garanzia restano quelli della quietanza più recente.
 */
export function datePeriodoPolizzaGaranzia(
  head: DateRangeLike | null | undefined,
  rate: DateRangeLike[] = [],
): DatePolizzaGaranzia {
  const h = head || {};
  const all = [h, ...rate];
  const inizioPolizza =
    nonemptyDate(h.durata_da) ||
    extremaDate(all.map((r) => r.garanzia_da), "min");
  const finePolizza =
    nonemptyDate(h.durata_a) ||
    extremaDate(all.map((r) => r.garanzia_a), "max");
  const conFine = rate.filter((r) => r.garanzia_a);
  const ultima =
    conFine.length > 0
      ? [...conFine].sort((a, b) => String(b.garanzia_a).localeCompare(String(a.garanzia_a)))[0]
      : null;
  return {
    inizioPolizza,
    finePolizza,
    inizioGaranzia: ultima?.garanzia_da || h.garanzia_da || null,
    fineGaranzia: ultima?.garanzia_a || h.garanzia_a || null,
  };
}

export function compareDateStr(a: string | null | undefined, b: string | null | undefined, dir: "asc" | "desc"): number {
  const av = a || "";
  const bv = b || "";
  const cmp = av.localeCompare(bv);
  return dir === "asc" ? cmp : -cmp;
}

export function compareText(a: string | null | undefined, b: string | null | undefined, dir: "asc" | "desc"): number {
  const cmp = String(a || "").localeCompare(String(b || ""), "it", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}
