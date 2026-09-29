import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiChatInput } from "@/components/ai/AiChatInput";
import { AiChatMessage } from "@/components/ai/AiChatMessage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bookmark, Eraser, Loader2, Plus, Share2, Star, Trash2, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiMessage } from "@/components/ai/AiChatMessage";
import type { GaranzieConv } from "@/hooks/useGaranzieChat";
import type { FiltroRicerche } from "@/lib/cbBotRicerche";
import type { UseMutationResult } from "@tanstack/react-query";

type Props = {
  canPersist: boolean;
  sidebarTab: "mie" | "condivise";
  setSidebarTab: (t: "mie" | "condivise") => void;
  sidebarList: GaranzieConv[];
  activeId: string | null;
  onSelectConv: (id: string) => void;
  resetChat: () => void;
  shareMutation: UseMutationResult<void, Error, string>;
  deleteMutation: UseMutationResult<void, Error, string>;
  messages: AiMessage[];
  isThinking: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isSharedReadOnly: boolean;
  sendMessage: (text: string) => Promise<void>;
  suggestions: string[];
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  thinkingLabel: string;
  convSubtitle?: (c: GaranzieConv) => string;
  formatConvDate: (c: GaranzieConv) => string | null;
  evidenzaMutation?: UseMutationResult<void, Error, { id: string; inEvidenza: boolean }>;
  salvaMutation?: UseMutationResult<void, Error, { id: string; salvata: boolean }>;
  clearHistoryMutation?: UseMutationResult<number, Error, void>;
  filtroRicerche?: FiltroRicerche;
  setFiltroRicerche?: (f: FiltroRicerche) => void;
  cronologiaDaAzzerare?: number;
  activeSalvata?: boolean;
  onSaveFonte?: (fonte: { title?: string; url: string; snippet?: string }) => void;
  savedFonteUrls?: string[];
  hideTeam?: boolean;
};

