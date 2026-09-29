import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download, Eye, FileText, Trash2, Upload, User, X, Shield,
  FolderOpen, Building2, Layers, FileStack, Info,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";
import UploadDocClienteDialog from "@/components/cliente/UploadDocClienteDialog";
import DocPreviewDialog from "@/components/cliente/DocPreviewDialog";
import { toast } from "sonner";
import { classifyDoc, TIPI_DOC_LIST, type TipoDocMeta } from "@/lib/clienteDocumentiTypes";

interface PolizzaInfo {
  id: string;
  numero: string;
  compagnia: string;
  ramo: string;
  stato: string | null;
  data_scadenza: string | null;
  source: "titolo" | "cga";
}

interface EnrichedDoc {
  raw: any;
  tipo: TipoDocMeta;
  polizza?: PolizzaInfo;
}

const ClienteDocumenti = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<EnrichedDoc[]>([]);
  const [polizze, setPolizze] = useState<PolizzaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [deleteDoc, setDeleteDoc] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroPolizza, setFiltroPolizza] = useState("");
  const [tab, setTab] = useState<string>(() => localStorage.getItem("cl-doc-tab") || "polizza");

  useEffect(() => { localStorage.setItem("cl-doc-tab", tab); }, [tab]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: ids } = await supabase.rpc("get_my_cliente_ids");
    const myIds: string[] = (ids ?? []) as any;
    if (!myIds.length) { setClienteId(null); setDocs([]); setPolizze([]); setLoading(false); return; }
    setClienteId(myIds[0]);

    // 1. Titoli del cliente
    const { data: titoli } = await supabase
      .from("titoli")
      .select("id, numero_polizza, prodotto_nome, stato, data_scadenza, compagnia_id, ramo_id")
      .in("cliente_id", myIds);

    const titoliIds = (titoli ?? []).map((t: any) => t.id);

    // 2. Polizza CGA del cliente
    const { data: cgaList } = await supabase
      .from("polizza_cga")
      .select("id, titolo_id, numero_polizza, contraente_ragione_sociale, data_scadenza, stato, documento_id")
      .in("cliente_id", myIds);

    const compIds = Array.from(new Set((titoli ?? []).map((t: any) => t.compagnia_id).filter(Boolean)));
    const ramoIds = Array.from(new Set((titoli ?? []).map((t: any) => t.ramo_id).filter(Boolean)));

    const [{ data: comps }, { data: rami }] = await Promise.all([
      compIds.length
        ? supabase.from("compagnie").select("id, nome").in("id", compIds)
        : Promise.resolve({ data: [] as any[] }),
      ramoIds.length
        ? supabase.from("rami").select("id, nome").in("id", ramoIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const compMap = new Map((comps ?? []).map((c: any) => [c.id, c.nome]));
    const ramoMap = new Map((rami ?? []).map((r: any) => [r.id, r.nome]));

    const polizzeInfo: PolizzaInfo[] = [
      ...(titoli ?? []).map((t: any) => ({
        id: t.id,
        numero: t.numero_polizza || "—",
        compagnia: compMap.get(t.compagnia_id) || "—",
        ramo: ramoMap.get(t.ramo_id) || t.prodotto_nome || "—",
        stato: t.stato,
        data_scadenza: t.data_scadenza,
        source: "titolo" as const,
      })),
      ...(cgaList ?? []).filter((c: any) => !c.titolo_id).map((c: any) => ({
        id: c.id,
        numero: c.numero_polizza || "—",
        compagnia: c.contraente_ragione_sociale || "—",
        ramo: "CGA",
        stato: c.stato,
        data_scadenza: c.data_scadenza,
        source: "cga" as const,
      })),
    ];

    // 3. Documenti: ente + titolo + cga (via documento_id)
    const cgaDocIds = (cgaList ?? []).map((c: any) => c.documento_id).filter(Boolean);

    const [{ data: docsEnte }, { data: docsTitoli }, { data: docsCga }] = await Promise.all([
      supabase.from("documenti").select("*").eq("entita_tipo", "cliente").in("entita_id", myIds),
      titoliIds.length
        ? supabase.from("documenti").select("*").eq("entita_tipo", "titolo").in("entita_id", titoliIds)
        : Promise.resolve({ data: [] as any[] }),
      cgaDocIds.length
        ? supabase.from("documenti").select("*").in("id", cgaDocIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    // map cga doc → polizza
    const cgaDocToPolizza = new Map<string, PolizzaInfo>();
    (cgaList ?? []).forEach((c: any) => {
      if (!c.documento_id) return;
      const pol = polizzeInfo.find(p => p.source === "cga" && p.id === c.id)
        || polizzeInfo.find(p => p.source === "titolo" && p.id === c.titolo_id);
      if (pol) cgaDocToPolizza.set(c.documento_id, pol);
    });

    const titoloMap = new Map(polizzeInfo.filter(p => p.source === "titolo").map(p => [p.id, p]));

    const enrich = (raw: any, pol?: PolizzaInfo): EnrichedDoc => ({
      raw,
      tipo: classifyDoc(raw.categoria, raw.nome_file),
      polizza: pol,
    });

    const all: EnrichedDoc[] = [
      ...(docsEnte ?? []).map((d: any) => {
        // doc legato a cliente ma con categoria cga_polizza → polizza via cgaDocToPolizza
        const pol = cgaDocToPolizza.get(d.id);
        return enrich(d, pol);
      }),
      ...(docsTitoli ?? []).map((d: any) => enrich(d, titoloMap.get(d.entita_id))),
      ...(docsCga ?? []).map((d: any) => enrich(d, cgaDocToPolizza.get(d.id))),
    ];

    // dedupe (cga docs may appear in both docsEnte and docsCga)
    const seen = new Set<string>();
    const deduped = all.filter(d => {
      if (seen.has(d.raw.id)) return false;
      seen.add(d.raw.id);
      return true;
    });

    deduped.sort((a, b) => (b.raw.created_at || "").localeCompare(a.raw.created_at || ""));

    setDocs(deduped);
    setPolizze(polizzeInfo);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const tipiOptions = useMemo(() => {
    const present = new Set(docs.map(d => d.tipo.key));
    return [
      { value: "", label: "Tutti i tipi" },
      ...TIPI_DOC_LIST.filter(t => present.has(t.key)).map(t => ({ value: t.key, label: t.label })),
    ];
  }, [docs]);

  const polizzeOptions = useMemo(() => {
    const used = new Set(docs.filter(d => d.polizza).map(d => d.polizza!.id));
    return [
      { value: "", label: "Tutte le polizze" },
      ...polizze.filter(p => used.has(p.id)).map(p => ({
        value: p.id,
        label: `${p.numero} — ${p.compagnia}`,
      })),
    ];
  }, [docs, polizze]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return docs.filter(d => {
      if (filtroTipo && d.tipo.key !== filtroTipo) return false;
      if (filtroPolizza && d.polizza?.id !== filtroPolizza) return false;
      if (q) {
        const hay = `${d.raw.nome_file ?? ""} ${d.raw.categoria ?? ""} ${d.polizza?.numero ?? ""} ${d.polizza?.compagnia ?? ""} ${d.tipo.label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, filtroTipo, filtroPolizza, search]);

  const perPolizza = useMemo(() => {
    const map = new Map<string, { polizza: PolizzaInfo; docs: EnrichedDoc[] }>();
    filtered.filter(d => d.polizza).forEach(d => {
      const k = d.polizza!.id;
      if (!map.has(k)) map.set(k, { polizza: d.polizza!, docs: [] });
      map.get(k)!.docs.push(d);
    });
    return Array.from(map.values()).sort((a, b) => a.polizza.numero.localeCompare(b.polizza.numero));
  }, [filtered]);

  const docsEnteOnly = useMemo(() => filtered.filter(d => !d.polizza), [filtered]);

  const stats = useMemo(() => ({
    totale: docs.length,
    polizzeCount: new Set(docs.filter(d => d.polizza).map(d => d.polizza!.id)).size,
    cga: docs.filter(d => d.tipo.key === "condizioni").length,
    miei: docs.filter(d => d.raw.caricato_da_cliente).length,
  }), [docs]);

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.path_storage, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    try {
      const { error: sErr } = await supabase.storage.from(deleteDoc.bucket_name).remove([deleteDoc.path_storage]);
      if (sErr) throw sErr;
      const { error: dErr } = await supabase.from("documenti").delete().eq("id", deleteDoc.id);
      if (dErr) throw dErr;
      toast.success("Documento eliminato");
      setDeleteDoc(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore eliminazione");
    }
  };

  const filtriAttivi = search || filtroTipo || filtroPolizza;

  return (
    <TooltipProvider delayDuration={200}>
    <div data-tour="cl-doc-page" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Documentazione Ente</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tutta la documentazione assicurativa dell'ente, organizzata per polizza e per tipologia.
          </p>
        </div>
        {clienteId && (
          <Button data-tour="cl-doc-upload" onClick={() => setUploadOpen(true)} className="bg-teal-700 hover:bg-teal-800 gap-1.5">
            <Upload className="h-4 w-4" /> Carica documento
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div data-tour="cl-doc-kpi" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileStack} label="Documenti totali" value={stats.totale} hint="Numero complessivo di documenti accessibili al tuo ente (ente + polizze + CGA)." />
        <KpiCard icon={Shield} label="Polizze documentate" value={stats.polizzeCount} hint="Polizze che hanno almeno un documento associato (contratto, quietanza, CGA, appendice…)." />
        <KpiCard icon={Layers} label="Condizioni / CGA" value={stats.cga} hint="Set di Condizioni Generali (CGA) caricati e analizzati: alimentano l'Assistente AI." />
        <KpiCard icon={User} label="Caricati da te" value={stats.miei} hint="Documenti che hai caricato tu dal portale. Puoi eliminarli; gli altri sono read-only." />
      </div>

      {/* Toolbar */}
      <Card data-tour="cl-doc-filters">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <Input placeholder="Cerca per nome / categoria / polizza / compagnia"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <SearchableSelect options={tipiOptions} value={filtroTipo} onValueChange={setFiltroTipo} placeholder="Tipo documento" />
            </div>
            <div className="md:col-span-3">
              <SearchableSelect options={polizzeOptions} value={filtroPolizza} onValueChange={setFiltroPolizza} placeholder="Polizza" />
            </div>
            <div className="md:col-span-1 flex justify-end">
              {filtriAttivi && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFiltroTipo(""); setFiltroPolizza(""); }} className="gap-1.5">
                  <X className="h-4 w-4" /> Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger data-tour="cl-doc-tab-polizza" value="polizza" className="gap-2">
              <Shield className="h-4 w-4" /> Per Polizza
              <Badge variant="secondary" className="ml-1">{perPolizza.length}</Badge>
            </TabsTrigger>
            <TabsTrigger data-tour="cl-doc-tab-ente" value="ente" className="gap-2">
              <Building2 className="h-4 w-4" /> Ente
              <Badge variant="secondary" className="ml-1">{docsEnteOnly.length}</Badge>
            </TabsTrigger>
            <TabsTrigger data-tour="cl-doc-tab-tutti" value="tutti" className="gap-2">
              <FolderOpen className="h-4 w-4" /> Tutti
              <Badge variant="secondary" className="ml-1">{filtered.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* TAB: PER POLIZZA */}
          <TabsContent value="polizza" className="mt-4">
            {perPolizza.length === 0 ? (
              <EmptyState text="Nessun documento di polizza disponibile." />
            ) : (
              <Accordion type="multiple" defaultValue={perPolizza.slice(0, 1).map(p => p.polizza.id)} className="space-y-3">
                {perPolizza.map(({ polizza, docs: pdocs }) => {
                  const byTipo = new Map<string, EnrichedDoc[]>();
                  pdocs.forEach(d => {
                    if (!byTipo.has(d.tipo.key)) byTipo.set(d.tipo.key, []);
                    byTipo.get(d.tipo.key)!.push(d);
                  });
                  const groups = TIPI_DOC_LIST
                    .filter(t => byTipo.has(t.key))
                    .map(t => ({ tipo: t, docs: byTipo.get(t.key)! }));
                  const ultimo = pdocs[0]?.raw.created_at;
                  return (
                    <AccordionItem key={polizza.id} value={polizza.id}
                      className="border border-border rounded-lg overflow-hidden bg-card data-[state=open]:shadow-md transition-shadow">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-teal-50/40 group">
                        <div className="flex items-center gap-4 flex-1 min-w-0 text-left">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shrink-0">
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {polizza.ramo} — N° {polizza.numero}
                              </span>
                              {polizza.stato && (
                                <Badge variant="outline" className="text-[10px] uppercase border-teal-200 text-teal-700">
                                  {polizza.stato}
                                </Badge>
                              )}
                              {polizza.source === "cga" && (
                                <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">CGA</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              <span className="truncate">{polizza.compagnia}</span>
                              {polizza.data_scadenza && (
                                <span>· Scad. {format(new Date(polizza.data_scadenza), "dd/MM/yyyy")}</span>
                              )}
                            </div>
                          </div>
                          <div className="hidden md:flex items-center gap-4 shrink-0 mr-2">
                            <div className="text-right">
                              <div className="text-lg font-bold text-teal-700 leading-none">{pdocs.length}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">documenti</div>
                            </div>
                            {ultimo && (
                              <div className="text-right border-l border-border pl-4">
                                <div className="text-xs font-medium">{format(new Date(ultimo), "dd/MM/yyyy")}</div>
                                <div className="text-[10px] text-muted-foreground">ultimo aggiornamento</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1 bg-muted/20">
                        <div className="space-y-4">
                          {groups.map(({ tipo, docs: gdocs }) => (
                            <div key={tipo.key}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium ${tipo.color}`}>
                                  <tipo.Icon className="h-3.5 w-3.5" />
                                  {tipo.label}
                                </span>
                                <span className="text-[11px] text-muted-foreground">({gdocs.length})</span>
                              </div>
                              <div className="space-y-1">
                                {gdocs.map(d => (
                                  <DocRow key={d.raw.id} d={d} onPreview={() => setPreviewDoc(d.raw)} onDownload={() => handleDownload(d.raw)} onDelete={() => setDeleteDoc(d.raw)} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>

          {/* TAB: ENTE */}
          <TabsContent value="ente" className="mt-4">
            {docsEnteOnly.length === 0 ? (
              <EmptyState text="Nessun documento generale dell'ente caricato." />
            ) : (
              <Card><CardContent className="p-2 space-y-1">
                {docsEnteOnly.map(d => (
                  <DocRow key={d.raw.id} d={d} onPreview={() => setPreviewDoc(d.raw)} onDownload={() => handleDownload(d.raw)} onDelete={() => setDeleteDoc(d.raw)} />
                ))}
              </CardContent></Card>
            )}
          </TabsContent>

          {/* TAB: TUTTI */}
          <TabsContent value="tutti" className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState text="Nessun documento trovato con i filtri attuali." />
            ) : (
              <Card><CardContent className="p-2 space-y-1">
                {filtered.map(d => (
                  <DocRow key={d.raw.id} d={d} showPolizza onPreview={() => setPreviewDoc(d.raw)} onDownload={() => handleDownload(d.raw)} onDelete={() => setDeleteDoc(d.raw)} />
                ))}
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {clienteId && (
        <UploadDocClienteDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          clienteAnagraficaId={clienteId}
          fixedEntita={{ tipo: "cliente", id: clienteId }}
          onUploaded={load}
        />
      )}
      <DocPreviewDialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)} doc={previewDoc} />

      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{deleteDoc?.nome_file}</strong>. L'operazione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
};

function KpiCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number; hint?: string }) {
  return (
    <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-100">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
          <Icon className="h-5 w-5 text-teal-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-teal-900 leading-none">{value}</div>
          <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wide flex items-center gap-1">
            <span className="truncate">{label}</span>
            {hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Info" className="text-muted-foreground/70 hover:text-teal-700">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs leading-snug">{hint}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card><CardContent className="py-12 text-center">
      <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </CardContent></Card>
  );
}

function DocRow({ d, showPolizza, onPreview, onDownload, onDelete }: {
  d: EnrichedDoc; showPolizza?: boolean;
  onPreview: () => void; onDownload: () => void; onDelete: () => void;
}) {
  const Icon = d.tipo.Icon;
  const created = d.raw.created_at ? new Date(d.raw.created_at) : null;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-teal-50/50 transition-colors group">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${d.tipo.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-sm font-medium truncate">{d.raw.nome_file}</p>
          </TooltipTrigger>
          <TooltipContent>{d.raw.nome_file}</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {showPolizza && d.polizza && (
            <Badge variant="outline" className="text-[10px] gap-1 border-teal-200 text-teal-700">
              <Shield className="h-3 w-3" />
              {d.polizza.numero}
            </Badge>
          )}
          {d.raw.caricato_da_cliente && (
            <Badge className="bg-teal-100 text-teal-800 text-[10px] gap-1 hover:bg-teal-100">
              <User className="h-3 w-3" /> Caricato da te
            </Badge>
          )}
          {created && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground cursor-help">
                  {formatDistanceToNow(created, { addSuffix: true, locale: it })}
                </span>
              </TooltipTrigger>
              <TooltipContent>{format(created, "dd/MM/yyyy 'alle' HH:mm", { locale: it })}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={onPreview} title="Anteprima"><Eye className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={onDownload} title="Scarica"><Download className="h-4 w-4" /></Button>
        {d.raw.caricato_da_cliente && (
          <Button variant="ghost" size="sm" onClick={onDelete} title="Elimina" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default ClienteDocumenti;
