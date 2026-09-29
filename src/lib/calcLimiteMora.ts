/** Limite mora = garanzia_da + mora_giorni (ISO date YYYY-MM-DD). */
export function calcLimiteMora(
  garanziaDa: string | null | undefined,
  moraGiorni: string | number | null | undefined,
): string {
  if (!garanziaDa) return "";
  const gg = Number(moraGiorni) || 0;
  const d = new Date(garanziaDa.slice(0, 10));
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + gg);
  return d.toISOString().slice(0, 10);
}

/** Giorni mora da garanzia_da e limite_mora. */
export function calcMoraGiorni(
  garanziaDa: string | null | undefined,
  limiteMora: string | null | undefined,
): string {
  if (!garanziaDa || !limiteMora) return "";
  const ms =
    new Date(limiteMora.slice(0, 10)).getTime() -
    new Date(garanziaDa.slice(0, 10)).getTime();
  return String(Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24))));
}
