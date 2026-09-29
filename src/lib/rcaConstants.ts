// Classi di merito CU (Conversione Universale) 1-18
export const CLASSI_MERITO = Array.from({ length: 18 }, (_, i) => ({
  value: String(i + 1),
  label: `Classe ${i + 1}`,
}));

// Tipi veicolo — fallback se lookup DB non disponibile; preferire useLookupTipologiaVeicolo()
export const TIPI_VEICOLO = [
  "AUTOVETTURA",
  "AUTOTASSAMETRO",
  "AUTOBUS",
  "AUTOCARRO",
  "CICLOMOTORE",
  "MOTOCICLO",
  "MACCHINA OPERATRICE",
  "MACCHINA AGRICOLA",
  "NATANTE",
  "RIMORCHIO",
  "CARRELLO",
  "AUTOARTICOLATO",
  "CAMPER",
  "QUADRICICLO",
].map((v) => ({ value: v, label: v }));

// Sigle Province italiane (110 sigle)
export const PROVINCE_IT = [
  "AG","AL","AN","AO","AP","AQ","AR","AT","AV","BA","BG","BI","BL","BN","BO","BR","BS","BT","BZ",
  "CA","CB","CE","CH","CL","CN","CO","CR","CS","CT","CZ","EN","FC","FE","FG","FI","FM","FR","GE",
  "GO","GR","IM","IS","KR","LC","LE","LI","LO","LT","LU","MB","MC","ME","MI","MN","MO","MS","MT",
  "NA","NO","NU","OR","PA","PC","PD","PE","PG","PI","PN","PO","PR","PT","PU","PV","PZ","RA","RC",
  "RE","RG","RI","RM","RN","RO","SA","SI","SO","SP","SR","SS","SU","SV","TA","TE","TN","TO","TP",
  "TR","TS","TV","UD","VA","VB","VC","VE","VI","VR","VT","VV",
].map((v) => ({ value: v, label: v }));

// Patenti standard
export const TIPI_PATENTE = ["AM","A1","A2","A","B","BE","C","C1","CE","D","DE"].map((v) => ({ value: v, label: v }));

// Patente di default per tipo veicolo
export function defaultPatenteForVeicolo(tipo: string | undefined | null): string {
  const t = (tipo || "").toUpperCase();
  if (t.includes("MOTO")) return "A";
  if (t.includes("CICLOMOT")) return "AM";
  if (t.includes("AUTOCARRO") || t.includes("AUTOARTICOLATO")) return "C";
  if (t.includes("AUTOBUS")) return "D";
  return "B";
}

// Validazione targa IT (auto/moto)
export function isTargaItValid(targa: string): boolean {
  const t = (targa || "").toUpperCase().replace(/\s/g, "");
  if (!t) return false;
  // Auto: 2 lettere + 3 cifre + 2 lettere
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(t)) return true;
  // Moto/Ciclomotori: 2 lettere + 5 cifre OR 2 lettere + 5 alfanumerici
  if (/^[A-Z]{2}\d{5}$/.test(t)) return true;
  if (/^[A-Z]{2}[A-Z0-9]{5}$/.test(t)) return true;
  return false;
}

