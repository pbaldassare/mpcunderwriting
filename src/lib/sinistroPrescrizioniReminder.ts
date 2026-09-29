/** Tipi condivisi prescrizioni perentorie e reminder sinistro */

import { addYears, format, parseISO } from "date-fns";

export type PrescrizioneDestinatario = "cliente" | "compagnia" | "perito" | "controparte" | "altro";

/** Destinatario obbligatorio per le prescrizioni perentorie verso l'agenzia assicurativa. */
export const PRESCRIZIONE_DESTINATARIO_AGENZIA: PrescrizioneDestinatario = "compagnia";

export const PRESCRIZIONE_ANNI_OPTIONS = [1, 2, 5, 10] as const;
export type PrescrizioneAnni = (typeof PRESCRIZIONE_ANNI_OPTIONS)[number];
export const PRESCRIZIONE_ANNI_DEFAULT: PrescrizioneAnni = 2;

export const PRESCRIZIONE_BIENNALE_OGGETTO =
  "Termine di prescrizione biennale (art. 2952 c.c.)";

export function isPrescrizioneAnni(value: unknown): value is PrescrizioneAnni {
  return PRESCRIZIONE_ANNI_OPTIONS.includes(value as PrescrizioneAnni);
}

export function normalizePrescrizioneAnni(value: unknown): PrescrizioneAnni {
  const n = typeof value === "string" ? Number(value) : value;
  return isPrescrizioneAnni(n) ? n : PRESCRIZIONE_ANNI_DEFAULT;
}

/** Data base del termine legale: accadimento (`data_evento`), poi denuncia, poi apertura. */
export function resolveDataAccadimentoPrescrizione(
  dataEvento?: string | null,
  dataDenuncia?: string | null,
  dataApertura?: string | null,
): string {
  return (dataEvento || dataDenuncia || dataApertura || "").trim();
}

export function labelTerminePrescrizione(anni: PrescrizioneAnni): string {
  if (anni === 1) return "annuale";
  if (anni === 5) return "quinquennale";
  if (anni === 10) return "decennale";
  return "biennale";
}

export function testoPrescrizioneLegale(anni: PrescrizioneAnni): { oggetto: string; corpo: string } {
  if (anni === 2) {
    return {
      oggetto: PRESCRIZIONE_BIENNALE_OGGETTO,
      corpo: "Prescrizione biennale dalla data di accadimento del sinistro.",
    };
  }
  const label = labelTerminePrescrizione(anni);
  return {
    oggetto: `Termine di prescrizione ${label} (${anni} ${anni === 1 ? "anno" : "anni"})`,
    corpo: `Prescrizione ${label} dalla data di accadimento del sinistro.`,
  };
}

/** Scadenza legale = data accadimento + N anni (default 2). */
export function calcScadenzaPrescrizione(
  dataAccadimento: string | null | undefined,
  anni: unknown = PRESCRIZIONE_ANNI_DEFAULT,
): string {
  if (!dataAccadimento) return "";
  const base = parseISO(dataAccadimento);
  if (Number.isNaN(base.getTime())) return "";
  return format(addYears(base, normalizePrescrizioneAnni(anni)), "yyyy-MM-dd");
}

/** Compat: scadenza biennale da una data già scelta (ora = accadimento). */
export function calcScadenzaPrescrizioneBiennale(dataAccadimento: string | null | undefined): string {
  return calcScadenzaPrescrizione(dataAccadimento, PRESCRIZIONE_ANNI_DEFAULT);
}

export function buildPrescrizioneBiennaleAgenzia(
  dataAccadimento: string | null | undefined,
  agenziaRiferimento?: string | null,
  anni: unknown = PRESCRIZIONE_ANNI_DEFAULT,
): SinistroPrescrizioneDraft | null {
  const anniNorm = normalizePrescrizioneAnni(anni);
  const scadenza = calcScadenzaPrescrizione(dataAccadimento, anniNorm);
  if (!scadenza) return null;
  const label = (agenziaRiferimento || "").trim() || undefined;
  const testi = testoPrescrizioneLegale(anniNorm);
  return {
    destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
    ...(label ? { destinatario_label: label } : {}),
    oggetto: testi.oggetto,
    corpo: testi.corpo,
    data_scadenza_risposta: scadenza,
  };
}
export type PrescrizioneStato = "bozza" | "inviata" | "risposta_ricevuta" | "scaduta";

