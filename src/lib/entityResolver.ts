import { supabase } from "@/integrations/supabase/client";
import type { EntityKind } from "@/hooks/useRecentEntities";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntityMatch {
  kind: EntityKind;
  id: string;
  path: string;
}

export interface EntityInfo {
  label: string;
  sub?: string;
}

/** Detect entity kind from a pathname containing a trailing UUID. */
export function detectEntity(pathname: string): EntityMatch | null {
  const seg = pathname.split("/").filter(Boolean);
  const last = seg[seg.length - 1];
  if (!last || !UUID_RE.test(last)) return null;

  if (seg[0] === "archivi" && seg[1] === "clienti") return { kind: "cliente", id: last, path: pathname };
  if (seg[0] === "portafoglio" && seg[1] === "estrazioni" && seg[2] === "per-cliente")
    return { kind: "cliente", id: last, path: pathname };
  if ((seg[0] === "archivi" && seg[1] === "prospect") || seg[0] === "prospect")
    return { kind: "prospect", id: last, path: pathname };
  if (seg[0] === "titoli") return { kind: "polizza", id: last, path: pathname };
  if (seg[0] === "portafoglio" && seg.length === 2) return { kind: "polizza", id: last, path: pathname };
  if (seg[0] === "sinistri") return { kind: "sinistro", id: last, path: pathname };
  if (seg[0] === "trattative") return { kind: "trattativa", id: last, path: pathname };
  if (seg[0] === "archivi" && seg[1]?.startsWith("anagrafiche-agenzie"))
    return { kind: "compagnia", id: last, path: pathname };

  return null;
}

/** Detect from an arbitrary UUID by inspecting the parent segment of the path. */
export function detectEntityFromContext(parentSegment: string | undefined, uuid: string, path: string): EntityMatch | null {
  if (!UUID_RE.test(uuid) || !parentSegment) return null;
  switch (parentSegment) {
    case "clienti":
    case "per-cliente":
      return { kind: "cliente", id: uuid, path };
    case "prospect":
      return { kind: "prospect", id: uuid, path };
    case "titoli":
    case "portafoglio":
      return { kind: "polizza", id: uuid, path };
    case "sinistri":
      return { kind: "sinistro", id: uuid, path };
    case "trattative":
      return { kind: "trattativa", id: uuid, path };
    default:
      if (parentSegment.startsWith("anagrafiche-agenzie")) return { kind: "compagnia", id: uuid, path };
      return null;
  }
}

export async function resolveEntityLabel(m: EntityMatch): Promise<EntityInfo | null> {
  try {
    switch (m.kind) {
      case "cliente": {
        const { data } = await supabase
          .from("clienti")
          .select("ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        const label =
          data.ragione_sociale || [data.cognome, data.nome].filter(Boolean).join(" ") || "Cliente";
        return { label, sub: data.codice_fiscale || data.partita_iva || undefined };
      }
      case "prospect": {
        const { data } = await supabase
          .from("prospect")
          .select("ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        const label =
          data.ragione_sociale || [data.cognome, data.nome].filter(Boolean).join(" ") || "Prospect";
        return { label, sub: data.codice_fiscale || data.partita_iva || undefined };
      }
      case "polizza": {
        const { data } = await supabase
          .from("titoli")
          .select("numero_titolo, descrizione_polizza, prodotto_nome")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return {
          label: data.numero_titolo || "Polizza",
          sub: data.descrizione_polizza || data.prodotto_nome || undefined,
        };
      }
      case "sinistro": {
        const { data } = await supabase
          .from("sinistri")
          .select("numero_sinistro, descrizione")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return { label: data.numero_sinistro || "Sinistro", sub: data.descrizione || undefined };
      }
      case "trattativa": {
        const { data } = await supabase
          .from("trattative")
          .select("prodotto, sottoprodotto, stato")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return {
          label: data.prodotto || "Trattativa",
          sub: [data.sottoprodotto, data.stato].filter(Boolean).join(" · ") || undefined,
        };
      }
      case "compagnia": {
        const { data } = await supabase
          .from("compagnie")
          .select("nome, codice")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return { label: data.nome || "Compagnia", sub: data.codice || undefined };
      }
    }
  } catch {
    return null;
  }
  return null;
}
