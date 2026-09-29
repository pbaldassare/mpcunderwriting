export type AssicurappOffer = {
  id?: string | number;
  quoteUID?: string;
  company_slug?: string;
  label?: string;
  prices?: Record<string, unknown>;
  guarantees?: unknown[];
  status?: string;
  notes?: string;
  origin?: string;
};

export function genderFromCf(cf?: string | null, fallback?: string | null): string {
  const g = String(fallback || "").trim().toUpperCase();
  if (g === "M" || g === "F") return g;
  const raw = String(cf || "").toUpperCase();
  if (raw.length < 11) return "";
  const day = parseInt(raw.substring(9, 11), 10);
  if (Number.isNaN(day)) return "";
  return day > 40 ? "F" : "M";
}

export function selectedCvtsFromGaranzie(garanzie: string[] | null | undefined): string[] {
  const g = new Set(garanzie || []);
  const cvts: string[] = [];
  if (g.has("infortuni_conducente")) cvts.push("IF");
  if (g.has("furto_incendio") || g.has("eventi_naturali") || g.has("atti_vandalici")) cvts.push("IFE");
  if (g.has("collisione")) cvts.push("IFE C");
  if (g.has("kasko")) cvts.push("IFE K");
  return cvts;
}

export function hasPendingAssicurappOffers(offerte: AssicurappOffer[] | null | undefined): boolean {
  return (offerte || []).some((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "pending" || s === "in_progress" || s === "running" || s === "processing";
  });
}

export function hasCompletedAssicurappOffers(offerte: AssicurappOffer[] | null | undefined): boolean {
  return (offerte || []).some((o) => {
    const s = String(o.status || "").toLowerCase();
    return s === "completed" || s === "success" || s === "ok";
  });
}

export function deriveStatoPreventivoDaOfferte(
  offerte: AssicurappOffer[] | null | undefined,
  quoteUid: string | null | undefined,
): "pronto" | "in_quotazione" | "quotato" {
  if (!quoteUid) return "pronto";
  if (hasPendingAssicurappOffers(offerte)) return "in_quotazione";
  if (hasCompletedAssicurappOffers(offerte)) return "quotato";
  return "in_quotazione";
}

export function extractPremioOfferta(prices?: Record<string, unknown> | null): number | null {
  if (!prices) return null;
  const keys = ["total_gross", "total", "orig_total", "premium", "annual", "annual_premium"];
  for (const key of keys) {
    const value = prices[key];
    if (typeof value === "number" && value > 0) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  const rate = prices.rate;
  if (Array.isArray(rate) && rate[0] && typeof rate[0] === "object") {
    const first = rate[0] as Record<string, unknown>;
    const min = typeof first.min === "number" ? first.min : Number(first.min);
    if (Number.isFinite(min) && min > 0) return min;
  }
  return null;
}

export function labelStatoOfferta(status?: string | null): string {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "success" || s === "ok") return "Completata";
  if (s === "pending" || s === "in_progress" || s === "running" || s === "processing") return "In corso";
  if (s === "failed" || s === "error") return "Errore";
  if (s === "declined" || s === "refused") return "Rifiutata";
  if (s === "not_quotable") return "Non quotabile";
  return status || "—";
}

export function formatEuroPremio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}
