import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HardDrive, LogOut } from "lucide-react";
import { useConsultazione } from "@/contexts/ConsultazioneContext";
import { useNavigate } from "react-router-dom";
import logoCbnet from "@/assets/logo-cbnet-transparent.png.asset.json";
import CbBotLogo from "@/components/shared/CbBotLogo";

export default function ConsultazioneLayout() {
  const { email, logout } = useConsultazione();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login?mode=consultazione", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoCbnet.url} alt="CBnet" className="h-7 w-auto shrink-0" />
            <CbBotLogo className="h-8 w-auto shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Area consultazione</div>
              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <HardDrive className="h-3 w-3 shrink-0" />
                {email}
              </div>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1.5" /> Esci
          </Button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
