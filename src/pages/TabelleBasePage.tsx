import { useState } from "react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, User, Building2, Landmark, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import TitoliNidificazioneTab from "@/pages/tabelle-base/TitoliNidificazioneTab";

const matchSearch = (q: string, fields: (string | null | undefined | number)[]) => {
  const s = (q || "").trim().toLowerCase();
  if (!s) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(s));
};
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  FATTORI_REGOLAZIONE_STANDARD,
  isFattoreRegolazioneStandard,
} from "@/lib/fattoriRegolazioneStandard";

/* ────────── Generic CRUD Tab ────────── */

// Tabelle lookup gestite dalle tab CRUD generiche di questa pagina.
type LookupTableName =
  | "gruppi_ramo"
  | "rami"
  | "rca_usi"
  | "rca_garanzie"
  | "gruppi_statistici"
  | "gruppi_finanziari"
  | "tipi_mandatario"
  | "tipi_rinnovo"
  | "lookup_indotti"
  | "lookup_attivita"
  | "lookup_settori"
  | "lookup_contratti"
  | "lookup_fasce_fatturato"
  | "lookup_fasce_dipendenti"
  | "lookup_tipo_documento"
  | "lookup_conti_incasso"
  | "lookup_tipologia_veicolo"
  | "lookup_titoli_nidificazione";

interface SimpleLookupTabProps {
  tableName: LookupTableName;
  title: string;
  queryKey: string;
}

