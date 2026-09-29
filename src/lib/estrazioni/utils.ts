import { format } from "date-fns";

export function periodoLabel(dateFrom?: Date | null, dateTo?: Date | null): string {
  if (dateFrom && dateTo) {
    return `${format(dateFrom, "dd/MM/yyyy")} — ${format(dateTo, "dd/MM/yyyy")}`;
  }
  if (dateFrom) return `dal ${format(dateFrom, "dd/MM/yyyy")}`;
  if (dateTo) return `al ${format(dateTo, "dd/MM/yyyy")}`;
  return "Tutto il periodo";
}
