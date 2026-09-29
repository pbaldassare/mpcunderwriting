import ChatArea from "@/components/chat/ChatArea";
import { useChatCanaleContestuale } from "@/hooks/useChatCanaleContestuale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";

interface ChatTabProps {
  entitaTipo: string;
  entitaId: string;
}

const ruoloLabel = (r: string): string => {
  const map: Record<string, string> = {
    cliente: "Cliente",
    produttore: "Produttore",
    backoffice: "Specialist",
    account_executive: "AE",
    AE: "AE",
    Backoffice: "Specialist",
    corrispondente_1: "Consul 1",
    corrispondente_2: "Consul 2",
    corrispondente_3: "Consul 3",
    "Produttore Sede": "Produttore Sede",
    Agente: "Agente",
    Executive: "Executive",
    admin: "Admin",
    ufficio: "Sede",
    contabilita: "Contabilità",
    cfo: "CFO",
    responsabile_sede: "Resp. Sede",
    assegnato: "Assegnato",
    responsabile: "Responsabile",
    staff: "Staff",
  };
  return map[r] || r;
};

const initials = (nome: string) => {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
};

function ChatRosterHeader({ roster }: { roster: { userId: string; nome: string; ruolo: string }[] }) {
  if (!roster.length) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
      <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground shrink-0">
        {roster.length} partecipant{roster.length === 1 ? "e" : "i"}:
      </span>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1 flex-wrap">
          {roster.map((r) => (
            <Tooltip key={r.userId}>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 bg-background border rounded-full pl-1 pr-2 py-0.5">
                  <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold flex items-center justify-center">
                    {initials(r.nome)}
                  </div>
                  <span className="text-[11px] font-medium text-foreground truncate max-w-[120px]">{r.nome}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                    {ruoloLabel(r.ruolo)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {r.nome} — {ruoloLabel(r.ruolo)}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

export default function ChatTab({ entitaTipo, entitaId }: ChatTabProps) {
  const { canaleId, canaleLoading, roster } = useChatCanaleContestuale(entitaTipo, entitaId);

  if (canaleLoading) {
    return (
      <div className="flex flex-col h-[28rem] border rounded-lg items-center justify-center text-muted-foreground text-sm">
        Caricamento chat...
      </div>
    );
  }

  return (
    <ChatArea
      canaleId={canaleId}
      embedded
      hideMembersBar
      logContext={{ entitaTipo, entitaId }}
      headerSlot={<ChatRosterHeader roster={roster} />}
    />
  );
}
