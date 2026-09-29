import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCheck, MessageSquare, Users, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import ConfermeStatus from "./ConfermeStatus";
import { logAttivita } from "@/lib/logAttivita";
import { exportStaffChatToPdf } from "@/lib/chatExportPdf";
import { toast } from "sonner";

interface ChatAreaProps {
  canaleId: string | null;
  headerSlot?: React.ReactNode;
  highlightTerm?: string;
  aboveMessages?: React.ReactNode;
  renderMessage?: (text: string) => React.ReactNode;
  embedded?: boolean;
  showExportPdf?: boolean;
  hideMembersBar?: boolean;
  emptyState?: React.ReactNode;
  logContext?: { entitaTipo: string; entitaId: string };
  onMessageSent?: () => void;
}

export default function ChatArea({
  canaleId,
  headerSlot,
  highlightTerm,
  aboveMessages,
  renderMessage,
  embedded = false,
  showExportPdf = false,
  hideMembersBar = false,
  emptyState,
  logContext,
  onMessageSent,
}: ChatAreaProps) {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [richiediConferma, setRichiediConferma] = useState(false);
  const [confermeOpenId, setConfermeOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messaggi } = useQuery({
    queryKey: ["chat_messaggi_interni", canaleId],
    queryFn: async () => {
      if (!canaleId) return [];
      const { data } = await supabase
        .from("chat_messaggi_interni")
        .select("*, profiles:mittente_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!canaleId,
    refetchInterval: 30000,
  });

  const { data: membri } = useQuery({
    queryKey: ["chat_canali_membri", canaleId],
    queryFn: async () => {
      if (!canaleId) return [];
      const { data } = await supabase
        .from("chat_canali_membri")
        .select("user_id, profiles:user_id(nome, cognome, ruolo)")
        .eq("canale_id", canaleId);
      return data || [];
    },
    enabled: !!canaleId,
  });

  const { data: pendingConferme } = useQuery({
    queryKey: ["chat_conferme_pending", canaleId, profile?.id],
    queryFn: async () => {
      if (!canaleId || !profile?.id) return [];
      const { data } = await supabase
        .from("chat_conferme_lettura")
        .select("*, chat_messaggi_interni!inner(canale_id, messaggio, profiles:mittente_id(nome, cognome))")
        .eq("user_id", profile.id)
        .eq("confermato", false);
      return (data || []).filter((c: { chat_messaggi_interni?: { canale_id?: string } }) => c.chat_messaggi_interni?.canale_id === canaleId);
    },
    enabled: !!canaleId && !!profile?.id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  useEffect(() => {
    if (!canaleId) return;

    const channel = supabase
      .channel(`chat-messages-${canaleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messaggi_interni",
          filter: `canale_id=eq.${canaleId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["chat_messaggi_interni", canaleId] });
          qc.invalidateQueries({ queryKey: ["chat_canali_staff_meta"] });
          qc.invalidateQueries({ queryKey: ["chat_canali_cliente_meta"] });
          qc.invalidateQueries({ queryKey: ["chat_unread_count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canaleId, qc]);

  useEffect(() => {
    if (!canaleId || !profile?.id) return;
    supabase.rpc("mark_canale_as_read", { _canale_id: canaleId }).then(() => {
      qc.invalidateQueries({ queryKey: ["chat_unread_count"] });
      qc.invalidateQueries({ queryKey: ["chat_canali_staff_meta"] });
    });
  }, [canaleId, messaggi?.length, profile?.id, qc]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!msg.trim() || !canaleId || !profile?.id) return;

      const { data: membership } = await supabase
        .from("chat_canali_membri")
        .select("id")
        .eq("canale_id", canaleId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!membership) {
        await supabase
          .from("chat_canali_membri")
          .upsert(
            { canale_id: canaleId, user_id: profile.id, ruolo_canale: "membro" },
            { onConflict: "canale_id,user_id", ignoreDuplicates: true }
          );
      }

      const { data: inserted } = await supabase
        .from("chat_messaggi_interni")
        .insert({
          canale_id: canaleId,
          mittente_id: profile.id,
          messaggio: msg.trim(),
          richiedi_conferma: isAdmin ? richiediConferma : false,
        })
        .select()
        .single();

      if (richiediConferma && isAdmin && inserted && membri) {
        const otherMembers = membri.filter((m: { user_id: string }) => m.user_id !== profile.id);
        if (otherMembers.length > 0) {
          await supabase.from("chat_conferme_lettura").insert(
            otherMembers.map((m: { user_id: string }) => ({
              messaggio_id: inserted.id,
              user_id: m.user_id,
            }))
          );
        }
      }

      if (logContext) {
        await logAttivita({
          azione: "messaggio_chat",
          entita_tipo: logContext.entitaTipo,
          entita_id: logContext.entitaId,
          dettagli_json: {
            preview: msg.trim().slice(0, 50),
            mittente_ruolo: profile.ruolo || "sconosciuto",
            canale_id: canaleId,
          },
        });
      } else {
        await logAttivita({
          azione: "messaggio_chat_interno",
          entita_tipo: "chat_canale",
          entita_id: canaleId,
          dettagli_json: {
            preview: msg.trim().slice(0, 50),
            mittente_ruolo: profile.ruolo || "sconosciuto",
            richiedi_conferma: richiediConferma,
          },
        });
      }
    },
    onSuccess: () => {
      setMsg("");
      setRichiediConferma(false);
      qc.invalidateQueries({ queryKey: ["chat_messaggi_interni", canaleId] });
      qc.invalidateQueries({ queryKey: ["chat_canali_staff_meta"] });
      qc.invalidateQueries({ queryKey: ["chat_canali_cliente_meta"] });
      onMessageSent?.();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (confermaId: string) => {
      await supabase
        .from("chat_conferme_lettura")
        .update({ confermato: true, confermato_at: new Date().toISOString() })
        .eq("id", confermaId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat_conferme_pending", canaleId, profile?.id] });
    },
  });

  const handleExportPdf = async () => {
    if (!canaleId || !profile?.id) return;
    setExporting(true);
    try {
      toast.loading("Generazione PDF...", { id: "chat-pdf-staff" });
      await exportStaffChatToPdf({
        canaleId,
        profileId: profile.id,
        profileNome: profile.nome,
        profileCognome: profile.cognome,
      });
      toast.success("PDF generato", { id: "chat-pdf-staff" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error("Errore generazione PDF: " + message, { id: "chat-pdf-staff" });
    } finally {
      setExporting(false);
    }
  };

  const containerClass = embedded
    ? "flex flex-col h-[28rem] border rounded-lg overflow-hidden"
    : "flex-1 flex flex-col h-full";

  if (!canaleId) {
    return (
      <div className={embedded ? containerClass : "flex-1 flex items-center justify-center text-muted-foreground"}>
        <div className="flex-1 flex items-center justify-center">
          {emptyState || (
            <div className="text-center px-6">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Seleziona una conversazione</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Scegli un canale dalla lista oppure avvia una nuova conversazione dal pulsante a sinistra.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {showExportPdf && (
        <div className="border-b border-border bg-card px-4 py-1.5 flex justify-end shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Esporta PDF
          </Button>
        </div>
      )}

      {headerSlot}

      {!hideMembersBar && membri && membri.length > 0 && !headerSlot && (
        <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-2 flex-wrap shrink-0">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Membri:</span>
          {membri.map((m: { user_id: string; profiles?: { nome?: string; cognome?: string; ruolo?: string } }) => {
            const nome = m.profiles ? `${m.profiles.nome || ""} ${m.profiles.cognome || ""}`.trim() : "—";
            const ruolo = m.profiles?.ruolo || "";
            return (
              <span key={m.user_id} className="inline-flex items-center gap-1 text-[10px]">
                <span className="font-medium text-foreground">{nome}</span>
                {ruolo && (
                  <span className="text-[9px] text-muted-foreground capitalize bg-muted px-1 py-0.5 rounded">
                    {ruolo}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {pendingConferme && pendingConferme.length > 0 && (
        <div className="border-b border-border bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2 shrink-0">
          {pendingConferme.map((c: {
            id: string;
            chat_messaggi_interni?: { profiles?: { nome?: string; cognome?: string }; messaggio?: string };
          }) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-amber-700 dark:text-amber-400">Conferma richiesta: </span>
                <span className="text-foreground">
                  {c.chat_messaggi_interni?.profiles?.nome} {c.chat_messaggi_interni?.profiles?.cognome}: &ldquo;
                  {c.chat_messaggi_interni?.messaggio?.slice(0, 60)}...&rdquo;
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => confirmMutation.mutate(c.id)}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Confermo
              </Button>
            </div>
          ))}
        </div>
      )}

      {aboveMessages}

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messaggi?.map((m: {
            id: string;
            mittente_id: string;
            messaggio: string;
            created_at: string;
            richiedi_conferma?: boolean;
            profiles?: { nome?: string; cognome?: string; ruolo?: string };
          }) => {
            const isOwn = m.mittente_id === profile?.id;
            return (
              <div key={m.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {m.profiles ? `${m.profiles.nome || ""} ${m.profiles.cognome || ""}` : "—"}
                  </span>
                  {m.profiles?.ruolo && (
                    <span className="text-[9px] text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">
                      {m.profiles.ruolo}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(m.created_at), "dd/MM HH:mm")}
                  </span>
                  {m.richiedi_conferma && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400 text-amber-600">
                      Conferma
                    </Badge>
                  )}
                </div>
                <div
                  className={`rounded-lg px-3 py-2 mt-1 max-w-[80%] text-sm whitespace-pre-wrap break-words ${
                    isOwn ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"
                  }`}
                >
                  {renderMessage ? renderMessage(m.messaggio) : m.messaggio}
                </div>
                {m.richiedi_conferma && isOwn && isAdmin && (
                  <button
                    onClick={() => setConfermeOpenId(confermeOpenId === m.id ? null : m.id)}
                    className="text-[10px] text-primary hover:underline mt-1"
                  >
                    Stato conferme
                  </button>
                )}
                {confermeOpenId === m.id && <ConfermeStatus messaggioId={m.id} />}
              </div>
            );
          })}
          {!messaggi?.length && (
            <p className="text-center text-sm text-muted-foreground py-8">Nessun messaggio — scrivi il primo!</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 space-y-2 shrink-0">
        {isAdmin && !embedded && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="conferma"
              checked={richiediConferma}
              onCheckedChange={(v) => setRichiediConferma(!!v)}
            />
            <label htmlFor="conferma" className="text-xs text-muted-foreground cursor-pointer">
              Richiedi conferma di lettura
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMutation.mutate()}
            placeholder="Scrivi un messaggio..."
            className="flex-1"
          />
          <Button size="icon" onClick={() => sendMutation.mutate()} disabled={!msg.trim() || sendMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ChatEmptyState({
  onNuovaConversazione,
}: {
  onNuovaConversazione?: () => void;
}) {
  return (
    <div className="text-center px-6">
      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium">Nessuna conversazione selezionata</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Avvia una nuova conversazione interna oppure apri la chat contestuale dalla scheda di un cliente, polizza o sinistro.
      </p>
      {onNuovaConversazione && (
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onNuovaConversazione}>
          <Plus className="h-3.5 w-3.5" /> Nuova conversazione
        </Button>
      )}
    </div>
  );
}
