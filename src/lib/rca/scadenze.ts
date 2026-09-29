import type { RcaClientelaRow } from "@/lib/rca/clientela";

export type FinestraScadenzaRca = "tutte" | "scadute" | "30" | "60" | "90";

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysUntilScadenza(scadenza: string | null | undefined, today: string): number | null {
  if (!scadenza) return null;
  const a = Date.parse(`${scadenza.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export type UrgenzaScadenzaRca = "scaduta" | "30" | "60" | "90" | "oltre" | "sconosciuta";

export function urgenzaScadenzaRca(
  scadenza: string | null | undefined,
  today: string,
): UrgenzaScadenzaRca {
  const days = daysUntilScadenza(scadenza, today);
  if (days == null) return "sconosciuta";
  if (days < 0) return "scaduta";
  if (days <= 30) return "30";
  if (days <= 60) return "60";
  if (days <= 90) return "90";
  return "oltre";
}

export function sortRcaByScadenza(rows: RcaClientelaRow[]): RcaClientelaRow[] {
  return [...rows].sort((a, b) => {
    if (!a.scadenza && !b.scadenza) return a.clienteNome.localeCompare(b.clienteNome, "it");
    if (!a.scadenza) return 1;
    if (!b.scadenza) return -1;
    const byDate = a.scadenza.localeCompare(b.scadenza);
    if (byDate !== 0) return byDate;
    return a.clienteNome.localeCompare(b.clienteNome, "it");
  });
}

export function filterRcaScadenze(
  rows: RcaClientelaRow[],
  opts: { finestra: FinestraScadenzaRca; today: string },
): RcaClientelaRow[] {
  if (opts.finestra === "tutte") return rows;
  const today = opts.today.slice(0, 10);
  if (opts.finestra === "scadute") {
    return rows.filter((r) => r.scadenza && r.scadenza.slice(0, 10) < today);
  }
  const limit = addDaysIso(today, Number(opts.finestra));
  return rows.filter((r) => {
    if (!r.scadenza) return false;
    const d = r.scadenza.slice(0, 10);
    return d >= today && d <= limit;
  });
}

export function preventivaPath(row: Pick<RcaClientelaRow, "targa" | "clienteId" | "titoloId">): string {
  const q = new URLSearchParams();
  if (row.targa && row.targa !== "—") q.set("targa", row.targa);
  if (row.clienteId) q.set("cliente", row.clienteId);
  if (row.titoloId) q.set("titolo", row.titoloId);
  return `/rca/preventivi/nuovo?${q.toString()}`;
}
