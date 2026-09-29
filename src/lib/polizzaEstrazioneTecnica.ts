export const FORMA_COPERTURA = [
  "claims_made",
  "loss_occurrence",
  "primo_rischio_assoluto",
  "primo_rischio_relativo",
  "valore_intero",
  "valore_a_nuovo",
  "secondo_rischio",
  "altro",
] as const;
export type FormaCopertura = (typeof FORMA_COPERTURA)[number];

export const TIPO_BENE = [
  "fabbricato",
  "contenuto",
  "merci",
  "macchinari",
  "ricorso_terzi",
  "fermo",
  "altro",
] as const;
export type TipoBene = (typeof TIPO_BENE)[number];

export const FORMA_ASSICURAZIONE = [
  "valore_intero",
  "primo_rischio_assoluto",
  "primo_rischio_relativo",
  "valore_a_nuovo",
  "altro",
] as const;
export type FormaAssicurazione = (typeof FORMA_ASSICURAZIONE)[number];

export const LIVELLO_ESCLUSIONE = ["generale", "garanzia", "partita"] as const;
export type LivelloEsclusione = (typeof LIVELLO_ESCLUSIONE)[number];

export const SOTTOLIMITE_PER = ["sinistro", "anno", "ubicazione", "persona"] as const;
export type SottolimitePer = (typeof SOTTOLIMITE_PER)[number];

export const BASE_CALCOLO = ["somma_partita", "massimale", "danno", "altro"] as const;
export type BaseCalcolo = (typeof BASE_CALCOLO)[number];

export const TASSO_UNITA = ["per_mille", "percento"] as const;
export type TassoUnita = (typeof TASSO_UNITA)[number];

export const TIPO_RATA_CALCOLO = ["annuo", "sottoscrizione", "successiva"] as const;
export type TipoRataCalcolo = (typeof TIPO_RATA_CALCOLO)[number];

export const FORMA_COPERTURA_LABEL: Record<FormaCopertura, string> = {
  claims_made: "Claims made",
  loss_occurrence: "Loss occurrence",
  primo_rischio_assoluto: "Primo rischio assoluto",
  primo_rischio_relativo: "Primo rischio relativo",
  valore_intero: "Valore intero",
  valore_a_nuovo: "Valore a nuovo",
  secondo_rischio: "Secondo rischio",
  altro: "Altro",
};

export const TIPO_BENE_LABEL: Record<TipoBene, string> = {
  fabbricato: "Fabbricato",
  contenuto: "Contenuto",
  merci: "Merci",
  macchinari: "Macchinari",
  ricorso_terzi: "Ricorso terzi",
  fermo: "Fermo",
  altro: "Altro",
};

export type EstrazionePartitaIn = {
  numero?: number;
  codice?: string;
  descrizione?: string;
  tipo_bene?: string;
  ubicazione?: string;
  somma_assicurata?: number;
  valuta?: string;
  forma_assicurazione?: string;
  percentuale_scoperto?: number;
  franchigia?: number;
  fonte_testo?: string;
};

export type EstrazioneBeneEsclusoIn = {
  partita_numero?: number;
  descrizione?: string;
  motivo?: string;
  fonte_testo?: string;
};

export type EstrazioneEsclusioneIn = {
  livello?: string;
  partita_numero?: number;
  garanzia?: string;
  articolo?: string;
  titolo?: string;
  testo?: string;
  rilevante_sinistri?: boolean;
  fonte_testo?: string;
};

export type EstrazioneSottolimiteIn = {
  partita_numero?: number;
  garanzia?: string;
  voce?: string;
  importo?: number;
  percentuale?: number;
  base_calcolo?: string;
  per?: string;
  franchigia?: number;
  scoperto_pct?: number;
  minimo?: number;
  massimo?: number;
  fonte_testo?: string;
};

