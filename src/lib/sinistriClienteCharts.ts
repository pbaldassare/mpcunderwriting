import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { isSinistroAperto as isAperto } from "@/lib/sinistriStati";

export { isSinistroAperto } from "@/lib/sinistriStati";

export type SinistroChartRow = {
  stato?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  targa_veicolo?: string | null;
  importo_riserva?: number | null;
};

export type StackApertiChiusi = {
  name: string;
  aperti: number;
  chiusi: number;
};

export type VeicoloChartRow = {
  name: string;
  sinistri: number;
  riserve: number;
};

export function aggregateSinPerTipo(sinistri: SinistroChartRow[]): StackApertiChiusi[] {
  const map = new Map<string, StackApertiChiusi>();
  for (const s of sinistri) {
    const name = formatTipoSinistro(s);
    const cur = map.get(name) || { name, aperti: 0, chiusi: 0 };
    if (isAperto(s.stato)) cur.aperti += 1;
    else cur.chiusi += 1;
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => (b.aperti + b.chiusi) - (a.aperti + a.chiusi));
}

export function aggregateSinPerVeicolo(
  sinistri: SinistroChartRow[],
  limit = 8,
): VeicoloChartRow[] {
  const map = new Map<string, VeicoloChartRow>();
  for (const s of sinistri) {
    const name = (s.targa_veicolo || "").trim() || "Senza targa";
    const cur = map.get(name) || { name, sinistri: 0, riserve: 0 };
    cur.sinistri += 1;
    cur.riserve += Number(s.importo_riserva) || 0;
    map.set(name, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.sinistri - a.sinistri || b.riserve - a.riserve)
    .slice(0, limit);
}
