import { resolveClienteNome, type ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";

export const TIPI_CLIENTELA_RCA = ["AUTOVETTURA", "AUTOCARRO", "AUTOVEICOLO"] as const;

export type TipoClientelaRca = "auto" | "autocarro";

export type RcaClientelaFiltroTipo = "tutti" | TipoClientelaRca;

export type RcaClientelaTitolo = {
  id?: string | null;
  numero_titolo?: string | null;
  data_scadenza?: string | null;
  garanzia_a?: string | null;
  stato?: string | null;
  cliente_anagrafica_id?: string | null;
  clienti?: ClienteEcAnagrafica | ClienteEcAnagrafica[] | null;
};

export type RcaClientelaRaw = {
  id: string;
  targa?: string | null;
  tipo_veicolo?: string | null;
  marca?: string | null;
  modello?: string | null;
  titolo?: RcaClientelaTitolo | RcaClientelaTitolo[] | null;
};

export type RcaClientelaRow = {
  veicoloId: string;
  titoloId: string | null;
  clienteId: string | null;
  targa: string;
  tipo: TipoClientelaRca;
  tipoLabel: string;
  clienteNome: string;
  scadenza: string | null;
  numeroPolizza: string | null;
};

const STATI_ESCLUSI = new Set(["annullato", "stornato", "sospeso"]);

export function classifyTipoVeicoloClientela(
  tipo: string | null | undefined,
): TipoClientelaRca | null {
  const u = (tipo || "").toUpperCase().trim();
  if (!u) return null;
  if (u.includes("AUTOCARRO")) return "autocarro";
  if (u.includes("AUTOVETTURA") || u === "AUTOVEICOLO" || u === "AUTO") return "auto";
  return null;
}

export function isTipoAutoOAutocarro(tipo: string | null | undefined): boolean {
  return classifyTipoVeicoloClientela(tipo) !== null;
}

export function tipoClientelaLabel(tipo: TipoClientelaRca): string {
  return tipo === "autocarro" ? "Autocarro" : "Auto";
}

export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function scadenzaPolizzaRca(titolo: RcaClientelaTitolo | null | undefined): string | null {
  const raw = titolo?.data_scadenza || titolo?.garanzia_a || null;
  if (!raw) return null;
  const s = String(raw).trim();
  return s || null;
}

export function formatScadenzaRca(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

export function mapRcaClientelaRow(raw: RcaClientelaRaw): RcaClientelaRow | null {
  const tipo = classifyTipoVeicoloClientela(raw.tipo_veicolo);
  if (!tipo) return null;
  const titolo = unwrapOne(raw.titolo);
  if (titolo?.stato && STATI_ESCLUSI.has(String(titolo.stato).toLowerCase())) return null;
  const cliente = unwrapOne(titolo?.clienti);
  const targa = String(raw.targa || "").trim().toUpperCase();
  return {
    veicoloId: raw.id,
    titoloId: titolo?.id ?? null,
    clienteId: titolo?.cliente_anagrafica_id ?? null,
    targa: targa || "—",
    tipo,
    tipoLabel: tipoClientelaLabel(tipo),
    clienteNome: resolveClienteNome(cliente),
    scadenza: scadenzaPolizzaRca(titolo),
    numeroPolizza: String(titolo?.numero_titolo || "").trim() || null,
  };
}

export function filterRcaClientelaRows(
  rows: RcaClientelaRow[],
  opts: { search?: string; tipo?: RcaClientelaFiltroTipo },
): RcaClientelaRow[] {
  const q = (opts.search || "").trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.tipo && opts.tipo !== "tutti" && r.tipo !== opts.tipo) return false;
    if (!q) return true;
    return (
      r.targa.toLowerCase().includes(q) ||
      r.clienteNome.toLowerCase().includes(q) ||
      (r.numeroPolizza || "").toLowerCase().includes(q)
    );
  });
}

export function sortRcaClientelaRows(rows: RcaClientelaRow[]): RcaClientelaRow[] {
  return [...rows].sort((a, b) => {
    const byCliente = a.clienteNome.localeCompare(b.clienteNome, "it");
    if (byCliente !== 0) return byCliente;
    return a.targa.localeCompare(b.targa, "it");
  });
}
