import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Shield, FileText, CalendarClock, MessageSquare,
  Bell, LogOut, Menu, X, AlertTriangle, Building2, Phone,
  ChevronLeft, ChevronRight, Sparkles, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import HistoryBackButton from "@/components/HistoryBackButton";
import { TourProvider, useTour, hasSeenAIAssistant } from "@/components/tour/AppTourContext";
import AppTour from "@/components/tour/AppTour";

const TourTopbarButton = () => {
  const { startTour, isActive } = useTour();
  if (isActive) return null;
  return (
    <button
      onClick={() => startTour()}
      title="Ricomincia tour guidato"
      aria-label="Ricomincia tour guidato"
      data-tour="cl-topbar-tour"
      className="relative p-2 rounded-md hover:bg-primary/10 text-primary min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
};

const TourSidebarButton = ({ compact }: { compact?: boolean }) => {
  const { startTour, isActive } = useTour();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => !isActive && setConfirmOpen(true)}
        title={compact ? "Tour guidato" : undefined}
        className={cn(
          "w-full gap-2 text-white hover:bg-white/15 min-h-[40px] bg-white/10 border border-white/15",
          compact ? "justify-center px-0" : "justify-start"
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        {!compact && <span>Tour guidato</span>}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Avvia tour guidato?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Il tour ti accompagna in tutte le sezioni dell'Area Clienti: Dashboard, Polizze, Scadenze,
              Sinistri, Chat, <strong>Assistente Polizze AI</strong>, Documenti e Notifiche.
              Durante il tour navigherai automaticamente tra le pagine. Puoi interrompere quando vuoi.
              <br /><br />
              Durata stimata: circa 3 minuti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => startTour()}>
              Avvia tour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const allNavItems = [
  { to: "/cliente", label: "Dashboard", icon: LayoutDashboard, end: true, tour: "cl-nav-dashboard" },
  { to: "/cliente/polizze", label: "Polizze", icon: Shield, tour: "cl-nav-polizze" },
  { to: "/cliente/parco-veicoli", label: "Parco Veicoli", icon: Truck, tour: "cl-nav-parco" },
  { to: "/cliente/scadenze", label: "Scadenziario", icon: CalendarClock, tour: "cl-nav-scadenziario" },
  { to: "/cliente/sinistri", label: "Sinistri", icon: AlertTriangle, tour: "cl-nav-sinistri" },
  { to: "/cliente/chat", label: "Chat", icon: MessageSquare, hasBadge: true, tour: "cl-nav-chat" },
  { to: "/cliente/assistente", label: "Assistente Polizze", icon: Sparkles, tour: "cl-nav-assistente" },
  { to: "/cliente/documenti", label: "Documentazione Ente", icon: FileText, tour: "cl-nav-documenti" },
  { to: "/cliente/notifiche", label: "Notifiche", icon: Bell, tour: "cl-nav-notifiche" },
  { to: "/cliente/anagrafica", label: "Dati Ente", icon: Building2, tour: "cl-nav-dati" },
  { to: "/cliente/ufficio", label: "Info e Contatti", icon: Phone, tour: "cl-nav-contatti" },
];

const SIDEBAR_BG = { background: "linear-gradient(180deg, hsl(199, 58%, 18%) 0%, hsl(199, 58%, 26%) 100%)" };

const ClienteLayout = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [areaType, setAreaType] = useState<string>("completa");
  const [aiSeen, setAiSeen] = useState<boolean>(() => hasSeenAIAssistant());

  // Re-check AI seen flag on route change (mark dismissed when user lands on /cliente/assistente)
  useEffect(() => {
    const handler = () => setAiSeen(hasSeenAIAssistant());
    window.addEventListener("cbnet:ai-seen", handler);
    return () => window.removeEventListener("cbnet:ai-seen", handler);
  }, []);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("clienti")
      .select("area_riservata_tipo")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAreaType((data as any)?.area_riservata_tipo || "nessuna");
      });
  }, [user]);

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

  const navItems = allNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = ({ onItemClick, compact = false }: { onItemClick?: () => void; compact?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div data-tour="cl-logo" className={cn("border-b border-white/10", compact ? "p-3 text-center" : "p-5")}>
        {compact ? (
          <h1 className="text-base font-bold text-white tracking-tight">CB</h1>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white tracking-tight">CBnet</h1>
            <span className="text-xs text-white/60">Area Clienti</span>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onItemClick}
            data-tour={(item as any).tour}
            title={compact ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-all min-h-[44px]",
                compact ? "justify-center px-2 py-2" : "px-3 py-2.5",
                isActive
                  ? "bg-white/20 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!compact && <span className="flex-1">{item.label}</span>}
            {(item as any).hasBadge && unreadCount > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none",
                  compact && "absolute translate-x-3 -translate-y-2"
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            {item.to === "/cliente/assistente" && !aiSeen && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold leading-none px-1.5 py-0.5 shadow animate-pulse",
                  compact && "absolute translate-x-3 -translate-y-2 px-1"
                )}
                title="Novità!"
              >
                {compact ? "✨" : "NUOVO ✨"}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className={cn("border-t border-white/10 space-y-2", compact ? "p-2" : "p-3")}>
        {!compact && (
          <p className="text-xs text-white/50 truncate px-1">
            {profile?.nome} {profile?.cognome}
          </p>
        )}
        <TourSidebarButton compact={compact} />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          title={compact ? "Esci" : undefined}
          className={cn(
            "w-full gap-2 text-white/70 hover:text-white hover:bg-white/10 min-h-[40px]",
            compact ? "justify-center px-0" : "justify-start"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!compact && "Esci"}
        </Button>
      </div>
    </div>
  );

  return (
    <TourProvider>
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar (md+) — collapsible */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col relative transition-[width] duration-200",
          desktopCollapsed ? "w-16" : "w-56"
        )}
        style={SIDEBAR_BG}
      >
        <SidebarContent compact={desktopCollapsed} />
        <button
          onClick={() => setDesktopCollapsed((v) => !v)}
          aria-label={desktopCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
          className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full bg-card border border-border shadow flex items-center justify-center text-foreground hover:bg-muted"
        >
          {desktopCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — visible on all sizes; hamburger only on mobile */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center justify-between gap-3 px-3 sm:px-4 h-14">
            <div className="flex items-center gap-2 min-w-0">
              <button
                className="md:hidden p-2 -ml-1 rounded-md hover:bg-muted active:bg-muted/70 min-h-[40px] min-w-[40px] flex items-center justify-center"
                onClick={() => setMobileOpen(true)}
                aria-label="Apri menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <HistoryBackButton fallback="/cliente" />
              <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight truncate">CBnet</h1>
              <span className="hidden sm:inline text-xs text-muted-foreground border-l border-border pl-2 ml-1 truncate">
                Area Clienti
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <TourTopbarButton />
              <NavLink
                to="/cliente/notifiche"
                title="Notifiche"
                data-tour="cl-topbar-bell"
                className="relative p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Notifiche"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </NavLink>
              <div data-tour="cl-topbar-user" className="hidden sm:flex flex-col items-end leading-tight max-w-[200px] truncate pr-1">
                <span className="text-xs font-medium text-foreground truncate">
                  {profile?.nome} {profile?.cognome}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">Area Clienti</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-tour="cl-topbar-logout"
                className="gap-1.5 text-muted-foreground hover:text-foreground min-h-[40px]"
                aria-label="Esci"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Esci</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile drawer */}
        <div
          className={cn(
            "fixed inset-0 z-50 md:hidden transition-opacity duration-200",
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          aria-hidden={!mobileOpen}
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside
            className={cn(
              "absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-2xl transition-transform duration-200",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
            style={SIDEBAR_BG}
            role="dialog"
            aria-label="Menu di navigazione"
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Chiudi menu"
              className="absolute right-2 top-2 p-2 rounded-md text-white/80 hover:bg-white/10 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onItemClick={() => setMobileOpen(false)} />
          </aside>
        </div>

        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>

        <footer className="border-t border-border bg-card py-3 text-center text-xs text-muted-foreground px-3">
          CBnet — Per assistenza contatta la tua agenzia
        </footer>
      </div>
    </div>
    <AppTour />
    
    </TourProvider>
  );
};

export default ClienteLayout;
