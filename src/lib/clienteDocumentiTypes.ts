import {
  BookOpen, FileSignature, Receipt, Paperclip, ShieldCheck,
  FileText, FileCheck2, AlertTriangle, IdCard, FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

export interface TipoDocMeta {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** classi tailwind per il chip/icona */
  color: string;
  /** ordine in cui mostrare i gruppi nella card polizza */
  order: number;
}

const TIPI: Record<string, TipoDocMeta> = {
  condizioni:    { key: "condizioni",    label: "Condizioni / CGA",   Icon: BookOpen,      color: "bg-teal-100 text-teal-800 border-teal-200",       order: 1 },
  polizza:       { key: "polizza",       label: "Polizza firmata",    Icon: FileSignature, color: "bg-blue-100 text-blue-800 border-blue-200",       order: 2 },
  quietanze:     { key: "quietanze",     label: "Quietanze",          Icon: Receipt,       color: "bg-amber-100 text-amber-800 border-amber-200",    order: 3 },
  appendici:     { key: "appendici",     label: "Appendici",          Icon: Paperclip,     color: "bg-violet-100 text-violet-800 border-violet-200", order: 4 },
  certificati:   { key: "certificati",   label: "Certificati",        Icon: FileCheck2,    color: "bg-emerald-100 text-emerald-800 border-emerald-200", order: 5 },
  precontrattuale:{key:"precontrattuale",label: "Pre-contrattuale",   Icon: ShieldCheck,   color: "bg-sky-100 text-sky-800 border-sky-200",          order: 6 },
  privacy:       { key: "privacy",       label: "Privacy",            Icon: ShieldCheck,   color: "bg-indigo-100 text-indigo-800 border-indigo-200", order: 7 },
  identita:      { key: "identita",      label: "Documenti identità", Icon: IdCard,        color: "bg-rose-100 text-rose-800 border-rose-200",       order: 8 },
  estratti:      { key: "estratti",      label: "Estratti conto",     Icon: FileSpreadsheet,color:"bg-cyan-100 text-cyan-800 border-cyan-200",       order: 9 },
  disdetta:      { key: "disdetta",      label: "Disdette",           Icon: AlertTriangle, color: "bg-red-100 text-red-800 border-red-200",          order: 10 },
  altro:         { key: "altro",         label: "Altri documenti",    Icon: FileText,      color: "bg-slate-100 text-slate-700 border-slate-200",    order: 99 },
};

export function classifyDoc(categoria: string | null | undefined, nomeFile: string | null | undefined): TipoDocMeta {
  const c = (categoria || "").toLowerCase().trim();
  const n = (nomeFile || "").toLowerCase();

  if (/cga|condiz|capitolat|set_inform/.test(c) || /capitolat|cga|condiz/.test(n)) return TIPI.condizioni;
  if (/polizza|firmat|originale|polizza_def|polizza_originale/.test(c) || /firmat|polizza_def/.test(n)) return TIPI.polizza;
  if (/quietanz/.test(c) || /quietanz|q\..*risk/.test(n)) return TIPI.quietanze;
  if (/appendic/.test(c) || /appendic/.test(n)) return TIPI.appendici;
  if (/certif/.test(c)) return TIPI.certificati;
  if (/precontr/.test(c)) return TIPI.precontrattuale;
  if (/privacy|consenso|informativa/.test(c)) return TIPI.privacy;
  if (/identita|carta_id|patente|passaporto/.test(c)) return TIPI.identita;
  if (/estratto|ec.*agenzia|incassi/.test(c)) return TIPI.estratti;
  if (/disdett|recess/.test(c)) return TIPI.disdetta;
  return TIPI.altro;
}

export const TIPI_DOC_LIST = Object.values(TIPI).sort((a, b) => a.order - b.order);