export type EstrazionePremioCalcoloIn = {
  partita_numero?: number;
  garanzia?: string;
  base_imponibile?: number;
  tasso?: number;
  tasso_unita?: string;
  premio_imponibile?: number;
  aliquota_imposte_pct?: number;
  imposte?: number;
  ssn?: number;
  premio_lordo?: number;
  tipo_rata?: string;
  regolazione?: boolean;
  parametro_regolazione?: string;
  premio_minimo?: number;
  formula_fonte?: string;
};

export type EstrazioneTecnicaExtracted = {
  prodotto?: { forma_copertura?: string };
  dati_personali?: {
    forma_copertura?: string;
    forma_copertura_note?: string;
  };
  partite?: EstrazionePartitaIn[];
  beni_esclusi?: EstrazioneBeneEsclusoIn[];
  esclusioni_polizza?: EstrazioneEsclusioneIn[];
  sottolimiti?: EstrazioneSottolimiteIn[];
  premio_calcolo?: EstrazionePremioCalcoloIn[];
};

export type PartitaDraft = {
  numero: number;
  codice: string | null;
  descrizione: string;
  tipo_bene: TipoBene;
  ubicazione: string | null;
  somma_assicurata: number | null;
  valuta: string;
  forma_assicurazione: FormaAssicurazione | null;
  percentuale_scoperto: number | null;
  franchigia: number | null;
  ordine: number;
  fonte_testo: string | null;
};

function inSet<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

function inSetOrNull<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  if (value && (allowed as readonly string[]).includes(value)) return value as T;
  return null;
}

export function normalizeFormaCopertura(raw?: string | null): FormaCopertura | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "primo_rischio") return "primo_rischio_assoluto";
  if ((FORMA_COPERTURA as readonly string[]).includes(v)) return v as FormaCopertura;
  return "altro";
}

export function buildEstrazioneTecnicaDrafts(extracted: EstrazioneTecnicaExtracted) {
  const forma_copertura = normalizeFormaCopertura(
    extracted.dati_personali?.forma_copertura || extracted.prodotto?.forma_copertura,
  );
  const forma_copertura_note = extracted.dati_personali?.forma_copertura_note?.trim() || null;

  const partite: PartitaDraft[] = (extracted.partite || [])
    .filter((p) => (p.descrizione || "").trim() || p.somma_assicurata != null)
    .map((p, i) => ({
      numero: Number.isFinite(p.numero) ? Number(p.numero) : i + 1,
      codice: p.codice?.trim() || null,
      descrizione: (p.descrizione || `Partita ${i + 1}`).trim(),
      tipo_bene: inSet(p.tipo_bene, TIPO_BENE, "altro"),
      ubicazione: p.ubicazione?.trim() || null,
      somma_assicurata: p.somma_assicurata ?? null,
      valuta: p.valuta?.trim() || "EUR",
      forma_assicurazione: inSetOrNull(p.forma_assicurazione, FORMA_ASSICURAZIONE),
      percentuale_scoperto: p.percentuale_scoperto ?? null,
      franchigia: p.franchigia ?? null,
      ordine: i,
      fonte_testo: p.fonte_testo?.trim() || null,
    }));

  const beni_esclusi = (extracted.beni_esclusi || [])
    .filter((b) => (b.descrizione || "").trim())
    .map((b, i) => ({
      partita_numero: Number.isFinite(b.partita_numero) ? Number(b.partita_numero) : null,
      descrizione: b.descrizione!.trim(),
      motivo: b.motivo?.trim() || null,
      fonte_testo: b.fonte_testo?.trim() || null,
      ordine: i,
    }));

  const esclusioni = (extracted.esclusioni_polizza || [])
    .filter((e) => (e.testo || "").trim())
    .map((e, i) => ({
      livello: inSet(e.livello, LIVELLO_ESCLUSIONE, "generale"),
      partita_numero: Number.isFinite(e.partita_numero) ? Number(e.partita_numero) : null,
      garanzia: e.garanzia?.trim() || null,
      articolo: e.articolo?.trim() || null,
      titolo: e.titolo?.trim() || null,
      testo: e.testo!.trim(),
      rilevante_sinistri: e.rilevante_sinistri ?? true,
      fonte_testo: e.fonte_testo?.trim() || null,
      ordine: i,
    }));

  const sottolimiti = (extracted.sottolimiti || [])
    .filter((s) => (s.voce || "").trim())
    .map((s, i) => ({
      partita_numero: Number.isFinite(s.partita_numero) ? Number(s.partita_numero) : null,
      garanzia: s.garanzia?.trim() || null,
      voce: s.voce!.trim(),
      importo: s.importo ?? null,
      percentuale: s.percentuale ?? null,
      base_calcolo: inSetOrNull(s.base_calcolo, BASE_CALCOLO),
      per: inSetOrNull(s.per, SOTTOLIMITE_PER),
      franchigia: s.franchigia ?? null,
      scoperto_pct: s.scoperto_pct ?? null,
      minimo: s.minimo ?? null,
      massimo: s.massimo ?? null,
      fonte_testo: s.fonte_testo?.trim() || null,
      ordine: i,
    }));

  const premio_calcolo = (extracted.premio_calcolo || [])
    .filter((r) =>
      r.premio_lordo != null
      || r.premio_imponibile != null
      || r.tasso != null
      || (r.garanzia || "").trim()
      || (r.formula_fonte || "").trim(),
    )
    .map((r, i) => ({
      partita_numero: Number.isFinite(r.partita_numero) ? Number(r.partita_numero) : null,
      garanzia: r.garanzia?.trim() || null,
      base_imponibile: r.base_imponibile ?? null,
      tasso: r.tasso ?? null,
      tasso_unita: inSet(r.tasso_unita, TASSO_UNITA, "per_mille"),
      premio_imponibile: r.premio_imponibile ?? null,
      aliquota_imposte_pct: r.aliquota_imposte_pct ?? null,
      imposte: r.imposte ?? null,
      ssn: r.ssn ?? null,
      premio_lordo: r.premio_lordo ?? null,
      tipo_rata: inSet(r.tipo_rata, TIPO_RATA_CALCOLO, "annuo"),
      regolazione: !!r.regolazione,
      parametro_regolazione: r.parametro_regolazione?.trim() || null,
      premio_minimo: r.premio_minimo ?? null,
      formula_fonte: r.formula_fonte?.trim() || null,
      ordine: i,
    }));

  return { forma_copertura, forma_copertura_note, partite, beni_esclusi, esclusioni, sottolimiti, premio_calcolo };
}

