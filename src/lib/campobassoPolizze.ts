/**
 * Mapping polizze gestionale sede Campobasso → titoli CBnet.
 *
 * Decisioni chiuse con il broker (2026-09-25):
 * - CAT110 (Armanetti, nome sporco) → CAT101 (DL Assiservice / Armanetti).
 * - Compagnia senza codice CBnet: non si importa, non si crea anagrafica.
 * - Ogni polizza ha un frontespizio non cassabile; la quietanza porta Dt Incasso.
 * - PI senza PQ: si clona una quietanza dagli stessi dati.
 * - PI+PQ: madre dal PI, quietanze solo dalle PQ (niente rate inventate).
 * - AM / PR / DP / PS: riga appendice (`is_appendice_modifica`, numero `/AM n`).
 * - 014414 / 016841 / 008325 e i 432 orfani già in sede: non in questo carico.
 * - Su `titoli`: `cliente_anagrafica_id` = clienti.id; `cliente_id` resta NULL
 *   (FK verso profiles, non verso clienti).
 */

import { derivaFrazionamentoDaRate, frazionamentoToRate } from "@/lib/frazionamento";

export const CAMPOBASSO_UFFICIO_ID = "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c";
export const CAMPOBASSO_UFFICIO_CODICE = "CB";

export const CAMPOBASSO_SKIP_CLIENTI = new Set(["014414", "016841", "008325"]);

export const CAMPOBASSO_COMPAGNIA_ALIAS: Record<string, string> = {
  CAT110: "CAT101",
};

export const CAMPOBASSO_ALLOWED_COMPAGNIE = new Set([
  "CAT101",
  "REA121",
  "REAGRO",
  "BENE00",
  "DAS001",
  "IPAL00",
  "SAR106",
  "LIB001",
  "CHA001",
  "GENMIL",
  "CHU000",
]);

export const CAMPOBASSO_APPENDICE_TIPI = new Set(["AM", "PR", "DP", "PS"]);

export type CampobassoPolizzaRiga = {
  ID?: string | number | null;
  CdClie?: string | number | null;
  "Nome CLiente"?: string | null;
  CdComp?: string | null;
  "Nome Compagnia"?: string | null;
  "%Riparto"?: string | number | null;
  CdRamo?: string | null;
  Ramo?: string | null;
  Polizza?: string | number | null;
  Appendice?: string | null;
  Descrizione?: string | null;
  "Rif/Cig"?: string | null;
  Comp_Contabile?: unknown;
  Comp_Assicurativa?: unknown;
  "Iniz Pol"?: unknown;
  "Scad Pol"?: unknown;
  "Iniz Gar"?: unknown;
  "Scad Gar"?: unknown;
  TipoDoc?: string | null;
  Valuta?: string | null;
  Cambio?: string | number | null;
  Premio?: string | number | null;
  Imponibile?: string | number | null;
  Tasse?: string | number | null;
  Attive?: string | number | null;
  "Nome Specialist"?: string | null;
  "Nome A/E"?: string | null;
  "Nome Produttore"?: string | null;
  "Dt Copertura"?: unknown;
  "Dt Incasso"?: unknown;
  TipoInc?: string | null;
  ContoInc?: string | null;
  "Mesi Disd"?: string | number | null;
  Rate?: string | number | null;
  Rinnovo?: string | null;
  "Tipo Portafoglio"?: string | null;
};

export type CampobassoCatalogs = {
  clientiByCodice: Record<string, string>;
  ramiByCodice: Record<string, { id: string; descrizione: string }>;
  compagnieByCodice: Record<string, string>;
  existingMadri: Array<{ numero: string; compagniaId: string }>;
};

export type CampobassoTitoloTipo = "polizza" | "quietanza" | "appendice";

