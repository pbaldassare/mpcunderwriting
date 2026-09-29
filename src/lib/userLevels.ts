import { Crown, BarChart3, Building2, Users, User, UserCircle, LucideIcon } from "lucide-react";

export type UserLevel = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

export interface LevelConfig {
  id: UserLevel;
  label: string;
  shortDesc: string;
  roles: string[]; // values stored in profiles.ruolo
  icon: LucideIcon;
  color: string; // hsl semantic class
  bgClass: string;
  borderClass: string;
  defaultPermissions: Record<string, boolean>;
  defaultVisibility: VisibilityScope;
}

export type VisibilityScope = "all" | "own_office" | "own_producers" | "self_only";

export const VISIBILITY_LABEL: Record<VisibilityScope, string> = {
  all: "Tutte le sedi",
  own_office: "Solo la propria sede",
  own_producers: "Solo i produttori assegnati",
  self_only: "Solo se stesso (proprio portafoglio)",
};

// Permessi modulari raggruppati per area
export const PERMISSION_GROUPS = [
  {
    label: "Operatività",
    items: [
      { key: "titoli", label: "Polizze (lettura/scrittura)" },
      { key: "sinistri", label: "Sinistri" },
      { key: "trattative", label: "Trattative & Prospect" },
      { key: "calendario", label: "Calendario appuntamenti" },
    ],
  },
  {
    label: "Contabilità",
    items: [
      { key: "contabilita", label: "Prima Nota / Incassi" },
      { key: "rimesse", label: "Rimesse a agenzie" },
      { key: "ec_clienti", label: "Estratti Conto Clienti" },
      { key: "chiusure", label: "Chiusure contabili" },
    ],
  },
  {
    label: "Reportistica",
    items: [
      { key: "report", label: "Report centralizzato" },
      { key: "estrazioni", label: "Estrazioni & Stampe" },
    ],
  },
  {
    label: "Amministrazione",
    items: [
      { key: "anagrafiche", label: "Anagrafiche utenti" },
      { key: "tabelle_base", label: "Tabelle di base" },
      { key: "agenzie", label: "Agenzie & Prodotti" },
      { key: "uffici", label: "Gestione Sedi" },
      { key: "manutenzione", label: "Manutenzione sistema" },
    ],
  },
  {
    label: "Documentale",
    items: [
      { key: "documentale", label: "Archivio documentale" },
      { key: "template", label: "Template & Comunicazioni" },
    ],
  },
  {
    label: "Provvigioni",
    items: [
      { key: "provvigioni", label: "Visualizza provvigioni" },
      { key: "riceve_provvigioni", label: "Riceve provvigioni" },
      { key: "pagamenti_provvigioni", label: "Gestisce pagamenti" },
    ],
  },
] as const;

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key)
);

const allTrue = () =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<string, boolean>;

const onlyKeys = (keys: string[]) =>
  Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, keys.includes(k)])) as Record<string, boolean>;

export const LEVELS: LevelConfig[] = [
  {
    id: "L1",
    label: "Admin",
    shortDesc: "Accesso totale alla piattaforma",
    roles: ["admin"],
    icon: Crown,
    color: "text-rose-600",
    bgClass: "bg-gradient-to-br from-rose-500/10 to-rose-600/5",
    borderClass: "border-rose-500/30",
    defaultPermissions: allTrue(),
    defaultVisibility: "all",
  },
  {
    id: "L2",
    label: "CFO",
    shortDesc: "Lettura globale + finanza",
    roles: ["cfo"],
    icon: BarChart3,
    color: "text-amber-600",
    bgClass: "bg-gradient-to-br from-amber-500/10 to-amber-600/5",
    borderClass: "border-amber-500/30",
    defaultPermissions: onlyKeys([
      "titoli", "sinistri", "trattative", "contabilita", "rimesse",
      "ec_clienti", "chiusure", "report", "estrazioni",
      "provvigioni", "documentale",
    ]),
    defaultVisibility: "all",
  },
  {
    id: "L3",
    label: "Sede / Specialist",
    shortDesc: "Operatività di sede e backoffice",
    roles: ["ufficio", "backoffice", "contabilita", "responsabile_sede"],
    icon: Building2,
    color: "text-teal-600",
    bgClass: "bg-gradient-to-br from-teal-500/10 to-teal-600/5",
    borderClass: "border-teal-500/30",
    defaultPermissions: onlyKeys([
      "titoli", "sinistri", "trattative", "calendario",
      "contabilita", "rimesse", "ec_clienti",
      "report", "estrazioni",
      "documentale", "template", "tabelle_base",
      "provvigioni",
    ]),
    defaultVisibility: "own_office",
  },
  {
    id: "L4",
    label: "Manager",
    shortDesc: "Coordina i propri produttori",
    roles: ["manager"],
    icon: Users,
    color: "text-indigo-600",
    bgClass: "bg-gradient-to-br from-indigo-500/10 to-indigo-600/5",
    borderClass: "border-indigo-500/30",
    defaultPermissions: onlyKeys([
      "titoli", "sinistri", "trattative", "calendario",
      "report", "estrazioni",
      "documentale", "provvigioni", "riceve_provvigioni",
    ]),
    defaultVisibility: "own_producers",
  },
  {
    id: "L5",
    label: "Produttore / Corrispondente",
    shortDesc: "Vede solo il proprio portafoglio",
    roles: ["produttore", "corrispondente"],
    icon: User,
    color: "text-sky-600",
    bgClass: "bg-gradient-to-br from-sky-500/10 to-sky-600/5",
    borderClass: "border-sky-500/30",
    defaultPermissions: onlyKeys([
      "titoli", "sinistri", "trattative", "calendario",
      "documentale", "provvigioni", "riceve_provvigioni",
    ]),
    defaultVisibility: "self_only",
  },
  {
    id: "L6",
    label: "Cliente / Prospect",
    shortDesc: "Portale read-only area riservata",
    roles: ["cliente", "prospect"],
    icon: UserCircle,
    color: "text-slate-600",
    bgClass: "bg-gradient-to-br from-slate-500/10 to-slate-600/5",
    borderClass: "border-slate-500/30",
    defaultPermissions: {},
    defaultVisibility: "self_only",
  },
];

export function getLevelByRole(ruolo: string | null | undefined): LevelConfig {
  if (!ruolo) return LEVELS[4]; // default produttore
  return LEVELS.find((l) => l.roles.includes(ruolo)) || LEVELS[4];
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  cfo: "CFO",
  ufficio: "Sede",
  backoffice: "Specialist",
  contabilita: "Contabilità",
  responsabile_sede: "Resp. Sede",
  manager: "Manager",
  produttore: "Produttore",
  corrispondente: "Corrispondente",
  cliente: "Cliente",
  prospect: "Prospect",
};
