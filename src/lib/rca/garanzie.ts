export const GARANZIE_ASSICURAPP = [
  { code: "furto_incendio", label: "Furto e incendio" },
  { code: "cristalli", label: "Rottura cristalli" },
  { code: "eventi_naturali", label: "Eventi naturali" },
  { code: "atti_vandalici", label: "Atti vandalici" },
  { code: "kasko", label: "Kasko" },
  { code: "collisione", label: "Collisione" },
  { code: "infortuni_conducente", label: "Infortuni conducente" },
  { code: "rinuncia_rivalsa", label: "Rinuncia alla rivalsa" },
  { code: "tutela_legale", label: "Tutela legale" },
  { code: "assistenza_stradale", label: "Assistenza stradale" },
  { code: "ricorso_terzi_incendi", label: "Ricorso terzi da incendio" },
] as const;

export type CodiceGaranziaAssicurapp = (typeof GARANZIE_ASSICURAPP)[number]["code"];

export type VoceGaranziaPolizza = {
  codice_garanzia?: string | null;
  garanzia?: string | null;
};

const BY_CODICE: Record<string, CodiceGaranziaAssicurapp> = {
  "01": "cristalli",
  "04": "atti_vandalici",
  "05": "furto_incendio",
  "06": "eventi_naturali",
  "07": "eventi_naturali",
  "11": "furto_incendio",
  "12": "assistenza_stradale",
  "13": "tutela_legale",
  "14": "infortuni_conducente",
  "15": "kasko",
};

const BY_TESTO: Array<{ needle: string; code: CodiceGaranziaAssicurapp }> = [
  { needle: "cristall", code: "cristalli" },
  { needle: "vandali", code: "atti_vandalici" },
  { needle: "vandalismo", code: "atti_vandalici" },
  { needle: "incendio", code: "furto_incendio" },
  { needle: "furto", code: "furto_incendio" },
  { needle: "grandine", code: "eventi_naturali" },
  { needle: "atmosfer", code: "eventi_naturali" },
  { needle: "natural", code: "eventi_naturali" },
  { needle: "assistenza", code: "assistenza_stradale" },
  { needle: "soccorso", code: "assistenza_stradale" },
  { needle: "tutela", code: "tutela_legale" },
  { needle: "infortun", code: "infortuni_conducente" },
  { needle: "kasko", code: "kasko" },
  { needle: "casko", code: "kasko" },
  { needle: "collision", code: "collisione" },
  { needle: "rivalsa", code: "rinuncia_rivalsa" },
  { needle: "ricorso", code: "ricorso_terzi_incendi" },
];

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function mapVoceGaranziaToAssicurapp(
  voce: VoceGaranziaPolizza,
): CodiceGaranziaAssicurapp | null {
  const code = String(voce.codice_garanzia || "").trim().toUpperCase();
  if (code && code !== "RCA") {
    const padded = code.padStart(2, "0");
    if (BY_CODICE[padded]) return BY_CODICE[padded];
  }
  const desc = norm(voce.garanzia || "");
  if (!desc) return null;
  if (desc === "rca" || desc.includes("rc auto") || desc.includes("responsabilit")) return null;
  const hit = BY_TESTO.find((x) => desc.includes(x.needle));
  return hit?.code ?? null;
}

export function mapGaranziePolizzaToAssicurapp(
  voci: VoceGaranziaPolizza[] | null | undefined,
): CodiceGaranziaAssicurapp[] {
  const out = new Set<CodiceGaranziaAssicurapp>();
  for (const v of voci || []) {
    const code = mapVoceGaranziaToAssicurapp(v);
    if (code) out.add(code);
  }
  return GARANZIE_ASSICURAPP.map((g) => g.code).filter((c) => out.has(c));
}

export function labelGaranziaAssicurapp(code: string): string {
  return GARANZIE_ASSICURAPP.find((g) => g.code === code)?.label || code;
}
