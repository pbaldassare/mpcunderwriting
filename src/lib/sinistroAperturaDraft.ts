import {
  normalizePrescrizioneAnni,
  PRESCRIZIONE_ANNI_DEFAULT,
  type PrescrizioneAnni,
  type SinistroPrescrizioneDraft,
  type SinistroReminderDraft,
} from "@/lib/sinistroPrescrizioniReminder";
import {
  sinistroPraticaDefaultValues,
  sinistroRowToPraticaValues,
  todayDateISO,
} from "@/lib/sinistroPraticaSchema";
import { emptySinistroTerziPolizza, terziPolizzaFromRow } from "@/lib/sinistroTerziPolizza";

export const LEGACY_LOCAL_DRAFT_KEY = "sinistri:apertura:bozza";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export type WizardDocumentEntry = {
  nome_file: string;
  path_temp?: string;
  categoria: string;
  descrizione?: string;
  file_base64?: string;
  /** Documento già salvato su storage/DB */
  saved?: boolean;
  doc_id?: string;
  path_storage?: string;
};

export type SinistroBozzaWizardJson = {
  v: 1;
  currentStep: WizardStep;
  sinistro_terzi?: boolean;
  soloMadri?: boolean;
  prescrizioniDrafts?: SinistroPrescrizioneDraft[];
  reminderDrafts?: SinistroReminderDraft[];
  anniPrescrizione?: PrescrizioneAnni;
};

export type WizardUiState = {
  currentStep: WizardStep;
  selectedClienteId: string | null;
  selectedPolizzaData: Record<string, unknown> | null;
  soloMadri: boolean;
  prescrizioniDrafts: SinistroPrescrizioneDraft[];
  reminderDrafts: SinistroReminderDraft[];
  anniPrescrizione: PrescrizioneAnni;
};

export const createEmptyWizardUiState = (): WizardUiState => ({
  currentStep: 1,
  selectedClienteId: null,
  selectedPolizzaData: null,
  soloMadri: true,
  prescrizioniDrafts: [],
  reminderDrafts: [],
  anniPrescrizione: PRESCRIZIONE_ANNI_DEFAULT,
});

export const createWizardFormDefaults = () => ({
  ...sinistroPraticaDefaultValues,
  data_denuncia: todayDateISO(),
  titolo_id: "",
  sinistro_terzi: false,
  ...emptySinistroTerziPolizza(),
  documenti: [] as WizardDocumentEntry[],
});

/** True quando il wizard deve partire pulito (nuova apertura, nessuna bozza esplicita). */
export const shouldStartCleanWizard = (params: {
  bozzaId: string | null;
  clienteId: string | null;
}): boolean => !params.bozzaId && !params.clienteId;

export const parseBozzaWizardJson = (raw: unknown): SinistroBozzaWizardJson | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<SinistroBozzaWizardJson>;
  const step = Number(o.currentStep);
  if (!Number.isInteger(step) || step < 1 || step > 5) return null;
  return {
    v: 1,
    currentStep: step as WizardStep,
    sinistro_terzi: o.sinistro_terzi === true,
    soloMadri: o.soloMadri !== false,
    prescrizioniDrafts: Array.isArray(o.prescrizioniDrafts) ? o.prescrizioniDrafts : [],
    reminderDrafts: Array.isArray(o.reminderDrafts) ? o.reminderDrafts : [],
    anniPrescrizione: normalizePrescrizioneAnni(o.anniPrescrizione),
  };
};

export const serializeBozzaWizardJson = (input: {
  currentStep: WizardStep;
  sinistro_terzi: boolean;
  soloMadri: boolean;
  prescrizioniDrafts: SinistroPrescrizioneDraft[];
  reminderDrafts: SinistroReminderDraft[];
  anniPrescrizione?: PrescrizioneAnni;
}): SinistroBozzaWizardJson => ({
  v: 1,
  currentStep: input.currentStep,
  sinistro_terzi: input.sinistro_terzi,
  soloMadri: input.soloMadri,
  prescrizioniDrafts: input.prescrizioniDrafts,
  reminderDrafts: input.reminderDrafts,
  anniPrescrizione: normalizePrescrizioneAnni(input.anniPrescrizione),
});

/** Mappa riga sinistro bozza → valori form + UI state. */
export const hydrateWizardFromSinistroBozza = (
  row: Record<string, unknown>,
  docs: Array<{ id: string; nome_file: string; path_storage: string; categoria: string | null; descrizione: string | null }>,
) => {
  const wizardMeta = parseBozzaWizardJson(row.bozza_wizard_json);
  const pratica = sinistroRowToPraticaValues(row);
  const documenti: WizardDocumentEntry[] = docs.map((d) => ({
    nome_file: d.nome_file,
    categoria: d.categoria || "",
    descrizione: d.descrizione || "",
    saved: true,
    doc_id: d.id,
    path_storage: d.path_storage,
  }));

  return {
    formValues: {
      ...pratica,
      data_denuncia: pratica.data_denuncia || todayDateISO(),
      titolo_id: (row.sinistro_terzi ? "" : (row.titolo_id as string) || "") as string,
      sinistro_terzi: row.sinistro_terzi === true,
      ...terziPolizzaFromRow(row),
      documenti,
    },
    ui: {
      currentStep: wizardMeta?.currentStep ?? 1,
      selectedClienteId: (row.cliente_anagrafica_id as string) || null,
      selectedPolizzaData: null as Record<string, unknown> | null,
      soloMadri: wizardMeta?.soloMadri !== false,
      prescrizioniDrafts: wizardMeta?.prescrizioniDrafts ?? [],
      reminderDrafts: wizardMeta?.reminderDrafts ?? [],
      anniPrescrizione: wizardMeta?.anniPrescrizione ?? PRESCRIZIONE_ANNI_DEFAULT,
    },
  };
};

/** Payload parziale per salvataggio bozza (validazione minima lato client). */
export const buildBozzaDbPayload = (
  values: Record<string, unknown>,
  ui: Pick<WizardUiState, "currentStep" | "soloMadri" | "prescrizioniDrafts" | "reminderDrafts" | "anniPrescrizione">,
  selectedClienteId: string | null,
) => {
  const isTerzi = values.sinistro_terzi === true;
  return {
    sinistro_terzi: isTerzi,
    cliente_anagrafica_id: selectedClienteId,
    titolo_id: isTerzi ? null : (values.titolo_id as string) || null,
    bozza_wizard_json: serializeBozzaWizardJson({
      currentStep: ui.currentStep,
      sinistro_terzi: isTerzi,
      soloMadri: ui.soloMadri,
      prescrizioniDrafts: ui.prescrizioniDrafts,
      reminderDrafts: ui.reminderDrafts,
      anniPrescrizione: ui.anniPrescrizione,
    }),
  };
};
