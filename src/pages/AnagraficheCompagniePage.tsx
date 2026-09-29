import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, UserCheck, Scale, Eye, Trash2 } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { assertFiscalValid } from "@/lib/assertFiscalValid";
import { matchesAnagraficaListSearch } from "@/lib/searchNoEmail";

const TIPI = [
  { value: "liquidatore", label: "Liquidatori", icon: UserCheck },
  { value: "perito", label: "Periti", icon: Eye },
  { value: "legale", label: "Legali", icon: Scale },
] as const;

type TipoAnagrafica = typeof TIPI[number]["value"];

interface Anagrafica {
  id: string;
  tipo: string;
  codice: string | null;
  nome: string | null;
  nome_breve: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  partita_iva: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  cellulare: string | null;
  fax: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  compagnia_id: string | null;
  specializzazione: string | null;
  albo_numero: string | null;
  referente_nome: string | null;
  referente_email: string | null;
  studio_ufficio: string | null;
  note: string | null;
  attivo: boolean | null;
  ufficio_id: string | null;
  sigla: string | null;
  banca_riga1: string | null;
  banca_riga2: string | null;
  banca_riga3: string | null;
  nome_rui: string | null;
  iscrizione_rui: string | null;
  numero_rui: string | null;
  sezione_rui: string | null;
  annullato: boolean | null;
  percentuale_base: number | null;
  codice_fornitore: string | null;
  percentuale_ra: number | null;
  percentuale_consulenza: number | null;
  abi: string | null;
  cab: string | null;
  iban: string | null;
  intestatario_cc: string | null;
}

const emptyForm = {
  codice: "", nome: "", nome_breve: "", cognome: "", ragione_sociale: "",
  codice_fiscale: "", partita_iva: "",
  email: "", pec: "", telefono: "", cellulare: "", fax: "",
  indirizzo: "", cap: "", citta: "", provincia: "",
  compagnia_id: "", specializzazione: "", albo_numero: "",
  referente_nome: "", referente_email: "", studio_ufficio: "", note: "",
  ufficio_id: "",
  // AE
  sigla: "", banca_riga1: "", banca_riga2: "", banca_riga3: "",
  nome_rui: "", iscrizione_rui: "", numero_rui: "", sezione_rui: "",
  // Produttori / commerciali
  percentuale_base: "", percentuale_consulenza: "", codice_fornitore: "", percentuale_ra: "4.60",
  abi: "", cab: "", iban: "", intestatario_cc: "",
};

