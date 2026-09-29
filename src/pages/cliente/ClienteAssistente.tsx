import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, BookOpen, FileSearch } from "lucide-react";
import { toast } from "sonner";
import InfoHint from "@/components/cliente/InfoHint";
import { hasSeenAIAssistant, markAIAssistantSeen } from "@/components/tour/AppTourContext";

type Msg = { role: "user" | "assistant"; content: string };

const ESEMPI = [
  "Ho un sinistro: è coperto? Quali massimali ho?",
  "Quali franchigie ho su RC?",
  "Cosa devo fare per aprire un sinistro?",
  "Quali esclusioni importanti ho sulle mie polizze?",
  "Riepiloga scadenze e premi delle mie polizze attive",
  "Ho copertura per danni informatici / cyber?",
];

export default function ClienteAssistente() {
  const [domanda, setDomanda] = useState("");
  const [messaggi, setMessaggi] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ polizze_amministrative: number; polizze_con_cga: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi, loading]);

  // Prima visita: rimuove solo il badge "NUOVO" dalla sidebar (nessun tour auto).
  useEffect(() => {
    if (hasSeenAIAssistant()) return;
    markAIAssistantSeen();
    window.dispatchEvent(new Event("cbnet:ai-seen"));
  }, []);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    const storico = messaggi.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessaggi((prev) => [...prev, { role: "user", content: q }]);
    setDomanda("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chiedi-mie-polizze", {
        body: { domanda: q, storico },
      });
      if (error) throw error;
      if (data?.stats) setStats(data.stats);
      setMessaggi((prev) => [...prev, { role: "assistant", content: data?.risposta ?? "(nessuna risposta)" }]);
    } catch (e: any) {
      toast.error("Errore: " + (e.message ?? "imprevisto"));
      setMessaggi((prev) => [...prev, { role: "assistant", content: "⚠️ Errore nella richiesta. Riprova tra poco." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-tour="cl-assist-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Assistente Polizze
        </h1>
        {stats && (
          <div className="flex gap-2 items-center text-xs" data-tour="cl-assist-stats">
            <Badge variant="secondary" className="gap-1">
              <FileSearch className="h-3 w-3" /> {stats.polizze_amministrative} polizze
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" /> {stats.polizze_con_cga} con CGA
            </Badge>
            <InfoHint text="L'AI consulta in tempo reale i dati amministrativi di tutte le tue polizze + le Condizioni Generali (CGA) approvate. Ogni risposta cita la polizza di origine." />
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            Chiedi qualsiasi cosa sulle tue polizze. L'assistente cita sempre la polizza di origine.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messaggi.length === 0 && (
            <div className="space-y-2" data-tour="cl-assist-suggerimenti">
              <p className="text-xs text-muted-foreground">Prova un esempio:</p>
              <div className="flex flex-wrap gap-2">
                {ESEMPI.map((e) => (
                  <Button key={e} variant="outline" size="sm" className="h-8 text-xs" onClick={() => ask(e)} disabled={loading}>
                    {e}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <ScrollArea className="h-[calc(100vh-22rem)] min-h-[300px] border rounded-md p-3 bg-muted/20">
            {messaggi.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-12">
                Nessuna conversazione ancora. Scrivi una domanda qui sotto o clicca un esempio.
              </p>
            ) : (
              <div className="space-y-4">
                {messaggi.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm"
                          : "bg-card border rounded-2xl rounded-bl-sm px-4 py-2 max-w-[90%] text-sm whitespace-pre-wrap"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              placeholder="Scrivi la tua domanda…"
              value={domanda}
              onChange={(e) => setDomanda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(domanda);
                }
              }}
              disabled={loading}
            />
            <Button onClick={() => ask(domanda)} disabled={loading || !domanda.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Le risposte si basano sui dati delle tue polizze caricate nel sistema. Per casi complessi contatta il tuo intermediario.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
