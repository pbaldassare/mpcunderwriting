import { format, parseISO } from "date-fns";
import type { PremiProvvigioniRow } from "./columns";

export type PremiProvvigioniRaw = {
  id: string;
  numero_titolo?: string | null;
  appendice_corrente?: string | null;
  appendice?: string | null;
  descrizione_polizza?: string | null;
  comp_contabile?: string | null;
  comp_assicurativa?: string | null;
  data_competenza?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  premio_lordo?: number | null;
  premio_netto?: number | null;
  tasse?: number | null;
  provvigioni_quietanza?: number | null;
  provvigioni_firma?: number | null;
  provv_passive?: number | null;
  perc_provv?: number | null;
  provv_pagata?: boolean | null;
  produttore_nome?: string | null;
  produttori_display?: string | null;
  data_copertura?: string | null;
  data_incasso?: string | null;
  data_messa_cassa?: string | null;
  importo_incassato?: number | null;
  conto_incasso?: string | null;
  filiale?: string | null;
  tipo_portafoglio?: string | null;
  percentuale_riparto?: number | null;
  cliente_nome_display?: string | null;
  ae_nome?: string | null;
  ufficio_nome?: string | null;
  specialist?: string | null;
  compagnia_nome?: string | null;
  compagnia_codice?: string | null;
  ramo_nome?: string | null;
  gruppo_compagnia_nome?: string | null;
  gruppo_stat_compagnia?: string | null;
  targa_telaio?: string | null;
  zona?: string | null;
  indotto?: string | null;
  settore?: string | null;
  contratto?: string | null;
  fatturato?: number | null;
  num_dipendenti?: number | null;
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  try {
    const d = v.length === 10 ? parseISO(v) : new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return format(d, "dd/MM/yyyy");
  } catch {
    return v;
  }
}

function compDate(comp: string | null | undefined, fallback: string | null | undefined): string {
  return fmtDate(comp || fallback);
}

export function mapPremiProvvigioniRow(t: PremiProvvigioniRaw): PremiProvvigioniRow {
  const descrizione = [t.descrizione_polizza, t.targa_telaio ? `Veicolo: ${t.targa_telaio}` : ""]
    .filter(Boolean)
    .join(" — ") || "";

  const attive = Number(t.provvigioni_quietanza ?? t.provvigioni_firma) || 0;
  const passive = Number(t.provv_passive) || 0;

  return {
    nomeCliente: t.cliente_nome_display || "",
    nomeAE: t.ufficio_nome || t.ae_nome || "",
    nomeSpecialist: t.specialist || "",
    cdComp: t.compagnia_codice || "",
    nomeCompagnia: t.compagnia_nome || "",
    percRiparto: t.percentuale_riparto ?? "",
    ramo: t.ramo_nome || "",
    gruppoFinCompagnia: t.gruppo_compagnia_nome || "",
    gruppoStatCompagnia: t.gruppo_stat_compagnia || "",
    polizza: t.numero_titolo || "",
    appendice: t.appendice_corrente || t.appendice || "",
    descrizione,
    compContabile: compDate(t.comp_contabile, t.data_competenza),
    compAssicurativa: compDate(t.comp_assicurativa, t.data_competenza),
    inizPol: fmtDate(t.durata_da),
    scadPol: fmtDate(t.durata_a),
    inizGar: fmtDate(t.garanzia_da),
    scadGar: fmtDate(t.garanzia_a),
    premio: Number(t.premio_lordo) || 0,
    imponibile: Number(t.premio_netto) || 0,
    tasse: Number(t.tasse) || 0,
    attive,
    passive,
    nomeProduttore: t.produttori_display || t.produttore_nome || "",
    dtCopertura: fmtDate(t.data_copertura),
    dtIncasso: fmtDate(t.data_messa_cassa || t.data_incasso),
    contoInc: t.conto_incasso || "",
    fil: t.filiale || "",
    tipoPortafoglio: t.tipo_portafoglio || "",
    zona: t.zona || "",
    indotto: t.indotto || "",
    settore: t.settore || "",
    contratto: t.contratto || "",
    fatturato: t.fatturato ?? "",
    dipendenti: t.num_dipendenti ?? "",
    incassato: Number(t.importo_incassato) || 0,
    percProvv: t.perc_provv ?? "",
    pagata: t.provv_pagata ? "Incassata" : "Non incassata",
  };
}