export type CampobassoTitoloPianificato = {
  tipo: CampobassoTitoloTipo;
  esito: "da_creare" | "saltata";
  motivo: string;
  chiave: string;
  fileId: string | null;
  fileTipoDoc: string;
  numeroTitolo: string;
  riga: number;
  stato: "attivo" | "incassato";
  clienteId: string | null;
  compagniaId: string | null;
  compagniaCodice: string | null;
  ramoId: string | null;
  prodottoNome: string | null;
  garanziaDa: string | null;
  garanziaA: string | null;
  durataDa: string | null;
  durataA: string | null;
  dataScadenza: string | null;
  dataCompetenza: string | null;
  dataMessaCassa: string | null;
  dataIncasso: string | null;
  importoIncassato: number | null;
  premioNetto: number;
  premioLordo: number;
  tasse: number;
  provvigioni: number;
  frazionamento: string;
  rate: number;
  anniDurata: number;
  percentualeRiparto: number;
  tacitoRinnovo: boolean;
  emittenda: boolean;
  sostituiscePolizza: string | null;
  sostituisceRiga: number | null;
  isAppendiceModifica: boolean;
  appendice: string | null;
  cigRif: string | null;
  descrizione: string | null;
  note: string | null;
  specialist: string | null;
  aeNome: string | null;
  produttoreNome: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  valuta: string;
  cambio: number;
  compContabile: string | null;
  compAssicurativa: string | null;
};

export type CampobassoGruppoPianificato = {
  chiave: string;
  esito: "da_creare" | "saltato";
  motivo: string;
  numero: string;
  compagniaCodice: string | null;
  madre: CampobassoTitoloPianificato | null;
  quietanze: CampobassoTitoloPianificato[];
  appendici: CampobassoTitoloPianificato[];
};

