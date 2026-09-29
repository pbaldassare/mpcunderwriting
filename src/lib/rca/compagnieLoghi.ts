const DOMAIN_BY_SLUG: Record<string, string> = {
  allianz: "allianz.it",
  axa: "axa.it",
  conte_it: "conte.it",
  conte: "conte.it",
  euroherc: "euroherc.com",
  generali_cargo: "generali.it",
  generali: "generali.it",
  genialpiu: "genial.it",
  groupama: "groupama.it",
  hdi: "hdiassicurazioni.it",
  prima: "prima.it",
  unipol: "unipol.it",
  verti: "verti.it",
  verti_professional: "verti.it",
  wakam: "wakam.com",
  lloyds: "lloyds.com",
  europassistance: "europ-assistance.it",
  italiana: "italiana.it",
};

const DOMAIN_BY_LABEL: Array<{ needle: string; domain: string }> = [
  { needle: "allianz", domain: "allianz.it" },
  { needle: "axa", domain: "axa.it" },
  { needle: "con.te", domain: "conte.it" },
  { needle: "conte", domain: "conte.it" },
  { needle: "euroherc", domain: "euroherc.com" },
  { needle: "generali", domain: "generali.it" },
  { needle: "genial", domain: "genial.it" },
  { needle: "groupama", domain: "groupama.it" },
  { needle: "hdi", domain: "hdiassicurazioni.it" },
  { needle: "prima", domain: "prima.it" },
  { needle: "unipol", domain: "unipol.it" },
  { needle: "verti", domain: "verti.it" },
  { needle: "wakam", domain: "wakam.com" },
  { needle: "lloyd", domain: "lloyds.com" },
  { needle: "europ", domain: "europ-assistance.it" },
  { needle: "italiana", domain: "italiana.it" },
];

function slugify(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function dominioLogoCompagnia(slug?: string | null, label?: string | null): string | null {
  const fromSlug = DOMAIN_BY_SLUG[slugify(slug)];
  if (fromSlug) return fromSlug;
  const text = String(label || "").toLowerCase();
  const hit = DOMAIN_BY_LABEL.find((x) => text.includes(x.needle));
  return hit?.domain || null;
}

export function urlLogoCompagnia(slug?: string | null, label?: string | null): string | null {
  const domain = dominioLogoCompagnia(slug, label);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

export function inizialiCompagnia(label?: string | null, slug?: string | null): string {
  const raw = String(label || slug || "?").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}
