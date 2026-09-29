import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { ArrowLeft, FileCode, Send, Copy, Download, Clock } from "lucide-react";
import { format } from "date-fns";
import TimelineTab from "@/components/TimelineTab";

const statoBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  bozza: "secondary",
  pronto: "outline",
  inviato: "default",
  errore: "destructive",
};

const FlussoCompagniaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: flusso, isLoading } = useQuery({
    queryKey: ["flussi_compagnia", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flussi_compagnia")
        .select("*, agenzie(nome), uffici(nome_ufficio), profiles(nome, cognome)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const generatePayloadMutation = useMutation({
    mutationFn: async () => {
      if (!flusso) throw new Error("Flusso non trovato");
      const [anno, mese] = flusso.periodo.split("-");
      const dataInizio = `${anno}-${mese}-01`;
      const nextMonth = parseInt(mese) === 12 ? `${parseInt(anno) + 1}-01-01` : `${anno}-${String(parseInt(mese) + 1).padStart(2, "0")}-01`;

      const { data: movimenti } = await supabase
        .from("movimenti_contabili")
        .select("*")
        .eq("ufficio_id", flusso.ufficio_id)
        .gte("data_movimento", dataInizio)
        .lt("data_movimento", nextMonth);

      const { data: titoli } = await supabase
        .from("titoli")
        .select("*, prodotti(nome_prodotto, compagnia_id)")
        .eq("ufficio_id", flusso.ufficio_id)
        .eq("stato", "incassato")
        .gte("data_incasso", dataInizio)
        .lt("data_incasso", nextMonth);

      const titoliCompagnia = (titoli || []).filter((t: any) => t.prodotti?.compagnia_id === flusso.compagnia_id);

      let payload: string;
      if (flusso.formato === "xml") {
        payload = generateXML(flusso, movimenti || [], titoliCompagnia);
      } else {
        payload = JSON.stringify({
          flusso_id: flusso.id,
          compagnia: flusso.compagnie?.nome,
          periodo: flusso.periodo,
          tipo: flusso.tipo_flusso,
          movimenti: movimenti || [],
          titoli_incassati: titoliCompagnia,
          totale_movimenti_entrata: (movimenti || []).filter((m: any) => m.tipo === "entrata").reduce((s: number, m: any) => s + Number(m.importo), 0),
          totale_movimenti_uscita: (movimenti || []).filter((m: any) => m.tipo === "uscita").reduce((s: number, m: any) => s + Number(m.importo), 0),
          totale_premi_incassati: titoliCompagnia.reduce((s: number, t: any) => s + Number(t.importo_incassato || 0), 0),
          generato_il: new Date().toISOString(),
        }, null, 2);
      }

      const { error } = await supabase
        .from("flussi_compagnia")
        .update({ payload_output: payload, stato: "pronto" })
        .eq("id", id!);
      if (error) throw error;
      return payload;
    },
    onSuccess: async () => {
      await logAttivita({ azione: "generazione_payload", entita_tipo: "flussi_compagnia", entita_id: id! });
      queryClient.invalidateQueries({ queryKey: ["flussi_compagnia", id] });
      toast.success("Payload generato", { description: "Il flusso è ora pronto per l'invio" });
    },
    onError: () => toast.error("Errore", { description: "Impossibile generare il payload" }),
  });

  const markSentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("flussi_compagnia")
        .update({ stato: "inviato" })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await logAttivita({ azione: "invio_flusso", entita_tipo: "flussi_compagnia", entita_id: id! });
      queryClient.invalidateQueries({ queryKey: ["flussi_compagnia", id] });
      toast.success("Flusso segnato come inviato");
    },
  });

  const markErrorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("flussi_compagnia")
        .update({ stato: "errore" })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await logAttivita({ azione: "errore_flusso", entita_tipo: "flussi_compagnia", entita_id: id!, severity: "critical" });
      queryClient.invalidateQueries({ queryKey: ["flussi_compagnia", id] });
      toast.error("Flusso segnato come errore");
    },
  });

  const copyPayload = () => {
    if (flusso?.payload_output) {
      navigator.clipboard.writeText(flusso.payload_output);
      toast.success("Payload copiato negli appunti");
    }
  };

  const downloadPayload = () => {
    if (!flusso?.payload_output) return;
    const ext = flusso.formato === "xml" ? "xml" : "json";
    const blob = new Blob([flusso.payload_output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flusso_${flusso.periodo}_${flusso.compagnie?.nome || "agenzia"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Caricamento...</div>;
  if (!flusso) return <div className="p-8 text-center text-muted-foreground">Flusso non trovato</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/flussi-agenzie")}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            Flusso {flusso.tipo_flusso?.replace("_", " ")} — {flusso.compagnie?.nome}
          </h1>
          <p className="text-muted-foreground">
            Periodo: {flusso.periodo} · Ufficio: {flusso.uffici?.nome_ufficio} · Formato: {flusso.formato?.toUpperCase()}
          </p>
        </div>
        <Badge variant={statoBadge[flusso.stato] || "secondary"} className="capitalize text-sm px-3 py-1">{flusso.stato}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Agenzia</p>
          <p className="text-lg font-semibold">{flusso.compagnie?.nome || "-"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Creato da</p>
          <p className="text-lg font-semibold">{flusso.profiles ? `${flusso.profiles.nome || ""} ${flusso.profiles.cognome || ""}`.trim() : "-"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Creato il</p>
          <p className="text-lg font-semibold">{format(new Date(flusso.created_at), "dd/MM/yyyy HH:mm")}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          {flusso.stato === "bozza" && (
            <Button onClick={() => generatePayloadMutation.mutate()} disabled={generatePayloadMutation.isPending}>
              <FileCode className="w-4 h-4 mr-2" />
              {generatePayloadMutation.isPending ? "Generazione..." : `Genera ${flusso.formato === "xml" ? "XML" : "JSON"}`}
            </Button>
          )}
          {flusso.stato === "pronto" && (
            <>
              <Button onClick={() => markSentMutation.mutate()}>
                <Send className="w-4 h-4 mr-2" />Segna come Inviato
              </Button>
              <Button variant="destructive" onClick={() => markErrorMutation.mutate()}>
                Segna Errore
              </Button>
            </>
          )}
          {flusso.payload_output && (
            <>
              <Button variant="outline" onClick={copyPayload}><Copy className="w-4 h-4 mr-2" />Copia Payload</Button>
              <Button variant="outline" onClick={downloadPayload}><Download className="w-4 h-4 mr-2" />Scarica File</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="payload">
        <TabsList>
          <TabsTrigger value="payload"><FileCode className="w-4 h-4 mr-1" />Payload</TabsTrigger>
          <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Log Attività</TabsTrigger>
        </TabsList>
        <TabsContent value="payload">
          <Card>
            <CardContent className="pt-6">
              {flusso.payload_output ? (
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono whitespace-pre-wrap">
                  {flusso.payload_output}
                </pre>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Nessun payload generato. Clicca "Genera" per creare il contenuto.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeline">
          <Card>
            <CardContent className="pt-6">
              <TimelineTab entitaTipo="flussi_compagnia" entitaId={id!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(flusso.api_endpoint || flusso.api_response) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Info API (predisposizione)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {flusso.api_endpoint && <div><span className="text-muted-foreground">Endpoint:</span> {flusso.api_endpoint}</div>}
            {flusso.api_response && <div><span className="text-muted-foreground">Response:</span> <pre className="text-xs bg-muted p-2 rounded mt-1">{flusso.api_response}</pre></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function generateXML(flusso: any, movimenti: any[], titoli: any[]): string {
  const totEntrate = movimenti.filter(m => m.tipo === "entrata").reduce((s, m) => s + Number(m.importo), 0);
  const totUscite = movimenti.filter(m => m.tipo === "uscita").reduce((s, m) => s + Number(m.importo), 0);
  const totPremi = titoli.reduce((s, t) => s + Number(t.importo_incassato || 0), 0);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<FlussoCompagnia>\n`;
  xml += `  <Intestazione>\n`;
  xml += `    <Compagnia>${flusso.compagnie?.nome || ""}</Compagnia>\n`;
  xml += `    <Periodo>${flusso.periodo}</Periodo>\n`;
  xml += `    <Tipo>${flusso.tipo_flusso}</Tipo>\n`;
  xml += `    <GeneratoIl>${new Date().toISOString()}</GeneratoIl>\n`;
  xml += `  </Intestazione>\n`;
  xml += `  <Riepilogo>\n`;
  xml += `    <TotaleEntrate>${totEntrate.toFixed(2)}</TotaleEntrate>\n`;
  xml += `    <TotaleUscite>${totUscite.toFixed(2)}</TotaleUscite>\n`;
  xml += `    <TotalePremiIncassati>${totPremi.toFixed(2)}</TotalePremiIncassati>\n`;
  xml += `  </Riepilogo>\n`;
  xml += `  <Movimenti>\n`;
  movimenti.forEach(m => {
    xml += `    <Movimento>\n`;
    xml += `      <Data>${m.data_movimento}</Data>\n`;
    xml += `      <Tipo>${m.tipo}</Tipo>\n`;
    xml += `      <Importo>${Number(m.importo).toFixed(2)}</Importo>\n`;
    xml += `      <Descrizione>${escapeXml(m.descrizione || "")}</Descrizione>\n`;
    xml += `    </Movimento>\n`;
  });
  xml += `  </Movimenti>\n`;
  xml += `  <TitoliIncassati>\n`;
  titoli.forEach(t => {
    xml += `    <Titolo>\n`;
    xml += `      <NumeroTitolo>${escapeXml(t.numero_titolo || "")}</NumeroTitolo>\n`;
    xml += `      <PremioLordo>${Number(t.premio_lordo || 0).toFixed(2)}</PremioLordo>\n`;
    xml += `      <ImportoIncassato>${Number(t.importo_incassato || 0).toFixed(2)}</ImportoIncassato>\n`;
    xml += `      <DataIncasso>${t.data_incasso || ""}</DataIncasso>\n`;
    xml += `    </Titolo>\n`;
  });
  xml += `  </TitoliIncassati>\n`;
  xml += `</FlussoCompagnia>`;
  return xml;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export default FlussoCompagniaDetail;