export function trimTxt(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

export function padClienteCodice(raw: unknown): string {
  const digits = trimTxt(raw).replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(6, "0");
}

export function normalizeNumeroPolizza(raw: unknown): string {
  return trimTxt(raw);
}

export function money(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  const s = trimTxt(value).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function excelSerialToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = trimTxt(value);
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const parts = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!parts) return null;
  const a = Number(parts[1]);
  const b = Number(parts[2]);
  let y = Number(parts[3]);
  if (y < 100) y += 2000;
  let month: number;
  let day: number;
  if (a > 12 && b <= 12) {
    day = a;
    month = b;
  } else {
    month = a;
    day = b;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function mapCompagniaCodice(cdComp: unknown): string | null {
  const raw = trimTxt(cdComp).toUpperCase();
  if (!raw) return null;
  const mapped = CAMPOBASSO_COMPAGNIA_ALIAS[raw] ?? raw;
  return CAMPOBASSO_ALLOWED_COMPAGNIE.has(mapped) ? mapped : null;
}

export function mapRateToFrazionamento(rate: unknown): string {
  const n = Number(rate);
  if (n === 0) return "Rata unica";
  return derivaFrazionamentoDaRate(Number.isFinite(n) && n > 0 ? n : 1, 1);
}

export function mapValuta(raw: unknown): string {
  const v = trimTxt(raw).toUpperCase();
  if (!v || v === "EURO" || v === "EUR") return "EUR";
  return "EUR";
}

export function isAppendiceTipo(tipoDoc: unknown): boolean {
  return CAMPOBASSO_APPENDICE_TIPI.has(trimTxt(tipoDoc).toUpperCase());
}

export function isEmittenda(numero: string): boolean {
  return /emitt/i.test(numero);
}

function yearsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 1;
  const days = (b.getTime() - a.getTime()) / 86400000;
  return Math.max(1, Math.round(days / 365));
}

function noteParts(parts: Array<string | null | undefined>): string | null {
  const rows = parts.map((p) => trimTxt(p)).filter(Boolean);
  return rows.length ? rows.join("\n") : null;
}

type ParsedRow = {
  raw: CampobassoPolizzaRiga;
  fileId: string | null;
  tipoDoc: string;
  numero: string;
  codiceCliente: string;
  clienteId: string | null;
  cdCompRaw: string;
  compagniaCodice: string | null;
  compagniaId: string | null;
  ramoCodice: string;
  ramoId: string | null;
  prodottoNome: string | null;
  inizPol: string | null;
  scadPol: string | null;
  inizGar: string | null;
  scadGar: string | null;
  dtIncasso: string | null;
  premio: number;
  imponibile: number;
  tasse: number;
  attive: number;
  rate: number;
  frazionamento: string;
  tacito: boolean;
  riparto: number;
  descrizione: string | null;
  cig: string | null;
  appendice: string | null;
  specialist: string | null;
  aeNome: string | null;
  produttoreNome: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  valuta: string;
  cambio: number;
  mesiDisd: string;
  compContabile: string | null;
  compAssicurativa: string | null;
};

function parseRow(riga: CampobassoPolizzaRiga, catalogs: CampobassoCatalogs): ParsedRow {
  const tipoDoc = trimTxt(riga.TipoDoc).toUpperCase();
  const codiceCliente = padClienteCodice(riga.CdClie);
  const cdCompRaw = trimTxt(riga.CdComp).toUpperCase();
  const compagniaCodice = mapCompagniaCodice(cdCompRaw);
  const ramoCodice = trimTxt(riga.CdRamo).toUpperCase();
  const ramo = ramoCodice ? catalogs.ramiByCodice[ramoCodice] : undefined;
  const rateN = Number(riga.Rate);
  return {
    raw: riga,
    fileId: trimTxt(riga.ID) || null,
    tipoDoc,
    numero: normalizeNumeroPolizza(riga.Polizza),
    codiceCliente,
    clienteId: codiceCliente ? catalogs.clientiByCodice[codiceCliente] ?? null : null,
    cdCompRaw,
    compagniaCodice,
    compagniaId: compagniaCodice ? catalogs.compagnieByCodice[compagniaCodice] ?? null : null,
    ramoCodice,
    ramoId: ramo?.id ?? null,
    prodottoNome: trimTxt(riga.Ramo) || ramo?.descrizione || null,
    inizPol: excelSerialToIso(riga["Iniz Pol"]),
    scadPol: excelSerialToIso(riga["Scad Pol"]),
    inizGar: excelSerialToIso(riga["Iniz Gar"]),
    scadGar: excelSerialToIso(riga["Scad Gar"]),
    dtIncasso: excelSerialToIso(riga["Dt Incasso"]),
    premio: money(riga.Premio),
    imponibile: money(riga.Imponibile),
    tasse: money(riga.Tasse),
    attive: money(riga.Attive),
    rate: Number.isFinite(rateN) ? rateN : 1,
    frazionamento: mapRateToFrazionamento(riga.Rate),
    tacito: trimTxt(riga.Rinnovo).toUpperCase() === "R",
    riparto: money(riga["%Riparto"]) || 100,
    descrizione: trimTxt(riga.Descrizione) || null,
    cig: trimTxt(riga["Rif/Cig"]) || null,
    appendice: trimTxt(riga.Appendice) || null,
    specialist: trimTxt(riga["Nome Specialist"]) || null,
    aeNome: trimTxt(riga["Nome A/E"]) || null,
    produttoreNome: trimTxt(riga["Nome Produttore"]) || null,
    tipoIncasso: trimTxt(riga.TipoInc) || null,
    contoIncasso: trimTxt(riga.ContoInc) || null,
    tipoPortafoglio: trimTxt(riga["Tipo Portafoglio"]) || null,
    valuta: mapValuta(riga.Valuta),
    cambio: money(riga.Cambio) || 1,
    mesiDisd: trimTxt(riga["Mesi Disd"]),
    compContabile: excelSerialToIso(riga.Comp_Contabile),
    compAssicurativa: excelSerialToIso(riga.Comp_Assicurativa),
  };
}

function emptyTitolo(partial: Partial<CampobassoTitoloPianificato> & Pick<CampobassoTitoloPianificato, "tipo" | "chiave" | "numeroTitolo">): CampobassoTitoloPianificato {
  return {
    esito: "da_creare",
    motivo: "",
    fileId: null,
    fileTipoDoc: "",
    riga: 0,
    stato: "attivo",
    clienteId: null,
    compagniaId: null,
    compagniaCodice: null,
    ramoId: null,
    prodottoNome: null,
    garanziaDa: null,
    garanziaA: null,
    durataDa: null,
    durataA: null,
    dataScadenza: null,
    dataCompetenza: null,
    dataMessaCassa: null,
    dataIncasso: null,
    importoIncassato: null,
    premioNetto: 0,
    premioLordo: 0,
    tasse: 0,
    provvigioni: 0,
    frazionamento: "Annuale",
    rate: 1,
    anniDurata: 1,
    percentualeRiparto: 100,
    tacitoRinnovo: false,
    emittenda: false,
    sostituiscePolizza: null,
    sostituisceRiga: null,
    isAppendiceModifica: false,
    appendice: null,
    cigRif: null,
    descrizione: null,
    note: null,
    specialist: null,
    aeNome: null,
    produttoreNome: null,
    tipoIncasso: null,
    contoIncasso: null,
    tipoPortafoglio: null,
    valuta: "EUR",
    cambio: 1,
    compContabile: null,
    compAssicurativa: null,
    ...partial,
  };
}

function fillFromParsed(
  tipo: CampobassoTitoloTipo,
  parsed: ParsedRow,
  opts: {
    chiave: string;
    numeroTitolo: string;
    riga: number;
    motivo: string;
    cassa: boolean;
    sostituiscePolizza?: string | null;
    isAppendice?: boolean;
  },
): CampobassoTitoloPianificato {
  const polDa = parsed.inizPol || parsed.inizGar;
  const polA = parsed.scadPol || parsed.scadGar;
  const garDa = parsed.inizGar || parsed.inizPol;
  const garA = parsed.scadGar || parsed.scadPol;
  const usePolDates = tipo === "polizza";
  const da = usePolDates ? polDa : garDa;
  const a = usePolDates ? polA : garA;
  const frazionamento = parsed.frazionamento;
  const rate = frazionamentoToRate(frazionamento, 1);
  const hasCassa = opts.cassa && !!parsed.dtIncasso;
  return emptyTitolo({
    tipo,
    esito: "da_creare",
    motivo: opts.motivo,
    chiave: opts.chiave,
    fileId: parsed.fileId,
    fileTipoDoc: parsed.tipoDoc,
    numeroTitolo: opts.numeroTitolo,
    riga: opts.riga,
    stato: hasCassa ? "incassato" : "attivo",
    clienteId: parsed.clienteId,
    compagniaId: parsed.compagniaId,
    compagniaCodice: parsed.compagniaCodice,
    ramoId: parsed.ramoId,
    prodottoNome: parsed.prodottoNome,
    garanziaDa: da,
    garanziaA: a,
    durataDa: usePolDates ? polDa : da,
    durataA: usePolDates ? polA : a,
    dataScadenza: usePolDates ? polA : a,
    dataCompetenza: da,
    dataMessaCassa: hasCassa ? parsed.dtIncasso : null,
    dataIncasso: hasCassa ? parsed.dtIncasso : null,
    importoIncassato: hasCassa ? parsed.premio : null,
    premioNetto: parsed.imponibile,
    premioLordo: parsed.premio,
    tasse: parsed.tasse,
    provvigioni: parsed.attive,
    frazionamento,
    rate,
    anniDurata: yearsBetween(polDa, polA),
    percentualeRiparto: parsed.riparto,
    tacitoRinnovo: parsed.tacito,
    emittenda: isEmittenda(opts.numeroTitolo),
    sostituiscePolizza: opts.sostituiscePolizza ?? null,
    sostituisceRiga: opts.sostituiscePolizza ? 0 : null,
    isAppendiceModifica: !!opts.isAppendice,
    appendice: parsed.appendice || (opts.isAppendice ? parsed.tipoDoc : null),
    cigRif: parsed.cig,
    descrizione: parsed.descrizione,
    note: noteParts([
      parsed.tipoDoc && opts.isAppendice ? `TipoDoc gestionale: ${parsed.tipoDoc}` : null,
      parsed.mesiDisd && parsed.mesiDisd !== "0" ? `Mesi disdetta gestionale: ${parsed.mesiDisd}` : null,
      parsed.cdCompRaw === "CAT110" ? "CdComp file CAT110 agganciata a CAT101" : null,
    ]),
    specialist: parsed.specialist,
    aeNome: parsed.aeNome,
    produttoreNome: parsed.produttoreNome,
    tipoIncasso: hasCassa ? parsed.tipoIncasso : null,
    contoIncasso: hasCassa ? parsed.contoIncasso : null,
    tipoPortafoglio: parsed.tipoPortafoglio,
    valuta: parsed.valuta,
    cambio: parsed.cambio,
    compContabile: parsed.compContabile,
    compAssicurativa: parsed.compAssicurativa,
  });
}

function skipGroup(chiave: string, motivo: string, parsed: ParsedRow[]): CampobassoGruppoPianificato {
  const first = parsed[0];
  return {
    chiave,
    esito: "saltato",
    motivo,
    numero: first?.numero ?? "",
    compagniaCodice: first?.compagniaCodice ?? null,
    madre: null,
    quietanze: [],
    appendici: [],
  };
}

export function resolveCampobassoGruppo(
  rows: CampobassoPolizzaRiga[],
  catalogs: CampobassoCatalogs,
  seq = 1,
): CampobassoGruppoPianificato {
  const parsed = rows.map((r) => parseRow(r, catalogs));
  const first = parsed[0];
  const chiave = `cb:${first?.numero || seq}:${first?.compagniaCodice || first?.cdCompRaw || "?"}`;
  if (!first) return skipGroup(`cb:${seq}`, "Gruppo vuoto", parsed);
  if (!first.numero) return skipGroup(chiave, "Numero polizza vuoto", parsed);

  const compagniaCodice = first.compagniaCodice;
  if (!compagniaCodice || !first.compagniaId) {
    return skipGroup(chiave, `Compagnia non in anagrafica (${first.cdCompRaw || "vuota"})`, parsed);
  }

  const clienti = [...new Set(parsed.map((p) => p.codiceCliente).filter(Boolean))];
  if (clienti.some((c) => CAMPOBASSO_SKIP_CLIENTI.has(c))) {
    return skipGroup(chiave, `Cliente in attesa (${clienti.filter((c) => CAMPOBASSO_SKIP_CLIENTI.has(c)).join(",")})`, parsed);
  }
  const clienteId = parsed.find((p) => p.clienteId)?.clienteId ?? null;
  if (!clienteId) {
    return skipGroup(chiave, `Cliente non in anagrafica (${clienti.join(",") || "vuoto"})`, parsed);
  }

  const existing = catalogs.existingMadri.some(
    (m) =>
      normalizeNumeroPolizza(m.numero) === first.numero &&
      m.compagniaId === first.compagniaId,
  );
  if (existing) {
    return skipGroup(chiave, "Già presente in sede (orfana, non toccare)", parsed);
  }

  const pi = parsed.filter((p) => p.tipoDoc === "PI");
  const pq = parsed.filter((p) => p.tipoDoc === "PQ");
  const apps = parsed.filter((p) => isAppendiceTipo(p.tipoDoc));
  const source = pi[0] || pq[0] || apps[0] || first;
  if (!source.ramoId) {
    return skipGroup(chiave, `Ramo non mappato (${source.ramoCodice || "vuoto"})`, parsed);
  }
  const hasDates = !!(source.inizPol || source.inizGar) && !!(source.scadPol || source.scadGar);
  if (!hasDates) return skipGroup(chiave, "Date effetto/scadenza mancanti", parsed);

  const madre = fillFromParsed("polizza", source, {
    chiave: `${chiave}:madre`,
    numeroTitolo: first.numero,
    riga: 0,
    motivo: pi.length ? "Frontespizio da PI" : pq.length ? "Frontespizio da PQ" : "Frontespizio da appendice",
    cassa: false,
  });
  madre.clienteId = clienteId;
  if (apps.length && !pi.length && !pq.length) {
    madre.premioNetto = 0;
    madre.premioLordo = 0;
    madre.tasse = 0;
    madre.provvigioni = 0;
  }

  const quietanze: CampobassoTitoloPianificato[] = [];
  const quietanzaSource = pq.length ? pq : pi;
  quietanzaSource.forEach((row, idx) => {
    quietanze.push(
      fillFromParsed("quietanza", row, {
        chiave: `${chiave}:q${idx + 1}`,
        numeroTitolo: first.numero,
        riga: idx + 1,
        motivo: pq.length ? "Quietanza da PQ" : "Quietanza clonata da PI",
        cassa: true,
        sostituiscePolizza: first.numero,
      }),
    );
  });

  const appendici: CampobassoTitoloPianificato[] = apps.map((row, idx) =>
    fillFromParsed("appendice", row, {
      chiave: `${chiave}:am${idx + 1}`,
      numeroTitolo: `${first.numero}/AM${idx + 1}`,
      riga: 1,
      motivo: `Appendice da ${row.tipoDoc}`,
      cassa: true,
      isAppendice: true,
    }),
  );

  return {
    chiave,
    esito: "da_creare",
    motivo: madre.motivo,
    numero: first.numero,
    compagniaCodice,
    madre,
    quietanze,
    appendici,
  };
}

export function groupCampobassoRighe(rows: CampobassoPolizzaRiga[]): CampobassoPolizzaRiga[][] {
  const map = new Map<string, CampobassoPolizzaRiga[]>();
  rows.forEach((row, idx) => {
    const numero = normalizeNumeroPolizza(row.Polizza) || `__vuoto_${idx}`;
    const mapped = mapCompagniaCodice(row.CdComp);
    const comp = mapped || trimTxt(row.CdComp).toUpperCase() || `UNK${idx}`;
    const key = `${numero}|${comp}`;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  });
  return [...map.values()];
}

export function planCampobassoPolizze(rows: CampobassoPolizzaRiga[], catalogs: CampobassoCatalogs): {
  gruppi: CampobassoGruppoPianificato[];
  daCreare: CampobassoTitoloPianificato[];
  saltati: CampobassoGruppoPianificato[];
  stats: Record<string, number>;
} {
  const gruppi = groupCampobassoRighe(rows).map((g, i) => resolveCampobassoGruppo(g, catalogs, i + 1));
  const daCreare: CampobassoTitoloPianificato[] = [];
  const saltati: CampobassoGruppoPianificato[] = [];
  const stats: Record<string, number> = {
    gruppi: gruppi.length,
    madri: 0,
    quietanze: 0,
    appendici: 0,
    saltati: 0,
  };
  for (const g of gruppi) {
    if (g.esito === "saltato") {
      saltati.push(g);
      stats.saltati += 1;
      const key = `skip:${g.motivo.split("(")[0].trim()}`;
      stats[key] = (stats[key] || 0) + 1;
      continue;
    }
    if (g.madre) {
      daCreare.push(g.madre);
      stats.madri += 1;
    }
    daCreare.push(...g.quietanze);
    stats.quietanze += g.quietanze.length;
    daCreare.push(...g.appendici);
    stats.appendici += g.appendici.length;
  }
  return { gruppi, daCreare, saltati, stats };
}
