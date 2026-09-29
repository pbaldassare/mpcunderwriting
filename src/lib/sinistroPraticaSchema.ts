import * as z from "zod";
import { format } from "date-fns";
import { TIPI_SINISTRO } from "@/lib/tipiSinistro";

/** Data odierna in formato ISO locale (yyyy-MM-dd), per input type="date". */
export const todayDateISO = () => format(new Date(), "yyyy-MM-dd");

const optionalNumber = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(0, "L'importo non può essere negativo").optional()
);

/** Minimo caratteri per la descrizione accadimento (apertura, dettaglio, import). */
export const DESCRIZIONE_MIN_CHARS = 10;

/** Campi anagrafici/pratica condivisi tra wizard apertura e modifica dettaglio */
export const sinistroPraticaSchema = z.object({
  data_evento: z.string().min(1, "La data accadimento è obbligatoria"),
  data_denuncia: z.string().min(1, "La data denuncia è obbligatoria"),
  tipo_sinistro: z.string().optional(),
  tipo_sinistro_personalizzato: z.string().optional(),
  numero_sinistro_compagnia: z.string().optional(),
  descrizione: z.string().min(
    DESCRIZIONE_MIN_CHARS,
    `La descrizione deve contenere almeno ${DESCRIZIONE_MIN_CHARS} caratteri`,
  ),
  note_importanti: z.string().optional(),
  luogo_sinistro: z.string().optional(),
  indirizzo_sinistro: z.string().optional(),
  citta_sinistro: z.string().optional(),
  cap_sinistro: z.string().optional(),
  provincia_sinistro: z.string().optional(),
  controparte: z.string().optional(),
  targa_veicolo: z.string().optional(),
  importo_riserva: optionalNumber,
  responsabile_id: z.string().optional(),
  liquidatore_id: z.string().optional(),
  note_interne: z.string().optional(),
  costo_preventivato: optionalNumber,
  costo_effettivo: optionalNumber,
  franchigia: optionalNumber,
  importo_liquidato: optionalNumber,
});

export type SinistroPraticaValues = z.infer<typeof sinistroPraticaSchema>;

export const sinistroPraticaDefaultValues: SinistroPraticaValues = {
  data_evento: "",
  data_denuncia: "",
  tipo_sinistro: "",
  tipo_sinistro_personalizzato: "",
  numero_sinistro_compagnia: "",
  descrizione: "",
  note_importanti: "",
  luogo_sinistro: "",
  indirizzo_sinistro: "",
  citta_sinistro: "",
  cap_sinistro: "",
  provincia_sinistro: "",
  controparte: "",
  targa_veicolo: "",
  importo_riserva: undefined,
  responsabile_id: "",
  liquidatore_id: "",
  note_interne: "",
  costo_preventivato: undefined,
  costo_effettivo: undefined,
  franchigia: undefined,
  importo_liquidato: undefined,
};

export const isTipoSinistroVeicolo = (
  tipoStd?: string | null,
  tipoPersonalizzato?: string | null
): boolean => {
  if (tipoPersonalizzato?.trim()) return false;
  if (!tipoStd || tipoStd === "__custom__") return false;
  return !!TIPI_SINISTRO.find((t) => t.value === tipoStd)?.isVeicolo;
};

export const validateTipoSinistro = (
  tipoStd?: string | null,
  tipoPersonalizzato?: string | null
): string | null => {
  const tStd = (tipoStd || "").trim();
  const tStdNorm = tStd === "__custom__" ? "" : tStd;
  const tCustom = (tipoPersonalizzato || "").trim();
  if (!tStdNorm && tCustom.length < 3) {
    return "Specifica il tipo sinistro (predefinito o personalizzato, min 3 caratteri)";
  }
  return null;
};

export const buildLuogoCompleto = (v: Pick<
  SinistroPraticaValues,
  "indirizzo_sinistro" | "cap_sinistro" | "citta_sinistro" | "provincia_sinistro" | "luogo_sinistro"
>): string | null => {
  const structured = [v.indirizzo_sinistro, v.cap_sinistro, v.citta_sinistro, v.provincia_sinistro]
    .filter(Boolean)
    .join(", ");
  return structured || v.luogo_sinistro?.trim() || null;
};

export const resolveTipoSinistroPayload = (values: Pick<SinistroPraticaValues, "tipo_sinistro" | "tipo_sinistro_personalizzato">) => {
  const custom = (values.tipo_sinistro_personalizzato || "").trim();
  const std = values.tipo_sinistro === "__custom__" ? "" : (values.tipo_sinistro || "").trim();
  return {
    tipo_sinistro: custom ? null : (std || null),
    tipo_sinistro_personalizzato: custom || null,
  };
};

