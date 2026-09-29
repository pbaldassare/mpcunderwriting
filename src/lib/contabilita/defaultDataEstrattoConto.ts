import { format } from "date-fns";

/** 10 del mese corrente — default "Data estratto conto" E/C agenzie e produttori. */
export function defaultDataEstrattoConto(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 10);
}

export function defaultDataEstrattoContoFormatted(): string {
  return format(defaultDataEstrattoConto(), "dd/MM/yyyy");
}
