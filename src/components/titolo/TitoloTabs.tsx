import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Percent, Clock, List, Users, ShieldCheck, StickyNote, Pencil, Eye, Download, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { fmtEuro } from "@/lib/formatCurrency";
import type { AppendicePolizzaRow } from "@/lib/appendiciPolizza";

interface TitoloTabsProps {
  id: string;
  t: any;
  movimentiPolizza: any[];
  provvigioni: any[];
  appendiciPolizza: AppendicePolizzaRow[];
  navigate: (path: string) => void;
  /** Id della catena (madre + tutte le quietanze) per condividere documenti su tutta la polizza. */
  chainIds?: string[];
  /** Layout ridotto su dettaglio appendice AM/PR/RG. */
  variant?: "full" | "appendice";
}

/**
 * Estratto da TitoloDetail.tsx (lines 3143-3280) per ridurre la complessità del file principale.
 * Comportamento e markup identici all'originale.
 */
export const TitoloTabs = ({ id, t, movimentiPolizza, provvigioni, appendiciPolizza, navigate, chainIds, variant = "full" }: TitoloTabsProps) => {

  const isAppendiceView = variant === "appendice";
  const madreId = chainIds?.[0] ?? id;
  const isMadreView = !isAppendiceView && id === madreId;

  /** Appendici: visibili sulla polizza madre (intera catena); sulla quietanza solo quelle agganciate alla rata. */
  const appendiciVisibili = useMemo(() => {
    if (isMadreView) return appendiciPolizza;
    return appendiciPolizza.filter(
      (a) =>
        a.titolo_id === id ||
        a.quietanza_id === id ||
        a.titolo_regolazione_id === id ||
        a.titolo_proroga_id === id ||
        a.titolo_modifica_id === id,
    );
  }, [appendiciPolizza, id, isMadreView]);

  // Lazy mount: ogni tab si monta solo la prima volta che viene aperto, poi resta in cache.
  const [tab, setTab] = useState<string>(isAppendiceView ? "provvigioni" : "movimenti");
  const [mounted, setMounted] = useState<Record<string, boolean>>(
    isAppendiceView ? { provvigioni: true } : { movimenti: true },
  );
  const open = (v: string) => {
    setTab(v);
    setMounted((m) => (m[v] ? m : { ...m, [v]: true }));
  };
  return (
    <Tabs value={tab} onValueChange={open}>
      <TabsList className="flex-wrap h-auto">

        {!isAppendiceView && (
          <TabsTrigger value="movimenti"><List className="w-4 h-4 mr-1" />Movimenti ({movimentiPolizza.length})</TabsTrigger>
        )}
        <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
        {!isAppendiceView && (
          <TabsTrigger value="appendici"><FileText className="w-4 h-4 mr-1" />Appendici ({appendiciVisibili.length})</TabsTrigger>
        )}
        {!isAppendiceView && (
          <TabsTrigger value="garanzie"><ShieldCheck className="w-4 h-4 mr-1" />Garanzie</TabsTrigger>
        )}
        {/* Voci RCA spostate dentro la sezione Importi */}
        {!isAppendiceView && (
          <TabsTrigger value="familiari"><Users className="w-4 h-4 mr-1" />Familiari</TabsTrigger>
        )}
        {!isAppendiceView && (
          <TabsTrigger value="note"><StickyNote className="w-4 h-4 mr-1" />Note</TabsTrigger>
        )}
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Log Attività</TabsTrigger>
      </TabsList>

      <TabsContent value="movimenti">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            I movimenti sono visualizzati nella sezione sopra. Questa tab potrà contenere funzionalità di gestione avanzata (aggiunta rinnovi, appendici, storni).
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="provvigioni">
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead>Percentuale</TableHead>
                  <TableHead>Importo €</TableHead>
                  <TableHead>Calcolata il</TableHead>
                  <TableHead>Pagata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provvigioni.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—"}</TableCell>
                    <TableCell className="font-mono">{p.percentuale}%</TableCell>
                    <TableCell className="font-mono">{fmtEuro(p.importo_provvigione)}</TableCell>
                    <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}</TableCell>
                    <TableCell><Badge variant={p.pagata ? "default" : "secondary"}>{p.pagata ? "Sì" : "No"}</Badge></TableCell>
                  </TableRow>
                ))}
                {provvigioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna provvigione generata</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="appendici">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Appendici registrate per questa polizza</p>
              <Button size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
                <FileText className="w-4 h-4 mr-1" /> Nuova Appendice
              </Button>
            </div>
            {appendiciVisibili.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna appendice registrata.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">N°</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Effetto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="w-28">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(appendiciVisibili as any[]).map((a: any) => (
                    <AppendiceTableRow key={a.id} a={a} t={t} navigate={navigate} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="garanzie">
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Garanzie — in fase di sviluppo. Qui verranno mostrate le coperture e garanzie della polizza.</CardContent></Card>
      </TabsContent>
      {/* Voci RCA: integrate dentro la sezione Importi sopra */}
      <TabsContent value="familiari">
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Familiari — in fase di sviluppo. Qui verranno mostrati assicurati e beneficiari collegati alla polizza.</CardContent></Card>
      </TabsContent>
      <TabsContent value="note">
        <Card><CardContent className="pt-6"><p className="text-sm whitespace-pre-wrap">{t.note || "Nessuna nota."}</p></CardContent></Card>
      </TabsContent>
      <TabsContent value="chat">
        <Card><CardContent className="pt-6">{mounted.chat ? <ChatTab entitaTipo="titolo" entitaId={id} /> : null}</CardContent></Card>
      </TabsContent>
      <TabsContent value="timeline">
        <Card><CardContent className="pt-6">{mounted.timeline ? <TimelineTab entitaTipo="titolo" entitaId={id} /> : null}</CardContent></Card>
      </TabsContent>
    </Tabs>
  );
};

