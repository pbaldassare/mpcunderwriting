import { format } from "date-fns";
import { PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";
import { quietanzaSogliaGaranziaDa } from "@/lib/quietanzeClienteView";

export type Periodo = "mese_corrente" | "tutte";
export type VistaIncasso = "pendenti" | "incassati";

export const todayStr = () => format(new Date(), "yyyy-MM-dd");
export const startOfMonthStr = () =>
  format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
export const endOfMonthStr = () =>
  format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd");

/** Quietanze e appendici in un'unica lista. */
export const isAppendiceExpr = "is_appendice_modifica.eq.true,is_regolazione.eq.true,is_proroga.eq.true";

export const CARICO_SELECT_FIELDS =
  "id, quietanza_id, polizza_id, numero_titolo, titolo_derivato_numero, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, produttori_display, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, ufficio_id, data_messa_cassa, data_copertura, data_pagamento, data_decorrenza_rinnovo, conferimento_gestito, fondi_ricevuti, sostituisce_polizza, is_regolazione, is_proroga, is_appendice_modifica, appendice_tipo, regolazione_quietanza_id, proroga_polizza_madre_id, numero_rata, numero_rate_totali";

/** Da Incassi/Carico: priorità alla quietanza (non alla madre), come Portafoglio Attive. */
export const rowHref = (p: {
  quietanza_id?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  id?: string | null;
  polizza_id?: string | null;
}): string | null => {
  if (p?.quietanza_id) return `/quietanze/${p.quietanza_id}`;
  if (p?.is_appendice_modifica || p?.is_proroga || p?.is_regolazione) {
    if (p?.id) return `/titoli/${p.id}`;
  }
  if (p?.polizza_id) return `/polizze/${p.polizza_id}`;
  if (p?.id) return `/titoli/${p.id}`;
  return null;
};

export const applyDateRange = (q: any, col: string, dateDa: string, dateA: string) => {
  if (dateDa) q = q.gte(col, dateDa);
  if (dateA) q = q.lte(col, dateA);
  return q;
};

export const applySedeFilter = (q: any, filtroUffici: string[]) =>
  filtroUffici.length > 0 ? q.in("ufficio_id", filtroUffici) : q;

/**
 * Pendenti: attivo + (senza messa a cassa OR garantito aperto in attesa fondi/incasso).
 * Default/mese usano soglia 60gg. Con Dal/Al espliciti: solo range su garanzia_da.
 * Incassati: stato=incassato; Dal/Al e "mese corrente" su data_messa_cassa.
 */
export const applyPeriodoFilter = (
  q: any,
  opts: {
    isVistaIncassati: boolean;
    dateDa: string;
    dateA: string;
    filtroPeriodo: Periodo;
  },
) => {
  const { isVistaIncassati, dateDa, dateA, filtroPeriodo } = opts;

  if (isVistaIncassati) {
    q = q.eq("stato", "incassato");
    if (dateDa || dateA) return applyDateRange(q, "data_messa_cassa", dateDa, dateA);
    if (filtroPeriodo === "mese_corrente") {
      return q
        .gte("data_messa_cassa", startOfMonthStr())
        .lte("data_messa_cassa", endOfMonthStr());
    }
    return q;
  }

  q = q.eq("stato", "attivo").or(PENDENTI_OR_GARANTITO_APERTO_FILTER);

  // Range esplicito Dal/Al: solo garanzia_da (senza soglia 60gg né null)
  if (dateDa || dateA) {
    return applyDateRange(q, "garanzia_da", dateDa, dateA);
  }

  if (filtroPeriodo === "mese_corrente") {
    const today = todayStr();
    const start = startOfMonthStr();
    const end = endOfMonthStr();
    const meseOArretrato = `or(garanzia_da.lt.${today},and(garanzia_da.gte.${start},garanzia_da.lte.${end}))`;
    const soglia = quietanzaSogliaGaranziaDa();
    return q.or(
      `garanzia_da.is.null,and(garanzia_da.lte.${soglia},${meseOArretrato}),and(or(${isAppendiceExpr}),${meseOArretrato})`,
    );
  }

  const soglia = quietanzaSogliaGaranziaDa();
  return q.or(`garanzia_da.is.null,garanzia_da.lte.${soglia},${isAppendiceExpr}`);
};

export const applySearch = (q: any, search: string) =>
  search
    ? q.or(
        `numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`,
      )
    : q;
