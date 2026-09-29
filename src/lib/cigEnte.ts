import { isValidCigWithFlag, normalizeCig } from "@/lib/validateCig";

export type ClienteCigSnippet = {
  tipo_cliente?: string | null;
  gruppi_finanziari?: { tipo_soggetto?: string | null } | { tipo_soggetto?: string | null }[] | null;
};

export function isClienteEnte(cli: ClienteCigSnippet | null | undefined): boolean {
  const gf = Array.isArray(cli?.gruppi_finanziari) ? cli?.gruppi_finanziari[0] : cli?.gruppi_finanziari;
  const tipo = (cli?.tipo_cliente || "").toLowerCase();
  const soggetto = (gf?.tipo_soggetto || "").toLowerCase();
  return tipo === "ente" || soggetto === "ente";
}

/** CIG definitivo malformato (vuoto consentito in messa a cassa). */
export function isCigFormatoInvalido(cig: string, temporaneo: boolean): boolean {
  const v = normalizeCig(cig);
  if (!v) return false;
  return !isValidCigWithFlag(v, temporaneo);
}

export function formatCigBadge(cig: string | null | undefined, temporaneo?: boolean): string {
  const v = (cig || "").trim();
  if (!v) return "CIG —";
  return temporaneo ? `CIG temp. ${v}` : `CIG ${v}`;
}