export function resolvePartitaId(
  partitaNumero: number | null,
  saved: { id: string; numero: number }[],
): string | null {
  if (partitaNumero == null) return null;
  return saved.find((p) => p.numero === partitaNumero)?.id ?? null;
}

type SbError = { message: string };
type SbResult<T = unknown> = { data: T; error: SbError | null };

export type EstrazioneTecnicaClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => PromiseLike<SbResult> };
    delete: () => { eq: (col: string, val: string) => PromiseLike<SbResult> };
    insert: (values: unknown) => PromiseLike<SbResult> & {
      select: (cols: string) => PromiseLike<SbResult<{ id: string; numero: number }[]>>;
    };
  };
};

async function throwIf(error: SbError | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export async function persistEstrazioneTecnica(
  client: EstrazioneTecnicaClient,
  polizzaCgaId: string,
  extracted: EstrazioneTecnicaExtracted,
  options?: { replace?: boolean },
) {
  const drafts = buildEstrazioneTecnicaDrafts(extracted);

  const headerPatch: Record<string, unknown> = {};
  if (drafts.forma_copertura) headerPatch.forma_copertura = drafts.forma_copertura;
  if (drafts.forma_copertura_note) headerPatch.forma_copertura_note = drafts.forma_copertura_note;
  if (Object.keys(headerPatch).length) {
    const upd = await client.from("polizza_cga").update(headerPatch).eq("id", polizzaCgaId);
    await throwIf(upd.error, "Aggiornamento forma copertura");
  }

  if (options?.replace) {
    for (const table of [
      "polizza_premio_calcolo",
      "polizza_sottolimiti",
      "polizza_esclusioni",
      "polizza_beni_esclusi",
      "polizza_partite",
    ]) {
      const del = await client.from(table).delete().eq("polizza_cga_id", polizzaCgaId);
      await throwIf(del.error, `Pulizia ${table}`);
    }
  }

  let savedPartite: { id: string; numero: number }[] = [];
  if (drafts.partite.length) {
    const ins = await client.from("polizza_partite").insert(
      drafts.partite.map((p) => ({
        polizza_cga_id: polizzaCgaId,
        numero: p.numero,
        codice: p.codice,
        descrizione: p.descrizione,
        tipo_bene: p.tipo_bene,
        ubicazione: p.ubicazione,
        somma_assicurata: p.somma_assicurata,
        valuta: p.valuta,
        forma_assicurazione: p.forma_assicurazione,
        percentuale_scoperto: p.percentuale_scoperto,
        franchigia: p.franchigia,
        ordine: p.ordine,
        fonte_testo: p.fonte_testo,
      })),
    ).select("id, numero");
    await throwIf(ins.error, "Salvataggio partite");
    savedPartite = ins.data ?? [];
  }

  if (drafts.beni_esclusi.length) {
    const ins = await client.from("polizza_beni_esclusi").insert(
      drafts.beni_esclusi.map((b) => ({
        polizza_cga_id: polizzaCgaId,
        partita_id: resolvePartitaId(b.partita_numero, savedPartite),
        descrizione: b.descrizione,
        motivo: b.motivo,
        fonte_testo: b.fonte_testo,
        ordine: b.ordine,
      })),
    );
    await throwIf(ins.error, "Salvataggio beni esclusi");
  }

  if (drafts.esclusioni.length) {
    const ins = await client.from("polizza_esclusioni").insert(
      drafts.esclusioni.map((e) => ({
        polizza_cga_id: polizzaCgaId,
        partita_id: resolvePartitaId(e.partita_numero, savedPartite),
        livello: e.livello,
        garanzia: e.garanzia,
        articolo: e.articolo,
        titolo: e.titolo,
        testo: e.testo,
        rilevante_sinistri: e.rilevante_sinistri,
        fonte_testo: e.fonte_testo,
        ordine: e.ordine,
      })),
    );
    await throwIf(ins.error, "Salvataggio esclusioni");
  }

  if (drafts.sottolimiti.length) {
    const ins = await client.from("polizza_sottolimiti").insert(
      drafts.sottolimiti.map((s) => ({
        polizza_cga_id: polizzaCgaId,
        partita_id: resolvePartitaId(s.partita_numero, savedPartite),
        garanzia: s.garanzia,
        voce: s.voce,
        importo: s.importo,
        percentuale: s.percentuale,
        base_calcolo: s.base_calcolo,
        per: s.per,
        franchigia: s.franchigia,
        scoperto_pct: s.scoperto_pct,
        minimo: s.minimo,
        massimo: s.massimo,
        fonte_testo: s.fonte_testo,
        ordine: s.ordine,
      })),
    );
    await throwIf(ins.error, "Salvataggio sottolimiti");
  }

  if (drafts.premio_calcolo.length) {
    const ins = await client.from("polizza_premio_calcolo").insert(
      drafts.premio_calcolo.map((r) => ({
        polizza_cga_id: polizzaCgaId,
        partita_id: resolvePartitaId(r.partita_numero, savedPartite),
        garanzia: r.garanzia,
        base_imponibile: r.base_imponibile,
        tasso: r.tasso,
        tasso_unita: r.tasso_unita,
        premio_imponibile: r.premio_imponibile,
        aliquota_imposte_pct: r.aliquota_imposte_pct,
        imposte: r.imposte,
        ssn: r.ssn,
        premio_lordo: r.premio_lordo,
        tipo_rata: r.tipo_rata,
        regolazione: r.regolazione,
        parametro_regolazione: r.parametro_regolazione,
        premio_minimo: r.premio_minimo,
        formula_fonte: r.formula_fonte,
        ordine: r.ordine,
      })),
    );
    await throwIf(ins.error, "Salvataggio calcolo premio");
  }

  return drafts;
}
