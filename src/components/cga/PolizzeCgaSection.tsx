import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolizzeCgaByCliente, type PolizzaCgaRow } from "@/hooks/usePolizzeCgaByCliente";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, Send, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

type Props = { clienteId: string; readOnly?: boolean };

const ESEMPI = [
  "Il furto è coperto?",
  "Qual è la franchigia RC?",
  "Cosa devo fare per aprire un sinistro?",
  "Ci sono esclusioni per danni da acqua?",
];

function StatoBadge({ stato }: { stato: string }) {
  const map: Record<string, string> = {
    approvato: "bg-green-600",
    bozza: "bg-amber-500",
    in_elaborazione: "bg-slate-500",
  };
  return <Badge className={map[stato] ?? ""}>{stato}</Badge>;
}

export default function PolizzeCgaSection({ clienteId, readOnly = false }: Props) {
  const { data: polizze = [], isLoading } = usePolizzeCgaByCliente(clienteId);
  const approvate = polizze.filter((p) => p.stato === "approvato");
  const [selId, setSelId] = useState<string>("");
  const [domanda, setDomanda] = useState("");
  const [storico, setStorico] = useState<Array<{ q: string; a: string }>>([]);
  const [loading, setLoading] = useState(false);

  const activeId = selId || approvate[0]?.id || "";

  const ask = async (q: string) => {
    const polizza_cga_id = activeId;
    if (!polizza_cga_id || !q.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chiedi-polizza-cga", {
        body: { polizza_cga_id, domanda: q },
      });
      if (error) throw error;
      setStorico((s) => [...s, { q, a: data?.risposta ?? "(nessuna risposta)" }]);
      setDomanda("");
    } catch (e: any) {
      toast.error("Errore: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Polizze Analizzate (CGA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Caricamento…</div>
        ) : polizze.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            Nessuna polizza analizzata. {!readOnly && "Usa il pulsante \"Analizza Polizza CGA\" per iniziare."}
          </div>
        ) : (
          <TableScrollArea>
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">Prodotto</th>
                <th>Compagnia</th>
                <th>Edizione</th>
                <th>Data</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {polizze.map((p: PolizzaCgaRow) => (
                <tr key={p.id} className="border-b odd:bg-muted/20">
                  <td className="py-2">{p.prodotto?.nome_prodotto ?? "—"}</td>
                  <td>{p.prodotto?.compagnia ?? "—"}</td>
                  <td>{p.prodotto?.edizione ?? "—"}</td>
                  <td>{new Date(p.created_at).toLocaleDateString("it-IT")}</td>
                  <td><StatoBadge stato={p.stato} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableScrollArea>
        )}

        {!readOnly && approvate.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Chiedi alla Polizza</span>
            </div>

            {approvate.length > 1 && (
              <Select value={activeId} onValueChange={setSelId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Scegli polizza" /></SelectTrigger>
                <SelectContent>
                  {approvate.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prodotto?.nome_prodotto} {p.prodotto?.compagnia ? `· ${p.prodotto.compagnia}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-wrap gap-1">
              {ESEMPI.map((e) => (
                <Button key={e} variant="outline" size="sm" className="h-7 text-xs" onClick={() => ask(e)} disabled={loading || !activeId}>
                  {e}
                </Button>
              ))}
            </div>

            <ScrollArea className="max-h-72 border rounded-md p-3 bg-muted/20">
              {storico.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nessuna domanda ancora. Prova un esempio o scrivi sotto.</div>
              ) : (
                <div className="space-y-3">
                  {storico.map((m, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-xs font-medium text-primary">D: {m.q}</div>
                      <div className="text-sm whitespace-pre-wrap">{m.a}</div>
                    </div>
                  ))}
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                placeholder="Scrivi una domanda…"
                value={domanda}
                onChange={(e) => setDomanda(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) ask(domanda); }}
                disabled={loading || !activeId}
              />
              <Button onClick={() => ask(domanda)} disabled={loading || !domanda.trim() || !activeId}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
