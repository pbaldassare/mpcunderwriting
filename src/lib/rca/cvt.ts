import type { CodiceGaranziaAssicurapp } from "@/lib/rca/garanzie";
import { selectedCvtsFromGaranzie } from "@/lib/rca/assicurapp";

export const QUOTE_KINDS = [
  {
    value: "rca",
    label: "RCA + accessori",
    hint: "Quoti la RCA e scegli subito le garanzie accessorie da chiedere alle compagnie.",
  },
  {
    value: "cvt",
    label: "CVT standalone",
    hint: "Solo coperture danni al veicolo (Incendio/Furto, Eventi, Collisione, Kasko), senza RCA.",
  },
] as const;

export type RcaQuoteKind = (typeof QUOTE_KINDS)[number]["value"];

export const GARANZIE_ACCESSORIE: CodiceGaranziaAssicurapp[] = [
  "infortuni_conducente",
  "tutela_legale",
  "assistenza_stradale",
  "rinuncia_rivalsa",
  "cristalli",
  "ricorso_terzi_incendi",
];

export const GARANZIE_DANNI: CodiceGaranziaAssicurapp[] = [
  "furto_incendio",
  "eventi_naturali",
  "atti_vandalici",
  "collisione",
  "kasko",
];

export const CVT_PACCHETTI = [
  { value: "", label: "Nessuna copertura danni", cvt: [] as string[], garanzie: [] as CodiceGaranziaAssicurapp[] },
  {
    value: "IFE",
    label: "Incendio e furto",
    cvt: ["IFE"],
    garanzie: ["furto_incendio"] as CodiceGaranziaAssicurapp[],
  },
  {
    value: "IFE_E",
    label: "Incendio/Furto + eventi e vandalici",
    cvt: ["IFE"],
    garanzie: ["furto_incendio", "eventi_naturali", "atti_vandalici"] as CodiceGaranziaAssicurapp[],
  },
  {
    value: "IFE_C",
    label: "Incendio/Furto + collisione",
    cvt: ["IFE C"],
    garanzie: ["furto_incendio", "collisione"] as CodiceGaranziaAssicurapp[],
  },
  {
    value: "IFE_K",
    label: "Kasko completa",
    cvt: ["IFE K"],
    garanzie: ["furto_incendio", "kasko"] as CodiceGaranziaAssicurapp[],
  },
] as const;

export type CvtPacchettoValue = (typeof CVT_PACCHETTI)[number]["value"];

export function danniPacchettoFromGaranzie(garanzie: string[] | null | undefined): CvtPacchettoValue {
  const g = new Set(garanzie || []);
  if (g.has("kasko")) return "IFE_K";
  if (g.has("collisione")) return "IFE_C";
  if (g.has("eventi_naturali") || g.has("atti_vandalici")) return "IFE_E";
  if (g.has("furto_incendio")) return "IFE";
  return "";
}

export function applyDanniPacchetto(
  garanzie: CodiceGaranziaAssicurapp[],
  pacchetto: CvtPacchettoValue,
): CodiceGaranziaAssicurapp[] {
  const kept = garanzie.filter((code) => !GARANZIE_DANNI.includes(code));
  const extra = CVT_PACCHETTI.find((p) => p.value === pacchetto)?.garanzie || [];
  return [...kept, ...extra];
}

export function resolveSelectedCvts(opts: {
  quoteKind: RcaQuoteKind;
  garanzie: string[];
  cvtPacchetto: CvtPacchettoValue;
}): string[] {
  const fromGaranzie = selectedCvtsFromGaranzie(opts.garanzie);
  if (opts.quoteKind === "cvt") {
    const pack = CVT_PACCHETTI.find((p) => p.value === opts.cvtPacchetto);
    const cvts = [...(pack?.cvt || [])];
    if (opts.garanzie.includes("infortuni_conducente") && !cvts.includes("IF")) cvts.unshift("IF");
    return cvts;
  }
  return fromGaranzie;
}

export function assicurappProductCode(opts: {
  quoteKind: RcaQuoteKind;
  prodottoCode: "rca_auto" | "rca_autocarri";
}): "rca_auto" | "rca_autocarri" | "cvt_standalone" {
  if (opts.quoteKind === "cvt") return "cvt_standalone";
  return opts.prodottoCode;
}

export function quoteKindLabel(kind: string | null | undefined): string {
  return QUOTE_KINDS.find((k) => k.value === kind)?.label || "RCA + accessori";
}

export function cvtPacchettoLabel(value: string | null | undefined): string {
  return CVT_PACCHETTI.find((p) => p.value === value)?.label || "Nessuna copertura danni";
}
