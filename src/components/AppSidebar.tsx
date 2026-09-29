import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  FileText,
  AlertTriangle,
  Calculator,
  BarChart3,
  Percent,
  Send,
  Mail,
  MessageSquare,
  Shield,
  Settings,
  FileStack,
  Wrench,
  UserPlus,
  Building2,
  Tag,
  Package,
  Grid3X3,
  Landmark,
  Bell,
  Receipt,
  HardDrive,
  LucideIcon,
  ChevronDown,
  ChevronRight,
  Search,
  FolderOpen,
  Briefcase,
  Banknote,
  ClipboardList,
  FileUp,
  FilePlus,
  FileSpreadsheet,
  Clock,
  FileCheck,
  Printer,
  CheckSquare,
  ListChecks,
  CalendarDays,
  FileOutput,
  Import,
  ArrowRightLeft,
  Database,
  Lock,
  Map,
  BookOpen,
  Archive,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  LineChart,
  Scale,
  Pencil,
  Wallet,
  Wand2,
  Target,
  Bot,
  Heart,
  Car,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSidebarToActive } from "@/lib/sidebarToActive";
import { SISTEMA_SEDE_ALLOWED_ROLES } from "@/lib/sistemaSede";
import RecentiPreferitiSidebar from "./RecentiPreferitiSidebar";


interface SidebarItem {
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hideForRoles?: string[];
  showForRoles?: string[];
}

interface SidebarGroupDef {
  label: string;
  icon: LucideIcon;
  permissionKey: string;
  adminOnly?: boolean;
  hideForRoles?: string[];
  showForRoles?: string[];
  children: SidebarItem[];
}

interface SidebarSingleItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permissionKey: string;
  adminOnly?: boolean;
  hasBadge?: boolean;
  hideForRoles?: string[];
  showForRoles?: string[];
  /** Match esatto del path (non i sotto-path). */
  end?: boolean;
}

type SidebarEntry =
  | { type: "single"; item: SidebarSingleItem }
  | { type: "group"; group: SidebarGroupDef };

// Path/label legacy DEFINITIVAMENTE RIMOSSI. Mai mostrare, anche se arrivano
// da cache, storage, o configurazioni vecchie.
const LEGACY_PATH_PREFIXES = [
  "/contabilita-generale",
  "/fatturapa",
  "/fornitori",
  "/banca-import",
  "/area-cfo",
  "/cfo",
  "/provvigioni-sede",
];
const LEGACY_LABEL_RE = /CONT\.?\s*GENERALE|FATTURAPA|AREA\s*CFO|PROVVIGIONI\s*CONSUL/i;
export const isLegacyPath = (path?: string) =>
  !!path && LEGACY_PATH_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
export const isLegacyLabel = (label?: string) => !!label && LEGACY_LABEL_RE.test(label);