const SimpleLookupTab = ({ tableName, title, queryKey }: SimpleLookupTabProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from(tableName).update({ codice, descrizione }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert({ codice, descrizione });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(editing ? `${title} aggiornato` : `${title} creato`);
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from(tableName).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} eliminato`);
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">{title}</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i: any) => matchSearch(search, [i.codice, i.descrizione]));
              if (isLoading) return (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessun elemento inserito"}</TableCell></TableRow>);
              return filtered.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Rami Tab (with gruppo_ramo_id relation) ────────── */

const RamiTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [gruppoId, setGruppoId] = useState("");
  const [aliquotaRamo, setAliquotaRamo] = useState("0");
  const [ssnAttivo, setSsnAttivo] = useState(false);
  const [aliquotaSsn, setAliquotaSsn] = useState("10.50");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<null | "codice" | "descrizione" | "gruppo" | "tasse">(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: "codice" | "descrizione" | "gruppo" | "tasse") => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir("asc");
  };
  const SortIcon = ({ k }: { k: "codice" | "descrizione" | "gruppo" | "tasse" }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const { data: rami = [], isLoading } = useQuery({
    queryKey: ["rami-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("*, gruppi_ramo(codice, descrizione)")
        .order("codice");
      if (error) throw error;
      return data;
    },
  });

  const { data: gruppi = [] } = useQuery({
    queryKey: ["gruppi-ramo"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { codice, descrizione, gruppo_ramo_id: gruppoId && gruppoId !== "none" ? gruppoId : null, aliquota_tasse_ramo: parseFloat(aliquotaRamo) || 0, ssn_attivo: ssnAttivo, aliquota_ssn: ssnAttivo ? (parseFloat(aliquotaSsn) || 0) : null };
      if (editing) {
        const { error } = await supabase.from("rami").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rami").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rami-list"] });
      toast.success(editing ? "Ramo aggiornato" : "Ramo creato");
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("rami").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rami-list"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rami").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rami-list"] });
      toast.success("Ramo eliminato");
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setGruppoId(""); setAliquotaRamo("0"); setSsnAttivo(false); setAliquotaSsn("10.50"); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setCodice(r.codice); setDescrizione(r.descrizione); setGruppoId(r.gruppo_ramo_id || ""); setAliquotaRamo(String(r.aliquota_tasse_ramo ?? 0)); setSsnAttivo(!!r.ssn_attivo); setAliquotaSsn(r.aliquota_ssn != null ? String(r.aliquota_ssn) : "10.50"); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">Garanzie</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca codice, descrizione, gruppo…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuova Garanzia</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">
                <button type="button" onClick={() => toggleSort("codice")} className="inline-flex items-center hover:text-foreground">Codice<SortIcon k="codice" /></button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => toggleSort("descrizione")} className="inline-flex items-center hover:text-foreground">Descrizione<SortIcon k="descrizione" /></button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => toggleSort("gruppo")} className="inline-flex items-center hover:text-foreground">Gruppo Ramo<SortIcon k="gruppo" /></button>
              </TableHead>
              <TableHead className="w-28 text-right">
                <button type="button" onClick={() => toggleSort("tasse")} className="inline-flex items-center hover:text-foreground ml-auto">% Tasse Garanzia<SortIcon k="tasse" /></button>
              </TableHead>
              <TableHead className="w-28 text-center">SSN</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = rami.filter((r: any) => matchSearch(search, [r.codice, r.descrizione, r.gruppi_ramo?.codice, r.gruppi_ramo?.descrizione]));
              const sorted = sortKey ? [...filtered].sort((a: any, b: any) => {
                const dir = sortDir === "asc" ? 1 : -1;
                if (sortKey === "tasse") {
                  return ((Number(a.aliquota_tasse_ramo) || 0) - (Number(b.aliquota_tasse_ramo) || 0)) * dir;
                }
                const getKey = (x: any) => {
                  if (sortKey === "codice") return String(x.codice ?? "");
                  if (sortKey === "descrizione") return String(x.descrizione ?? "");
                  // gruppo: codice gruppo poi descrizione; null in fondo
                  const g = x.gruppi_ramo;
                  return g ? `${g.codice ?? ""} ${g.descrizione ?? ""}` : "\uFFFF";
                };
                return getKey(a).localeCompare(getKey(b), "it", { numeric: true, sensitivity: "base" }) * dir;
              }) : filtered;
              if (isLoading) return (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (sorted.length === 0) return (<TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessuna garanzia inserita"}</TableCell></TableRow>);
              return sorted.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold">{r.codice}</TableCell>
                <TableCell>{r.descrizione}</TableCell>
                <TableCell>
                  {r.gruppi_ramo ? (
                    <Badge variant="secondary">{r.gruppi_ramo.codice} - {r.gruppi_ramo.descrizione}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {r.diritti_agenzia ? (
                    <Badge variant="outline" className="text-[10px]">Solo tasse</Badge>
                  ) : (
                    `${r.aliquota_tasse_ramo ?? 0}%`
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {r.ssn_attivo ? (
                    <Badge variant="default" className="font-mono">{Number(r.aliquota_ssn ?? 10.5).toFixed(2)}%</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={r.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: r.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  {!r.diritti_agenzia && (
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  )}
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Garanzia" : "Nuova Garanzia"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Infortuni" /></div>
              <div>
                <Label>Gruppo Ramo</Label>
                <SearchableSelect
                  value={gruppoId}
                  onValueChange={setGruppoId}
                  placeholder="— Nessun gruppo —"
                  options={[
                    { value: "none", label: "— Nessun gruppo —" },
                    ...gruppi.map((g) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` })),
                  ]}
                 />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>% Tasse Garanzia</Label><Input type="number" step="0.01" value={aliquotaRamo} onChange={(e) => setAliquotaRamo(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Contributo SSN</span>
                    <Switch checked={ssnAttivo} onCheckedChange={setSsnAttivo} />
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={aliquotaSsn}
                    onChange={(e) => setAliquotaSsn(e.target.value)}
                    disabled={!ssnAttivo}
                    placeholder="% SSN (es. 10,50)"
                  />
                  <p className="text-[10px] text-muted-foreground">Calcolato sul lordo (netto+tasse). Tipico RCA Auto: 10,50%.</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Gruppi Finanziari Tab ────────── */

type TipoSoggetto = "privato" | "azienda" | "ente";

const TIPO_SOGGETTO_META: Record<TipoSoggetto, { label: string; icon: typeof User; badgeClass: string }> = {
  privato: { label: "Privato", icon: User, badgeClass: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200" },
  azienda: { label: "Azienda", icon: Building2, badgeClass: "bg-primary/15 text-primary hover:bg-primary/15 border-primary/30" },
  ente:    { label: "Ente",    icon: Landmark,  badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" },
};

const TipoSoggettoBadge = ({ tipo }: { tipo: TipoSoggetto }) => {
  const meta = TIPO_SOGGETTO_META[tipo] ?? TIPO_SOGGETTO_META.azienda;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${meta.badgeClass}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
};

const GruppiFinanziariTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [tipoSoggetto, setTipoSoggetto] = useState<TipoSoggetto>("azienda");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gruppi-finanziari"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gruppi_finanziari")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { codice, nome, descrizione, tipo_soggetto: tipoSoggetto };
      if (editing) {
        const { error } = await supabase.from("gruppi_finanziari").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gruppi_finanziari").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] });
      toast.success(editing ? "Gruppo aggiornato" : "Gruppo creato");
      closeDialog();
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("gruppi_finanziari").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gruppi_finanziari").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gruppi-finanziari"] });
      toast.success("Gruppo eliminato");
    },
    onError: (e: any) => toast.error("Errore"),
  });

  const openNew = () => {
    setEditing(null);
    setCodice(""); setNome(""); setDescrizione("");
    setTipoSoggetto("azienda");
    setOpen(true);
  };
  const openEdit = (g: any) => {
    setEditing(g);
    setCodice(g.codice); setNome(g.nome || ""); setDescrizione(g.descrizione);
    setTipoSoggetto((g.tipo_soggetto as TipoSoggetto) || "azienda");
    setOpen(true);
  };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">Gruppi Finanziari</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Codice</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-32">Tipo</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i: any) => matchSearch(search, [i.codice, i.nome, i.descrizione, i.tipo_soggetto]));
              if (isLoading) return (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessun elemento"}</TableCell></TableRow>);
              return filtered.map((item: any, idx: number) => (
              <TableRow key={item.id} className={idx % 2 === 1 ? "bg-muted/30" : undefined}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell className="font-medium">{item.nome || "—"}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell>
                  <TipoSoggettoBadge tipo={(item.tipo_soggetto as TipoSoggetto) || "azienda"} />
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Gruppo Finanziario" : "Nuovo Gruppo Finanziario"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. ISP" /></div>
              <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Intesa Sanpaolo S.p.A." /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>

              <div className="space-y-2">
                <Label>Tipo Soggetto</Label>
                <p className="text-xs text-muted-foreground">
                  Determina i campi che verranno richiesti in anagrafica cliente per questo gruppo.
                </p>
                <RadioGroup
                  value={tipoSoggetto}
                  onValueChange={(v) => setTipoSoggetto(v as TipoSoggetto)}
                  className="grid grid-cols-3 gap-2"
                >
                  {(Object.keys(TIPO_SOGGETTO_META) as TipoSoggetto[]).map((key) => {
                    const meta = TIPO_SOGGETTO_META[key];
                    const Icon = meta.icon;
                    const selected = tipoSoggetto === key;
                    return (
                      <Label
                        key={key}
                        htmlFor={`tipo-${key}`}
                        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all ${
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-muted hover:border-primary/40"
                        }`}
                      >
                        <RadioGroupItem id={`tipo-${key}`} value={key} className="sr-only" />
                        <Icon className={`w-6 h-6 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{meta.label}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !nome || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Ordered Lookup Tab (with ordine field) ────────── */

interface OrderedLookupTabProps {
  tableName: LookupTableName;
  title: string;
  queryKey: string;
}

const OrderedLookupTab = ({ tableName, title, queryKey }: OrderedLookupTabProps) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [ordine, setOrdine] = useState(0);
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order("ordine");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from(tableName).update({ codice, descrizione, ordine }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert({ codice, descrizione, ordine });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
      toast.success(editing ? `${title} aggiornato` : `${title} creato`);
      closeDialog();
    },
    onError: () => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from(tableName).update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["lookup", tableName] });
      toast.success(`${title} eliminato`);
    },
    onError: () => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOrdine(items.length + 1); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOrdine(g.ordine ?? 0); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">{title}</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Ordine</TableHead>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i: any) => matchSearch(search, [i.codice, i.descrizione, i.ordine]));
              if (isLoading) return (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessun elemento inserito"}</TableCell></TableRow>);
              return filtered.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="text-center font-mono">{item.ordine}</TableCell>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? `Modifica ${title}` : `Nuovo ${title}`}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. F01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
              <div><Label>Ordine</Label><Input type="number" value={ordine} onChange={(e) => setOrdine(Number(e.target.value))} placeholder="1" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── RCA Usi Tab (lista piatta, no settore) ────────── */

const RcaUsiTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["rca-usi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rca_usi").select("*").order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { codice, descrizione };
      if (editing) {
        const { error } = await supabase.from("rca_usi").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rca_usi").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rca-usi"] }); toast.success(editing ? "Uso aggiornato" : "Uso creato"); closeDialog(); },
    onError: () => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("rca_usi").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rca-usi"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rca_usi").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rca-usi"] }); toast.success("Uso eliminato"); },
    onError: () => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">Usi RCA</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i) => matchSearch(search, [i.codice, i.descrizione]));
              if (isLoading) return (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessun elemento"}</TableCell></TableRow>);
              return filtered.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Uso RCA" : "Nuovo Uso RCA"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 1" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. PRIVATO" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── RCA Garanzie Tab (with aliquota_tasse) ────────── */

const RcaGaranzieTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [aliquota, setAliquota] = useState("0");
  const [gruppoRamoId, setGruppoRamoId] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: gruppiRamo = [] } = useQuery({
    queryKey: ["gruppi-ramo-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gruppi_ramo")
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("codice");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["rca-garanzie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rca_garanzie")
        .select("*, gruppi_ramo(codice, descrizione)")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const defaultGruppoZqId = gruppiRamo.find((g: any) => g.codice === "ZQ")?.id || "";

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        codice,
        descrizione,
        aliquota_tasse: parseFloat(aliquota) || 0,
        gruppo_ramo_id: gruppoRamoId || defaultGruppoZqId,
      };
      if (editing) {
        const { error } = await supabase.from("rca_garanzie").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rca_garanzie").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rca-garanzie"] }); toast.success(editing ? "Garanzia aggiornata" : "Garanzia creata"); closeDialog(); },
    onError: () => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("rca_garanzie").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rca-garanzie"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rca_garanzie").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rca-garanzie"] }); toast.success("Garanzia eliminata"); },
    onError: () => toast.error("Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setAliquota("0"); setGruppoRamoId(defaultGruppoZqId); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setAliquota(String(g.aliquota_tasse ?? 0)); setGruppoRamoId(g.gruppo_ramo_id || defaultGruppoZqId); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">Catalogo Garanzie</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuova</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-40">Gruppo Ramo</TableHead>
              <TableHead className="w-28 text-right">% Tasse</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i) => matchSearch(search, [i.codice, i.descrizione, i.gruppi_ramo?.codice, i.gruppi_ramo?.descrizione]));
              if (isLoading) return (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessun elemento"}</TableCell></TableRow>);
              return filtered.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                <TableCell>{item.descrizione}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.gruppi_ramo ? `${item.gruppi_ramo.codice} - ${item.gruppi_ramo.descrizione}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono">{item.aliquota_tasse ?? 0}%</TableCell>
                <TableCell className="text-center">
                  <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Garanzia" : "Nuova Garanzia"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 01" /></div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Cristalli veicolo" /></div>
              <div>
                <Label>Gruppo Ramo</Label>
                <SearchableSelect
                  value={gruppoRamoId}
                  onValueChange={setGruppoRamoId}
                  options={gruppiRamo.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.descrizione}` }))}
                  placeholder="Seleziona gruppo ramo..."
                />
              </div>
              <div><Label>% Tasse</Label><Input type="number" step="0.01" value={aliquota} onChange={(e) => setAliquota(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || !gruppoRamoId || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Tipo Documento Tab (with boolean flags) ────────── */

const TIPO_DOC_FLAGS = [
  { key: "visibile", label: "Vis" },
  { key: "clienti", label: "Cli" },
  { key: "agenzie", label: "Comp" },
  { key: "polizze", label: "Pol" },
  { key: "trattative", label: "Tratt" },
  { key: "contrattuali", label: "Contr" },
  { key: "prod", label: "Prod" },
] as const;

const TipoDocumentoTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [firma, setFirma] = useState("");
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lookup-tipo-documento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lookup_tipo_documento")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { codice, descrizione, firma: firma || null };
      TIPO_DOC_FLAGS.forEach(f => { payload[f.key] = flags[f.key] ?? false; });
      if (editing) {
        const { error } = await supabase.from("lookup_tipo_documento").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lookup_tipo_documento").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-tipo-documento"] });
      toast.success(editing ? "Tipo aggiornato" : "Tipo creato");
      closeDialog();
    },
    onError: () => toast.error("Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("lookup_tipo_documento").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lookup-tipo-documento"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lookup_tipo_documento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-tipo-documento"] });
      toast.success("Tipo eliminato");
    },
    onError: () => toast.error("Errore"),
  });

  const openNew = () => {
    setEditing(null); setCodice(""); setDescrizione(""); setFirma("");
    setFlags({}); setOpen(true);
  };
  const openEdit = (item: any) => {
    setEditing(item); setCodice(item.codice); setDescrizione(item.descrizione); setFirma(item.firma || "");
    const f: Record<string, boolean> = {};
    TIPO_DOC_FLAGS.forEach(fl => { f[fl.key] = !!item[fl.key]; });
    setFlags(f); setOpen(true);
  };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Tipi Documento</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Codice</TableHead>
                <TableHead>Descrizione</TableHead>
                {TIPO_DOC_FLAGS.map(f => (
                  <TableHead key={f.key} className="w-12 text-center text-xs">{f.label}</TableHead>
                ))}
                <TableHead className="w-14 text-center text-xs">Firma</TableHead>
                <TableHead className="w-20 text-center">Attivo</TableHead>
                <TableHead className="w-24 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Nessun elemento</TableCell></TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-semibold text-xs">{item.codice}</TableCell>
                  <TableCell className="text-sm">{item.descrizione}</TableCell>
                  {TIPO_DOC_FLAGS.map(f => (
                    <TableCell key={f.key} className="text-center">
                      {item[f.key] ? <Badge variant="default" className="px-1 py-0 text-[10px]">✓</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-center text-xs font-mono">{item.firma || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={item.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: item.id, attivo: v })} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Modifica Tipo Documento" : "Nuovo Tipo Documento"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="es. 11" /></div>
                <div><Label>Firma</Label><Input value={firma} onChange={(e) => setFirma(e.target.value)} placeholder="S o vuoto" /></div>
              </div>
              <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Descrizione..." /></div>
              <div>
                <Label className="mb-2 block">Visibilità per sezione</Label>
                <div className="grid grid-cols-4 gap-2">
                  {TIPO_DOC_FLAGS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <Switch checked={flags[f.key] ?? false} onCheckedChange={(v) => setFlags(prev => ({ ...prev, [f.key]: v }))} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice || !descrizione || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Causali Movimento Contabile Tab ────────── */

const CausaliMovTab = () => {
  const qc = useQueryClient();
  const queryKey = "causali-movimento-contabile";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [segno, setSegno] = useState<"dare" | "avere" | "entrambi">("entrambi");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("causali_movimento_contabile")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const codiceUpper = codice.trim().toUpperCase();
      const payload = { codice: codiceUpper, descrizione: descrizione.trim(), segno, note: note.trim() || null };
      if (editing) {
        const { error } = await (supabase as any).from("causali_movimento_contabile").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("causali_movimento_contabile").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      toast.success(editing ? "Causale aggiornata" : "Causale creata");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.message?.includes("unique") ? "Codice già esistente" : "Errore salvataggio"),
  });

  const toggleAttiva = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await (supabase as any).from("causali_movimento_contabile").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("causali_movimento_contabile").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      toast.success("Causale eliminata");
    },
    onError: () => toast.error("Errore eliminazione"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setSegno("entrambi"); setNote(""); setOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setCodice(g.codice); setDescrizione(g.descrizione); setSegno(g.segno || "entrambi"); setNote(g.note || ""); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  const canSave = codice.trim().length >= 2 && codice.trim().length <= 10 && descrizione.trim().length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-3">
        <CardTitle className="text-lg whitespace-nowrap">Causali Contabili</CardTitle>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuovo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-28">Segno</TableHead>
              <TableHead className="w-24 text-center">Attiva</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = items.filter((i: any) => matchSearch(search, [i.codice, i.descrizione, i.note]));
              if (isLoading) return (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>);
              if (filtered.length === 0) return (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessuna causale inserita"}</TableCell></TableRow>);
              return filtered.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono font-semibold">{item.codice}</TableCell>
                  <TableCell>{item.descrizione}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{item.segno}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={item.attiva} onCheckedChange={(v) => toggleAttiva.mutate({ id: item.id, attiva: v })} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Causale" : "Nuova Causale Contabile"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Codice *</Label>
                <Input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="es. ABP" maxLength={10} />
                <p className="text-xs text-muted-foreground mt-1">2–10 caratteri, maiuscolo, univoco.</p>
              </div>
              <div>
                <Label>Descrizione *</Label>
                <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. ABBUONO PASSIVO" maxLength={120} />
              </div>
              <div>
                <Label>Segno</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={segno}
                  onChange={(e) => setSegno(e.target.value as any)}
                >
                  <option value="entrambi">Entrambi</option>
                  <option value="dare">Dare</option>
                  <option value="avere">Avere</option>
                </select>
              </div>
              <div>
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note opzionali" maxLength={250} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
                {save.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Causali Compensazione Messa a Cassa ────────── */

const CausaliCompensazioneTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [segno, setSegno] = useState<"+" | "-">("+");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["causali-compensazione"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("causali_contabili")
        .select("*")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const cod = codice.trim().toUpperCase();
      const desc = descrizione.trim();
      if (!cod || !desc) throw new Error("Codice e descrizione obbligatori");
      if (!/^[A-Z0-9_]{2,20}$/.test(cod)) throw new Error("Codice: 2-20 caratteri A-Z, 0-9, _");
      const dup = (items as any[]).find((i) => i.codice === cod && (!editing || i.id !== editing.id));
      if (dup) throw new Error("Codice già esistente");
      const payload = { tipo_tabella: "compensazione_messa_cassa", codice: cod, descrizione: desc, segno_default: segno };
      if (editing) {
        const { error } = await supabase.from("causali_contabili").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("causali_contabili").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["causali-compensazione"] });
      qc.invalidateQueries({ queryKey: ["causali-compensazione-messa-cassa"] });
      toast.success(editing ? "Causale aggiornata" : "Causale creata");
      closeDialog();
    },
    onError: (e: any) => toast.error(e?.message ?? "Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("causali_contabili").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["causali-compensazione"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("causali_contabili").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["causali-compensazione"] });
      toast.success("Causale eliminata");
    },
    onError: (e: any) => toast.error(String(e?.message ?? "").includes("foreign key") ? "Causale in uso: impossibile eliminare" : "Errore"),
  });

  const openNew = () => { setEditing(null); setCodice(""); setDescrizione(""); setSegno("+"); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setCodice(c.codice); setDescrizione(c.descrizione); setSegno((c.segno_default === "-" ? "-" : "+")); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); };

  const filtered = (items as any[]).filter((i) => matchSearch(search, [i.codice, i.descrizione]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-lg whitespace-nowrap">Causali Compensazione (Messa a Cassa)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Usate per quadrare l'incasso (abbuoni, sconti, arrotondamenti). Segno <strong className="font-mono">+</strong> riduce il dovuto cliente, <strong className="font-mono">−</strong> lo aumenta.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
          </div>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuova Causale</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Segno</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-28 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Caricamento…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessuna causale"}</TableCell></TableRow>
            ) : (
              filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.codice}</TableCell>
                  <TableCell>{c.descrizione}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.segno_default === "+" ? "default" : "secondary"} className="font-mono">{c.segno_default ?? "?"}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: c.id, attivo: v })} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Eliminare la causale ${c.codice}?`)) remove.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifica Causale" : "Nuova Causale Compensazione"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Codice</Label>
                <Input value={codice} onChange={(e) => setCodice(e.target.value.toUpperCase())} placeholder="es. ABB_ATT" maxLength={20} />
                <p className="text-xs text-muted-foreground mt-1">2-20 caratteri: A-Z, 0-9, _</p>
              </div>
              <div>
                <Label>Descrizione</Label>
                <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. Abbuono attivo" maxLength={200} />
              </div>
              <div>
                <Label>Segno di default</Label>
                <RadioGroup value={segno} onValueChange={(v) => setSegno(v as "+" | "-")} className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="+" id="seg-plus" />
                    <Label htmlFor="seg-plus" className="font-normal cursor-pointer"><strong className="font-mono">+</strong> Riduce dovuto cliente (abbuono attivo, sconto)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="-" id="seg-minus" />
                    <Label htmlFor="seg-minus" className="font-normal cursor-pointer"><strong className="font-mono">−</strong> Aumenta dovuto cliente (abbuono passivo, spese)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Annulla</Button>
              <Button onClick={() => save.mutate()} disabled={!codice.trim() || !descrizione.trim() || save.isPending}>
                {save.isPending ? "Salvataggio…" : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

/* ────────── Fattori regolazione (sottoramo ↔ fattore) ────────── */

const FattoriRegolazioneTab = () => {
  const qc = useQueryClient();
  const [ramoId, setRamoId] = useState("");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [fattoreId, setFattoreId] = useState("");
  const [newCodice, setNewCodice] = useState("");
  const [newDescrizione, setNewDescrizione] = useState("");
  const [search, setSearch] = useState("");

  const { data: rami = [] } = useQuery({
    queryKey: ["rami-list-fattori"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rami")
        .select("id, codice, descrizione, attivo, gruppi_ramo(codice, descrizione)")
        .eq("attivo", true)
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fattori = [] } = useQuery({
    queryKey: ["fattori-regolazione"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fattori_regolazione")
        .select("id, codice, descrizione, attivo")
        .order("codice");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["sottoramo-fattori-regolazione"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sottoramo_fattori_regolazione")
        .select("id, ramo_id, fattore_id, attivo, rami(codice, descrizione, gruppi_ramo(codice, descrizione)), fattori_regolazione(codice, descrizione)")
        .order("ramo_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingFattoreIdsForRamo = new Set(
    links.filter((l: any) => l.ramo_id === ramoId).map((l: any) => l.fattore_id as string),
  );

  const addCombination = useMutation({
    mutationFn: async () => {
      if (!ramoId) throw new Error("Seleziona un sottoramo");

      let resolvedFattoreId = fattoreId;

      if (mode === "new") {
        const codice = newCodice.trim();
        const descrizione = newDescrizione.trim();
        if (!codice || !descrizione) throw new Error("Inserisci codice e descrizione del nuovo fattore");
        const { data: created, error: createErr } = await supabase
          .from("fattori_regolazione")
          .insert({ codice, descrizione, attivo: true })
          .select("id")
          .single();
        if (createErr) throw createErr;
        resolvedFattoreId = created.id;
      } else {
        if (!resolvedFattoreId) throw new Error("Seleziona un fattore");
        if (existingFattoreIdsForRamo.has(resolvedFattoreId)) {
          throw new Error("Combinazione già presente per questo sottoramo");
        }
      }

      const { error } = await supabase.from("sottoramo_fattori_regolazione").insert({
        ramo_id: ramoId,
        fattore_id: resolvedFattoreId,
        attivo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sottoramo-fattori-regolazione"] });
      qc.invalidateQueries({ queryKey: ["fattori-regolazione"] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      toast.success("Combinazione salvata");
      setFattoreId("");
      setNewCodice("");
      setNewDescrizione("");
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const toggleAttivo = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("sottoramo_fattori_regolazione").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sottoramo-fattori-regolazione"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sottoramo_fattori_regolazione").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sottoramo-fattori-regolazione"] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      toast.success("Combinazione eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore"),
  });

  const ramoOpts = rami.map((r: any) => {
    const g = r.gruppi_ramo;
    const gLabel = g ? `${g.codice || ""} ${g.descrizione || ""}`.trim() : "";
    return {
      value: r.id as string,
      label: gLabel
        ? `${r.codice} — ${r.descrizione} (${gLabel})`
        : `${r.codice} — ${r.descrizione}`,
    };
  });

  const fattoreOpts = fattori
    .filter((f: any) => f.attivo !== false)
    .filter((f: any) => !existingFattoreIdsForRamo.has(f.id))
    .map((f: any) => ({
      value: f.id as string,
      label: isFattoreRegolazioneStandard(f.codice)
        ? `★ ${f.descrizione} (${f.codice}) — standard`
        : `${f.descrizione} (${f.codice})`,
      _std: isFattoreRegolazioneStandard(f.codice),
    }))
    .sort((a, b) => Number(b._std) - Number(a._std) || a.label.localeCompare(b.label, "it"));

  const canSubmit =
    !!ramoId &&
    (mode === "existing"
      ? !!fattoreId
      : !!newCodice.trim() && !!newDescrizione.trim()) &&
    !addCombination.isPending;

  const filtered = links.filter((l: any) => {
    const ramo = l.rami;
    const fat = l.fattori_regolazione;
    const g = ramo?.gruppi_ramo;
    return matchSearch(search, [
      ramo?.codice,
      ramo?.descrizione,
      g?.codice,
      g?.descrizione,
      fat?.codice,
      fat?.descrizione,
    ]);
  });

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-lg">Fattori regolazione</CardTitle>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-medium">5 fattori standard (sempre disponibili in polizza)</p>
          <p className="text-xs text-muted-foreground">
            Indipendenti dal sottoramo: in immissione sono sempre in griglia quando la regolazione è attiva.
            Qui sotto puoi solo aggiungere combinazioni custom sottoramo ↔ fattore.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 text-sm">
            {FATTORI_REGOLAZIONE_STANDARD.map((f) => (
              <li key={f.codice} className="font-mono text-xs">
                <span className="text-muted-foreground">{f.codice}</span>
                <span className="mx-1 text-muted-foreground">—</span>
                <span className="font-sans">{f.descrizione}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">
          Combinazioni custom sottoramo ↔ fattore (opzionali, in aggiunta agli standard).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end rounded-md border p-3 bg-muted/30">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Sottoramo</Label>
            <SearchableSelect
              options={ramoOpts}
              value={ramoId}
              onValueChange={(v) => {
                setRamoId(v);
                setFattoreId("");
              }}
              placeholder="Seleziona sottoramo"
              clearable
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-xs">Fattore</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => {
                setMode(v as "existing" | "new");
                setFattoreId("");
                setNewCodice("");
                setNewDescrizione("");
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existing" id="fattore-mode-existing" />
                <Label htmlFor="fattore-mode-existing" className="text-xs font-normal cursor-pointer">
                  Fattore esistente
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="fattore-mode-new" />
                <Label htmlFor="fattore-mode-new" className="text-xs font-normal cursor-pointer">
                  Nuovo fattore
                </Label>
              </div>
            </RadioGroup>
          </div>
          {mode === "existing" ? (
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Seleziona fattore</Label>
              <SearchableSelect
                options={fattoreOpts}
                value={fattoreId}
                onValueChange={setFattoreId}
                placeholder={ramoId ? "Seleziona fattore" : "Prima seleziona un sottoramo"}
                disabled={!ramoId}
                clearable
              />
              {ramoId && !fattoreOpts.length && (
                <p className="text-xs text-muted-foreground">
                  Tutti i fattori attivi sono già collegati a questo sottoramo — crea un nuovo fattore.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Codice</Label>
                <Input
                  value={newCodice}
                  onChange={(e) => setNewCodice(e.target.value)}
                  placeholder="es. fatturato"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrizione</Label>
                <Input
                  value={newDescrizione}
                  onChange={(e) => setNewDescrizione(e.target.value)}
                  placeholder="es. Fatturato"
                  className="h-9"
                />
              </div>
            </>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" onClick={() => addCombination.mutate()} disabled={!canSubmit}>
              <Plus className="w-4 h-4 mr-1" /> Aggiungi combinazione
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative max-w-xs mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca…" className="h-8 pl-7" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sottoramo</TableHead>
              <TableHead>Ramo</TableHead>
              <TableHead>Fattore (codice)</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-24 text-center">Attivo</TableHead>
              <TableHead className="w-20 text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{search ? "Nessun risultato" : "Nessuna combinazione"}</TableCell></TableRow>
            ) : (
              filtered.map((l: any) => {
                const ramo = l.rami;
                const g = ramo?.gruppi_ramo;
                const fat = l.fattori_regolazione;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-mono text-xs mr-1">{ramo?.codice}</span>
                      {ramo?.descrizione}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g ? `${g.codice || ""} ${g.descrizione || ""}`.trim() : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{fat?.codice ?? "—"}</TableCell>
                    <TableCell>{fat?.descrizione ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={!!l.attivo} onCheckedChange={(v) => toggleAttivo.mutate({ id: l.id, attivo: v })} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

/* ────────── Page ────────── */

const tabConfig: { value: string; label: string; tableName: LookupTableName; queryKey: string; title: string; custom?: string | boolean }[] = [
  { value: "gruppi_ramo", label: "Gruppi Ramo", tableName: "gruppi_ramo", queryKey: "gruppi-ramo", title: "Gruppo Ramo" },
  { value: "rami", label: "Garanzie", tableName: "rami", queryKey: "rami-list", title: "Garanzia", custom: true },
  { value: "fattori_regolazione", label: "Fattori regolazione", tableName: "sottoramo_fattori_regolazione" as LookupTableName, queryKey: "sottoramo-fattori-regolazione", title: "Fattori regolazione", custom: "fattori_regolazione" },

  { value: "rca_usi", label: "Usi RCA", tableName: "rca_usi", queryKey: "rca-usi", title: "Uso RCA", custom: "rca_usi" },
  { value: "lookup_tipologia_veicolo", label: "Tipologia Veicolo", tableName: "lookup_tipologia_veicolo", queryKey: "lookup-tipologia-veicolo", title: "Tipologia Veicolo" },
  { value: "rca_garanzie", label: "Catalogo Garanzie RCA", tableName: "rca_garanzie", queryKey: "rca-garanzie", title: "Garanzia", custom: "rca_garanzie" },
  { value: "gruppi_statistici", label: "Gruppi Statistici", tableName: "gruppi_statistici", queryKey: "gruppi-statistici", title: "Gruppo Statistico" },
  { value: "lookup_titoli_nidificazione", label: "Titoli Nidificazione", tableName: "lookup_titoli_nidificazione", queryKey: "lookup-titoli-nidificazione", title: "Titolo Nidificazione", custom: "titoli_nidificazione" },
  { value: "gruppi_finanziari", label: "Gruppi Finanziari", tableName: "gruppi_finanziari", queryKey: "gruppi-finanziari", title: "Gruppo Finanziario", custom: "gruppi_finanziari" },
  { value: "tipi_mandatario", label: "Tipi Mandatario", tableName: "tipi_mandatario", queryKey: "tipi-mandatario", title: "Tipo Mandatario" },
  { value: "tipi_rinnovo", label: "Tipi Rinnovo", tableName: "tipi_rinnovo", queryKey: "tipi-rinnovo", title: "Tipo Rinnovo" },
  { value: "lookup_indotti", label: "Indotti", tableName: "lookup_indotti", queryKey: "lookup-indotti", title: "Indotto" },
  { value: "lookup_attivita", label: "Attività", tableName: "lookup_attivita", queryKey: "lookup-attivita", title: "Attività" },
  { value: "lookup_settori", label: "Settori", tableName: "lookup_settori", queryKey: "lookup-settori", title: "Settore" },
  { value: "lookup_contratti", label: "Contratti", tableName: "lookup_contratti", queryKey: "lookup-contratti", title: "Contratto" },
  { value: "lookup_fasce_fatturato", label: "Fasce Fatturato", tableName: "lookup_fasce_fatturato", queryKey: "lookup-fasce-fatturato", title: "Fascia Fatturato", custom: "ordered" },
  { value: "lookup_fasce_dipendenti", label: "Fasce Dipendenti", tableName: "lookup_fasce_dipendenti", queryKey: "lookup-fasce-dipendenti", title: "Fascia Dipendenti", custom: "ordered" },
  { value: "lookup_tipo_documento", label: "Tipo Documento", tableName: "lookup_tipo_documento", queryKey: "lookup-tipo-documento", title: "Tipo Documento", custom: "tipo_documento" },
  { value: "lookup_conti_incasso", label: "Causali Cassa/Banca", tableName: "lookup_conti_incasso", queryKey: "lookup-conti-incasso", title: "Causali Cassa/Banca (causali contabili — non contiene IBAN, per gli IBAN usa Archivi → Conti Bancari)" },
  { value: "causali_movimento_contabile", label: "Causali Contabili", tableName: "causali_movimento_contabile" as LookupTableName, queryKey: "causali-movimento-contabile", title: "Causale Contabile", custom: "causali_mov" },
  { value: "causali_compensazione", label: "Causali Compensazione", tableName: "causali_contabili" as LookupTableName, queryKey: "causali-compensazione", title: "Causale Compensazione", custom: "causali_comp" },
];

const TabelleBasePage = () => {
  // Fetch counts for all tabs
  const { data: counts = {} } = useQuery({
    queryKey: ["tabelle-base-counts"],
    queryFn: async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        tabConfig.map(async (t) => {
          let q = (supabase as any).from(t.tableName).select("*", { count: "exact", head: true });
          if (t.custom === "causali_comp") q = q.eq("tipo_tabella", "compensazione_messa_cassa");
          const { count, error } = await q;
          if (!error) results[t.value] = count ?? 0;
        })
      );
      return results;
    },
    staleTime: 300000 * 60 * 5,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tabelle di Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestione delle tabelle di lookup utilizzate nei filtri e nei form
        </p>
      </div>

      <Tabs defaultValue="gruppi_ramo" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          {tabConfig.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              {counts[t.value] != null && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] min-w-[20px] justify-center">
                  {counts[t.value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.custom === true || t.custom === "rami" ? (
              <RamiTab />
            ) : t.custom === "fattori_regolazione" ? (
              <FattoriRegolazioneTab />
            ) : t.custom === "gruppi_finanziari" ? (
              <GruppiFinanziariTab />
            ) : t.custom === "rca_usi" ? (
              <RcaUsiTab />
            ) : t.custom === "rca_garanzie" ? (
              <RcaGaranzieTab />
            ) : t.custom === "ordered" ? (
              <OrderedLookupTab tableName={t.tableName} title={t.title} queryKey={t.queryKey} />
            ) : t.custom === "tipo_documento" ? (
              <TipoDocumentoTab />
            ) : t.custom === "causali_mov" ? (
              <CausaliMovTab />
            ) : t.custom === "causali_comp" ? (
              <CausaliCompensazioneTab />
            ) : t.custom === "titoli_nidificazione" ? (
              <TitoliNidificazioneTab />
            ) : (
              <SimpleLookupTab tableName={t.tableName} title={t.title} queryKey={t.queryKey} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default TabelleBasePage;
