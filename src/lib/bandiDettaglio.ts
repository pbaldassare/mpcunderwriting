export const TIPI_AVVISO_BANDO = ["gara", "esito", "altro"] as const;
export type TipoAvvisoBando = (typeof TIPI_AVVISO_BANDO)[number];

export type BandoDettaglio = {
  tipo_avviso?: string | null;
  notice_type?: string | null;
  form_type?: string | null;
  aggiudicato?: boolean | null;
  aggiudicatario?: string | null;
  data_decisione?: string | null;
  data_contratto?: string | null;
  servizio_da?: string | null;
  servizio_a?: string | null;
  tipo_procedura?: string | null;
  data_pubblicazione?: string | null;
  scadenza?: string | null;
  cig?: string | null;
};

export function isTedPublicationNumber(value: string | null | undefined): boolean {
  return !!value && /^\d{4,}-\d{4}$/.test(value.trim());
}

export function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const it = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  return null;
}

/** Periodo mandato scritto nell'oggetto («dal 01.09.2024 al 31.08.2027»). */
export function parsePeriodoDaTitolo(titolo: string | null | undefined): {
  servizio_da: string | null;
  servizio_a: string | null;
} {
  if (!titolo) return { servizio_da: null, servizio_a: null };
  const m = titolo.match(
    /dal\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+al\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i,
  );
  if (!m) return { servizio_da: null, servizio_a: null };
  const pad = (v: string) => v.padStart(2, "0");
  return {
    servizio_da: `${m[3]}-${pad(m[2])}-${pad(m[1])}`,
    servizio_a: `${m[6]}-${pad(m[5])}-${pad(m[4])}`,
  };
}

export function labelTipoAvviso(tipo: string | null | undefined): string {
  if (tipo === "esito") return "Esito / aggiudicato";
  if (tipo === "gara") return "Gara";
  return "Avviso";
}

export function labelTipoProcedura(tipo: string | null | undefined): string | null {
  if (!tipo) return null;
  const map: Record<string, string> = {
    open: "Procedura aperta",
    restricted: "Procedura ristretta",
    negotiated: "Procedura negoziata",
    "competitive-dialogue": "Dialogo competitivo",
    "innovation-partnership": "Partenariato per l'innovazione",
  };
  return map[tipo] ?? tipo;
}

export function needsDettaglioHarvest(bando: BandoDettaglio & { titolo?: string | null }): boolean {
  if (bando.tipo_avviso) return false;
  if (bando.aggiudicatario || bando.servizio_da || bando.data_decisione) return false;
  return true;
}

export function mergeDettaglio(
  bando: BandoDettaglio & { titolo?: string | null },
  extra: Partial<BandoDettaglio>,
): BandoDettaglio {
  const fromTitle = parsePeriodoDaTitolo(bando.titolo);
  return {
    tipo_avviso: extra.tipo_avviso ?? bando.tipo_avviso ?? null,
    notice_type: extra.notice_type ?? bando.notice_type ?? null,
    form_type: extra.form_type ?? bando.form_type ?? null,
    aggiudicato: extra.aggiudicato ?? bando.aggiudicato ?? false,
    aggiudicatario: extra.aggiudicatario ?? bando.aggiudicatario ?? null,
    data_decisione: toIsoDate(extra.data_decisione) ?? toIsoDate(bando.data_decisione),
    data_contratto: toIsoDate(extra.data_contratto) ?? toIsoDate(bando.data_contratto),
    servizio_da: toIsoDate(extra.servizio_da) ?? toIsoDate(bando.servizio_da) ?? fromTitle.servizio_da,
    servizio_a: toIsoDate(extra.servizio_a) ?? toIsoDate(bando.servizio_a) ?? fromTitle.servizio_a,
    tipo_procedura: extra.tipo_procedura ?? bando.tipo_procedura ?? null,
    data_pubblicazione: toIsoDate(extra.data_pubblicazione) ?? toIsoDate(bando.data_pubblicazione),
    scadenza: toIsoDate(extra.scadenza) ?? toIsoDate(bando.scadenza),
    cig: extra.cig ?? bando.cig ?? null,
  };
}

export function dettaglioUpdatePayload(d: BandoDettaglio): Record<string, unknown> {
  return {
    tipo_avviso: d.tipo_avviso ?? null,
    notice_type: d.notice_type ?? null,
    form_type: d.form_type ?? null,
    aggiudicato: !!d.aggiudicato,
    aggiudicatario: d.aggiudicatario ?? null,
    data_decisione: d.data_decisione ?? null,
    data_contratto: d.data_contratto ?? null,
    servizio_da: d.servizio_da ?? null,
    servizio_a: d.servizio_a ?? null,
    tipo_procedura: d.tipo_procedura ?? null,
    data_pubblicazione: d.data_pubblicazione ?? null,
    ...(d.scadenza ? { scadenza: d.scadenza } : {}),
    ...(d.cig ? { cig: d.cig } : {}),
    ...(d.aggiudicato ? { stato: "scaduto" } : {}),
  };
}