export type SinistroPrescrizioneRow = {
  id: string;
  sinistro_id: string;
  creato_da: string;
  destinatario_tipo: PrescrizioneDestinatario;
  destinatario_label: string | null;
  oggetto: string;
  corpo: string | null;
  data_invio: string | null;
  data_scadenza_risposta: string;
  stato: PrescrizioneStato;
  canale: string | null;
  note: string | null;
  created_at: string;
};

export type SinistroPrescrizioneDraft = {
  destinatario_tipo: PrescrizioneDestinatario;
  destinatario_label?: string;
  oggetto: string;
  corpo?: string;
  data_scadenza_risposta: string;
  canale?: string;
  note?: string;
};

export type SinistroReminderCategoria =
  | "documenti"
  | "follow_up"
  | "perizia"
  | "contatto_cliente"
  | "altro";

export type SinistroReminderStato = "attivo" | "completato" | "annullato";

export type SinistroReminderRow = {
  id: string;
  sinistro_id: string;
  user_id: string;
  creato_da: string | null;
  assegnato_a: string | null;
  titolo_id: string | null;
  cliente_id: string | null;
  testo: string;
  categoria: SinistroReminderCategoria;
  data_scadenza: string;
  data_promemoria: string | null;
  stato: SinistroReminderStato;
  letto: boolean;
  completato: boolean;
  popup_mostrato_at: string | null;
  created_at: string;
  updated_at?: string;
  sinistri?: {
    id: string;
    numero_sinistro: string | null;
    stato: string | null;
    ufficio_id: string | null;
    compagnia_id: string | null;
    clienti?: { cognome?: string; nome?: string; ragione_sociale?: string; tipo_cliente?: string } | null;
    compagnie?: { nome?: string } | null;
    titoli?: { numero_titolo?: string | null; ramo_id?: string | null; rami?: { descrizione?: string } | null } | null;
    profiles?: { nome?: string; cognome?: string } | null;
  } | null;
  assegnato?: { nome?: string; cognome?: string } | null;
};

export type SinistroReminderDraft = {
  testo: string;
  data_scadenza: string;
  categoria?: SinistroReminderCategoria;
  assegnato_a?: string;
};

export const REMINDER_CATEGORIA_LABEL: Record<SinistroReminderCategoria, string> = {
  documenti: "Documenti",
  follow_up: "Follow-up",
  perizia: "Perizia",
  contatto_cliente: "Contatto cliente",
  altro: "Altro",
};

export const REMINDER_CATEGORIA_OPTIONS = (
  Object.entries(REMINDER_CATEGORIA_LABEL) as [SinistroReminderCategoria, string][]
).map(([value, label]) => ({ value, label }));

export const REMINDER_STATO_LABEL: Record<SinistroReminderStato, string> = {
  attivo: "Attivo",
  completato: "Completato",
  annullato: "Annullato",
};

export const REMINDER_STATO_CLASS: Record<SinistroReminderStato, string> = {
  attivo: "bg-blue-100 text-blue-800",
  completato: "bg-green-100 text-green-800",
  annullato: "bg-muted text-muted-foreground",
};

/** Elenco globale: come scheda pratica (attivi + completati, senza annullati). */
export const REMINDER_LIST_DEFAULT_STATI: SinistroReminderStato[] = ["attivo", "completato"];

/** Admin e CFO vedono i reminder di tutte le sedi. Gli altri sono limitati alla propria sede. */
export function reminderListSeesAllSedi(ruolo: string | null | undefined): boolean {
  return ruolo === "admin" || ruolo === "cfo";
}

export const PRESCRIZIONE_STATO_LABEL: Record<PrescrizioneStato, string> = {
  bozza: "Bozza",
  inviata: "Inviata",
  risposta_ricevuta: "Risposta ricevuta",
  scaduta: "Scaduta",
};

export const PRESCRIZIONE_STATO_CLASS: Record<PrescrizioneStato, string> = {
  bozza: "bg-muted text-muted-foreground",
  inviata: "bg-blue-100 text-blue-800",
  risposta_ricevuta: "bg-green-100 text-green-800",
  scaduta: "bg-red-100 text-red-800",
};

export const DESTINATARIO_LABEL: Record<PrescrizioneDestinatario, string> = {
  cliente: "Cliente",
  /** Valore DB storico `compagnia`: in UI è l'agenzia di riferimento della polizza. */
  compagnia: "Agenzia di riferimento",
  perito: "Perito",
  controparte: "Controparte",
  altro: "Altro",
};
