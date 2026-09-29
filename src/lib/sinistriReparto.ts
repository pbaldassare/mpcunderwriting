/** Logica reparto ospedaliero — portale cliente sanitario. */

export const REPARTI_OSPEDALE_STANDARD = [
  "Pronto Soccorso",
  "Chirurgia",
  "Ortopedia",
  "Day Hospital",
  "Medicina",
  "Pediatria",
  "Oncologia",
  "Radiologia",
  "Laboratorio Analisi",
  "Servizi Tecnici",
  "IT / Sistemi Informativi",
  "Trasporto Sanitario",
  "Altro",
] as const;

export type ClienteSanitarioInfo = {
  spec_sx_sanita?: string | null;
  settore?: string | null;
  codice_ricerca?: string | null;
  azienda_ssn_sx?: boolean | null;
};

export function isClienteSanitario(cliente: ClienteSanitarioInfo | null | undefined): boolean {
  if (!cliente) return false;
  if (cliente.azienda_ssn_sx) return true;
  if (cliente.spec_sx_sanita?.trim()) return true;
  if (cliente.codice_ricerca === "OSPEDALE_DEMO") return true;
  const settore = (cliente.settore || "").toLowerCase();
  return settore.includes("sanit") || settore.includes("ospedal");
}

/** Risolve il reparto da colonna dedicata o da luogo_sinistro (fallback legacy). */
export function resolveReparto(sinistro: {
  reparto?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
}): string {
  if (sinistro.reparto?.trim()) return sinistro.reparto.trim();

  const luogo = (sinistro.luogo_sinistro || sinistro.indirizzo_sinistro || "").trim();
  if (!luogo) return "Non specificato";

  const lower = luogo.toLowerCase();
  if (lower.includes("reparto ortopedia") || lower.includes("ortopedia")) return "Ortopedia";
  if (lower.includes("day hospital")) return "Day Hospital";
  if (lower.includes("blocco operatorio") || lower.includes("padiglione chirurgia") || lower.includes("chirurgia"))
    return "Chirurgia";
  if (lower.includes("data center") || lower.includes("sistemi informativi")) return "IT / Sistemi Informativi";
  if (lower.includes("deposito") || lower.includes("servizi tecnici")) return "Servizi Tecnici";
  if (lower.includes("pronto soccorso") || lower.includes("emergenza")) return "Pronto Soccorso";
  if (lower.includes("ambulanza") || lower.includes("trasporto")) return "Trasporto Sanitario";

  const match = luogo.match(/^Reparto\s+([^—\-]+)/i);
  if (match?.[1]) return match[1].trim();

  const beforeSep = luogo.split(/[—\-]/)[0]?.trim();
  return beforeSep || "Non specificato";
}

export interface SinPerRepartoRow {
  reparto: string;
  aperti: number;
  chiusi: number;
  riserva: number;
  liquidato: number;
}

export function aggregateSinPerReparto(sinistri: any[]): SinPerRepartoRow[] {
  const map = new Map<string, SinPerRepartoRow>();
  sinistri.forEach((s) => {
    const reparto = resolveReparto(s);
    const isOpen = !["chiuso", "respinto", "archiviato"].includes(s.stato);
    const cur = map.get(reparto) || { reparto, aperti: 0, chiusi: 0, riserva: 0, liquidato: 0 };
    if (isOpen) cur.aperti++;
    else cur.chiusi++;
    cur.riserva += s.importo_riserva || 0;
    cur.liquidato += s.importo_liquidato || 0;
    map.set(reparto, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.reparto.localeCompare(b.reparto, "it"));
}