/** Mappa riga sinistri → valori form (unifica descrizione/dinamica) */
/** UUID opzionale: omette stringhe vuote (input RHF / SearchableSelect). */
export const asOptionalUuid = (val?: string | null): string | undefined => {
  const trimmed = (val ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Numero opzionale: omette "", null e NaN (input type="number" vuoto). */
export const asOptionalNumber = (val?: number | string | null): number | undefined => {
  if (val === "" || val === undefined || val === null) return undefined;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : undefined;
};

export const sinistroRowToPraticaValues = (s: Record<string, unknown>): SinistroPraticaValues => ({
  data_evento: (s.data_evento as string) || "",
  data_denuncia: (s.data_denuncia as string) || "",
  tipo_sinistro: (s.tipo_sinistro as string) || (s.tipo_sinistro_personalizzato ? "__custom__" : ""),
  tipo_sinistro_personalizzato: (s.tipo_sinistro_personalizzato as string) || "",
  numero_sinistro_compagnia: (s.numero_sinistro_compagnia as string) || "",
  descrizione: (s.descrizione as string) || (s.dinamica as string) || "",
  note_importanti: (s.note_importanti as string) || "",
  luogo_sinistro: (s.luogo_sinistro as string) || "",
  indirizzo_sinistro: (s.indirizzo_sinistro as string) || "",
  citta_sinistro: (s.citta_sinistro as string) || "",
  cap_sinistro: (s.cap_sinistro as string) || "",
  provincia_sinistro: (s.provincia_sinistro as string) || "",
  controparte: (s.controparte as string) || "",
  targa_veicolo: (s.targa_veicolo as string) || "",
  importo_riserva: s.importo_riserva != null ? Number(s.importo_riserva) : undefined,
  responsabile_id: (s.responsabile_id as string) || "",
  liquidatore_id: (s.liquidatore_id as string) || "",
  note_interne: (s.note_interne as string) || "",
  costo_preventivato: s.costo_preventivato != null ? Number(s.costo_preventivato) : undefined,
  costo_effettivo: s.costo_effettivo != null ? Number(s.costo_effettivo) : undefined,
  franchigia: s.franchigia != null ? Number(s.franchigia) : undefined,
  importo_liquidato: s.importo_liquidato != null ? Number(s.importo_liquidato) : undefined,
});

export const praticaValuesToDbPayload = (
  values: SinistroPraticaValues,
  options?: { persistNoteImportanti?: boolean }
) => {
  const tipo = resolveTipoSinistroPayload(values);
  const descrizione = values.descrizione.trim();
  const showTarga = isTipoSinistroVeicolo(values.tipo_sinistro, values.tipo_sinistro_personalizzato);
  const luogo = buildLuogoCompleto(values);
  return {
    ...(tipo.tipo_sinistro != null ? { tipo_sinistro: tipo.tipo_sinistro } : {}),
    ...(tipo.tipo_sinistro_personalizzato != null
      ? { tipo_sinistro_personalizzato: tipo.tipo_sinistro_personalizzato }
      : {}),
    data_evento: values.data_evento,
    data_denuncia: values.data_denuncia,
    ...(values.numero_sinistro_compagnia?.trim()
      ? { numero_sinistro_compagnia: values.numero_sinistro_compagnia.trim() }
      : {}),
    descrizione: descrizione || undefined,
    dinamica: descrizione || undefined,
    ...(options?.persistNoteImportanti
      ? { note_importanti: values.note_importanti?.trim() || null }
      : values.note_importanti?.trim()
        ? { note_importanti: values.note_importanti.trim() }
        : {}),
    ...(luogo ? { luogo_sinistro: luogo } : {}),
    ...(values.indirizzo_sinistro?.trim()
      ? { indirizzo_sinistro: values.indirizzo_sinistro.trim() }
      : {}),
    ...(values.citta_sinistro?.trim() ? { citta_sinistro: values.citta_sinistro.trim() } : {}),
    ...(values.cap_sinistro?.trim() ? { cap_sinistro: values.cap_sinistro.trim() } : {}),
    ...(values.provincia_sinistro?.trim()
      ? { provincia_sinistro: values.provincia_sinistro.trim() }
      : {}),
    ...(values.controparte?.trim() ? { controparte: values.controparte.trim() } : {}),
    ...(showTarga && values.targa_veicolo?.trim()
      ? { targa_veicolo: values.targa_veicolo.trim() }
      : {}),
    ...(asOptionalNumber(values.importo_riserva) != null
      ? { importo_riserva: asOptionalNumber(values.importo_riserva) }
      : {}),
    ...(asOptionalUuid(values.responsabile_id)
      ? { responsabile_id: asOptionalUuid(values.responsabile_id) }
      : {}),
    ...(asOptionalUuid(values.liquidatore_id)
      ? { liquidatore_id: asOptionalUuid(values.liquidatore_id) }
      : {}),
    ...(values.note_interne?.trim() ? { note_interne: values.note_interne.trim() } : {}),
    ...(asOptionalNumber(values.costo_preventivato) != null
      ? { costo_preventivato: asOptionalNumber(values.costo_preventivato) }
      : {}),
    ...(asOptionalNumber(values.costo_effettivo) != null
      ? { costo_effettivo: asOptionalNumber(values.costo_effettivo) }
      : {}),
    ...(asOptionalNumber(values.franchigia) != null
      ? { franchigia: asOptionalNumber(values.franchigia) }
      : {}),
    ...(asOptionalNumber(values.importo_liquidato) != null
      ? { importo_liquidato: asOptionalNumber(values.importo_liquidato) }
      : {}),
  };
};
