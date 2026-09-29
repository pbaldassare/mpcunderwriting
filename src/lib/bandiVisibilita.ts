import type { BandoEsito, FiltroPipelineBando } from "@/lib/bandiInteresse";

export const VISIBILITA_BANDI = ["nuovo", "gia_visto", "deciso"] as const;
export type VisibilitaBando = (typeof VISIBILITA_BANDI)[number];

export function visibilitaBando(opts: {
  esito?: BandoEsito | null;
  visto_il?: string | null;
}): VisibilitaBando {
  if (opts.esito) return "deciso";
  return opts.visto_il ? "gia_visto" : "nuovo";
}

export function labelVisibilitaBando(visibilita: VisibilitaBando | null | undefined): string {
  switch (visibilita) {
    case "gia_visto":
      return "Già visto";
    case "deciso":
      return "Deciso";
    default:
      return "Nuovo";
  }
}

export function matchesFiltroVisibilita(
  visibilita: VisibilitaBando,
  filtro: FiltroPipelineBando,
): boolean {
  if (filtro === "tutti") return true;
  if (filtro === "nuovi") return visibilita === "nuovo";
  if (filtro === "gia_visti") return visibilita === "gia_visto";
  return visibilita === "deciso";
}

export function toastSalvataggioBandi(nuovi: number, giaInArchivio: number): string {
  const parti: string[] = [];
  if (nuovi > 0) parti.push(`${nuovi} nuov${nuovi === 1 ? "o" : "i"}`);
  if (giaInArchivio > 0) {
    parti.push(`${giaInArchivio} già in archivio`);
  }
  if (parti.length === 0) return "Nessun bando da salvare.";
  return `${parti.join(", ")}.`;
}
