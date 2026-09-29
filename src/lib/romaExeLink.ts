import { resolveRomaExeRamo, type CatalogoRamoCBnet, type RomaExeRamoRisolto } from "@/lib/romaExeRami";
import {
  resolveRomaExeCompagnia,
  type CatalogoCompagniaCBnet,
  type CatalogoGruppoCompagnia,
  type RomaExeCompagniaRisolta,
} from "@/lib/romaExeCompagnie";
import { lookupRomaExeClienteId } from "@/lib/romaExeClienti";

export type RomaExeRefs = {
  ramo: RomaExeRamoRisolto | null;
  compagnia: RomaExeCompagniaRisolta | null;
  clienteId: string | null;
};

/** Collega rami + compagnia + cliente EXE ai record CBnet già in catalogo. */
export function resolveRomaExeRefs(
  input: {
    ramoCodice?: string | number | null;
    ramoDescrizione?: string | null;
    compagniaNome?: string | null;
    clienteCodice?: string | number | null;
  },
  cataloghi: {
    rami: CatalogoRamoCBnet[];
    compagnie: CatalogoCompagniaCBnet[];
    gruppi?: CatalogoGruppoCompagnia[];
    clienti?: Array<{ exe_codice: string; cliente_id: string | null }>;
  },
): RomaExeRefs {
  return {
    ramo: resolveRomaExeRamo(input.ramoCodice, input.ramoDescrizione, cataloghi.rami),
    compagnia: resolveRomaExeCompagnia(input.compagniaNome, cataloghi.compagnie, cataloghi.gruppi ?? []),
    clienteId: lookupRomaExeClienteId(input.clienteCodice, cataloghi.clienti ?? []),
  };
}