function isPdf(name?: string | null) {
  return !!name && /\.pdf$/i.test(name);
}
function isImage(name?: string | null) {
  return !!name && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function AppendiceTableRow({ a, t, navigate }: { a: any; t: any; navigate: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (open && a.file_path && !url) {
      setLoading(true);
      supabase.storage.from("documenti_titoli").createSignedUrl(a.file_path, 60 * 10).then(({ data }) => {
        if (!cancelled) {
          setUrl(data?.signedUrl || null);
          setLoading(false);
        }
      });
    }
    return () => { cancelled = true; };
  }, [open, a.file_path, url]);

  const hasFile = !!a.file_path;
  const kind = isImage(a.nome_file) ? "image" : isPdf(a.nome_file) ? "pdf" : "other";

  return (
    <>
      <TableRow>
        <TableCell className="font-mono font-bold">
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:underline"
            disabled={!hasFile}
            onClick={() => setOpen((v) => !v)}
            title={hasFile ? "Mostra/nascondi anteprima" : "Nessun allegato"}
          >
            {hasFile ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
            {a.numero_appendice}
          </button>
        </TableCell>
        <TableCell className="text-sm">{a.data_appendice ? format(new Date(a.data_appendice), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
        <TableCell className="text-sm">{a.data_effetto ? format(new Date(a.data_effetto), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
        <TableCell><Badge variant="outline" className="capitalize">{a.tipo}</Badge></TableCell>
        <TableCell className="max-w-[200px] truncate text-sm">{a.oggetto || "—"}</TableCell>
        <TableCell className="text-sm">{a.nome_file || "—"}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifica" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}&appendiceId=${a.id}`)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            {hasFile && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" title={open ? "Nascondi anteprima" : "Mostra anteprima"} onClick={() => setOpen((v) => !v)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Download" onClick={async () => {
                  const { data, error } = await supabase.storage.from("documenti_titoli").download(a.file_path);
                  if (error || !data) return;
                  const u = URL.createObjectURL(data);
                  const link = document.createElement("a");
                  link.href = u; link.download = a.nome_file || "file"; link.click();
                  URL.revokeObjectURL(u);
                }}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
      {open && hasFile && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Caricamento anteprima…
              </div>
            )}
            {!loading && url && kind === "image" && (
              <img src={url} alt={a.nome_file || "allegato"} className="max-h-72 mx-auto rounded" />
            )}
            {!loading && url && kind === "pdf" && (
              <iframe src={url} title={a.nome_file || "allegato"} className="w-full h-[480px] rounded border-0" />
            )}
            {!loading && url && kind === "other" && (
              <p className="text-sm text-muted-foreground py-3">
                Anteprima non disponibile per questo tipo di file. Usa il pulsante Download.
              </p>
            )}
            {!loading && !url && (
              <p className="text-sm text-destructive py-3">Impossibile generare l'anteprima.</p>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
