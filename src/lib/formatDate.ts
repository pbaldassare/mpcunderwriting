/**
 * Formatta una data ISO date-only (`YYYY-MM-DD`) in italiano `dd/MM/yyyy`.
 * Non usa `new Date(s)` (evita shift timezone su stringhe date-only).
 * Stringa vuota / non valida → "—".
 */
export function formatDateIT(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const s = String(iso).trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
