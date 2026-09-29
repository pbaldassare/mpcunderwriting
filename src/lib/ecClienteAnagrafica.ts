/** Ragione sociale mittente standard su documenti E/C cliente. */
export const RAGIONE_SOCIALE_CONSULBROKERS = "Consulbrokers SPA";

export type ClienteEcAnagrafica = {
  tipo_cliente?: string | null;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  sesso?: string | null;
  email?: string | null;
  pec?: string | null;
  referente_email?: string | null;
  indirizzo_residenza?: string | null;
  cap_residenza?: string | null;
  citta_residenza?: string | null;
  provincia_residenza?: string | null;
  indirizzo_sede?: string | null;
  cap_sede?: string | null;
  citta_sede?: string | null;
  provincia_sede?: string | null;
  indirizzo_fiscale?: string | null;
  cap_fiscale?: string | null;
  citta_fiscale?: string | null;
  provincia_fiscale?: string | null;
};

export function isClienteAziendaEnte(c: ClienteEcAnagrafica | null | undefined): boolean {
  if (!c) return false;
  const t = (c.tipo_cliente || "").toLowerCase();
  return t === "azienda" || t === "ente" || !!c.ragione_sociale;
}

export function resolveClienteEmail(c: ClienteEcAnagrafica | null | undefined): string {
  if (!c) return "";
  return (c.email || c.pec || c.referente_email || "").trim();
}

export function resolveClienteNome(c: ClienteEcAnagrafica | null | undefined): string {
  if (!c) return "—";
  if (isClienteAziendaEnte(c)) return (c.ragione_sociale || "").trim() || "—";
  return `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
}

export function resolveClienteIntestazione(c: ClienteEcAnagrafica | null | undefined): string {
  if (!c) return "";
  if (isClienteAziendaEnte(c)) return "Spett.le";
  return c.sesso === "F" ? "Preg.ma Sig.ra" : "Preg.mo Sig.";
}

export function resolveClienteIndirizzo(c: ClienteEcAnagrafica | null | undefined): {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
} {
  if (!c) return { indirizzo: "", cap: "", citta: "", provincia: "" };
  if (isClienteAziendaEnte(c)) {
    return {
      indirizzo: c.indirizzo_sede || c.indirizzo_fiscale || c.indirizzo_residenza || "",
      cap: c.cap_sede || c.cap_fiscale || c.cap_residenza || "",
      citta: c.citta_sede || c.citta_fiscale || c.citta_residenza || "",
      provincia: c.provincia_sede || c.provincia_fiscale || c.provincia_residenza || "",
    };
  }
  return {
    indirizzo: c.indirizzo_residenza || c.indirizzo_fiscale || c.indirizzo_sede || "",
    cap: c.cap_residenza || c.cap_fiscale || c.cap_sede || "",
    citta: c.citta_residenza || c.citta_fiscale || c.citta_sede || "",
    provincia: c.provincia_residenza || c.provincia_fiscale || c.provincia_sede || "",
  };
}
