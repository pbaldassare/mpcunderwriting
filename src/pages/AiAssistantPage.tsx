import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, Loader2, Bot, Target, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AiChatMessage, type AiMessage, type AiToolCall } from "@/components/ai/AiChatMessage";
import { AiChatInput } from "@/components/ai/AiChatInput";
import { useConsumedAiEntityContext, type AiEntityContext } from "@/lib/ai/context";

interface DbConversation {
  id: string;
  titolo: string;
  updated_at: string;
}

interface DbMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: AiToolCall[] | null;
  created_at: string;
}

const SUGGESTIONS = [
  "Quante trattative aperte ho?",
  "Pipeline trattative per stato",
  "Polizze in scadenza nei prossimi 30 giorni",
  "Prospect non convertiti più vecchi di 30 giorni",
  "Conversion rate trattative ultimo anno",
  "Provvigioni totali di questo mese",
  "Mandati gare in scadenza nei prossimi 12 mesi",
  "Top 10 broker incumbent nello storico gare",
  "Comuni del Veneto gestiti da competitor",
  "Win rate Intermedia per categoria ente",
];

const AiAssistantPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<AiMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Contesto entità impostato dalla pagina chiamante (es. "Chiedi all'AI"
  // da ClienteDetail). Viene letto e rimosso una sola volta al mount.
  const consumedCtx = useConsumedAiEntityContext();
  const [entityContext, setEntityContext] = useState<AiEntityContext | null>(consumedCtx);

  // Conversations list
  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chat_conversazioni")
        .select("id, titolo, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbConversation[];
    },
  });

  // Messages of active conversation
  const { data: dbMessages = [] } = useQuery({
    queryKey: ["ai-messages", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chat_messaggi")
        .select("id, role, content, tool_calls, created_at")
        .eq("conversazione_id", activeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DbMessage[];
    },
  });

  const persistedMessages: AiMessage[] = activeId
    ? dbMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          tool_calls: (m.tool_calls as AiToolCall[] | null) ?? undefined,
        }))
    : [];
  const messages: AiMessage[] = [...persistedMessages, ...pendingMessages];

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isThinking]);

  const newConversation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not authenticated");
      const { data, error } = await supabase
        .from("ai_chat_conversazioni")
        .insert({ user_id: user.id, titolo: "Nuova conversazione" })
        .select("id, titolo, updated_at")
        .single();
      if (error) throw error;
      return data as DbConversation;
    },
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      setActiveId(conv.id);
      setPendingMessages([]);
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_chat_conversazioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeId === id) {
        setActiveId(null);
        setPendingMessages([]);
      }
    },
  });

  const handleSelect = (id: string) => {
    setActiveId(id);
    setPendingMessages([]);
  };

  const sendMessage = async (text: string) => {
    if (!user || isThinking) return;

    // Ensure a conversation exists
    let convId = activeId;
    let isFirstMessage = false;
    if (!convId) {
      const { data, error } = await supabase
        .from("ai_chat_conversazioni")
        .insert({ user_id: user.id, titolo: text.slice(0, 60) })
        .select("id")
        .single();
      if (error) {
        toast.error("Impossibile creare la conversazione");
        return;
      }
      convId = data.id;
      setActiveId(convId);
      isFirstMessage = true;
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    }

    const userMsg: AiMessage = { role: "user", content: text };
    setPendingMessages((prev) => [...prev, userMsg]);

    // Persist user message
    await supabase.from("ai_chat_messaggi").insert([
      {
        conversazione_id: convId,
        user_id: user.id,
        role: "user",
        content: text,
      },
    ]);

    // Build full history (DB + pending)
    const history = messages
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.content }));

    setIsThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: history,
          conversation_id: convId,
          entity_context: entityContext ?? undefined,
        },
      });
      if (error) {
        const msg = error.message ?? "Errore IA";
        toast.error(msg);
        setPendingMessages((prev) => prev.filter((m) => m !== userMsg));
        return;
      }
      const assistantContent: string = data?.content ?? "";
      const toolCalls: AiToolCall[] = data?.tool_calls ?? [];

      // Persist assistant message
      await supabase.from("ai_chat_messaggi").insert([
        {
          conversazione_id: convId,
          user_id: user.id,
          role: "assistant",
          content: assistantContent,
          tool_calls: (toolCalls.length > 0 ? toolCalls : null) as any,
        },
      ]);

      // Touch conversation timestamp + update title if needed
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (isFirstMessage) updatePayload.titolo = text.slice(0, 60);
      await supabase.from("ai_chat_conversazioni").update(updatePayload).eq("id", convId);

      qc.invalidateQueries({ queryKey: ["ai-messages", convId] });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      setPendingMessages([]);
    } catch (e) {
      console.error(e);
      toast.error("Errore di rete con l'IA");
      setPendingMessages((prev) => prev.filter((m) => m !== userMsg));
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar conversazioni */}
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border bg-card">
        <div className="border-b p-3">
          <Button
            onClick={() => {
              setActiveId(null);
              setPendingMessages([]);
            }}
            variant="default"
            size="sm"
            className="w-full justify-start gap-2"
          >
            <Plus className="h-4 w-4" />
            Nuova conversazione
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {conversations.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Nessuna conversazione
              </p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                  activeId === c.id && "bg-muted",
                )}
              >
                <button
                  onClick={() => handleSelect(c.id)}
                  className="flex-1 truncate text-left"
                  title={c.titolo}
                >
                  {c.titolo}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Eliminare questa conversazione?")) deleteConversation.mutate(c.id);
                  }}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label="Elimina"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat */}
      <main className="flex flex-1 flex-col rounded-lg border bg-card">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold">Assistente IA</h1>
            <p className="text-xs text-muted-foreground">
              Chiedi informazioni sui tuoi dati. Vedi solo ciò che ti è permesso.
            </p>
          </div>
          {entityContext && (
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/40 bg-primary/5 py-1 pl-2 pr-1 text-xs text-primary"
              title={`Contesto attivo: ${entityContext.entityType} ${entityContext.scopeHint}`}
            >
              <Target className="h-3 w-3" />
              <span className="max-w-[200px] truncate">
                {entityContext.entityType}: {entityContext.scopeHint}
              </span>
              <button
                type="button"
                onClick={() => setEntityContext(null)}
                className="ml-1 rounded p-0.5 hover:bg-primary/10"
                aria-label="Rimuovi contesto"
                title="Rimuovi contesto (l'AI vedrà tutti i tuoi dati)"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <div className="rounded-full bg-muted p-4">
                <Bot className="h-8 w-8" />
              </div>
              <div>
                <p className="text-base font-medium text-foreground">Come posso aiutarti?</p>
                <p className="mt-1 text-sm">
                  Polizze, scadenze, sinistri, trattative, prospect, provvigioni, contabilità…
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((m, i) => (
                <AiChatMessage key={m.id ?? `${m.role}-${i}`} message={m} />
              ))}
              {isThinking && (
                <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  Sto consultando i tuoi dati…
                </div>
              )}
            </div>
          )}
        </div>

        <AiChatInput
          onSend={sendMessage}
          disabled={isThinking}
          suggestions={SUGGESTIONS}
          showSuggestions={messages.length === 0}
        />
      </main>
    </div>
  );
};

export default AiAssistantPage;