const sidebarEntries: SidebarEntry[] = [
  { type: "single", item: { label: "Home", path: "/", icon: LayoutDashboard, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Assistente IA", path: "/ai-assistant", icon: Sparkles, permissionKey: "dashboard" } },
  {
    type: "single",
    item: {
      label: "CB Bot",
      path: "/cb-bot",
      icon: Bot,
      permissionKey: "dashboard",
      showForRoles: ["admin"],
    },
  },
  {
    type: "single",
    item: {
      label: "Cruscotto Direzione",
      path: "/cruscotto-direzione",
      icon: LineChart,
      permissionKey: "dashboard",
      showForRoles: ["admin", "cfo", "executive"],
    },
  },
  {
    type: "single",
    item: {
      label: "Trattative",
      path: "/trattative",
      icon: ArrowRightLeft,
      permissionKey: "trattative",
      end: true,
    },
  },
  {
    type: "group",
    group: {
      label: "Bandi Pubblici",
      icon: Landmark,
      permissionKey: "trattative",
      children: [
        { label: "Bandi Pubblici", path: "/bandi-pubblici", icon: Landmark },
        { label: "Bandi partecipati", path: "/bandi-pubblici/partecipati", icon: Heart },
        { label: "Storico Gare", path: "/trattative/storico-gare", icon: Archive },
      ],
    },
  },
  { type: "single", item: { label: "Opportunity", path: "/opportunity", icon: Target, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Chat", path: "/chat", icon: MessageSquare, permissionKey: "dashboard", hasBadge: true } },
  {
    type: "group",
    group: {
      label: "Portafoglio",
      icon: Briefcase,
      permissionKey: "titoli",
      children: [
        { label: "Clienti", path: "/archivi/clienti", icon: Users },
        { label: "Polizze Attive", path: "/portafoglio/attive", icon: Shield },
        { label: "Carico del mese", path: "/portafoglio/carico", icon: Clock },
        { label: "Storico Polizze", path: "/portafoglio/storico", icon: Archive },
        { label: "Gestione Polizze", path: "/portafoglio/gestione", icon: Wand2 },
        { label: "Rettifica Provvigioni", path: "/portafoglio/rettifica-provvigioni", icon: Percent, hideForRoles: ["manager", "produttore", "corrispondente", "backoffice", "cliente", "prospect", "executive"] },
        
        { label: "Estrazioni e Stampe", path: "/portafoglio/estrazioni-stampe", icon: Printer },
      ],
    },
  },
  {
    type: "single",
    item: { label: "Archivio Documentale", path: "/portafoglio/documentale", icon: HardDrive, permissionKey: "portafoglio" },
  },
  {
    type: "single",
    item: {
      label: "CB Bot",
      path: "/portafoglio/documentale?tab=cb-bot",
      icon: Bot,
      permissionKey: "portafoglio",
      hideForRoles: ["admin"],
    },
  },
  {
    type: "group",
    group: {
      label: "Anagrafiche",
      icon: Briefcase,
      permissionKey: "anagrafiche",
      hideForRoles: ["ufficio"],
      children: [
        { label: "Centro Utenti & Privilegi", path: "/utenti-privilegi", icon: ShieldCheck },
        { label: "Anagrafiche Agenzie", path: "/archivi/anagrafiche-agenzie", icon: Scale },
        { label: "Anagrafiche Amministrative", path: "/archivi/anagrafiche-amministrative", icon: Briefcase },
        { label: "Conti Bancari", path: "/archivi/conti-bancari", icon: Banknote },
        { label: "Compagnie / Agenzie", path: "/compagnie", icon: Building2 },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Sinistri",
      icon: AlertTriangle,
      permissionKey: "sinistri",
      children: [
        { label: "Ricerca", path: "/sinistri", icon: Search },
        { label: "Apertura", path: "/sinistri/apertura", icon: FilePlus },
        { label: "Caricamento massivo", path: "/sinistri/caricamento", icon: FileSpreadsheet },
        { label: "Termini di prescrizione", path: "/sinistri/prescrizioni", icon: Clock },
        { label: "Reminder", path: "/sinistri/reminder", icon: Bell },
        { label: "Report Sanitario SIR", path: "/sinistri/report-sir", icon: FileText },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Contabilità operativa",
      icon: Calculator,
      permissionKey: "contabilita",
      children: [
        { label: "Incassi", path: "/portafoglio/incassi", icon: Clock },
        { label: "Riepilogo Messe a Cassa", path: "/contabilita", icon: Landmark },
        { label: "E/C Clienti", path: "/contabilita/ec-clienti", icon: Users },
        { label: "Storico E/C Clienti", path: "/contabilita/ec-cliente/storico", icon: Archive },
        { label: "E/C Produttori", path: "/contabilita/ec-produttori", icon: Percent },
        { label: "Storico E/C Produttori", path: "/contabilita/ec-produttore/storico", icon: Archive },
        { label: "Acconti", path: "/contabilita/anticipi-clienti", icon: Wallet },
        { label: "Bonifici", path: "/contabilita/caricamento-mov-bancari?tab=da-ricongiungere", icon: ArrowRightLeft, hideForRoles: ["manager","produttore","corrispondente","cliente","prospect"] },
        { label: "Caricamento Mov. Bancari", path: "/contabilita/caricamento-mov-bancari?tab=importazione", icon: Import, hideForRoles: ["manager","produttore","corrispondente","cliente","prospect"] },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Contabilità Amministrativa",
      icon: Landmark,
      permissionKey: "contabilita",
      children: [
        { label: "E/C Agenzie", path: "/contabilita/ec-agenzia", icon: Building2, hideForRoles: ["ufficio"] },
        { label: "Agenzie in Pagamento", path: "/contabilita/ec-agenzia/in-pagamento", icon: Building2, hideForRoles: ["ufficio"] },
        { label: "Storico E/C Agenzie", path: "/contabilita/ec-agenzia/storico", icon: Archive, hideForRoles: ["ufficio"] },
        { label: "Storico Rimesse", path: "/contabilita/storico-rimesse", icon: Send },
        { label: "E/C Produttori", path: "/contabilita/ec-produttori", icon: Percent },
        { label: "Storico E/C Produttori", path: "/contabilita/ec-produttore/storico", icon: Archive },
        { label: "Provvigioni Maturate", path: "/provvigioni-maturate", icon: TrendingUp },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Progetto RCA",
      icon: Car,
      permissionKey: "titoli",
      children: [
        { label: "Clientela", path: "/rca/clientela", icon: Users },
        { label: "Scadenze", path: "/rca/scadenze", icon: CalendarDays },
        { label: "Preventivi", path: "/rca/preventivi", icon: FileText },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Sistema",
      icon: Settings,
      permissionKey: "impostazioni",
      showForRoles: [...SISTEMA_SEDE_ALLOWED_ROLES],
      children: [
        { label: "Anomalie Sistema", path: "/anomalie-sistema", icon: AlertTriangle, adminOnly: true },
        { label: "Backup & Export", path: "/backup-export", icon: HardDrive, adminOnly: true },
        { label: "Tabelle di Base", path: "/tabelle-base", icon: Database },
        { label: "Template Email", path: "/template", icon: Mail },
        { label: "Sitemap", path: "/sitemap", icon: Map, adminOnly: true },
      ],
    },
  },
  { type: "single", item: { label: "Notifiche", path: "/notifiche", icon: Bell, permissionKey: "dashboard" } },
  { type: "single", item: { label: "Guida Operativa", path: "/guida-operativa", icon: BookOpen, permissionKey: "dashboard" } },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const { hasPermission, isAdmin, user, profile } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["chat_unread_count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase.rpc("get_chat_unread_count", { _user_id: user.id });
      return Number(data) || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  // Realtime: refresh badge when new messages arrive
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("chat_unread_realtime_main")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messaggi_interni" },
        () => {
          qc.invalidateQueries({ queryKey: ["chat_unread_count", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  useEffect(() => {
    for (const entry of sidebarEntries) {
      if (entry.type === "group") {
        const match = entry.group.children.some((child) => {
          const base = child.path.split("?")[0];
          return location.pathname === base || location.pathname.startsWith(base + "/");
        });
        if (match) {
          setOpenGroups((prev) => {
            const next = new Set(prev);
            next.add(entry.group.label);
            return next;
          });
        }
      }
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const currentRole = profile?.ruolo ?? "";

  const isVisible = (
    permissionKey: string,
    adminOnly?: boolean,
    hideForRoles?: string[],
    showForRoles?: string[],
  ) => {
    if (showForRoles && currentRole && !showForRoles.includes(currentRole)) return false;
    if (adminOnly && !isAdmin) return false;
    if (hideForRoles && currentRole && hideForRoles.includes(currentRole)) return false;
    return hasPermission(permissionKey);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen z-30 transition-all duration-200 flex flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
      style={{
        background: "linear-gradient(180deg, hsl(var(--sidebar-bg-from)), hsl(var(--sidebar-bg-to)))",
      }}
    >
      {/* Brand rimosso */}


      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 sidebar-scrollbar">
        <RecentiPreferitiSidebar collapsed={collapsed} />
        {sidebarEntries.map((entry) => {
          if (entry.type === "single") {
            const item = entry.item;
            if (isLegacyPath(item.path) || isLegacyLabel(item.label)) return null;
            if (!isVisible(item.permissionKey, item.adminOnly, item.hideForRoles, item.showForRoles)) return null;
            return (
              <RouterNavLink
                key={item.path}
                to={item.path}
                end={item.end || item.path === "/"}
                className={() => {
                  const isActive = isSidebarToActive(location, item.path, item.end || item.path === "/");
                  return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 ${
                    isActive
                      ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                      : "text-white/70 hover:bg-white/8 hover:text-white/90"
                  } ${collapsed ? "justify-center" : ""}`;
                }}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {item.hasBadge && unreadCount > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none ${
                    collapsed ? "absolute top-0.5 right-0.5 w-4 h-4" : "ml-auto min-w-[18px] h-[18px] px-1"
                  }`}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </RouterNavLink>
            );
          }

          const group = entry.group;
          if (isLegacyLabel(group.label)) return null;
          if (!isVisible(group.permissionKey, group.adminOnly, group.hideForRoles, group.showForRoles)) return null;
          const visibleChildren = group.children.filter(
            (child) =>
              !isLegacyPath(child.path) &&
              !isLegacyLabel(child.label) &&
              isVisible("dashboard", child.adminOnly, child.hideForRoles, child.showForRoles)
          );
          if (visibleChildren.length === 0) return null;
          const isOpen = openGroups.has(group.label);
          const hasActiveChild = visibleChildren.some((child) => {
            const base = child.path.split("?")[0];
            return location.pathname === base || location.pathname.startsWith(base + "/");
          });

          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 w-full ${
                  hasActiveChild
                    ? "text-white"
                    : "text-white/60 hover:bg-white/8 hover:text-white/80"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <group.icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left uppercase text-xs tracking-wider">
                      {group.label}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    )}
                  </>
                )}
              </button>

              {isOpen && !collapsed && (
                <div className="ml-3 pl-3 border-l border-white/15">
                  {visibleChildren.map((child) => (
                    <RouterNavLink
                      key={child.path}
                      to={child.path}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150 mb-0.5 ${
                          isActive
                            ? "bg-white/15 text-white font-medium"
                            : "text-white/60 hover:bg-white/8 hover:text-white/80"
                        }`
                      }
                    >
                      <child.icon className="w-4 h-4 shrink-0" />
                      <span>{child.label}</span>
                    </RouterNavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default AppSidebar;
