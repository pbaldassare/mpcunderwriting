/**
 * Etichette compagnia / agenzia da titolo (join compagnia_diretta + compagnia_rapporto).
 * Per broker/pluri la Compagnia Assicurativa è sul rapporto (gruppo), non sull'anagrafica agenzia.
 */

type GruppoLike = { descrizione?: string | null; codice?: string | null } | null | undefined;

type TitoloCompagniaLike = {
  compagnia_diretta?: {
    nome?: string | null;
    codice?: string | null;
    gruppo_compagnia?: string | null;
    gruppi_compagnia?: GruppoLike;
  } | null;
  compagnia_rapporto?: {
    gruppi_compagnia?: GruppoLike;
  } | null;
  prodotti?: { compagnie?: { nome?: string | null } | null } | null;
};

function isPlaceholderGruppo(value: string | null | undefined): boolean {
  const v = (value || "").trim();
  return !v || v.toLowerCase() === "da definire";
}

/** Compagnia assicurativa (gruppo): da rapporto se presente, altrimenti da agenzia. */
export function labelCompagniaAssicurativa(t: TitoloCompagniaLike | null | undefined): string {
  if (!t) return "";
  const fromRapporto = (t.compagnia_rapporto?.gruppi_compagnia?.descrizione || "").trim();
  if (!isPlaceholderGruppo(fromRapporto)) return fromRapporto;

  const fromAgenziaFk = (t.compagnia_diretta?.gruppi_compagnia?.descrizione || "").trim();
  if (!isPlaceholderGruppo(fromAgenziaFk)) return fromAgenziaFk;

  const fromAgenziaText = (t.compagnia_diretta?.gruppo_compagnia || "").trim();
  if (!isPlaceholderGruppo(fromAgenziaText)) return fromAgenziaText;

  return "";
}

/** Agenzia / broker di riferimento (anagrafica compagnie). */
export function labelAgenziaRiferimento(t: TitoloCompagniaLike | null | undefined): string {
  if (!t) return "";
  return (t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome || "").trim();
}

/**
 * Riga header / liste: "Lloyd's · Simplymore" se diversi, altrimenti il solo nome disponibile.
 */
export function labelCompagniaEAgenzia(t: TitoloCompagniaLike | null | undefined): string {
  const comp = labelCompagniaAssicurativa(t);
  const ag = labelAgenziaRiferimento(t);
  if (comp && ag && comp.toLowerCase() !== ag.toLowerCase()) return `${comp} · ${ag}`;
  return comp || ag || "";
}

export type CompagniaContattoLike = {
  id?: string | null;
  telefono?: string | null;
  cellulare?: string | null;
  mail?: string | null;
  mail_ec?: string | null;
  pec?: string | null;
  tipo?: string | null;
} | null | undefined;

export type CompagniaContattoResolved = {
  telefono: string | null;
  email: string | null;
  pec: string | null;
};

/** Telefono, email e PEC da anagrafica compagnie (email ≠ PEC). */
export function resolveCompagniaContatto(agenzia: CompagniaContattoLike): CompagniaContattoResolved {
  const telefono = (agenzia?.telefono || agenzia?.cellulare || "").trim() || null;
  const email = (agenzia?.mail || agenzia?.mail_ec || "").trim() || null;
  const pec = (agenzia?.pec || "").trim() || null;
  return { telefono, email, pec };
}

/** @deprecated Usare resolveCompagniaContatto */
export function resolveAgenziaContatto(agenzia: CompagniaContattoLike) {
  return resolveCompagniaContatto(agenzia);
}

const TIPI_COMPAGNIA_ASSICURATIVA = ["direzione", "agenzia", "mandataria"] as const;

/** Compagnia mandante/assicuratrice collegata al gruppo (esclude broker/plurimandataria). */
export function pickCompagniaAssicurativaDaGruppo(
  compagnie: CompagniaContattoLike[] | null | undefined,
): CompagniaContattoLike {
  if (!compagnie?.length) return null;
  for (const tipo of TIPI_COMPAGNIA_ASSICURATIVA) {
    const found = compagnie.find((c) => (c?.tipo || "").toLowerCase() === tipo);
    if (found) return found;
  }
  const nonBroker = compagnie.find(
    (c) => !["broker", "plurimandataria"].includes((c?.tipo || "").toLowerCase()),
  );
  return nonBroker ?? compagnie[0] ?? null;
}

type SinistroContattiLike = {
  compagnie?: CompagniaContattoLike;
  titoli?: {
    compagnia_diretta?: CompagniaContattoLike;
    compagnia_rapporto?: {
      gruppi_compagnia?: {
        compagnie?: CompagniaContattoLike[] | null;
      } | null;
    } | null;
  } | null;
};

export type SinistroContattiPraticaResolved = {
  agenzia: CompagniaContattoResolved;
  compagnia: CompagniaContattoResolved | null;
  sameEntity: boolean;
};

/** Contatti compagnia assicurativa + agenzia riferimento per scheda sinistro. */
export function resolveSinistroContattiPratica(sinistro: SinistroContattiLike): SinistroContattiPraticaResolved {
  const agenziaEntity =
    sinistro.titoli?.compagnia_diretta ?? sinistro.compagnie ?? null;
  const compagniaGruppo = pickCompagniaAssicurativaDaGruppo(
    sinistro.titoli?.compagnia_rapporto?.gruppi_compagnia?.compagnie,
  );
  const sinistroCompagnia = sinistro.compagnie ?? null;

  let compagniaEntity: CompagniaContattoLike = compagniaGruppo;
  if (
    !compagniaEntity &&
    sinistroCompagnia?.id &&
    agenziaEntity?.id &&
    sinistroCompagnia.id !== agenziaEntity.id
  ) {
    compagniaEntity = sinistroCompagnia;
  }

  const sameEntity =
    !compagniaEntity ||
    !agenziaEntity ||
    (compagniaEntity.id != null &&
      agenziaEntity.id != null &&
      compagniaEntity.id === agenziaEntity.id);

  return {
    agenzia: resolveCompagniaContatto(agenziaEntity),
    compagnia: sameEntity ? null : resolveCompagniaContatto(compagniaEntity),
    sameEntity,
  };
}

/**
 * Telefono del blocco Identità (stessa anagrafica di Email/PEC):
 * agenzia di riferimento, poi compagnia se distinta.
 */
export function telefonoIdentitaSinistro(sinistro: SinistroContattiLike): string | null {
  const { agenzia, compagnia, sameEntity } = resolveSinistroContattiPratica(sinistro);
  if (sameEntity) return agenzia.telefono;
  return agenzia.telefono || compagnia?.telefono || null;
}