const AnagraficheCompagniePage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TipoAnagrafica>("liquidatore");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Anagrafica | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["anagrafiche_professionali", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("*")
        .eq("tipo", activeTab)
        .order("cognome", { ascending: true });
      if (error) throw error;
      return data as unknown as Anagrafica[];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_select"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: ufficiList = [] } = useQuery({
    queryKey: ["uffici_select"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio, codice_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []) as unknown as { id: string; nome_ufficio: string; codice_ufficio: string }[];
    },
  });

  const isCommerciale = false;
  const isAE = false;
  const isCorr = false;
  const isNewCommercial = false;
  const isProduttore = false;

  const createMutation = useMutation({
    mutationFn: async () => {
      assertFiscalValid([
        { label: "Codice Fiscale", value: form.codice_fiscale, kind: "cf-azienda" },
        { label: "Partita IVA", value: form.partita_iva, kind: "piva" },
      ]);
      const resolvedUfficioId = isProduttore
        ? (form.ufficio_id || profile?.ufficio_id || null)
        : (profile?.ufficio_id || null);

      if (isProduttore && !resolvedUfficioId) {
        throw new Error("Selezionare un ufficio per il produttore");
      }

      const payload: Record<string, unknown> = {
        tipo: activeTab,
        codice: form.codice || null,
        nome: form.nome || null,
        nome_breve: form.nome_breve || null,
        cognome: form.cognome || null,
        ragione_sociale: form.ragione_sociale || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        email: form.email || null,
        pec: form.pec || null,
        telefono: form.telefono || null,
        cellulare: form.cellulare || null,
        fax: form.fax || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        compagnia_id: form.compagnia_id || null,
        specializzazione: form.specializzazione || null,
        albo_numero: form.albo_numero || null,
        referente_nome: form.referente_nome || null,
        referente_email: form.referente_email || null,
        studio_ufficio: form.studio_ufficio || null,
        note: form.note || null,
        ufficio_id: resolvedUfficioId,
        sigla: form.sigla || null,
        banca_riga1: form.banca_riga1 || null,
        banca_riga2: form.banca_riga2 || null,
        banca_riga3: form.banca_riga3 || null,
        nome_rui: form.nome_rui || null,
        iscrizione_rui: form.iscrizione_rui || null,
        numero_rui: form.numero_rui || null,
        sezione_rui: form.sezione_rui || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : 0,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : 0,
        codice_fornitore: form.codice_fornitore || null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : 4.60,
        abi: form.abi || null,
        cab: form.cab || null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
      };
      const { error } = await supabase.from("anagrafiche_professionali").insert([payload as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Anagrafica creata con successo");
    },
    onError: (e: Error) => {
      toast.error("Errore");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nessun record selezionato");
      assertFiscalValid([
        { label: "Codice Fiscale", value: form.codice_fiscale, kind: "cf-azienda" },
        { label: "Partita IVA", value: form.partita_iva, kind: "piva" },
      ]);
      const resolvedUfficioId = isProduttore
        ? (form.ufficio_id || profile?.ufficio_id || null)
        : (profile?.ufficio_id || null);

      const payload: Record<string, unknown> = {
        codice: form.codice || null,
        nome: form.nome || null,
        nome_breve: form.nome_breve || null,
        cognome: form.cognome || null,
        ragione_sociale: form.ragione_sociale || null,
        codice_fiscale: form.codice_fiscale || null,
        partita_iva: form.partita_iva || null,
        email: form.email || null,
        pec: form.pec || null,
        telefono: form.telefono || null,
        cellulare: form.cellulare || null,
        fax: form.fax || null,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        compagnia_id: form.compagnia_id || null,
        specializzazione: form.specializzazione || null,
        albo_numero: form.albo_numero || null,
        referente_nome: form.referente_nome || null,
        referente_email: form.referente_email || null,
        studio_ufficio: form.studio_ufficio || null,
        note: form.note || null,
        ufficio_id: resolvedUfficioId,
        sigla: form.sigla || null,
        banca_riga1: form.banca_riga1 || null,
        banca_riga2: form.banca_riga2 || null,
        banca_riga3: form.banca_riga3 || null,
        nome_rui: form.nome_rui || null,
        iscrizione_rui: form.iscrizione_rui || null,
        numero_rui: form.numero_rui || null,
        sezione_rui: form.sezione_rui || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : 0,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : 0,
        codice_fornitore: form.codice_fornitore || null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : 4.60,
        abi: form.abi || null,
        cab: form.cab || null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("anagrafiche_professionali").update(payload).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("Anagrafica aggiornata con successo");
    },
    onError: (e: Error) => {
      toast.error("Errore durante l'aggiornamento");
    },
  });

  const openEdit = (item: Anagrafica) => {
    setEditingId(item.id);
    setForm({
      codice: item.codice || "",
      nome: item.nome || "",
      nome_breve: item.nome_breve || "",
      cognome: item.cognome || "",
      ragione_sociale: item.ragione_sociale || "",
      codice_fiscale: item.codice_fiscale || "",
      partita_iva: item.partita_iva || "",
      email: item.email || "",
      pec: item.pec || "",
      telefono: item.telefono || "",
      cellulare: item.cellulare || "",
      fax: item.fax || "",
      indirizzo: item.indirizzo || "",
      cap: item.cap || "",
      citta: item.citta || "",
      provincia: item.provincia || "",
      compagnia_id: item.compagnia_id || "",
      specializzazione: item.specializzazione || "",
      albo_numero: item.albo_numero || "",
      referente_nome: item.referente_nome || "",
      referente_email: item.referente_email || "",
      studio_ufficio: item.studio_ufficio || "",
      note: item.note || "",
      ufficio_id: item.ufficio_id || "",
      sigla: item.sigla || "",
      banca_riga1: item.banca_riga1 || "",
      banca_riga2: item.banca_riga2 || "",
      banca_riga3: item.banca_riga3 || "",
      nome_rui: item.nome_rui || "",
      iscrizione_rui: item.iscrizione_rui || "",
      numero_rui: item.numero_rui || "",
      sezione_rui: item.sezione_rui || "",
      percentuale_base: item.percentuale_base?.toString() || "",
      percentuale_consulenza: item.percentuale_consulenza?.toString() || "",
      codice_fornitore: item.codice_fornitore || "",
      percentuale_ra: item.percentuale_ra?.toString() || "4.60",
      abi: item.abi || "",
      cab: item.cab || "",
      iban: item.iban || "",
      intestatario_cc: item.intestatario_cc || "",
    });
    setDialogOpen(true);
  };

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("anagrafiche_professionali").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("anagrafiche_professionali").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anagrafiche_professionali"] });
      setDeleteTarget(null);
      toast.success("Anagrafica eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore eliminazione"),
  });

  const filtered = items.filter((item) => matchesAnagraficaListSearch(item, search));

  const tipoLabel = TIPI.find((t) => t.value === activeTab)?.label || "";
  const isPeritiLegali = activeTab === "perito" || activeTab === "legale";
  const isLiquidatore = activeTab === "liquidatore";

  const renderTableHeaders = () => {
    if (isPeritiLegali) {
      return (
        <TableRow>
          <TableHead>Codice / Nome Breve</TableHead>
          <TableHead>Nominativo</TableHead>
          <TableHead>Studio/Ufficio</TableHead>
          <TableHead>Indirizzo / Località / Mail</TableHead>
          <TableHead>Contatti</TableHead>
          <TableHead className="text-center">Attivo</TableHead>
        </TableRow>
      );
    }
    if (isAE) {
      return (
        <TableRow>
          <TableHead>Codice</TableHead>
          <TableHead>Descrizione</TableHead>
          <TableHead>Sigla</TableHead>
          <TableHead>Tel / Mail</TableHead>
          <TableHead>Dati RUI</TableHead>
          <TableHead>Dati Bancari</TableHead>
          <TableHead className="text-center">Ann.</TableHead>
        </TableRow>
      );
    }
    if (isCorr || isNewCommercial) {
      return (
        <TableRow>
          <TableHead>Cod</TableHead>
          <TableHead>Denominazione</TableHead>
          <TableHead>Indirizzo / Località</TableHead>
          <TableHead>% Provv / Cons / RA</TableHead>
          <TableHead>Tel / Mail</TableHead>
          <TableHead>IBAN</TableHead>
          <TableHead className="text-center">Stato</TableHead>
        </TableRow>
      );
    }
    return (
      <TableRow>
        <TableHead>Codice / Nome Breve</TableHead>
        <TableHead>Nome</TableHead>
        <TableHead>Indirizzo</TableHead>
        <TableHead>Contatti</TableHead>
        <TableHead>Attenzione di / Mail</TableHead>
        <TableHead>Agenzia</TableHead>
        <TableHead className="text-center">Attivo</TableHead>
      </TableRow>
    );
  };

  const getColSpan = () => {
    if (isPeritiLegali) return 6;
    if (isAE) return 7;
    if (isCorr || isNewCommercial) return 7;
    return 7;
  };

  const renderTableRow = (item: Anagrafica) => {
    const compName = compagnie.find((c) => c.id === item.compagnia_id)?.nome;
    const addressParts = [item.indirizzo, [item.cap, item.citta].filter(Boolean).join("  "), item.provincia].filter(Boolean);
    const phoneParts = [
      item.telefono ? `Tel ${item.telefono}` : null,
      item.fax ? `Fax ${item.fax}` : null,
      item.cellulare ? `Mob ${item.cellulare}` : null,
    ].filter(Boolean);

    if (isPeritiLegali) {
      return (
        <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
          <TableCell>
            <div className="font-medium">{item.codice || "—"}</div>
            <div className="text-xs text-muted-foreground">{item.nome_breve || ""}</div>
          </TableCell>
          <TableCell className="font-medium">
            {[item.cognome, item.nome].filter(Boolean).join(" ") || "—"}
          </TableCell>
          <TableCell>{item.studio_ufficio || "—"}</TableCell>
          <TableCell className="text-sm">
            {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : ""}
            {item.email && <div className="text-xs text-muted-foreground mt-0.5">{item.email}</div>}
            {!addressParts.length && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm">{phoneParts.length > 0 ? phoneParts.map((p, i) => <div key={i}>{p}</div>) : "—"}</TableCell>
          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <Switch checked={item.attivo ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Elimina" onClick={() => setDeleteTarget(item)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (isAE) {
      const ruiParts = [
        item.nome_rui,
        item.iscrizione_rui ? `Iscr. ${item.iscrizione_rui}` : null,
        item.numero_rui ? `N° ${item.numero_rui}` : null,
        item.sezione_rui ? `Sez. ${item.sezione_rui}` : null,
      ].filter(Boolean);
      const bancaParts = [item.banca_riga1, item.banca_riga2, item.banca_riga3].filter(Boolean);
      return (
         <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${item.annullato ? "opacity-50" : ""}`} onClick={() => openEdit(item)}>
          <TableCell className="font-medium">{item.codice || "—"}</TableCell>
          <TableCell className="font-medium">{item.ragione_sociale || item.cognome || item.nome || "—"}</TableCell>
          <TableCell>{item.sigla || "—"}</TableCell>
          <TableCell className="text-sm">
            {item.telefono && <div>Tel {item.telefono}</div>}
            {item.email && <div className="text-xs text-muted-foreground">{item.email}</div>}
            {!item.telefono && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm">
            {ruiParts.length > 0 ? ruiParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-sm">
            {bancaParts.length > 0 ? bancaParts.map((p, i) => <div key={i} className="text-xs">{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-center">
            {item.annullato ? <Badge variant="destructive" className="text-xs">A</Badge> : <Badge variant="secondary" className="text-xs">—</Badge>}
          </TableCell>
        </TableRow>
      );
    }

    if (isCorr || isNewCommercial) {
      return (
        <TableRow key={item.id} className={`cursor-pointer hover:bg-muted/50 ${item.annullato ? "opacity-50" : ""}`} onClick={() => openEdit(item)}>
          <TableCell className="font-medium">{item.codice || "—"}</TableCell>
          <TableCell className="font-medium">
            {item.cognome || item.ragione_sociale || "—"}
            {item.nome && <div className="text-xs text-muted-foreground">{item.nome}</div>}
          </TableCell>
          <TableCell className="text-sm">
            {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
          </TableCell>
          <TableCell className="text-sm">
            <div>Provv: {item.percentuale_base ?? 0}%</div>
            <div>Cons: {item.percentuale_consulenza ?? 0}%</div>
            <div>RA: {item.percentuale_ra ?? 0}%</div>
          </TableCell>
          <TableCell className="text-sm">
            {item.telefono && <div>Tel {item.telefono}</div>}
            {item.email && <div className="text-xs text-muted-foreground">{item.email}</div>}
            {!item.telefono && !item.email && "—"}
          </TableCell>
          <TableCell className="text-sm text-xs">{item.iban || "—"}</TableCell>
          <TableCell className="text-center">
            {item.annullato ? <Badge variant="destructive" className="text-xs">Ann.</Badge> : <Badge variant="secondary" className="text-xs">Attivo</Badge>}
          </TableCell>
        </TableRow>
      );
    }

    // Liquidatori
    return (
      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
        <TableCell>
          <div className="font-medium">{item.codice || "—"}</div>
          <div className="text-xs text-muted-foreground">{item.nome_breve || ""}</div>
        </TableCell>
        <TableCell className="font-medium">{item.nome || "—"}</TableCell>
        <TableCell className="text-sm">
          {addressParts.length > 0 ? addressParts.map((p, i) => <div key={i}>{p}</div>) : "—"}
        </TableCell>
        <TableCell className="text-sm">{phoneParts.length > 0 ? phoneParts.map((p, i) => <div key={i}>{p}</div>) : "—"}</TableCell>
        <TableCell>
          {item.referente_nome && <div className="font-medium text-sm">{item.referente_nome}</div>}
          {item.referente_email && <div className="text-xs text-muted-foreground">{item.referente_email}</div>}
          {!item.referente_nome && !item.referente_email && "—"}
        </TableCell>
        <TableCell className="text-sm">{compName || "—"}</TableCell>
        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            <Switch checked={item.attivo ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: item.id, attivo: v })} />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Elimina" onClick={() => setDeleteTarget(item)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderUfficioSelect = () => {
    if (!isProduttore) return null;
    return (
      <div className="mb-4">
        <Label>Ufficio *</Label>
        <Select
          value={form.ufficio_id || (profile?.ufficio_id ?? "")}
          onValueChange={(v) => setForm({ ...form, ufficio_id: v })}
          disabled={false}
        >
          <SelectTrigger><SelectValue placeholder="Seleziona sede..." /></SelectTrigger>
          <SelectContent>
            {ufficiList.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.codice_ufficio} — {u.nome_ufficio}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderFormFields = () => {
    if (isAE) {
      return (
        <>
          {renderUfficioSelect()}
          <Tabs defaultValue="dati">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="dati">Dati</TabsTrigger>
              <TabsTrigger value="rui">RUI & Banca</TabsTrigger>
              <TabsTrigger value="contatti">Contatti & Note</TabsTrigger>
            </TabsList>
            <TabsContent value="dati" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} /></div>
                <div><Label>Sigla</Label><Input value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} /></div>
                <div className="col-span-2"><Label>Descrizione (Ragione Sociale)</Label><Input value={form.ragione_sociale} onChange={(e) => setForm({ ...form, ragione_sociale: e.target.value })} /></div>
                <div><Label>Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="rui" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Dati RUI</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                <div><Label>Iscrizione RUI</Label><Input value={form.iscrizione_rui} onChange={(e) => setForm({ ...form, iscrizione_rui: e.target.value })} placeholder="dd/mm/yyyy" /></div>
                <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} placeholder="Es. B" /></div>
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Dati Bancari</p>
              <div className="grid grid-cols-1 gap-3">
                <div><Label>Banca (riga 1)</Label><Input value={form.banca_riga1} onChange={(e) => setForm({ ...form, banca_riga1: e.target.value })} /></div>
                <div><Label>Banca (riga 2)</Label><Input value={form.banca_riga2} onChange={(e) => setForm({ ...form, banca_riga2: e.target.value })} /></div>
                <div><Label>Banca (riga 3)</Label><Input value={form.banca_riga3} onChange={(e) => setForm({ ...form, banca_riga3: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="contatti" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            </TabsContent>
          </Tabs>
        </>
      );
    }

    if (isCorr) {
      return (
        <>
          {renderUfficioSelect()}
          <Tabs defaultValue="dati">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="dati">Dati</TabsTrigger>
              <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
              <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
              <TabsTrigger value="banca">Banca</TabsTrigger>
            </TabsList>
            <TabsContent value="dati" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} /></div>
                <div><Label>Codice Fornitore</Label><Input value={form.codice_fornitore} onChange={(e) => setForm({ ...form, codice_fornitore: e.target.value })} /></div>
                <div className="col-span-2"><Label>Descrizione (Ragione Sociale)</Label><Input value={form.ragione_sociale} onChange={(e) => setForm({ ...form, ragione_sociale: e.target.value })} /></div>
                <div><Label>Azienda o Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                <div><Label>Segue o Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="indirizzo" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                <div><Label>Località</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
                <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            </TabsContent>
            <TabsContent value="provvigioni" className="space-y-3 mt-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                <div><Label>% Provv. Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                <div><Label>% RA (Ritenuta Acconto)</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="banca" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ABI</Label><Input value={form.abi} onChange={(e) => setForm({ ...form, abi: e.target.value })} /></div>
                <div><Label>CAB</Label><Input value={form.cab} onChange={(e) => setForm({ ...form, cab: e.target.value })} /></div>
                <div className="col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
                <div className="col-span-2"><Label>Intestatario C/C</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      );
    }

    if (isNewCommercial) {
      return (
        <>
          {renderUfficioSelect()}
          <Tabs defaultValue="dati">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="dati">Dati</TabsTrigger>
              <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
              <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
              <TabsTrigger value="banca">RUI & Banca</TabsTrigger>
            </TabsList>
            <TabsContent value="dati" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} /></div>
                <div><Label>Codice Fornitore</Label><Input value={form.codice_fornitore} onChange={(e) => setForm({ ...form, codice_fornitore: e.target.value })} /></div>
                <div><Label>Cognome o Denominazione *</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                <div><Label>Nome o seguito Denominazione</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>Codice Fiscale</Label><FiscalCodeInput kind="cf-azienda" value={form.codice_fiscale || ""} onChange={(val) => setForm({ ...form, codice_fiscale: val })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="indirizzo" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
                <div><Label>Comune</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
            </TabsContent>
            <TabsContent value="provvigioni" className="space-y-3 mt-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                <div><Label>% Provv. Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                <div><Label>% RA (Ritenuta Acconto)</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
              </div>
            </TabsContent>
            <TabsContent value="banca" className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Iscrizione RUI</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome Iscrizione RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                <div><Label>Data Iscrizione RUI</Label><Input value={form.iscrizione_rui} onChange={(e) => setForm({ ...form, iscrizione_rui: e.target.value })} placeholder="dd/mm/yyyy" /></div>
                <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Coordinate Bancarie</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ABI</Label><Input value={form.abi} onChange={(e) => setForm({ ...form, abi: e.target.value })} /></div>
                <div><Label>CAB</Label><Input value={form.cab} onChange={(e) => setForm({ ...form, cab: e.target.value })} /></div>
                <div className="col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
                <div className="col-span-2"><Label>Intestatario C/C</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      );
    }

    // Liquidatori, Periti, Legali
    return (
      <Tabs defaultValue="dati">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="dati">Dati Personali</TabsTrigger>
          <TabsTrigger value="contatti">Contatti</TabsTrigger>
          <TabsTrigger value="indirizzo">Indirizzo & Note</TabsTrigger>
        </TabsList>
        <TabsContent value="dati" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Codice</Label><Input value={form.codice} onChange={(e) => setForm({ ...form, codice: e.target.value })} placeholder="Es. 51" /></div>
            <div><Label>Nome Breve</Label><Input value={form.nome_breve} onChange={(e) => setForm({ ...form, nome_breve: e.target.value })} /></div>
            <div><Label>Cognome</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Studio / Ufficio</Label><Input value={form.studio_ufficio} onChange={(e) => setForm({ ...form, studio_ufficio: e.target.value })} /></div>
            <div>
              <Label>Agenzia</Label>
              <Select value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                <SelectContent>
                  {compagnie.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Codice Fiscale</Label><FiscalCodeInput kind="cf-azienda" value={form.codice_fiscale || ""} onChange={(val) => {
              const updates: any = { ...form, codice_fiscale: val };
              if (val.length === 11 && /^\d{11}$/.test(val) && !form.partita_iva) {
                updates.partita_iva = val;
                toast.info("Partita IVA copiata dal Codice Fiscale");
              }
              setForm(updates);
            }} /></div>
            <div><Label>Partita IVA</Label><FiscalCodeInput kind="piva" value={form.partita_iva || ""} onChange={(val) => setForm({ ...form, partita_iva: val })} /></div>
            <div><Label>N° Albo</Label><Input value={form.albo_numero} onChange={(e) => setForm({ ...form, albo_numero: e.target.value })} /></div>
            <div><Label>Specializzazione</Label><Input value={form.specializzazione} onChange={(e) => setForm({ ...form, specializzazione: e.target.value })} /></div>
          </div>
        </TabsContent>
        <TabsContent value="contatti" className="space-y-3 mt-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Contatti diretti</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
            <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
            <div><Label>Cellulare</Label><Input value={form.cellulare} onChange={(e) => setForm({ ...form, cellulare: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>PEC</Label><Input type="email" value={form.pec} onChange={(e) => setForm({ ...form, pec: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-4 mb-2">Attenzione di (referente)</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome Referente</Label><Input value={form.referente_nome} onChange={(e) => setForm({ ...form, referente_nome: e.target.value })} /></div>
            <div><Label>Email Referente</Label><Input type="email" value={form.referente_email} onChange={(e) => setForm({ ...form, referente_email: e.target.value })} /></div>
          </div>
        </TabsContent>
        <TabsContent value="indirizzo" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f: any) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
            <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
            <div><Label>Città</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
            <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} maxLength={2} /></div>
          </div>
          <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anagrafiche Agenzie</h1>
          <p className="text-sm text-muted-foreground">Figure esterne nominate dalle compagnie: Liquidatori, Periti, Legali</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Nuovo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TipoAnagrafica); setSearch(""); }}>
        <TabsList>
          {TIPI.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="w-4 h-4" />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cerca per nome, codice, città..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} risultati</Badge>
        </div>

        {TIPI.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>{renderTableHeaders()}</TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={getColSpan()} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={getColSpan()} className="text-center py-8 text-muted-foreground">Nessun risultato trovato</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => renderTableRow(item))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? `Modifica ${tipoLabel.slice(0, -1)}` : `Nuovo ${tipoLabel.slice(0, -1)}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editingId ? updateMutation.mutate() : createMutation.mutate(); }} className="space-y-4">
            {renderFormFields()}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteWithImpactDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityId={deleteTarget?.id}
        entityType={tipoLabel.slice(0, -1).toLowerCase() || "anagrafica"}
        entityName={deleteTarget ? (deleteTarget.ragione_sociale || [deleteTarget.cognome, deleteTarget.nome].filter(Boolean).join(" ") || deleteTarget.codice || "—") : "—"}
        checks={[
          { table: "sinistri", column: "liquidatore_id", label: "Sinistri (liquidatore)" },
          { table: "sinistri", column: "perito_id", label: "Sinistri (perito)" },
          { table: "titoli", column: "anagrafica_commerciale_id", label: "Polizze (commerciale)" },
          { table: "produttori_provvigioni_ramo", column: "anagrafica_id", label: "Provvigioni per ramo" },
          { table: "fornitori", column: "anagrafica_professionale_id", label: "Fornitori collegati", blocking: false },
        ]}
        onConfirmDelete={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onDeactivateInstead={
          deleteTarget?.attivo
            ? () => deleteTarget && toggleMutation.mutate({ id: deleteTarget.id, attivo: false })
            : undefined
        }
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
};

export default AnagraficheCompagniePage;