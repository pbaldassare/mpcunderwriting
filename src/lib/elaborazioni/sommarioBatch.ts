import type { AnalisiCgaDettaglio } from "@/lib/portafoglioClienteAnalisi";
import type { SommarioPolizzaRow } from "@/lib/sommarioPolizze";
import type { ValoriCampi } from "@/lib/elaborazioni/render";

export const ELAB_TIPO_SINGOLA = "singola";
export const ELAB_TIPO_SOMMARIO = "sommario_portafoglio";

const STATI_VIGENTI = new Set(["attivo", "sospeso", "incassato"]);

export function isPolizzaVigente(stato?: string | null): boolean {
  return STATI_VIGENTI.has((stato || "").toLowerCase());
}

/** Preseleziona le polizze vigenti; se non ce ne sono, tutte. */
export function defaultSelectedTitoloIds(
  polizze: Array<{ id: string; stato?: string | null }>,
): string[] {
  const vigenti = polizze.filter((p) => isPolizzaVigente(p.stato));
  return (vigenti.length ? vigenti : polizze).map((p) => p.id);
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Integra i campi estratti dall'IA sulla riga sommario, senza sovrascrivere dati CBnet già presenti. */
export function applyElaborazioneCampiToSommario(
  p: SommarioPolizzaRow,
  campi: ValoriCampi | null | undefined,
): SommarioPolizzaRow {
  if (!campi || !Object.keys(campi).length) return p;
  const prodotto = asText(campi.prodotto);
  const compagnia = asText(campi.compagnia);
  const numero = asText(campi.numero_polizza);
  const fraz = asText(campi.frazionamento);
  const premio = asNumber(campi.premio_lordo);
  const oggetto = asText(campi.garanzie) || asText(campi.note);
  const scadenza = asText(campi.data_scadenza);
  return {
    ...p,
    numero_titolo: p.numero_titolo || numero,
    prodotto_nome: p.prodotto_nome || prodotto,
    compagnia_nome: p.compagnia_nome || compagnia,
    frazionamento: p.frazionamento || fraz,
    premio_lordo: p.premio_lordo != null ? p.premio_lordo : premio,
    data_scadenza: p.data_scadenza || scadenza,
    garanzia_a: p.garanzia_a || scadenza,
    descrizione_polizza: p.descrizione_polizza || oggetto,
    regolazione_note: p.regolazione_note || asText(campi.note),
  };
}

export function applyElaborazioneCampiToPolizze(
  polizze: SommarioPolizzaRow[],
  estrattiByTitolo: Record<string, ValoriCampi>,
): SommarioPolizzaRow[] {
  return polizze.map((p) => applyElaborazioneCampiToSommario(p, estrattiByTitolo[p.id]));
}

/** Costruisce un dettaglio CGA sintetico dai campi IA, per arricchire le schede del sommario. */
export function buildCgaFromElaborazioneCampi(
  p: SommarioPolizzaRow,
  campi: ValoriCampi | null | undefined,
): AnalisiCgaDettaglio | null {
  if (!campi) return null;
  const massimale = asNumber(campi.massimale);
  const franchigia = asNumber(campi.franchigia);
  const scoperto = asNumber(campi.scoperto);
  const garanzieTxt = asText(campi.garanzie);
  const esclusioni = asText(campi.esclusioni);
  const note = asText(campi.note);
  const sommario = asText(campi.garanzie) || note;
  if (massimale == null && franchigia == null && !garanzieTxt && !esclusioni && !sommario) return null;

  const garanzie = garanzieTxt
    ? garanzieTxt.split(/[;\n•]+/).map((g) => g.trim()).filter(Boolean).slice(0, 12).map((garanzia) => ({
        garanzia,
        massimale,
        franchigia,
        scoperto,
        note: null,
      }))
    : massimale != null || franchigia != null
      ? [{ garanzia: p.prodotto_nome || p.ramo_nome || "Garanzia", massimale, franchigia, scoperto, note: null }]
      : [];

  const condizioni = [
    esclusioni ? { tipo: "esclusione", titolo: "Esclusioni", testo: esclusioni } : null,
    note && note !== sommario ? { tipo: "nota", titolo: "Note", testo: note } : null,
  ].filter(Boolean) as AnalisiCgaDettaglio["condizioni"];

  return {
    polizza_cga_id: `elab-${p.id}`,
    titolo_id: p.id,
    numero_polizza: p.numero_titolo,
    prodotto_nome: asText(campi.prodotto) || p.prodotto_nome,
    compagnia: asText(campi.compagnia) || p.compagnia_nome,
    sommario,
    massimale_aggregato: massimale,
    garanzie,
    condizioni,
  };
}

export function mergeCgaDettagli(
  base: AnalisiCgaDettaglio[],
  extra: Array<AnalisiCgaDettaglio | null>,
): AnalisiCgaDettaglio[] {
  const byTitolo = new Set(base.map((c) => c.titolo_id).filter(Boolean));
  const out = [...base];
  for (const c of extra) {
    if (!c) continue;
    if (c.titolo_id && byTitolo.has(c.titolo_id)) continue;
    out.push(c);
  }
  return out;
}

export function preferDocumentoPerPolizza<T extends { id: string; categoria?: string | null; nome_file?: string | null }>(
  docs: T[],
): T | null {
  if (!docs.length) return null;
  const cga = docs.find((d) => {
    const cat = (d.categoria || "").toLowerCase();
    const nome = (d.nome_file || "").toLowerCase();
    return cat.includes("cga") || nome.includes("cga") || nome.includes("condiz");
  });
  return cga || docs[0];
}
