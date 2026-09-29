import { format, parseISO } from "date-fns";
import { isInCoperturaGarantita } from "@/lib/garantitoTitolo";
import type { TitoloDaIncassareRow } from "./columns";

export type TitoloDaIncassareRaw = {
  id: string;
  numero_titolo: string | null;
  appendice_corrente?: string | null;
  appendice?: string | null;
  descrizione_polizza?: string | null;
  cig_rif?: string | null;
  data_competenza?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  limite_mora?: string | null;
  valuta?: string | null;
  cambio?: number | null;
  premio_lordo?: number | null;
  provvigioni_quietanza?: number | null;
  provvigioni_attive?: number | null;
  provvigioni_passive?: number | null;
  produttore_nome?: string | null;
  produttori_display?: string | null;
  data_copertura?: string | null;
  data_incasso?: string | null;
  data_messa_cassa?: string | null;
  conferimento_gestito?: boolean | null;
  fondi_ricevuti?: boolean | null;
  tipo_pagamento?: string | null;
  stato?: string | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  disdetta_giorni?: number | null;
  filiale?: string | null;
  tipo_portafoglio?: string | null;
  tipo?: string | null;
  rate?: number | null;
  numero_rata?: number | null;
  numero_rate_totali?: number | null;
  tacito_rinnovo?: string | null;
  cliente_nome_display?: string | null;
  ae_nome?: string | null;
  ufficio_nome?: string | null;
  specialist?: string | null;
  compagnia_nome?: string | null;
  ramo_nome?: string | null;
  gruppo_compagnia_nome?: string | null;
  gruppo_finanziario_nome?: string | null;
  indotto?: string | null;
  targa_telaio?: string | null;
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  try {
    const d = v.length === 10 ? parseISO(v) : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "";
  }
}

function tipoTitoloLabel(t: TitoloDaIncassareRaw): string {
  if (t.appendice_corrente || t.appendice) return "AP";
  if (!t.sostituisce_polizza) return "PI";
  return "PQ";
}

function rateLabel(t: TitoloDaIncassareRaw): string {
  const rata = t.numero_rata ?? t.rate;
  const tot = t.numero_rate_totali;
  if (rata != null && tot != null && tot > 0) return `${rata}/${tot}`;
  if (rata != null) return String(rata);
  return "";
}

export function mapTitoloDaIncassareRow(t: TitoloDaIncassareRaw): TitoloDaIncassareRow {
  const descrizione = [t.descrizione_polizza, t.targa_telaio ? `Veicolo: ${t.targa_telaio}` : ""]
    .filter(Boolean)
    .join(" — ") || "";

  const garantito = isInCoperturaGarantita(t) ? "G" : "";

  return {
    cliente: t.cliente_nome_display || "",
    sede: t.ufficio_nome || t.ae_nome || "",
    specialist: t.specialist || "",
    compagnia: t.compagnia_nome || "",
    ramo: t.ramo_nome || "",
    gruppoCompagnia: t.gruppo_compagnia_nome || "",
    polizza: t.numero_titolo || "",
    appendice: t.appendice_corrente || t.appendice || "",
    descrizione,
    rifCig: t.cig_rif || "",
    competenza: fmtDate(t.data_competenza),
    inizioPolizza: fmtDate(t.durata_da),
    scadenzaPolizza: fmtDate(t.durata_a),
    inizioGaranzia: fmtDate(t.garanzia_da),
    scadenzaGaranzia: fmtDate(t.garanzia_a),
    limiteMora: fmtDate(t.limite_mora),
    valuta: t.valuta || "EUR",
    cambio: t.cambio ?? 1,
    premio: Number(t.premio_lordo) || 0,
    provvAttive: Number(t.provvigioni_attive ?? t.provvigioni_quietanza) || 0,
    provvPassive: Number(t.provvigioni_passive) || 0,
    produttore: t.produttori_display || t.produttore_nome || "",
    dataGarantito: fmtDate(t.data_copertura),
    dataIncasso: fmtDate(t.data_messa_cassa || t.data_incasso),
    garantito,
    giorniDisdetta: t.disdetta_giorni ?? 0,
    gruppoFinanziario: t.gruppo_finanziario_nome || "",
    filiale: t.filiale || "",
    indotto: t.indotto || "",
    tipoPortafoglio: t.tipo_portafoglio || "",
    tipoTitolo: tipoTitoloLabel(t),
    rate: rateLabel(t),
    rinnovo: t.tacito_rinnovo || "",
  };
}
