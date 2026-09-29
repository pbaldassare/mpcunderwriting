import { extractPremioOfferta, type AssicurappOffer } from "@/lib/rca/assicurapp";

export type OffertaSalvata = {
  id: string | number | null;
  company_slug: string;
  label: string;
  premio: number | null;
  status: string;
  notes: string;
  origin: string;
};

export function offertaKey(offer: Pick<AssicurappOffer, "id" | "company_slug" | "label">, index = 0): string {
  return String(offer.id || offer.company_slug || offer.label || index);
}

export function sortOfferte(offerte: AssicurappOffer[]): AssicurappOffer[] {
  const rank = (status?: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed" || s === "success" || s === "ok") return 0;
    if (s === "pending" || s === "in_progress" || s === "running" || s === "processing") return 1;
    if (s === "not_quotable") return 3;
    return 2;
  };
  return [...offerte].sort((a, b) => {
    const rs = rank(a.status) - rank(b.status);
    if (rs !== 0) return rs;
    const pa = extractPremioOfferta(a.prices) ?? Number.POSITIVE_INFINITY;
    const pb = extractPremioOfferta(b.prices) ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
}

export function bestCompletedOffer(offerte: AssicurappOffer[]): AssicurappOffer | null {
  const completed = offerte.filter((o) => {
    const s = String(o.status || "").toLowerCase();
    return (s === "completed" || s === "success" || s === "ok") && extractPremioOfferta(o.prices);
  });
  if (completed.length === 0) return null;
  return sortOfferte(completed)[0] || null;
}

export function toOffertaSalvata(offer: AssicurappOffer): OffertaSalvata {
  return {
    id: offer.id ?? null,
    company_slug: String(offer.company_slug || ""),
    label: String(offer.label || offer.company_slug || "Compagnia"),
    premio: extractPremioOfferta(offer.prices),
    status: String(offer.status || ""),
    notes: String(offer.notes || ""),
    origin: String(offer.origin || ""),
  };
}

export function selectedOfferFromSnapshot(snapshot: Record<string, unknown> | null | undefined): OffertaSalvata | null {
  const raw = snapshot?.selected_offer;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<OffertaSalvata>;
  if (!o.label && !o.company_slug) return null;
  return {
    id: o.id ?? null,
    company_slug: String(o.company_slug || ""),
    label: String(o.label || o.company_slug || "Compagnia"),
    premio: typeof o.premio === "number" ? o.premio : o.premio != null ? Number(o.premio) : null,
    status: String(o.status || ""),
    notes: String(o.notes || ""),
    origin: String(o.origin || ""),
  };
}

export function withSelectedOffer(
  snapshot: Record<string, unknown> | null | undefined,
  offer: AssicurappOffer,
): Record<string, unknown> {
  return {
    ...(snapshot || {}),
    selected_offer: toOffertaSalvata(offer),
  };
}
