export interface TipoSinistroDef {
  value: string;
  label: string;
  isVeicolo?: boolean;
}

export const TIPI_SINISTRO: TipoSinistroDef[] = [
  { value: "atti_vandalici", label: "Atti vandalici" },
  { value: "atti_vandalici_auto", label: "Atti vandalici auto", isVeicolo: true },
  { value: "auto_guasti_kasko", label: "Auto guasti / Kasko", isVeicolo: true },
  { value: "auto_varie", label: "Auto varie", isVeicolo: true },
  { value: "cristalli", label: "Cristalli", isVeicolo: true },
  { value: "danno_acqua", label: "Danno d'acqua" },
  { value: "danno_indiretto", label: "Danno indiretto" },
  { value: "difesa_legale", label: "Difesa legale" },
  { value: "evento_naturale", label: "Evento naturale" },
  { value: "fenomeno_elettrico", label: "Fenomeno elettrico" },
  { value: "grandine", label: "Grandine" },
  { value: "incendio", label: "Incendio" },
  { value: "furto", label: "Furto" },
  { value: "infortunio_non_mortale", label: "Infortunio non mortale" },
  { value: "malattia", label: "Malattia" },
  { value: "rc_professionale", label: "RC Professionale" },
  { value: "rc_sanitaria", label: "RC Sanitaria" },
  { value: "rca_danni_a_cose", label: "RCA danni a cose", isVeicolo: true },
  { value: "rca_danni_a_persone", label: "RCA danni a persone", isVeicolo: true },
  { value: "rct_danni_a_cose", label: "RCT danni a cose" },
  { value: "rct_danni_a_persone_non_mortale", label: "RCT danni a persone (non mortale)" },
  { value: "rct_danni_a_persone_mortale", label: "RCT danni a persone (mortale)" },
  { value: "rct_danni_a_persone_e_cose", label: "RCT danni a persone e cose" },
  { value: "rc_patrimoniale", label: "RC Patrimoniale" },
  { value: "rischio_montaggio", label: "Rischio montaggio" },
  { value: "urto_veicolo_non_identificato", label: "Urto veicolo non identificato", isVeicolo: true },
];

export const TIPO_SINISTRO_LABELS: Record<string, string> = TIPI_SINISTRO.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<string, string>
);

export const getTipoSinistroLabel = (v?: string | null) =>
  v ? TIPO_SINISTRO_LABELS[v] || v.replace(/_/g, " ") : "—";

/**
 * Formatta il tipo di sinistro mostrando il valore personalizzato (se valorizzato)
 * con prefisso "Personalizzato:", altrimenti la label del tipo predefinito.
 */
export const formatTipoSinistro = (
  s: { tipo_sinistro?: string | null; tipo_sinistro_personalizzato?: string | null } | null | undefined
): string => {
  if (!s) return "—";
  if (s.tipo_sinistro_personalizzato && s.tipo_sinistro_personalizzato.trim()) {
    return `Personalizzato: ${s.tipo_sinistro_personalizzato.trim()}`;
  }
  return getTipoSinistroLabel(s.tipo_sinistro);
};

function normalizeTipoHaystack(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Testo ramo/prodotto da cui inferire un tipo sinistro catalogo. */
export type TitoloTipoCoperturaLike = {
  ramo?: {
    descrizione?: string | null;
    gruppo_ramo?: { descrizione?: string | null } | null;
  } | null;
  prodotto_nome?: string | null;
  prodotti?: { nome_prodotto?: string | null } | null;
} | null | undefined;

/**
 * Suggerisce un `tipo_sinistro` dal ramo/prodotto della polizza.
 * Prefill modificabile: se non c'è un match univoco/chiaro ritorna null.
 */
export function suggestTipoSinistroFromTitolo(titolo: TitoloTipoCoperturaLike): string | null {
  if (!titolo) return null;
  const hay = normalizeTipoHaystack(
    [
      titolo.ramo?.descrizione,
      titolo.ramo?.gruppo_ramo?.descrizione,
      titolo.prodotto_nome,
      titolo.prodotti?.nome_prodotto,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!hay) return null;

  const byLabel = [...TIPI_SINISTRO]
    .map((t) => ({ value: t.value, needle: normalizeTipoHaystack(t.label) }))
    .filter((t) => t.needle.length >= 4)
    .sort((a, b) => b.needle.length - a.needle.length);
  for (const t of byLabel) {
    if (hay.includes(t.needle)) return t.value;
  }

  const aliases: { needle: string; value: string }[] = [
    { needle: "cristall", value: "cristalli" },
    { needle: "kasko", value: "auto_guasti_kasko" },
    { needle: "casco", value: "auto_guasti_kasko" },
    { needle: "fenomeno elettrico", value: "fenomeno_elettrico" },
    { needle: "danno acqua", value: "danno_acqua" },
    { needle: "danni d acqua", value: "danno_acqua" },
    { needle: "difesa legale", value: "difesa_legale" },
    { needle: "rc professionale", value: "rc_professionale" },
    { needle: "rc sanitaria", value: "rc_sanitaria" },
    { needle: "rc patrimoniale", value: "rc_patrimoniale" },
    { needle: "infortunio", value: "infortunio_non_mortale" },
    { needle: "malattia", value: "malattia" },
    { needle: "grandine", value: "grandine" },
    { needle: "incendio", value: "incendio" },
    { needle: "furto", value: "furto" },
    { needle: "vandalic", value: "atti_vandalici" },
    { needle: "evento naturale", value: "evento_naturale" },
    { needle: "montaggio", value: "rischio_montaggio" },
  ];
  for (const a of aliases.sort((x, y) => y.needle.length - x.needle.length)) {
    if (hay.includes(a.needle)) return a.value;
  }
  return null;
}
