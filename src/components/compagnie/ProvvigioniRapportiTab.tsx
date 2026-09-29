import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Percent, Copy, ClipboardPaste, Upload, Sparkles, Plus, Download, Save,
  Search, ChevronLeft, ChevronRight, ChevronsUpDown,
  AlertCircle, FileText, Loader2, ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_DOCUMENT_UPLOAD_BYTES, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { garanzieDelRamo, rowKeyProvv } from "@/lib/provvigioniRamoTree";
import ProvvigioniRamoTree from "./ProvvigioniRamoTree";

const LS_KEY = "provv-rapporti-ui-v2";


type Props = {
  /** Se valorizzato, il componente si "blocca" su un singolo rapporto:
   *  nasconde l'elenco rapporti, il selettore prev/next e non persiste su localStorage. */
  fixedRapportoId?: string;
};

export default function ProvvigioniRapportiTab({ fixedRapportoId }: Props = {}) {
  const qc = useQueryClient();
  const isFixed = !!fixedRapportoId;
  // Stato UI (con persistenza localStorage solo in modalità globale)
  const persisted = useMemo(() => {
    if (isFixed) return {} as any;
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
  }, [isFixed]);
  const [rapportoIdState, setRapportoIdState] = useState<string>(persisted.rapportoId || "");
  const rapportoId = isFixed ? (fixedRapportoId as string) : rapportoIdState;
  const setRapportoId = (v: string) => { if (!isFixed) setRapportoIdState(v); };
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [search, setSearch] = useState<string>("");
  const [addRamoId, setAddRamoId] = useState("");
  const [expandedGruppi, setExpandedGruppi] = useState<Set<string>>(() => {
    const raw = persisted.expandedGruppi ?? persisted.expanded;
    if (Array.isArray(raw)) return new Set(raw as string[]);
    if (raw && typeof raw === "object") {
      return new Set(
        Object.entries(raw as Record<string, boolean>)
          .filter(([, v]) => v)
          .map(([k]) => k)
      );
    }
    return new Set();
  });

  useEffect(() => {
    if (isFixed) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        rapportoId,
        expandedGruppi: Array.from(expandedGruppi),
      }));
    } catch {}
  }, [isFixed, rapportoId, expandedGruppi]);

  useEffect(() => {
    setAddRamoId("");
  }, [rapportoId]);


  // Rapporti elenco
  const { data: rapporti = [] } = useQuery({
    queryKey: ["all-compagnia-rapporti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporti")
        .select("id, nome_rapporto, tipo_rapporto, attivo, compagnia_id, gruppo_compagnia_id, compagnie(nome), gruppi_compagnia(descrizione)")
        .eq("attivo", true)
        .order("nome_rapporto");
      if (error) throw error;
      return data || [];
    },
  });

  const rapportoOptions = useMemo(
    () =>
      rapporti.map((r: any) => ({
        value: r.id,
        label: `${r.gruppi_compagnia?.descrizione || "?"} — ${r.nome_rapporto}${r.compagnie?.nome ? ` (${r.compagnie.nome})` : ""} · ${r.tipo_rapporto || "—"}`,
      })),
    [rapporti]
  );

  // Aggregato: conteggio righe provvigione attive per rapporto (per pannello "Elenco rapporti")
  const { data: provvCountByRapporto = {} } = useQuery({
    queryKey: ["provv-count-by-rapporto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("compagnia_rapporto_id")
        .eq("attiva", true);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        if (!r.compagnia_rapporto_id) return;
        m[r.compagnia_rapporto_id] = (m[r.compagnia_rapporto_id] || 0) + 1;
      });
      return m;
    },
  });

  const rapportoSelected = rapporti.find((r: any) => r.id === rapportoId) as any;

  // Gruppi ramo + rami (sottorami)
  const { data: gruppiRamo = [] } = useQuery({
    queryKey: ["gruppi-ramo-all"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return data || [];
    },
  });
  const { data: rami = [] } = useQuery({
    queryKey: ["rami-all"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione, gruppo_ramo_id").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  // Rami abilitati per il rapporto selezionato (compagnia_rapporto_rami)
  const { data: ramiAbilitati = [] } = useQuery({
    queryKey: ["rapporto-rami-abilitati", rapportoId],
    enabled: !!rapportoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .select("gruppo_ramo_id, ramo_id")
        .eq("rapporto_id", rapportoId);
      if (error) throw error;
      return ((data || []) as unknown) as { gruppo_ramo_id: string; ramo_id: string | null }[];
    },
  });
  const enabledGruppoIds = useMemo(
    () => new Set<string>(ramiAbilitati.map((x) => x.gruppo_ramo_id)),
    [ramiAbilitati],
  );

  // Provvigioni del rapporto selezionato
  const { data: provvigioni = [], refetch: refetchProvv } = useQuery({
    queryKey: ["provv-rapporto", rapportoId],
    enabled: !!rapportoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("id, gruppo_ramo_id, ramo_id, percentuale_provvigione, percentuale_provvigione_accessori")
        .eq("compagnia_rapporto_id", rapportoId)
        .eq("attiva", true);
      if (error) throw error;
      return data || [];
    },
  });

  const provvMap = useMemo(() => {
    const m: Record<string, { id: string; perc: number; percAccessori: number | null }> = {};
    provvigioni.forEach((p: any) => {
      const key = rowKeyProvv(p.gruppo_ramo_id || "", p.ramo_id);
      m[key] = {
        id: p.id,
        perc: Number(p.percentuale_provvigione),
        percAccessori: p.percentuale_provvigione_accessori != null
          ? Number(p.percentuale_provvigione_accessori)
          : null,
      };
    });
    return m;
  }, [provvigioni]);

  // Default tipo rapporto
  const { data: defaultTipo = [] } = useQuery({
    queryKey: ["provv-default-tipo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("provvigioni_default_tipo" as any)
        .select("id, tipo_rapporto, gruppo_ramo_id, ramo_id, percentuale")
        .eq("attiva", true);
      return data || [];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (rows: {
      gruppo_ramo_id: string;
      ramo_id: string | null;
      percentuale: number;
      percentuale_accessori?: number | null;
      id?: string;
    }[]) => {
      if (!rapportoId) throw new Error("Seleziona un rapporto");
      if (!rows.length) return { inserted: 0, updated: 0 };

      const toUpdate = rows.filter((r) => !!r.id);
      const toInsert = rows.filter((r) => !r.id);

      const updates = await Promise.all(
        toUpdate.map((r) =>
          supabase
            .from("provvigioni_compagnia_ramo")
            .update({
              percentuale_provvigione: r.percentuale,
              percentuale_provvigione_accessori: r.percentuale_accessori ?? null,
              attiva: true,
            } as any)
            .eq("id", r.id!)
        )
      );
      const updErr = updates.find((u) => u.error)?.error;
      if (updErr) throw updErr;

      if (toInsert.length) {
        const payload = toInsert.map((r) => ({
          compagnia_rapporto_id: rapportoId,
          compagnia_id: rapportoSelected?.compagnia_id,
          gruppo_ramo_id: r.gruppo_ramo_id,
          ramo_id: r.ramo_id,
          percentuale_provvigione: r.percentuale,
          percentuale_provvigione_accessori: r.percentuale_accessori ?? null,
          attiva: true,
        }));
        const { error } = await (supabase.from("provvigioni_compagnia_ramo") as any).insert(payload);
        if (error) throw error;
      }
      return { inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: (res: any) => {
      const n = (res?.inserted || 0) + (res?.updated || 0);
      toast.success(n > 1 ? `Salvate ${n} righe` : "Salvato");
      qc.invalidateQueries({ queryKey: ["provv-rapporto", rapportoId] });
      qc.invalidateQueries({ queryKey: ["provv-count-by-rapporto"] });
    },
    onError: (e: any) => toast.error(e?.message || "Errore nel salvataggio"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").update({ attiva: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rimosso");
      qc.invalidateQueries({ queryKey: ["provv-rapporto", rapportoId] });
    },
  });

  const addRamiMutation = useMutation({
    mutationFn: async (gruppoIds: string[]) => {
      if (!rapportoId) throw new Error("Seleziona un rapporto");
      const missing = [...new Set(gruppoIds.filter((id) => id && !enabledGruppoIds.has(id)))];
      if (!missing.length) return 0;
      const { error } = await supabase.from("compagnia_rapporto_rami" as any).insert(
        missing.map((gruppo_ramo_id) => ({
          rapporto_id: rapportoId,
          gruppo_ramo_id,
          ramo_id: null,
        })),
      );
      if (error) throw error;
      return missing.length;
    },
    onSuccess: (n) => {
      if (n) toast.success(n === 1 ? "Ramo aggiunto (tutte le garanzie)" : `${n} rami aggiunti`);
      qc.invalidateQueries({ queryKey: ["rapporto-rami-abilitati", rapportoId] });
    },
    onError: (e: any) => toast.error(e?.message || "Errore nell'aggiunta del ramo"),
  });

  const removeRamoMutation = useMutation({
    mutationFn: async (gruppoId: string) => {
      if (!rapportoId) throw new Error("Seleziona un rapporto");
      const { error } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .delete()
        .eq("rapporto_id", rapportoId)
        .eq("gruppo_ramo_id", gruppoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ramo rimosso dal rapporto. Le % salvate restano (appendici e polizze le riusano).");
      qc.invalidateQueries({ queryKey: ["rapporto-rami-abilitati", rapportoId] });
    },
    onError: (e: any) => toast.error(e?.message || "Errore nella rimozione del ramo"),
  });

  const enableGruppiFromRows = (rows: { gruppo_ramo_id?: string | null }[]) => {
    const ids = [...new Set(rows.map((r) => r.gruppo_ramo_id).filter(Boolean))] as string[];
    if (ids.length) addRamiMutation.mutate(ids);
  };

  const exportCsv = () => {
    if (!rapportoSelected) return;
    const lines = ["ramo;sottoramo;percentuale"];
    gruppiRamo.forEach((gr: any) => {
      const def = provvMap[`${gr.id}|`];
      if (def) lines.push(`${gr.descrizione};;${def.perc}`);
      rami
        .filter((r: any) => r.gruppo_ramo_id === gr.id)
        .forEach((r: any) => {
          const ex = provvMap[`${gr.id}|${r.id}`];
          if (ex) lines.push(`${gr.descrizione};${r.descrizione};${ex.perc}`);
        });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `provvigioni-${rapportoSelected.nome_rapporto}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: % ereditata dal tipo rapporto per un gruppo (livello 4)
  const inheritedFromTipo = (gruppoId: string, ramoId: string | null = null) => {
    const tipo = rapportoSelected?.tipo_rapporto;
    if (!tipo) return null;
    const rows = (defaultTipo as any[]).filter((d) => d.tipo_rapporto === tipo && d.gruppo_ramo_id === gruppoId);
    const exact = ramoId ? rows.find((r) => r.ramo_id === ramoId) : null;
    const def = rows.find((r) => r.ramo_id === null);
    const hit = exact || def;
    return hit ? Number(hit.percentuale) : null;
  };

  // Lista gruppi visibili: tutti i rami abilitati, con TUTTE le garanzie di catalogo
  const gruppiVisibili = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (gruppiRamo as any[])
      .filter((gr) => enabledGruppoIds.has(gr.id))
      .map((gr) => {
        const sottorami = garanzieDelRamo(rami as any[], gr.id);
        const defaultRow = provvMap[rowKeyProvv(gr.id, null)];
        const configuredCount = sottorami.filter((s) => provvMap[rowKeyProvv(gr.id, s.id)]).length;
        return { gr, sottorami, defaultRow, configuredCount };
      })
      .filter(({ gr, sottorami }) => {
        if (!q) return true;
        const grMatch = gr.descrizione?.toLowerCase().includes(q) || gr.codice?.toLowerCase().includes(q);
        const sottoMatch = sottorami.some(
          (s: any) => s.descrizione?.toLowerCase().includes(q) || s.codice?.toLowerCase().includes(q)
        );
        return grMatch || sottoMatch;
      });
  }, [gruppiRamo, rami, enabledGruppoIds, provvMap, search]);

  const ramiNonAbilitati = useMemo(
    () => (gruppiRamo as any[]).filter((g) => !enabledGruppoIds.has(g.id)),
    [gruppiRamo, enabledGruppoIds],
  );

  const totals = useMemo(() => {
    const totSotto = gruppiVisibili.reduce((acc, g) => acc + g.sottorami.length, 0);
    const totConf = gruppiVisibili.reduce((acc, g) => acc + g.configuredCount + (g.defaultRow ? 1 : 0), 0);
    return { gruppi: gruppiVisibili.length, sottorami: totSotto, configurati: totConf };
  }, [gruppiVisibili]);

  const lastRapportoForExpand = useRef<string>("");
  useEffect(() => {
    const ids = ramiAbilitati.map((x) => x.gruppo_ramo_id);
    if (rapportoId !== lastRapportoForExpand.current) {
      lastRapportoForExpand.current = rapportoId;
      setExpandedGruppi(new Set(ids));
      return;
    }
    setExpandedGruppi((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rapportoId, ramiAbilitati]);

  const toggleGruppoExpanded = (gruppoId: string) => {
    setExpandedGruppi((prev) => {
      const next = new Set(prev);
      if (next.has(gruppoId)) next.delete(gruppoId);
      else next.add(gruppoId);
      return next;
    });
  };

  const expandAllGruppi = () => {
    setExpandedGruppi(new Set(gruppiVisibili.map(({ gr }) => gr.id)));
  };

  const collapseAllGruppi = () => {
    setExpandedGruppi(new Set());
  };

  // Navigazione rapporto prev/next
  const currentIdx = rapportoOptions.findIndex((o) => o.value === rapportoId);
  const goRapporto = (delta: number) => {
    if (!rapportoOptions.length) return;
    const next = (currentIdx + delta + rapportoOptions.length) % rapportoOptions.length;
    setRapportoId(rapportoOptions[next].value);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Catena di risoluzione (collassabile) */}
        <Accordion type="single" collapsible>
          <AccordionItem value="chain" className="border-primary/30 border rounded-md bg-primary/5 px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />Catena di risoluzione della % provvigione (5 livelli)
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5 pb-2">
                <li>Match esatto <b>Rapporto + Gruppo Ramo + Garanzia</b></li>
                <li>Default di <b>Gruppo Ramo</b> sul rapporto</li>
                <li><b>% globale del rapporto</b> (<code>compagnia_rapporti</code>)</li>
                <li>Default per <b>Tipo rapporto + Gruppo Ramo/Garanzia</b></li>
                <li>Se nessuna regola → <b>0%</b> + warning</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Elenco rapporti attivi (collassabile) — nascosto in modalità rapporto-fisso */}
        {!isFixed && (
        <Accordion type="single" collapsible>
          <AccordionItem value="elenco" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span className="flex items-center gap-2">
                <Percent className="w-4 h-4" />
                Elenco Agenzie e provvigioni attive ({rapporti.length})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Rapporto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Righe %</TableHead>
                      <TableHead className="text-right">Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rapporti.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                          Nessun rapporto attivo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (rapporti as any[]).map((r) => {
                        const count = provvCountByRapporto[r.id] || 0;
                        return (
                          <TableRow
                            key={r.id}
                            className={`cursor-pointer ${rapportoId === r.id ? "bg-primary/10" : ""}`}
                            onClick={() => setRapportoId(r.id)}
                          >
                            <TableCell className="text-sm">{r.gruppi_compagnia?.descrizione || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {r.nome_rapporto}
                              {r.compagnie?.nome ? (
                                <span className="text-muted-foreground"> · {r.compagnie.nome}</span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.tipo_rapporto || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {count > 0 ? (
                                <Badge variant="default">{count}</Badge>
                              ) : (
                                <Badge variant="secondary">0</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={rapportoId === r.id ? "default" : "outline"}
                                onClick={(e) => { e.stopPropagation(); setRapportoId(r.id); }}
                              >
                                Apri
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        )}

        {/* Toolbar sticky: selettore rapporto + azioni */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              {/* Riga 1: selettore rapporto con prev/next (nascosto in modalità fissa) */}
              {!isFixed && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rapporto Agenzia ↔ Compagnia</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!rapportoOptions.length} onClick={() => goRapporto(-1)} title="Rapporto precedente">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      options={rapportoOptions}
                      value={rapportoId}
                      onValueChange={setRapportoId}
                      placeholder="Seleziona un rapporto..."
                    />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!rapportoOptions.length} onClick={() => goRapporto(1)} title="Rapporto successivo">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              )}

              {/* Riga 2: tipo rapporto + azioni */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {rapportoSelected && (
                    <Badge variant="outline" className="h-8 px-3">
                      Tipo: {rapportoSelected.tipo_rapporto || "—"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setPasteOpen(true)}>
                    <ClipboardPaste className="w-4 h-4 mr-2" />Incolla CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setCopyOpen(true)}>
                    <Copy className="w-4 h-4 mr-2" />Copia da altro
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={() => setAiOpen(true)}>
                    <Sparkles className="w-4 h-4 mr-2" />Import IA
                  </Button>
                  <Button size="sm" variant="outline" disabled={!rapportoId} onClick={exportCsv}>
                    <Download className="w-4 h-4 mr-2" />Export
                  </Button>
                </div>
              </div>

              {/* Filtri matrice */}
              {rapportoId && (
                <div className="flex items-center gap-2 flex-wrap pt-3 border-t">
                  <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cerca Gruppo Ramo o Garanzia..."
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {totals.gruppi} Rami · {totals.sottorami} garanzie · <b>{totals.configurati}</b> configurati
                    </span>
                    <Button size="sm" variant="ghost" className="h-8" onClick={expandAllGruppi}>
                      <ChevronsUpDown className="w-3.5 h-3.5 mr-1" />Espandi tutti
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={collapseAllGruppi}>
                      Collassa tutti
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {rapportoId && (
          <Card className="overflow-hidden">
            <CardHeader className="py-3 border-b space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-sm">Matrice % Provvigioni — Ramo e garanzie</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    La % di default del ramo vale per tutte le garanzie e per le appendici.
                    Un override sulla garanzia sostituisce solo quella garanzia.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-[260px]">
                    <SearchableSelect
                      options={ramiNonAbilitati.map((g: any) => ({
                        value: g.id,
                        label: `${g.codice} - ${g.descrizione}`,
                      }))}
                      value={addRamoId}
                      onValueChange={setAddRamoId}
                      placeholder={ramiNonAbilitati.length ? "Aggiungi ramo..." : "Tutti i rami sono già in lista"}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!addRamoId || addRamiMutation.isPending}
                    onClick={() => {
                      addRamiMutation.mutate([addRamoId]);
                      setAddRamoId("");
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Aggiungi ramo
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!ramiNonAbilitati.length || addRamiMutation.isPending}
                    onClick={() => addRamiMutation.mutate(ramiNonAbilitati.map((g: any) => g.id))}
                  >
                    <ListPlus className="w-4 h-4 mr-1" />
                    Tutti i rami
                  </Button>
                </div>
              </div>
            </CardHeader>
            {ramiAbilitati.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nessun ramo in questo rapporto. Aggiungi un ramo, usa Tutti i rami, oppure Import IA / Incolla CSV / Copia da altro.
              </CardContent>
            ) : gruppiVisibili.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nessun ramo corrisponde alla ricerca.
              </CardContent>
            ) : (
              <ProvvigioniRamoTree
                gruppi={gruppiVisibili}
                expanded={expandedGruppi}
                onToggle={toggleGruppoExpanded}
                provvMap={provvMap}
                inheritedFromTipo={inheritedFromTipo}
                onSave={(rows) => upsertMutation.mutate(rows)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onRemoveRamo={(gruppoId) => removeRamoMutation.mutate(gruppoId)}
              />
            )}
          </Card>
        )}

        {pasteOpen && (
          <PasteDialog
            open={pasteOpen}
            onClose={() => setPasteOpen(false)}
            gruppiRamo={gruppiRamo}
            rami={rami}
            onConfirm={(rows) => {
              upsertMutation.mutate(rows, {
                onSuccess: () => {
                  enableGruppiFromRows(rows);
                  setPasteOpen(false);
                },
              });
            }}
          />
        )}

        {copyOpen && (
          <CopyDialog
            open={copyOpen}
            onClose={() => setCopyOpen(false)}
            rapporti={rapporti.filter((r: any) => r.id !== rapportoId)}
            onConfirm={async (sourceId) => {
              const { data } = await supabase
                .from("provvigioni_compagnia_ramo")
                .select("gruppo_ramo_id, ramo_id, percentuale_provvigione")
                .eq("compagnia_rapporto_id", sourceId)
                .eq("attiva", true);
              const rows = (data || [])
                .filter((r: any) => r.gruppo_ramo_id)
                .map((r: any) => ({
                  gruppo_ramo_id: r.gruppo_ramo_id,
                  ramo_id: r.ramo_id,
                  percentuale: Number(r.percentuale_provvigione),
                }));
              if (rows.length === 0) {
                toast.error("Il rapporto sorgente non ha righe");
                return;
              }
              upsertMutation.mutate(rows, {
                onSuccess: () => {
                  enableGruppiFromRows(rows);
                  setCopyOpen(false);
                },
              });
            }}
          />
        )}

        {aiOpen && (
          <AiImportDialog
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            gruppiRamo={gruppiRamo}
            rami={rami}
            onConfirm={(rows) => {
              upsertMutation.mutate(rows, {
                onSuccess: () => {
                  enableGruppiFromRows(rows);
                  setAiOpen(false);
                },
              });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Dialog paste CSV ──────────────────────────────────────────────────────
function PasteDialog({ open, onClose, gruppiRamo, rami, onConfirm }: any) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      setText(content);
      toast.success(`File "${file.name}" caricato`);
    } catch (e: any) {
      toast.error(e.message || "Errore lettura file");
    }
  };

  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    const allLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // skippa header se la prima riga contiene "ramo" e "perc"/"%"
    const lines = allLines.filter((l, i) => {
      if (i > 0) return true;
      const low = l.toLowerCase();
      return !(low.includes("ramo") && (low.includes("perc") || low.includes("%")));
    });
    return lines.map((line) => {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      let ramoName = "", sottoName = "", percStr = "";
      if (parts.length === 2) { sottoName = parts[0]; percStr = parts[1]; }
      else if (parts.length >= 3) { ramoName = parts[0]; sottoName = parts[1]; percStr = parts[2]; }
      const percentuale = parseFloat(percStr.replace(",", ".").replace("%", ""));

      const upper = (s: string) => s.toUpperCase().trim();
      const gr = ramoName
        ? gruppiRamo.find((g: any) => upper(g.descrizione) === upper(ramoName) || upper(g.codice) === upper(ramoName))
        : null;
      const sotto = sottoName
        ? rami.find(
            (r: any) =>
              (upper(r.descrizione) === upper(sottoName) || upper(r.codice) === upper(sottoName)) &&
              (!gr || r.gruppo_ramo_id === gr.id)
          )
        : null;
      const grResolved = gr || (sotto ? gruppiRamo.find((g: any) => g.id === sotto.gruppo_ramo_id) : null);

      return {
        line,
        ramoName,
        sottoName,
        percentuale,
        gruppo_ramo_id: grResolved?.id || null,
        ramo_id: sotto?.id || null,
        ok: !!grResolved && !isNaN(percentuale),
      };
    });
  }, [text, gruppiRamo, rami]);

  const valid = parsed.filter((p: any) => p.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incolla o carica provvigioni (CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Formato: <code>GruppoRamo;Garanzia;%</code> oppure <code>Garanzia;%</code> (una riga per voce). Separatori: <code>; , tab</code>. Header opzionale.
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />Carica CSV
            </Button>
            <span className="text-xs text-muted-foreground">oppure incolla qui sotto</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"AUTO;RCA AUTO;10\nAUTO;ARD;18\nAUTO;CRISTALLI;22"}
          />
          {parsed.length > 0 && (
            <div className="border rounded max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gruppo Ramo</TableHead>
                    <TableHead>Garanzia</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Esito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((p: any, i: number) => (
                    <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell>{p.ramoName || "—"}</TableCell>
                      <TableCell>{p.sottoName || "—"}</TableCell>
                      <TableCell>{isNaN(p.percentuale) ? "?" : p.percentuale}</TableCell>
                      <TableCell>{p.ok ? <Badge variant="default">OK</Badge> : <Badge variant="destructive">scarta</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button
            disabled={valid.length === 0}
            onClick={() =>
              onConfirm(
                valid.map((p: any) => ({
                  gruppo_ramo_id: p.gruppo_ramo_id,
                  ramo_id: p.ramo_id,
                  percentuale: p.percentuale,
                }))
              )
            }
          >
            <Save className="w-4 h-4 mr-2" />Salva {valid.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog copia da altro rapporto ────────────────────────────────────────
function CopyDialog({ open, onClose, rapporti, onConfirm }: any) {
  const [src, setSrc] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Copia da altro rapporto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <SearchableSelect
            options={rapporti.map((r: any) => ({
              value: r.id,
              label: `${r.gruppi_compagnia?.descrizione || "?"} — ${r.nome_rapporto}`,
            }))}
            value={src}
            onValueChange={setSrc}
            placeholder="Seleziona rapporto sorgente..."
          />
          <p className="text-xs text-muted-foreground">Verranno copiate tutte le righe attive (sovrascrivendo le esistenti per stesso Ramo/Sottoramo).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button disabled={!src} onClick={() => onConfirm(src)}><Copy className="w-4 h-4 mr-2" />Copia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog import AI ───────────────────────────────────────────────────────
function AiImportDialog({ open, onClose, gruppiRamo, rami, onConfirm }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [risultati, setRisultati] = useState<any[]>([]);
  const [warningMsg, setWarningMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Normalizzazione robusta: maiuscole, no accenti, no punteggiatura, spazi compatti
  const norm = (s: string) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Alias comuni (sinonimi → nome canonico)
  const ALIASES: Record<string, string[]> = {
    INFORTUNI: ["INFORTUNI", "INF", "INFORTUNIO"],
    MALATTIA: ["MALATTIA", "MAL"],
    AUTO: ["AUTO", "RCA AUTO", "VEICOLI", "AUTOVETTURE"],
    RCA: ["RCA", "RC AUTO", "RESPONSABILITA CIVILE AUTO"],
    ARD: ["ARD", "AUTO RISCHI DIVERSI", "FURTO INCENDIO KASKO"],
    INCENDIO: ["INCENDIO", "INCENDIO FURTO"],
    FURTO: ["FURTO"],
    "RC GENERALE": ["RC GENERALE", "RCG", "RESPONSABILITA CIVILE GENERALE", "RC"],
    CAUZIONI: ["CAUZIONI", "CAUZIONE", "CREDITO CAUZIONI"],
    "TUTELA LEGALE": ["TUTELA LEGALE", "TL"],
    ASSISTENZA: ["ASSISTENZA", "ASS STRADALE"],
    CRISTALLI: ["CRISTALLI"],
    VITA: ["VITA", "RAMO VITA"],
  };

  const matchEntry = (
    raw: string,
    pool: { id: string; codice: string; descrizione: string; gruppo_ramo_id?: string }[],
    restrictGruppoId?: string | null
  ) => {
    if (!raw) return null;
    const target = norm(raw);
    const candidates = restrictGruppoId ? pool.filter((p) => p.gruppo_ramo_id === restrictGruppoId) : pool;
    let hit = candidates.find((p) => norm(p.codice) === target || norm(p.descrizione) === target);
    if (hit) return hit;
    for (const [canon, alts] of Object.entries(ALIASES)) {
      if (alts.includes(target) || target === canon) {
        hit = candidates.find((p) => norm(p.descrizione) === canon || alts.includes(norm(p.descrizione)));
        if (hit) return hit;
      }
    }
    hit = candidates.find((p) => {
      const d = norm(p.descrizione);
      return d && (d.includes(target) || target.includes(d));
    });
    return hit || null;
  };

  const enrich = (righe: any[]) =>
    righe.map((r: any) => {
      const gr = matchEntry(r.ramo, gruppiRamo as any[]);
      const sotto = r.sottoramo ? matchEntry(r.sottoramo, rami as any[], gr?.id || null) : null;
      const gruppo_ramo_id = gr?.id || sotto?.gruppo_ramo_id || null;
      const perc = typeof r.percentuale === "number" ? r.percentuale : parseFloat(r.percentuale);
      return {
        ramo: r.ramo || "",
        sottoramo: r.sottoramo || "",
        percentuale: perc,
        gruppo_ramo_id,
        ramo_ids: sotto?.id ? [sotto.id] : [],
        ok: !!gruppo_ramo_id && !isNaN(perc),
      };
    });

  const compressImage = async (file: File): Promise<{ base64: string; mime: string }> => {
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Immagine non leggibile"));
      i.src = dataUrl;
    });
    const maxSide = 2000;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", 0.85);
    return { base64: out.split(",")[1], mime: "image/jpeg" };
  };

  const handleFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImg = file.type.startsWith("image/");
    setWarningMsg("");
    setErrorMsg("");
    setRisultati([]);
    setFileName(file.name);

    if (!isPdf && !isImg) {
      const msg = "Formato non supportato: carica un PDF o un'immagine.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    if (file.size === 0) {
      const msg = "Il file selezionato è vuoto. Scarica di nuovo l'allegato e riprova.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      const msg = `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_DOCUMENT_UPLOAD_MB} MB. Per PDF pesanti, esporta come immagine JPG.`;
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      let b64: string;
      let mime: string;
      if (isImg) {
        const c = await compressImage(file);
        b64 = c.base64;
        mime = c.mime;
      } else {
        const buf = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
        }
        b64 = btoa(binary);
        mime = file.type || "application/pdf";
      }
      if (!b64 || b64.length < 100) {
        throw new Error("L'allegato non è stato letto correttamente: contenuto vuoto o non valido.");
      }
      console.log("[AI Import] invio", { name: file.name, mime, sizeKB: Math.round(b64.length / 1024) });
      const { data, error } = await supabase.functions.invoke("parse-tariffario-rami", {
        body: { pdf_base64: b64, mime_type: mime },
      });
      if (error) {
        console.error("[AI Import] invoke error", error);
        throw new Error(error.message || "Errore chiamata IA");
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const righe = (data as any)?.righe || [];
      const warning = (data as any)?.warning || "";
      setWarningMsg(warning);
      console.log("[AI Import] righe ricevute", righe.length, (data as any)?.warning);
      if (!righe.length) {
        const msg = warning || "L'IA non ha estratto righe. Verifica leggibilità del documento.";
        setWarningMsg(msg);
        toast.warning(msg);
      } else {
        toast.success(`Estratte ${righe.length} righe dal documento`);
      }
      setRisultati(enrich(righe));
    } catch (e: any) {
      console.error("[AI Import] errore", e);
      const msg = e?.message || "Errore IA durante l'analisi del documento";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (i: number, patch: Partial<any>) => {
    setRisultati((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const merged = { ...r, ...patch };
        merged.ok = !!merged.gruppo_ramo_id && !isNaN(Number(merged.percentuale));
        return merged;
      })
    );
  };

  const valid = risultati.filter((r) => r.ok);
  const totalToSave = valid.reduce((acc, r) => acc + Math.max(r.ramo_ids?.length || 0, 1), 0);
  const showPreview = !!fileName || loading || !!warningMsg || !!errorMsg || risultati.length > 0;

  const gruppoOptions = useMemo(
    () => (gruppiRamo as any[]).map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` })),
    [gruppiRamo]
  );
  const sottoramiFor = (gruppoId: string | null) =>
    (rami as any[]).filter((r: any) => gruppoId && r.gruppo_ramo_id === gruppoId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[96vw] md:max-w-5xl w-full max-h-[88vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle>Import IA tariffario provvigioni</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                e.currentTarget.value = "";
                if (selected) handleFile(selected);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {loading ? "Analisi in corso..." : "Carica PDF/Immagine"}
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground truncate max-w-[260px]">{fileName}</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto hidden md:inline">
              L'IA estrae Ramo, Sottoramo e %. Puoi correggere i match prima di salvare.
            </span>
          </div>

          {showPreview && (
            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-start gap-2">
                {errorMsg ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
                ) : loading ? (
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">
                    {loading
                      ? "Analisi dell'allegato in corso"
                      : errorMsg
                        ? "Allegato non caricato"
                        : risultati.length > 0
                          ? `Anteprima import: ${risultati.length} righe estratte`
                          : "Anteprima import"}
                  </div>
                  <div className={errorMsg ? "text-destructive break-words" : "text-muted-foreground break-words"}>
                    {errorMsg ||
                      warningMsg ||
                      (fileName
                        ? `File selezionato: ${fileName}`
                        : "Seleziona un PDF o un'immagine per avviare l'estrazione.")}
                  </div>
                  {risultati.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="default">{valid.length} salvabili</Badge>
                      <Badge variant="destructive">{risultati.length - valid.length} da rivedere</Badge>
                      <span className="text-xs text-muted-foreground">
                        Le righe senza sottoramo vengono salvate come <b>default ramo</b>.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {risultati.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[14%] h-9 px-2 text-xs">Ramo IA</TableHead>
                      <TableHead className="w-[14%] h-9 px-2 text-xs">Sottoramo IA</TableHead>
                      <TableHead className="w-[24%] h-9 px-2 text-xs">Ramo DB</TableHead>
                      <TableHead className="w-[24%] h-9 px-2 text-xs">Sottoramo DB</TableHead>
                      <TableHead className="w-[12%] h-9 px-2 text-xs">%</TableHead>
                      <TableHead className="w-[12%] h-9 px-2 text-xs">Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risultati.map((r, i) => (
                      <TableRow key={i} className={i % 2 ? "bg-muted/30" : ""}>
                        <TableCell className="text-xs p-2 align-top">{r.ramo || "—"}</TableCell>
                        <TableCell className="text-xs p-2 align-top">{r.sottoramo || "—"}</TableCell>
                        <TableCell className="p-2 align-top">
                          <SearchableSelect
                            options={gruppoOptions}
                            value={r.gruppo_ramo_id || ""}
                            onValueChange={(v) => updateRow(i, { gruppo_ramo_id: v, ramo_ids: [] })}
                            placeholder="Seleziona ramo..."
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <SottoramiMultiSelect
                            sottorami={sottoramiFor(r.gruppo_ramo_id)}
                            value={r.ramo_ids || []}
                            onChange={(ids) => updateRow(i, { ramo_ids: ids })}
                            disabled={!r.gruppo_ramo_id}
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            value={isNaN(r.percentuale) ? "" : r.percentuale}
                            onChange={(e) => updateRow(i, { percentuale: parseFloat(e.target.value) })}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell className="p-2 align-top">
                          {r.ok ? <Badge>OK</Badge> : <Badge variant="destructive">no match</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!showPreview && (
            <div className="rounded-md border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              Nessun allegato caricato. Seleziona un PDF o un'immagine della tabella provvigionale per iniziare.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button
            disabled={totalToSave === 0}
            onClick={() =>
              onConfirm(
                valid.flatMap((r) => {
                  const ids = r.ramo_ids?.length ? r.ramo_ids : [null];
                  return ids.map((ramo_id: string | null) => ({
                    gruppo_ramo_id: r.gruppo_ramo_id,
                    ramo_id,
                    percentuale: Number(r.percentuale),
                  }));
                })
              )
            }
          >
            <Save className="w-4 h-4 mr-2" />
            Salva {totalToSave}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SottoramiMultiSelect({
  sottorami,
  value,
  onChange,
  disabled,
}: {
  sottorami: { id: string; codice: string; descrizione: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allIds = sottorami.map((s) => s.id);
  const selectedSet = new Set(value);
  const allSelected = sottorami.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = value.length > 0 && !allSelected;

  const label = (() => {
    if (disabled) return "Seleziona prima il ramo";
    if (sottorami.length === 0) return "— Default ramo (nessun sottoramo) —";
    if (value.length === 0) return "— Default ramo (nessun sottoramo) —";
    if (allSelected) return `Tutti i sottorami (${value.length})`;
    if (value.length === 1) {
      const s = sottorami.find((x) => x.id === value[0]);
      return s ? `${s.codice} - ${s.descrizione}` : "1 sottoramo";
    }
    return `${value.length} sottorami`;
  })();

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-8 w-full justify-between text-xs font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca sottoramo..." className="h-9" />
          <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 text-xs">
            <button
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent"
              onClick={() => onChange(allSelected ? [] : allIds)}
              disabled={sottorami.length === 0}
            >
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                className="pointer-events-none"
              />
              <span className="font-medium">
                {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
              </span>
            </button>
            <span className="text-muted-foreground">
              {value.length}/{sottorami.length}
            </span>
          </div>
          <CommandList>
            <CommandEmpty>Nessun sottoramo</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__default__" onSelect={() => onChange([])}>
                <Check className={`mr-2 h-4 w-4 ${value.length === 0 ? "opacity-100" : "opacity-0"}`} />
                <span className="italic text-muted-foreground">— Default ramo (nessun sottoramo) —</span>
              </CommandItem>
              {sottorami.map((s) => {
                const checked = selectedSet.has(s.id);
                return (
                  <CommandItem
                    key={s.id}
                    value={`${s.codice} ${s.descrizione}`}
                    onSelect={() => toggle(s.id)}
                  >
                    <Checkbox checked={checked} className="mr-2 pointer-events-none" />
                    <span className="truncate">
                      <span className="font-medium">{s.codice}</span> - {s.descrizione}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
