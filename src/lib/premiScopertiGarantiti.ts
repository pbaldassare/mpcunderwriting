import { format } from "date-fns";
import { isGarantitoDaIncassare } from "@/lib/garantitoTitolo";
import { canHaveDataCopertura, isAppendice, isQuietanza, type TitoloLike } from "@/lib/quietanze";
import { labelAgenziaRiferimento } from "@/lib/compagniaDisplay";

export type MoraStatusFilter = "tutti" | "scaduti" | "in_corso" | "senza_limite";
export type ClassificazioneFilter = "tutti" | "scoperti" | "garantiti";
export type CriterioDataFilter = "limite_mora" | "garanzia_a" | "smart";

export type PremiScopertiRaw = TitoloLike & {
  id: string;
  numero_titolo?: string | null;
  stato?: string | null;
  premio_lordo?: number | null;
  importo_incassato?: number | null;
  ufficio_id?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  limite_mora?: string | null;
  mora_giorni?: number | null;
  tipo_portafoglio?: string | null;
  data_messa_cassa?: string | null;
  data_copertura?: string | null;
  conferimento_gestito?: boolean | null;
  fondi_ricevuti?: boolean | null;
  tipo_pagamento?: string | null;
  prodotto_nome?: string | null;
  compagnia_id?: string | null;
  clienti?: {
    cognome?: string | null;
    nome?: string | null;
    ragione_sociale?: string | null;
  } | null;
  compagnia_diretta?: {
    nome?: string | null;
    codice?: string | null;
    gruppo_compagnia?: string | null;
    gruppi_compagnia?: { descrizione?: string | null; codice?: string | null } | null;
  } | null;
  compagnia_rapporto?: {
    gruppi_compagnia?: { descrizione?: string | null; codice?: string | null } | null;
  } | null;
  ramo?: {
    descrizione?: string | null;
    codice?: string | null;
    gruppo_ramo?: { descrizione?: string | null; codice?: string | null } | null;
  } | null;
  uffici?: { nome_ufficio?: string | null } | null;
};

export type PremiScopertiRow = {
  id: string;
  numeroTitolo: string;
  cliente: string;
  agenzia: string;
  ramo: string;
  garanzia: string;
  premioLordo: number;
  garanziaA: string | null;
  limiteMora: string | null;
  tipoDocumento: string;
  classificazione: "garantito" | "scoperto";
  sede: string;
  ufficioId: string | null;
  compagniaId: string | null;
  stato: string;
  moraStatus: "scaduto" | "in_corso" | "senza_limite";
  dateKey: string | null;
};

/** Titolo ancora da chiudere (quietanza/appendice): senza messa a cassa, oppure garantito in attesa fondi. */
export function isApertoDaIncassare(t: PremiScopertiRaw): boolean {
  if (!canHaveDataCopertura(t)) return false;
  if (t.stato === "incassato" || t.stato === "annullato") return false;
  if (!(t.stato === "attivo" || t.stato === "sospeso" || !t.stato)) return false;
  if (!t.data_messa_cassa) return true;
  return isGarantitoDaIncassare(t);
}

export function classifyPremio(t: PremiScopertiRaw): "garantito" | "scoperto" {
  return isGarantitoDaIncassare(t) ? "garantito" : "scoperto";
}

export function labelTipoDocumento(t: PremiScopertiRaw): string {
  const fromPortafoglio = (t.tipo_portafoglio || "").trim().toLowerCase();
  if (fromPortafoglio.includes("quietanz")) return "Quietanza";
  if (fromPortafoglio.includes("appendic")) return "Appendice";
  if (fromPortafoglio && fromPortafoglio !== "polizza") {
    return t.tipo_portafoglio!.trim();
  }
  if (isAppendice(t)) return "Appendice";
  if (isQuietanza(t)) return "Quietanza";
  return "Altro";
}

export function moraStatusOf(limiteMora: string | null | undefined, refDate = format(new Date(), "yyyy-MM-dd")): PremiScopertiRow["moraStatus"] {
  if (!limiteMora) return "senza_limite";
  return limiteMora < refDate ? "scaduto" : "in_corso";
}

export function dateKeyForRow(t: PremiScopertiRaw, criterio: CriterioDataFilter): string | null {
  if (criterio === "limite_mora") return t.limite_mora || null;
  if (criterio === "garanzia_a") return t.garanzia_a || null;
  return t.limite_mora || t.garanzia_a || null;
}

export function mapPremiScopertiRow(t: PremiScopertiRaw, criterio: CriterioDataFilter = "smart"): PremiScopertiRow {
  const cliente =
    t.clienti?.ragione_sociale ||
    `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim() ||
    "—";
  const gruppoRamo = t.ramo?.gruppo_ramo?.descrizione || "";
  const ramoDesc = t.ramo?.descrizione || "";
  const ramo = [gruppoRamo, ramoDesc].filter(Boolean).join(" / ") || "—";
  const garanzia = ramoDesc || t.prodotto_nome || "—";

  return {
    id: t.id,
    numeroTitolo: t.numero_titolo || "—",
    cliente,
    agenzia: labelAgenziaRiferimento(t) || "—",
    ramo,
    garanzia,
    premioLordo: Number(t.premio_lordo) || 0,
    garanziaA: t.garanzia_a || null,
    limiteMora: t.limite_mora || null,
    tipoDocumento: labelTipoDocumento(t),
    classificazione: classifyPremio(t),
    sede: t.uffici?.nome_ufficio || "—",
    ufficioId: t.ufficio_id || null,
    compagniaId: t.compagnia_id || null,
    stato: t.stato || "",
    moraStatus: moraStatusOf(t.limite_mora),
    dateKey: dateKeyForRow(t, criterio),
  };
}

export function inDateRange(dateKey: string | null, from?: Date | null, to?: Date | null): boolean {
  if (!from && !to) return true;
  if (!dateKey) return false;
  if (from && dateKey < format(from, "yyyy-MM-dd")) return false;
  if (to && dateKey > format(to, "yyyy-MM-dd")) return false;
  return true;
}

export function fmtDateIt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}
