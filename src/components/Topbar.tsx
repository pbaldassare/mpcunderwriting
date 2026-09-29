import { LogOut, Menu, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import HistoryBackButton from "./HistoryBackButton";
import GlobalSearch from "./GlobalSearch";
import NotificheDropdown from "./NotificheDropdown";
import { ProfileThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface TopbarProps {
  onToggleSidebar: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Amministratore",
  ufficio: "Responsabile Ufficio",
  produttore: "Produttore",
  contabilita: "Contabilità",
  cfo: "CFO",
  cliente: "Cliente",
};

const Topbar = ({ onToggleSidebar }: TopbarProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const appEnv = import.meta.env.VITE_APP_ENV || "DEV";
  const isDev = appEnv !== "PROD";

  const displayName = profile
    ? `${profile.nome || ""} ${profile.cognome || ""}`.trim() || profile.email || "Utente"
    : "Utente";
  const roleLabel = profile?.ruolo ? (ROLE_LABELS[profile.ruolo] || profile.ruolo) : "—";
  const initials = profile
    ? `${(profile.nome || "")[0] || ""}${(profile.cognome || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <header className="h-14 bg-card border-b-2 border-primary/20 flex items-center gap-2 px-3 sm:px-6 sticky top-0 z-20 shadow-sm">
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <HistoryBackButton />

      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0 max-w-xl relative">
          <GlobalSearch />
          <kbd className="hidden md:flex pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
        <Badge variant={isDev ? "destructive" : "default"} className="hidden sm:inline-flex text-[10px] px-2 py-0.5 uppercase tracking-wider">
          {appEnv}
        </Badge>
      </div>

      <div className="flex items-center gap-1 sm:gap-4 shrink-0">
        <NotificheDropdown />



        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 sm:gap-3 sm:pl-3 sm:border-l border-border hover:opacity-80 transition-opacity max-w-[220px]">
              <div className="text-right hidden md:block min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
              </div>
              <Avatar className="w-8 h-8 ring-2 ring-primary/20 ring-offset-1 ring-offset-card shrink-0">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground font-normal">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/mio-profilo")}>
              <UserIcon className="w-4 h-4 mr-2" />
              Il mio profilo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ProfileThemeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