export function GaranzieChatLayout({
  canPersist,
  sidebarTab,
  setSidebarTab,
  sidebarList,
  activeId,
  onSelectConv,
  resetChat,
  shareMutation,
  deleteMutation,
  messages,
  isThinking,
  scrollRef,
  isSharedReadOnly,
  sendMessage,
  suggestions,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  thinkingLabel,
  convSubtitle,
  formatConvDate,
  evidenzaMutation,
  salvaMutation,
  clearHistoryMutation,
  filtroRicerche = "tutte",
  setFiltroRicerche,
  cronologiaDaAzzerare = 0,
  activeSalvata = false,
  onSaveFonte,
  savedFonteUrls,
  hideTeam = false,
}: Props) {
  const [confirmAzzera, setConfirmAzzera] = useState(false);
  const canSaveActive = canPersist && !!activeId && (hideTeam || sidebarTab === "mie");
  const isActiveSalvata = activeSalvata || sidebarList.find((c) => c.id === activeId)?.salvata === true;

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[520px] border rounded-lg overflow-hidden bg-card">
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r flex flex-col">
        {canPersist && !hideTeam && (
          <div className="p-2 border-b flex gap-1">
            <Button
              variant={sidebarTab === "mie" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSidebarTab("mie")}
            >
              <User className="h-3 w-3" /> Mie
            </Button>
            <Button
              variant={sidebarTab === "condivise" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setSidebarTab("condivise")}
            >
              <Users className="h-3 w-3" /> Team
            </Button>
          </div>
        )}
        {canPersist && hideTeam && (
          <div className="p-2 border-b text-xs font-medium text-muted-foreground px-3">
            Le tue ricerche
          </div>
        )}
        {!canPersist && (
          <div className="p-2 border-b text-xs font-medium text-muted-foreground flex items-center gap-1 px-3">
            <Users className="h-3 w-3" /> Ricerche condivise
          </div>
        )}
        <div className="p-2 border-b space-y-2">
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={resetChat}>
            <Plus className="h-3 w-3" /> Nuova ricerca
          </Button>
          {canPersist && (hideTeam || sidebarTab === "mie") && setFiltroRicerche && (
            <div className="flex gap-1">
              <Button
                variant={filtroRicerche === "tutte" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 text-[10px] h-7"
                onClick={() => setFiltroRicerche("tutte")}
              >
                Tutte
              </Button>
              <Button
                variant={filtroRicerche === "salvate" ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 text-[10px] h-7"
                onClick={() => setFiltroRicerche("salvate")}
              >
                Salvate
              </Button>
            </div>
          )}
          {canPersist && (hideTeam || sidebarTab === "mie") && clearHistoryMutation && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1 text-[10px] h-7 text-muted-foreground hover:text-destructive"
              disabled={cronologiaDaAzzerare === 0 || clearHistoryMutation.isPending}
              onClick={() => setConfirmAzzera(true)}
            >
              <Eraser className="h-3 w-3" /> Azzera cronologia
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1 max-h-64 lg:max-h-none">
          <div className="p-2 space-y-1">
            {sidebarList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">
                {sidebarTab === "condivise" ? "Nessuna ricerca condivisa" : "Nessuna ricerca salvata"}
              </p>
            )}
            {sidebarList.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-start gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer",
                  activeId === c.id && "bg-muted",
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => onSelectConv(c.id)}
                >
                  <div className="truncate font-medium text-xs" title={c.titolo}>
                    {c.titolo}
                  </div>
                  {(convSubtitle || formatConvDate(c)) && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {convSubtitle ? convSubtitle(c) : null}
                      {formatConvDate(c) && `${convSubtitle ? " · " : ""}${formatConvDate(c)}`}
                    </div>
                  )}
                </button>
                {canPersist && (hideTeam || sidebarTab === "mie") && salvaMutation && (
                  <button
                    type="button"
                    title={c.salvata ? "Togli dai salvati" : "Salva ricerca"}
                    className={cn(
                      "shrink-0 p-1",
                      c.salvata
                        ? "text-primary"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary",
                    )}
                    onClick={() => salvaMutation.mutate({ id: c.id, salvata: !c.salvata })}
                  >
                    <Bookmark className={cn("h-3 w-3", c.salvata && "fill-current")} />
                  </button>
                )}
                {canPersist && (hideTeam || sidebarTab === "mie") && evidenzaMutation && (
                  <button
                    type="button"
                    title={c.in_evidenza ? "Già in know-how" : "Salva come know-how: le prossime domande uguali non bruciano IA"}
                    className={cn(
                      "shrink-0 p-1",
                      c.in_evidenza
                        ? "text-amber-500"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-500",
                    )}
                    onClick={() => evidenzaMutation.mutate({ id: c.id, inEvidenza: !c.in_evidenza })}
                  >
                    <Star className={cn("h-3 w-3", c.in_evidenza && "fill-current")} />
                  </button>
                )}
                {canPersist && (hideTeam || sidebarTab === "mie") && !c.condivisa && (
                  <div className="flex shrink-0 opacity-0 group-hover:opacity-100">
                    {!hideTeam && (
                      <button
                        type="button"
                        title="Condividi con il team"
                        className="p-1 hover:text-primary"
                        onClick={() => shareMutation.mutate(c.id)}
                      >
                        <Share2 className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Elimina"
                      className="p-1 hover:text-destructive"
                      onClick={() => {
                        if (confirm("Eliminare questa ricerca?")) deleteMutation.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {!hideTeam && c.condivisa && <Badge variant="outline" className="text-[9px] shrink-0">Team</Badge>}
                {c.salvata && (
                  <Badge variant="outline" className="text-[9px] shrink-0">Salvata</Badge>
                )}
                {c.in_evidenza && (
                  <Badge variant="secondary" className="text-[9px] shrink-0">Know-how</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-h-[400px]">
        {canSaveActive && salvaMutation && messages.length > 0 && (
          <div className="flex justify-end px-4 pt-3">
            <Button
              variant={isActiveSalvata ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => salvaMutation.mutate({ id: activeId!, salvata: !isActiveSalvata })}
            >
              <Bookmark className={cn("h-3.5 w-3.5", isActiveSalvata && "fill-current")} />
              {isActiveSalvata ? "Salvata" : "Salva ricerca"}
            </Button>
          </div>
        )}
        <ScrollArea className="flex-1 p-4">
          <div ref={scrollRef}>
            {messages.length === 0 && !isThinking && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                {emptyIcon}
                <p className="text-sm font-medium">{emptyTitle}</p>
                <p className="text-xs mt-1 max-w-md">{emptyDescription}</p>
              </div>
            )}
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <AiChatMessage
                  key={m.id ?? i}
                  message={m}
                  onSaveFonte={onSaveFonte}
                  savedFonteUrls={savedFonteUrls}
                />
              ))}
              {isThinking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {thinkingLabel}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {!isSharedReadOnly && (
          <AiChatInput
            onSend={sendMessage}
            disabled={isThinking}
            suggestions={messages.length === 0 ? suggestions : []}
            showSuggestions={messages.length === 0}
          />
        )}
        {isSharedReadOnly && (
          <div className="border-t p-3 text-xs text-muted-foreground text-center bg-muted/30">
            Ricerca condivisa in sola lettura — avvia una nuova ricerca per fare domande di follow-up
          </div>
        )}
      </div>

      <AlertDialog open={confirmAzzera} onOpenChange={setConfirmAzzera}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Azzerare la cronologia?</AlertDialogTitle>
            <AlertDialogDescription>
              Elimina {cronologiaDaAzzerare} ricerc{cronologiaDaAzzerare === 1 ? "a" : "he"} non
              salvate. Le ricerche salvate restano in archivio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => clearHistoryMutation?.mutate()}
            >
              Azzera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
