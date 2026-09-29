import { useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useCfoFilters } from "@/hooks/useCfoFilters";
import { format } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Riassumi i KPI del periodo selezionato",
  "Quali sono i top 10 clienti per premi?",
  "Confronta premi per compagnia",
  "Mostra il trend mensile premi e margine",
  "Qual è la redditività per sede?",
  "Loss ratio per ramo assicurativo",
];

function FiltersTransparency() {
  const { filters, aiFilters } = useCfoFilters();
  return (
    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
      <span className="font-medium text-foreground">Cosa sto analizzando: </span>
      periodo {format(filters.dataDa, "dd/MM/yyyy")} – {format(filters.dataA, "dd/MM/yyyy")}
      {aiFilters.ufficio_id ? ` · sede filtrata` : " · tutte le sedi"}
      {aiFilters.compagnia_id ? ` · compagnia filtrata` : ""}
    </div>
  );
}

export function CfoAnalystChat() {
  const { aiFilters } = useCfoFilters();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("cfo-ai-analyst", {
        body: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          filters: aiFilters,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply = data?.reply ?? "Nessuna risposta dall'analista.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore imprevisto";
      toast.error(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[min(70vh,640px)] border rounded-lg bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="h-8 w-8 mx-auto text-primary/60" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Chiedi all&apos;Analista CFO dati su premi, provvigioni, clienti e trend.
              Le risposte usano solo RPC predefinite — nessun SQL libero.
            </p>
            <FiltersTransparency />
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <Card className={`max-w-[85%] ${m.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
              <CardContent className="p-3 text-sm whitespace-pre-wrap">{m.content}</CardContent>
            </Card>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisi in corso...
          </div>
        )}

        {messages.some((m) => m.role === "assistant") && !loading && (
          <FiltersTransparency />
        )}

        <div ref={scrollRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <Badge
              key={s}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 font-normal"
              onClick={() => send(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Es. Qual è il margine netto nel periodo?"
            className="min-h-[44px] max-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
