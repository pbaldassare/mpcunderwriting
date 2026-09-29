import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Building2, Search, Percent, Pencil, Layers, Trash2, Network, AlertTriangle, ShieldCheck } from "lucide-react";

const PLURIMANDATARIO_CODE = "PLURIMANDATARIO";

import RapportiCompagniaDialog from "@/components/compagnie/RapportiCompagniaDialog";
import ProvvigioniCompagniaDialog from "@/components/compagnie/ProvvigioniCompagniaDialog";


import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { toast } from "sonner";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  filterAgenzieList,
  filterCompagnieAssicurativeList,
  matchesAgenziaSearch,
} from "@/lib/compagnieSearch";

// ── Constants ──

const NAZIONI = [
  "BELGIO", "DEUTSCHLAND", "FRANCIA", "GRAN BRETAGNA", "ITALIA",
  "LUSSEMBURGO", "PRINCIPATO DI MONACO", "STATI UNITI D'AMERICA", "SVIZZERA",
  "COREA DEL SUD",
].sort();

const STATI_COMPAGNIA = ["Attivo", "Sospeso", "Non Operativo"];

const TIPI_MANDATARIO = [
  "Direzione", "Gerenza", "Agenzia Generale", "Agente Monomandatario",
  "Agente Multimandatario", "Broker", "Sub-Agente", "Agenzia Estera",
  "Agente Estero", "Broker Estero", "Lloyd's Coverholder", "Lloyd's Broker",
  "Lloyd's Service Company", "Altro",
];

const GRUPPI_STATISTICI = [
  "BROKER","COMP. ESTERE","COMP. ESTERE (in Italia)","Corrispondente LLOYD'S","Da definire",
  "DELEGA ALTRUI","EUROINS","FIN CASSA","Gruppo AIG","Gruppo ALLIANZ","Gruppo AMISSIMA",
  "Gruppo AMTRUST","Gruppo ARAG","Gruppo ARFIN","Gruppo ASSIMOCO","Gruppo ASSITALIA",
  "Gruppo ATRADIUS","Gruppo AUGUSTA","Gruppo AVIVA","Gruppo AXA","Gruppo BANCA CARIGE",
  "Gruppo BANCA DI TOKJO","Gruppo BAVARIA","Gruppo BENE","Gruppo BNC","Gruppo CATTOLICA",
  "Gruppo CELERITAS","Gruppo CHUBB","Gruppo CIDAS","Gruppo CIGNA","Gruppo CNA",
  "Gruppo COFACE","Gruppo CREDENDO","Gruppo CREDIT SUISSE","Gruppo DALLBOG",
  "Gruppo DUAL AGENCY","Gruppo ELBA","Gruppo EUROPE ASSISTANCE","Gruppo FARO",
  "Gruppo FIAT - TORO","Gruppo FONDIARIA - SAI","Gruppo GENERALI","Gruppo GLOBAL ASSISTANCE",
  "Gruppo GROUPAMA","Gruppo H.D.I.","Gruppo HARMONIE MUTUELLE","Gruppo HELVETIA",
  "Gruppo INTERGEA SpA","Gruppo IPA","Gruppo ITAS","Gruppo LA DIFESA","Gruppo LEGAL & GENERAL",
  "Gruppo LIBERTY","Gruppo LIGRESTI","Gruppo LIGURIA/DE LONGHI","Gruppo MARCHAND OLANDESE",
  "Gruppo METLIFE","Gruppo MILANESE","Gruppo MINERVA","Gruppo MUT. MANS","Gruppo NOBIS",
  "Gruppo NORDITALIA","Gruppo NOVIT","Gruppo POSTE","Gruppo QBE","Gruppo REALE MUTUA",
  "Gruppo REVO","Gruppo ROLAND","Gruppo ROYAL & SUN A.","Gruppo S2C","Gruppo SACE",
  "Gruppo SARA","Gruppo SIAC","Gruppo SMABTP","Gruppo SWISS RE","Gruppo TALANX",
  "Gruppo TELECOM ITALIA","Gruppo TOKIO MARINE","Gruppo UCA","Gruppo UNIPOL",
  "Gruppo UNIQA Austria","Gruppo VINCI","Gruppo VITTORIA","Gruppo ZURICH F.S.",
  "Società Finanziarie","VHV",
];

const TIPI_PAGAMENTO = ["Assegno bancario", "Assegno circolare", "Bonifico", "Rimessa Diretta"];
const FIRME_DIGITALI = ["No", "FES", "FEA"];
const TIPI_COPERTURA = ["Deposito a copertura", "Scambio conferme", "Conferma solo da parte Broker"];

// ── Types ──

const TIPI_AGENZIA = ["agenzia", "broker", "direzione", "plurimandataria"];
const TIPI_LABEL: Record<string, string> = {
  agenzia: "Agenzia",
  broker: "Broker",
  direzione: "Direzione",
  plurimandataria: "Plurimandataria",
};

interface CompagniaForm {
  tipo: string;
  nome: string;
  nome_sede: string;
  codice: string;
  nome_segue: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  stato: string;
  telefono: string;
  fax: string;
  cellulare: string;
  note: string;
  mail: string;
  pec: string;
  mail_ec: string;
  mail_avvisi: string;
  email_messe_a_cassa: string;
  email_estratto_conto: string;
  codice_fiscale: string;
  partita_iva: string;
  iscrizione_rui_sez: string;
  iscrizione_rui_num: string;
  pagamento: string;
  tipo_pagamento: string;
  percentuale_ra: string;
  gruppo_compagnia: string;
  gruppo_compagnia_id: string;
  tipo_mandatario: string;
  gruppo_statistico: string;
  iban: string;
  codice_abi: string;
  codice_cab: string;
  intestato_a: string;
  bic: string;
  citta_banca: string;
  conto_bancario_id: string | null;
  // Mini-form conto bancario dell'agenzia (record in conti_bancari)
  conto_etichetta: string;
  conto_banca: string;
  conto_iban: string;
  conto_intestato_a: string;
  conto_bic: string;
  conto_abi: string;
  conto_cab: string;
  conto_note: string;
  conto_is_default: boolean;
  aut_incasso_118: boolean;
  tipo_copertura: string;
  ra_ec_negativi: boolean;
  allegato_excel_avvisi: boolean;
  allegato_excel_ec: boolean;
  firma_digitale: string;
  escluso_all4: boolean;
}

const emptyForm: CompagniaForm = {
  tipo: "agenzia",
  nome: "", nome_sede: "", codice: "", nome_segue: "", indirizzo: "", cap: "", comune: "", provincia: "",
  nazione: "ITALIA", stato: "Attivo", telefono: "", fax: "", cellulare: "", note: "",
  mail: "", pec: "", mail_ec: "", mail_avvisi: "",
  email_messe_a_cassa: "pscarpelli@consulbrokers.it",
  email_estratto_conto: "pscarpelli@consulbrokers.it",
  codice_fiscale: "", partita_iva: "", iscrizione_rui_sez: "", iscrizione_rui_num: "",
  pagamento: "", tipo_pagamento: "", percentuale_ra: "4.6",
  gruppo_compagnia: "", gruppo_compagnia_id: "", tipo_mandatario: "", gruppo_statistico: "",
  iban: "", codice_abi: "", codice_cab: "", intestato_a: "", bic: "", citta_banca: "",
  conto_bancario_id: null,
  conto_etichetta: "", conto_banca: "", conto_iban: "", conto_intestato_a: "",
  conto_bic: "", conto_abi: "", conto_cab: "", conto_note: "", conto_is_default: true,
  aut_incasso_118: false, tipo_copertura: "", ra_ec_negativi: false,
  allegato_excel_avvisi: false, allegato_excel_ec: false, firma_digitale: "No", escluso_all4: false,
};

function toOptions(arr: string[]) {
  return arr.map((v) => ({ value: v, label: v }));
}

function dbToForm(c: any): CompagniaForm {
  return {
    tipo: c.tipo || "agenzia",
    nome: c.nome || "",
    nome_sede: c.nome_sede || "",
    codice: c.codice || "",
    nome_segue: c.nome_segue || "",
    indirizzo: c.indirizzo || "",
    cap: c.cap || "",
    comune: c.comune || "",
    provincia: c.provincia || "",
    nazione: c.nazione || "ITALIA",
    stato: c.stato || "Attivo",
    telefono: c.telefono || "",
    fax: c.fax || "",
    cellulare: c.cellulare || "",
    note: c.note || "",
    mail: c.mail || "",
    pec: c.pec || "",
    mail_ec: c.mail_ec || "",
    mail_avvisi: c.mail_avvisi || "",
    email_messe_a_cassa: c.email_messe_a_cassa || "pscarpelli@consulbrokers.it",
    email_estratto_conto: c.email_estratto_conto || "pscarpelli@consulbrokers.it",
    codice_fiscale: c.codice_fiscale || "",
    partita_iva: c.partita_iva || "",
    iscrizione_rui_sez: c.iscrizione_rui_sez || "",
    iscrizione_rui_num: c.iscrizione_rui_num || "",
    pagamento: c.pagamento || "",
    tipo_pagamento: c.tipo_pagamento || "",
    percentuale_ra: c.percentuale_ra != null ? String(c.percentuale_ra) : "4.6",
    gruppo_compagnia: c.gruppo_compagnia || "",
    gruppo_compagnia_id: c.gruppo_compagnia_id || "",
    tipo_mandatario: c.tipo_mandatario || "",
    gruppo_statistico: c.gruppo_statistico || "",
    iban: c.iban || "",
    codice_abi: c.codice_abi || "",
    codice_cab: c.codice_cab || "",
    intestato_a: c.intestato_a || "",
    bic: c.bic || "",
    citta_banca: c.citta_banca || "",
    conto_bancario_id: c.conto_bancario_id || null,
    conto_etichetta: "", conto_banca: "", conto_iban: "", conto_intestato_a: "",
    conto_bic: "", conto_abi: "", conto_cab: "", conto_note: "", conto_is_default: true,
    aut_incasso_118: c.aut_incasso_118 ?? false,
    tipo_copertura: c.tipo_copertura || "",
    ra_ec_negativi: c.ra_ec_negativi ?? false,
    allegato_excel_avvisi: c.allegato_excel_avvisi ?? false,
    allegato_excel_ec: c.allegato_excel_ec ?? false,
    firma_digitale: c.firma_digitale || "No",
    escluso_all4: c.escluso_all4 ?? false,
  };
}

function formToPayload(form: CompagniaForm) {
  const parsedPercentualeRa = parseFloat(form.percentuale_ra);
  const percentualeRa = Number.isFinite(parsedPercentualeRa) ? parsedPercentualeRa : 4.6;
  return {
    tipo: form.tipo || "agenzia",
    nome: form.nome,
    nome_sede: form.nome_sede || null,
    codice: form.codice || null,
    nome_segue: form.nome_segue || null,
    indirizzo: form.indirizzo || null,
    cap: form.cap || null,
    comune: form.comune || null,
    provincia: form.provincia || null,
    nazione: form.nazione || null,
    stato: form.stato || null,
    telefono: form.telefono || null,
    fax: form.fax || null,
    cellulare: form.cellulare || null,
    note: form.note || null,
    mail: form.mail || null,
    pec: form.pec || null,
    mail_ec: form.mail_ec || null,
    mail_avvisi: form.mail_avvisi || null,
    email_messe_a_cassa: form.email_messe_a_cassa || null,
    email_estratto_conto: form.email_estratto_conto || null,
    codice_fiscale: form.codice_fiscale || null,
    partita_iva: form.partita_iva || null,
    iscrizione_rui_sez: form.iscrizione_rui_sez || null,
    iscrizione_rui_num: form.iscrizione_rui_num || null,
    pagamento: form.pagamento || null,
    tipo_pagamento: form.tipo_pagamento || null,
    percentuale_ra: percentualeRa,
    gruppo_compagnia: form.gruppo_compagnia || null,
    gruppo_compagnia_id: form.gruppo_compagnia_id || null,
    tipo_mandatario: form.tipo_mandatario || null,
    gruppo_statistico: form.gruppo_statistico || null,
    iban: form.iban || null,
    codice_abi: form.codice_abi || null,
    codice_cab: form.codice_cab || null,
    intestato_a: form.intestato_a || null,
    bic: form.bic || null,
    citta_banca: form.citta_banca || null,
    conto_bancario_id: form.conto_bancario_id || null,
    aut_incasso_118: form.aut_incasso_118,
    tipo_copertura: form.tipo_copertura || null,
    ra_ec_negativi: form.ra_ec_negativi,
    allegato_excel_avvisi: form.allegato_excel_avvisi,
    allegato_excel_ec: form.allegato_excel_ec,
    firma_digitale: form.firma_digitale || "No",
    escluso_all4: form.escluso_all4,
  };
}

// Crea o aggiorna il conto bancario dell'agenzia in conti_bancari. Ritorna l'id (o null se no-op).
async function persistContoAgenzia(
  compagniaId: string,
  form: CompagniaForm,
): Promise<string | null> {
  const iban = (form.conto_iban || "").trim().toUpperCase();
  // No-op se né IBAN né record esistente
  if (!iban && !form.conto_bancario_id) return null;
  if (iban && iban.startsWith("IT") && iban.length !== 27) {
    throw new Error(`IBAN italiano non valido (${iban.length} caratteri, attesi 27).`);
  }
  const intestatario = form.conto_intestato_a?.trim() || form.nome?.trim() || "";
  if (iban && !intestatario) {
    throw new Error("Specifica l'intestatario del conto bancario (o la ragione sociale dell'agenzia).");
  }
  const payload: any = {
    tipo: "agenzia",
    compagnia_id: compagniaId,
    etichetta: form.conto_etichetta?.trim() || form.conto_banca?.trim() || "Conto agenzia",
    banca: form.conto_banca?.trim() || "Banca da definire",
    iban: iban || null,
    intestato_a: intestatario || null,
    bic: form.conto_bic?.trim() || null,
    codice_abi: form.conto_abi?.trim() || null,
    codice_cab: form.conto_cab?.trim() || null,
    note: form.conto_note?.trim() || null,
    is_default: !!form.conto_is_default,
    attivo: true,
  };
  if (form.conto_bancario_id) {
    const { error } = await supabase
      .from("conti_bancari")
      .update(payload)
      .eq("id", form.conto_bancario_id);
    if (error) throw error;
    return form.conto_bancario_id;
  }
  if (!iban) return null;
  const { data, error } = await supabase
    .from("conti_bancari")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data?.id || null;
}

function ProvvigioniTabContent({ compagniaId }: { compagniaId: string | null }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProvv, setNewProvv] = useState({ categoria_id: "", percentuale: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: categorie = [] } = useQuery({
    queryKey: ["categorie_prodotto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorie_prodotto").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: provvigioni = [], isLoading } = useQuery({
    queryKey: ["provvigioni_compagnia_ramo", compagniaId],
    queryFn: async () => {
      if (!compagniaId) return [];
      const { data, error } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("*, categorie_prodotto(id, nome)")
        .eq("compagnia_id", compagniaId)
        .eq("attiva", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!compagniaId,
  });

  const categoriaOptions = categorie.map((c: any) => ({ value: c.id, label: c.nome }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo").insert({
        compagnia_id: compagniaId,
        categoria_id: newProvv.categoria_id,
        percentuale_provvigione: parseFloat(newProvv.percentuale),
        attiva: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo", compagniaId] });
      setCreateOpen(false);
      setNewProvv({ categoria_id: "", percentuale: "" });
      toast.success("Provvigione per ramo creata");
    },
    onError: (err: any) => toast.error(err.message?.includes("duplicate") ? "Ramo già configurato per questa agenzia" : "Errore nella creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("provvigioni_compagnia_ramo")
        .update({ percentuale_provvigione: value } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provvigioni_compagnia_ramo", compagniaId] });
      setEditingId(null);
      toast.success("Provvigione aggiornata");
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  if (!compagniaId) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Percent className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Salva l'agenzia prima di configurare le provvigioni per ramo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Provvigioni configurate: {provvigioni.length}</p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" />Nuova Provvigione</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Provvigione per Ramo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ramo (Categoria) *</Label>
                <SearchableSelect
                  options={categoriaOptions}
                  value={newProvv.categoria_id}
                  onValueChange={(v) => setNewProvv((p) => ({ ...p, categoria_id: v }))}
                  placeholder="Seleziona ramo..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Provvigione % *</Label>
                <Input type="number" step="0.01" value={newProvv.percentuale} onChange={(e) => setNewProvv((p) => ({ ...p, percentuale: e.target.value }))} placeholder="es. 5" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!newProvv.categoria_id || !newProvv.percentuale || createMutation.isPending} className="w-full">
                Crea Provvigione
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Garanzia</TableHead>
              <TableHead>Provvigione %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {provvigioni.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell><Badge variant="outline">{p.categorie_prodotto?.nome || "—"}</Badge></TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="w-20 h-8"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editValue) updateMutation.mutate({ id: p.id, value: parseFloat(editValue) });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={() => { setEditingId(p.id); setEditValue(String(p.percentuale_provvigione ?? "")); }}
                    >
                      <span className="font-semibold">{p.percentuale_provvigione}%</span>
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {provvigioni.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nessuna provvigione configurata</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CompagniaFormDialog({
  form, setForm, onSave, saving, title, saveLabel, compagniaId,
}: {
  form: CompagniaForm;
  setForm: React.Dispatch<React.SetStateAction<CompagniaForm>>;
  onSave: () => void;
  saving: boolean;
  title: string;
  saveLabel: string;
  compagniaId: string | null;
}) {
  const setField = (key: keyof CompagniaForm, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { data: gruppiCompagnia = [] } = useQuery({
    queryKey: ["gruppi_compagnia_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia")
        .select("id, descrizione, codice")
        .eq("attivo", true)
        .order("descrizione");
      return (data || []).map((g: any) => ({
        value: g.id,
        label: g.codice === PLURIMANDATARIO_CODE ? `⚠️ ${g.descrizione} (Fallback)` : g.descrizione,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });

  // Carica il conto bancario dell'agenzia esistente (edit mode)
  useEffect(() => {
    if (!compagniaId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conti_bancari")
        .select("id, etichetta, banca, iban, intestato_a, bic, codice_abi, codice_cab, note, is_default")
        .eq("compagnia_id", compagniaId)
        .is("rapporto_id", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);
      if (cancelled || !data || data.length === 0) return;
      const c: any = data[0];
      setForm((prev) => ({
        ...prev,
        conto_bancario_id: c.id,
        conto_etichetta: c.etichetta || "",
        conto_banca: c.banca || "",
        conto_iban: c.iban || "",
        conto_intestato_a: c.intestato_a || "",
        conto_bic: c.bic || "",
        conto_abi: c.codice_abi || "",
        conto_cab: c.codice_cab || "",
        conto_note: c.note || "",
        conto_is_default: c.is_default ?? true,
      }));
    })();
    return () => { cancelled = true; };
  }, [compagniaId, setForm]);
  const renderField = (label: string, field: keyof CompagniaForm, placeholder?: string, className?: string) => (
    <div className={`space-y-1 ${className || ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={(form[field] as string) || ""} onChange={(e) => setField(field, e.target.value)} placeholder={placeholder} />
    </div>
  );

  const isBrokerLike = form.tipo === "broker" || form.tipo === "plurimandataria";
  const needsGruppo = form.tipo === "agenzia" || form.tipo === "direzione";
  const canSave = !!form.nome.trim() && !!form.codice.trim() && (!needsGruppo || !!form.gruppo_compagnia_id);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="identificativi" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="identificativi">Identificativi</TabsTrigger>
          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
          <TabsTrigger value="bancario">RUI &amp; Bancario</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: IDENTIFICATIVI ── */}
        <TabsContent value="identificativi" className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo <span className="text-destructive">*</span></Label>
            <RadioGroup
              value={form.tipo}
              onValueChange={(v) => {
                setField("tipo", v);
                if (v === "broker" || v === "plurimandataria") {
                  setField("gruppo_compagnia_id", "");
                  setField("gruppo_compagnia", "");
                }
              }}
              className="flex flex-wrap gap-x-6 gap-y-2 pt-1"
            >
              {TIPI_AGENZIA.map((t) => (
                <div key={t} className="flex items-center gap-2 min-w-[140px]">
                  <RadioGroupItem value={t} id={`tipo-${t}`} />
                  <Label htmlFor={`tipo-${t}`} className="text-sm font-normal cursor-pointer whitespace-nowrap">
                    {TIPI_LABEL[t] || t}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Codice <span className="text-destructive">*</span></Label>
              <Input
                value={form.codice}
                onChange={(e) => setField("codice", e.target.value.toUpperCase().trim())}
                placeholder="es. MED001"
                className="font-mono"
              />
              {!form.codice.trim() && <p className="text-xs text-destructive">Obbligatorio e univoco</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stato</Label>
              <RadioGroup value={form.stato} onValueChange={(v) => setField("stato", v)} className="flex gap-6 pt-1">
                {["Attivo", "Sospeso"].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <RadioGroupItem value={s} id={`stato-${s}`} />
                    <Label htmlFor={`stato-${s}`} className="text-sm font-normal cursor-pointer">{s}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ragione sociale <span className="text-destructive">*</span></Label>
            <Input value={form.nome} onChange={(e) => setField("nome", e.target.value)} placeholder="Nome completo dell'agenzia/broker" />
          </div>

          {needsGruppo ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Compagnia madre <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                options={[{ value: "__none__", label: "— Nessuna —" }, ...gruppiCompagnia]}
                value={form.gruppo_compagnia_id || ""}
                onValueChange={(v) => {
                  const val = v === "__none__" ? "" : v;
                  setField("gruppo_compagnia_id", val);
                  const found = gruppiCompagnia.find((g: any) => g.value === val);
                  setField("gruppo_compagnia", found?.label?.replace(/^⚠️\s*/, "").replace(/\s*\(Fallback\)$/, "") || "");
                }}
                placeholder="Seleziona compagnia assicurativa..."
              />
              {!form.gruppo_compagnia_id && (
                <p className="text-xs text-destructive">Campo obbligatorio per agenzia/direzione</p>
              )}
              <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 flex gap-2 mt-2">
                <Network className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium">Rapporto principale automatico</p>
                  <p>
                    Per {form.tipo === "agenzia" ? "le agenzie" : "le direzioni"} il sistema crea automaticamente <span className="font-semibold">un unico Rapporto principale</span> copiando questi dati (nome, codice, IBAN, sede, gruppo, conto bancario). Le modifiche successive su questi campi vengono propagate al rapporto.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 flex gap-2">
              <Network className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-medium">
                  {form.tipo === "broker" ? "Broker" : "Plurimandataria"} — nessuna compagnia madre
                </p>
                <p>
                  Un {form.tipo === "broker" ? "broker" : "plurimandatario"} lavora con più compagnie contemporaneamente.
                  Dopo aver creato l'anagrafica, gestisci i legami dalla colonna <span className="font-semibold">Rapporti</span> in elenco
                  (un rapporto per ogni compagnia con codice mandato, % provvigione, date).
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: ANAGRAFICA ── */}
        <TabsContent value="anagrafica" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Codice Fiscale</Label>
              <Input
                value={form.codice_fiscale}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setField("codice_fiscale", val);
                  if (val.length === 11 && /^\d{11}$/.test(val) && !form.partita_iva) {
                    setField("partita_iva", val);
                    toast.info("Partita IVA copiata dal Codice Fiscale");
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Partita IVA</Label>
              <Input
                value={form.partita_iva}
                onChange={(e) => setField("partita_iva", e.target.value.toUpperCase())}
                placeholder="11 cifre"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Percentuale ritenuta d'acconto (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={form.percentuale_ra}
                onChange={(e) => setField("percentuale_ra", e.target.value)}
                placeholder="4.6"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Indirizzo</Label>
            <AddressAutocomplete
              value={form.indirizzo}
              onChange={(v) => setField("indirizzo", v)}
              onSelect={(c) => { setField("cap", c.cap); setField("comune", c.citta); setField("provincia", c.provincia); }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {renderField("CAP", "cap")}
            {renderField("Comune", "comune")}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nazione</Label>
              <SearchableSelect
                options={toOptions(NAZIONI)}
                value={form.nazione}
                onValueChange={(v) => setField("nazione", v)}
                placeholder="Seleziona nazione..."
              />
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <Label className="text-sm font-medium text-foreground">Contatti</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Email", "mail", "info@...")}
            {renderField("PEC", "pec", "pec@...")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Telefono", "telefono")}
            {renderField("Mail Estratto Conto (legacy)", "mail_ec")}
          </div>

          <div className="border-t pt-3 mt-3">
            <Label className="text-sm font-medium text-foreground">Indirizzi Email Funzionali</Label>
            <p className="text-xs text-muted-foreground">Usati per invio comunicazioni operative. Sovrascrivibili per singolo rapporto.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email Messe a Cassa</Label>
              <Input
                type="email"
                placeholder="messeacassa@..."
                value={form.email_messe_a_cassa}
                onChange={(e) => setField("email_messe_a_cassa", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Destinatario comunicazioni di messa in pagamento</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email Estratto Conto</Label>
              <Input
                type="email"
                placeholder="estrattoconto@..."
                value={form.email_estratto_conto}
                onChange={(e) => setField("email_estratto_conto", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Destinatario invio E/C agenzia</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea value={form.note} onChange={(e) => setField("note", e.target.value)} rows={2} />
          </div>
        </TabsContent>

        {/* ── TAB 3: RUI & BANCARIO ── */}
        <TabsContent value="bancario" className="space-y-4 mt-4">
          <div className="border-b pb-2">
            <Label className="text-sm font-medium text-foreground">Iscrizione RUI</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Sezione", "iscrizione_rui_sez", "A / B / E …")}
            {renderField("Numero", "iscrizione_rui_num")}
          </div>

          <div className="border-b pb-2 pt-3">
            <Label className="text-sm font-medium text-foreground">Conto bancario dell'agenzia</Label>
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.conto_bancario_id
                ? "Conto già registrato per questa agenzia. Modifica i campi e salva per aggiornarlo."
                : "Inserisci qui le coordinate del conto della nuova agenzia. Al salvataggio verrà creato in Anagrafiche → Conti Bancari."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Etichetta conto", "conto_etichetta", "es. Conto principale")}
            {renderField("Banca", "conto_banca", "es. Intesa Sanpaolo")}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">IBAN</Label>
            <Input
              value={form.conto_iban}
              onChange={(e) => setField("conto_iban", e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="IT60X0542811101000000123456"
              maxLength={34}
              className={form.conto_iban && form.conto_iban.startsWith("IT") && form.conto_iban.length !== 27 ? "border-destructive" : ""}
            />
            {form.conto_iban && form.conto_iban.startsWith("IT") && form.conto_iban.length !== 27 && (
              <p className="text-[11px] text-destructive">IBAN italiano deve essere di 27 caratteri (attuali: {form.conto_iban.length}).</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {renderField("Intestato a", "conto_intestato_a", "Ragione sociale titolare")}
            {renderField("BIC / SWIFT (opz.)", "conto_bic")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {renderField("ABI (opz.)", "conto_abi")}
            {renderField("CAB (opz.)", "conto_cab")}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Predefinito</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={form.conto_is_default} onCheckedChange={(v) => setField("conto_is_default", v)} />
                <span className="text-xs text-muted-foreground">Default rimesse premi</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Note conto (opz.)</Label>
            <Textarea value={form.conto_note} onChange={(e) => setField("conto_note", e.target.value)} rows={2} />
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={onSave} disabled={!canSave || saving} className="w-full mt-4">
        {saveLabel}
      </Button>
    </>
  );
}

// ── Tab Compagnie Assicurative (Gruppi Compagnia nel DB) ──

interface GruppoForm {
  codice: string;
  descrizione: string;
  attivo: boolean;
}

const emptyGruppo: GruppoForm = { codice: "", descrizione: "", attivo: true };

// ── Dialog: Agenzie collegate a una agenzia madre ──
function AgenzieCollegateDialog({
  gruppoId,
  gruppoDescrizione,
  open,
  onClose,
  onOpenAgenzia,
}: {
  gruppoId: string | null;
  gruppoDescrizione: string;
  open: boolean;
  onClose: () => void;
  onOpenAgenzia?: (compagniaId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const { data: compagnie = [], isLoading } = useQuery({
    queryKey: ["agenzie-collegate", gruppoId],
    queryFn: async () => {
      if (!gruppoId) return [];
      const { data, error } = await supabase
        .from("compagnie")
        .select("id, codice, nome, nome_sede, comune, provincia, stato, attiva")
        .eq("gruppo_compagnia_id", gruppoId)
        .eq("attiva", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!gruppoId && open,
  });

  // Rapporti N:N (plurimandatarie) verso questa Compagnia Assicurativa
  const { data: rapporti = [], isLoading: loadingRapporti } = useQuery({
    queryKey: ["rapporti-per-gruppo", gruppoId],
    queryFn: async () => {
      if (!gruppoId) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporti")
        .select("id, codice_rapporto, tipo_rapporto, rami_abilitati, data_inizio, data_fine, attivo, percentuale_provvigione, compagnia_id, compagnie:compagnia_id(id, codice, nome, nome_sede, gruppo_compagnia_id)")
        .eq("gruppo_compagnia_id", gruppoId)
        .order("attivo", { ascending: false })
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      // Difesa in profondità: escludi rapporti che puntano ad agenzie dello stesso gruppo principale
      return (data || []).filter((r: any) => r.compagnie?.gruppo_compagnia_id !== gruppoId);
    },
    enabled: !!gruppoId && open,
  });

  const filtered = compagnie.filter((a: any) => matchesAgenziaSearch(a, search));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSearch(""); onClose(); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Agenzie collegate a <span className="text-primary">{gruppoDescrizione}</span>
            <Badge variant="secondary" className="ml-2">{compagnie.length} principali</Badge>
            {rapporti.length > 0 && (
              <Badge variant="outline" className="border-primary/40">{rapporti.filter((r: any) => r.attivo).length} rapporti N:N</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Sezione 1: Agenzie principali (1:N) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Agenzie con questa Compagnia Assicurativa come <span className="text-primary">principale</span> (1:N)
            </h3>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome o codice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[35vh] overflow-auto border rounded-md">
            {isLoading ? (
              <p className="p-4 text-muted-foreground">Caricamento...</p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-28">Codice</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Comune</TableHead>
                    <TableHead className="w-16">Prov</TableHead>
                    <TableHead className="w-28">Stato</TableHead>
                    <TableHead className="w-20 text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a: any, idx: number) => (
                    <TableRow key={a.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                      <TableCell className="font-mono text-sm">{a.codice || "—"}</TableCell>
                      <TableCell className="font-medium">{a.nome || "—"}</TableCell>
                      <TableCell>{a.nome_sede || "—"}</TableCell>
                      <TableCell>{a.comune || "—"}</TableCell>
                      <TableCell>{a.provincia || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={a.stato === "Attivo" ? "default" : "secondary"}>
                          {a.stato || (a.attiva ? "Attivo" : "Non Operativo")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {onOpenAgenzia && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { onOpenAgenzia(a.id); onClose(); }}
                          >
                            Apri
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        {compagnie.length === 0 ? "Nessuna agenzia con questa Compagnia Assicurativa come principale" : "Nessun risultato per la ricerca"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Sezione 2: Rapporti N:N (plurimandatarie) */}
        <div className="space-y-2 mt-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Rapporti aggiuntivi (plurimandatarie) — N:N
            <span className="text-xs text-muted-foreground font-normal">
              gestibili dal tab "Agenzie" → colonna "Rapporti"
            </span>
          </h3>

          <div className="max-h-[30vh] overflow-auto border rounded-md">
            {loadingRapporti ? (
              <p className="p-4 text-muted-foreground">Caricamento...</p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Agenzia</TableHead>
                    <TableHead className="w-32">Codice rapp.</TableHead>
                    <TableHead className="w-40">Tipo</TableHead>
                    <TableHead>Garanzie</TableHead>
                    <TableHead className="w-28">Inizio</TableHead>
                    <TableHead className="w-28">Fine</TableHead>
                    <TableHead className="w-20 text-right">% Provv.</TableHead>
                    <TableHead className="w-24">Stato</TableHead>
                    <TableHead className="w-20 text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rapporti).map((r, idx) => (
                    <TableRow key={r.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                      <TableCell className="font-medium">{r.compagnie?.nome || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.codice_rapporto || "—"}</TableCell>
                      <TableCell className="text-sm">{r.tipo_rapporto || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                        {Array.isArray(r.rami_abilitati) && r.rami_abilitati.length ? r.rami_abilitati.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.data_inizio || "—"}</TableCell>
                      <TableCell className="text-sm">{r.data_fine || "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {r.percentuale_provvigione != null ? `${r.percentuale_provvigione}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.attivo ? "default" : "secondary"}>{r.attivo ? "Attivo" : "Chiuso"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {onOpenAgenzia && r.compagnia_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { onOpenAgenzia(r.compagnia_id); onClose(); }}
                          >
                            Apri
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rapporti.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                        Nessun rapporto N:N registrato verso questa Compagnia Assicurativa
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompagnieMadriTab({ onOpenAgenzia }: { onOpenAgenzia?: (compagniaId: string) => void } = {}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GruppoForm>(emptyGruppo);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; descrizione: string; count: number } | null>(null);
  const [agenzieDialog, setAgenzieDialog] = useState<{ gruppoId: string; gruppoDescrizione: string } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: gruppi = [], isLoading } = useQuery({
    queryKey: ["agenzie-madri-list"],
    queryFn: async () => {
      const { data: gruppiData, error } = await supabase
        .from("gruppi_compagnia")
        .select("id, codice, descrizione, attivo")
        .order("descrizione");
      if (error) throw error;

      // Conteggio relazioni 1:N (agenzie con gruppo principale)
      const { data: countsData } = await supabase
        .from("compagnie")
        .select("gruppo_compagnia_id")
        .not("gruppo_compagnia_id", "is", null)
        .eq("attiva", true);

      const counts1n: Record<string, number> = {};
      (countsData || []).forEach((row: any) => {
        if (row.gruppo_compagnia_id) {
          counts1n[row.gruppo_compagnia_id] = (counts1n[row.gruppo_compagnia_id] || 0) + 1;
        }
      });

      // Conteggio relazioni N:N attive (rapporti plurimandatari)
      // Escludi i rapporti principali (is_principale=true) auto-creati dal trigger DB:
      // sono già rappresentati nel conteggio 1:N via compagnie.gruppo_compagnia_id.
      const { data: rapportiData } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id, gruppo_compagnia_id")
        .eq("attivo", true)
        .eq("is_principale", false);

      const countsNn: Record<string, Set<string>> = {};
      (rapportiData || []).forEach((row: any) => {
        if (!row.gruppo_compagnia_id) return;
        if (!countsNn[row.gruppo_compagnia_id]) countsNn[row.gruppo_compagnia_id] = new Set();
        countsNn[row.gruppo_compagnia_id].add(row.compagnia_id);
      });

      const enriched = (gruppiData || []).map((g: any) => ({
        ...g,
        agenzie_count_1n: counts1n[g.id] || 0,
        rapporti_count_nn: countsNn[g.id]?.size || 0,
        agenzie_count: (counts1n[g.id] || 0) + (countsNn[g.id]?.size || 0),
        is_pluri: g.codice === PLURIMANDATARIO_CODE,
      }));

      // PLURIMANDATARIO sempre in cima
      return enriched.sort((a: any, b: any) => {
        if (a.is_pluri && !b.is_pluri) return -1;
        if (!a.is_pluri && b.is_pluri) return 1;
        return (a.descrizione || "").localeCompare(b.descrizione || "");
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const norm = form.descrizione.trim().toUpperCase();
      // Check anti-duplicato case-insensitive
      const { data: existing } = await supabase
        .from("gruppi_compagnia")
        .select("id, descrizione")
        .ilike("descrizione", form.descrizione.trim());
      if ((existing || []).some((g: any) => (g.descrizione || "").trim().toUpperCase() === norm)) {
        throw new Error("Esiste già una compagnia assicurativa con questo nome (confronto senza distinzione di maiuscole/minuscole)");
      }
      const { error } = await supabase
        .from("gruppi_compagnia")
        .insert({ codice: form.codice || null, descrizione: form.descrizione.trim(), attivo: form.attivo });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setCreateOpen(false);
      setForm(emptyGruppo);
      toast.success("Compagnia assicurativa creata");
    },
    onError: (e: any) => toast.error(e.message || "Errore creazione"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const norm = form.descrizione.trim().toUpperCase();
      // Check anti-duplicato case-insensitive (escluso il record corrente)
      const { data: existing } = await supabase
        .from("gruppi_compagnia")
        .select("id, descrizione")
        .ilike("descrizione", form.descrizione.trim());
      if ((existing || []).some((g: any) => g.id !== editId && (g.descrizione || "").trim().toUpperCase() === norm)) {
        throw new Error("Esiste già una compagnia assicurativa con questo nome (confronto senza distinzione di maiuscole/minuscole)");
      }
      const { error } = await supabase
        .from("gruppi_compagnia")
        .update({ codice: form.codice || null, descrizione: form.descrizione.trim(), attivo: form.attivo })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setEditOpen(false);
      setEditId(null);
      setForm(emptyGruppo);
      toast.success("Compagnia assicurativa aggiornata");
    },
    onError: (e: any) => toast.error(e.message || "Errore aggiornamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gruppi_compagnia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["gruppi_compagnia_lookup"] });
      setDeleteTarget(null);
      toast.success("Compagnia assicurativa eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore eliminazione"),
  });

  const openEdit = (g: any) => {
    if (g.is_pluri) {
      toast.info("Compagnia assicurativa di sistema (PLURIMANDATARIO): non modificabile.");
      return;
    }
    setForm({ codice: g.codice || "", descrizione: g.descrizione || "", attivo: g.attivo ?? true });
    setEditId(g.id);
    setEditOpen(true);
  };

  const handleDeleteClick = (g: any) => {
    if (g.is_pluri) {
      toast.error("Compagnia assicurativa di sistema (PLURIMANDATARIO): non eliminabile.");
      return;
    }
    setDeleteTarget({ id: g.id, descrizione: g.descrizione, count: g.agenzie_count });
  };

  const filtered = useMemo(
    () => filterCompagnieAssicurativeList(gruppi, debouncedSearch),
    [gruppi, debouncedSearch],
  );

  const renderForm = () => (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Codice</Label>
        <Input value={form.codice} onChange={(e) => setForm((p) => ({ ...p, codice: e.target.value }))} placeholder="es. GEN" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Descrizione *</Label>
        <Input value={form.descrizione} onChange={(e) => setForm((p) => ({ ...p, descrizione: e.target.value }))} placeholder="es. Gruppo Generali / ALLIANZ" />
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <Label className="text-sm">Attiva</Label>
        <Switch checked={form.attivo} onCheckedChange={(v) => setForm((p) => ({ ...p, attivo: v }))} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Cerca per nome o codice</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cerca per nome o codice..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <Button variant="secondary" onClick={() => { setSearch(""); setDebouncedSearch(""); }}>Reset</Button>
            <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyGruppo); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />Nuova Compagnia Assicurativa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova Compagnia Assicurativa</DialogTitle></DialogHeader>
                {renderForm()}
                <Button onClick={() => createMutation.mutate()} disabled={!form.descrizione || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Salvataggio..." : "Crea Compagnia Assicurativa"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-5 h-5" />Compagnie Assicurative ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Caricamento...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-center">Agenzie collegate</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="w-24 text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((g: any, idx: number) => (
                  <TableRow
                    key={g.id}
                    className={`cursor-pointer hover:bg-muted/50 ${g.is_pluri ? "bg-accent/40" : idx % 2 === 1 ? "bg-muted/20" : ""}`}
                    onClick={() => openEdit(g)}
                  >
                    <TableCell className="font-mono text-sm">{g.codice || "—"}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {g.descrizione}
                        {g.is_pluri && (
                          <Badge variant="outline" className="gap-1 border-primary/40 bg-accent/40 text-foreground">
                            <ShieldCheck className="w-3 h-3" />Fallback di sistema
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {g.agenzie_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => setAgenzieDialog({ gruppoId: g.id, gruppoDescrizione: g.descrizione })}
                          title="Vedi agenzie collegate"
                          className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                        >
                          <Badge variant="default" className="cursor-pointer">{g.agenzie_count}</Badge>
                        </button>
                      ) : (
                        <Badge variant="outline">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.attivo ? "default" : "secondary"}>{g.attivo ? "Attiva" : "Disattiva"}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-30"
                        disabled={g.is_pluri}
                        title={g.is_pluri ? "Compagnia assicurativa di sistema, non eliminabile" : "Elimina"}
                        onClick={() => handleDeleteClick(g)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna compagnia assicurativa trovata</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditId(null); setForm(emptyGruppo); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifica Compagnia Assicurativa</DialogTitle></DialogHeader>
          {renderForm()}
          <Button onClick={() => updateMutation.mutate()} disabled={!form.descrizione || updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <DeleteWithImpactDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityId={deleteTarget?.id}
        entityType="agenzia"
        entityName={deleteTarget?.descrizione || "—"}
        checks={[
          { table: "compagnie", column: "gruppo_compagnia_id", label: "Compagnie collegate" },
          { table: "compagnia_rapporti", column: "gruppo_compagnia_id", label: "Rapporti agenzia-compagnia" },
        ]}
        onConfirmDelete={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isDeleting={deleteMutation.isPending}
      />

      <AgenzieCollegateDialog
        gruppoId={agenzieDialog?.gruppoId ?? null}
        gruppoDescrizione={agenzieDialog?.gruppoDescrizione ?? ""}
        open={!!agenzieDialog}
        onClose={() => setAgenzieDialog(null)}
        onOpenAgenzia={onOpenAgenzia}
      />
    </div>
  );
}

// ── Main Page ──

const CompagnieList = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CompagniaForm>(emptyForm);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [onlyPluri, setOnlyPluri] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("agenzie");
  const [rapportiTarget, setRapportiTarget] = useState<{ id: string; nome: string } | null>(null);
  const [provvigioniTarget, setProvvigioniTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleteCompagnia, setDeleteCompagnia] = useState<{ id: string; nome: string; attiva: boolean } | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: compagnie = [], isLoading } = useQuery({
    queryKey: ["agenzie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("compagnie").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Lookup map id → { descrizione, codice } per arricchire la lista Agenzie
  const { data: gruppiMap = {} } = useQuery({
    queryKey: ["gruppi_compagnia_map"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia")
        .select("id, descrizione, codice");
      const map: Record<string, { descrizione: string; codice: string | null; is_pluri: boolean }> = {};
      (data || []).forEach((g: any) => {
        map[g.id] = { descrizione: g.descrizione, codice: g.codice, is_pluri: g.codice === PLURIMANDATARIO_CODE };
      });
      return map;
    },
    staleTime: 300000 * 60 * 30,
  });

  // Conteggio rapporti attivi per agenzia (RPC aggregata lato DB, evita limite 1000 righe)
  const { data: rapportiCounts = {} } = useQuery({
    queryKey: ["compagnia_rapporti_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rapporti_counts_per_compagnia");
      if (error) throw error;
      const counts: Record<string, { tot: number; attivi: number }> = {};
      (data || []).forEach((r: any) => {
        counts[r.compagnia_id] = { tot: Number(r.tot) || 0, attivi: Number(r.attivi) || 0 };
      });
      return counts;
    },
    staleTime: 300000 * 30,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: created, error } = await supabase
        .from("compagnie")
        .insert(formToPayload(form) as any)
        .select("id")
        .single();
      if (error) throw error;
      const newId = created?.id;
      if (!newId) return;
      try {
        const contoId = await persistContoAgenzia(newId, form);
        if (contoId) {
          await supabase.from("compagnie").update({ conto_bancario_id: contoId }).eq("id", newId);
        }
      } catch (e) {
        // Rollback: libera codice univoco e non lascia agenzia orfana senza conto
        await supabase.from("compagnie").delete().eq("id", newId);
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie"] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Agenzia creata con successo");
    },
    onError: (err: any) => {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("idx_compagnie_codice_unique") || msg.includes("compagnie_codice_unique") || err?.code === "23505") {
        toast.error(`Codice "${form.codice}" già usato da un'altra agenzia`);
      } else if (msg.includes("intestato_a")) {
        toast.error("Manca l'intestatario del conto bancario");
      } else {
        toast.error(err?.message || "Errore nella creazione");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase.from("compagnie").update(formToPayload(form) as any).eq("id", editId);
      if (error) throw error;
      const contoId = await persistContoAgenzia(editId, form);
      if (contoId && contoId !== form.conto_bancario_id) {
        await supabase.from("compagnie").update({ conto_bancario_id: contoId }).eq("id", editId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie"] });
      setEditOpen(false);
      setEditId(null);
      toast.success("Agenzia aggiornata");
    },
    onError: (err: any) => toast.error(
      err?.message?.toLowerCase()?.includes("idx_compagnie_codice_unique") || err?.code === "23505"
        ? `Codice "${form.codice}" già usato da un'altra agenzia`
        : err?.message || "Errore nell'aggiornamento"
    ),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attiva }: { id: string; attiva: boolean }) => {
      const { error } = await supabase.from("compagnie").update({ attiva }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["agenzie"] });
      queryClient.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      queryClient.invalidateQueries({ queryKey: ["agenzie-collegate"] });
      queryClient.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      queryClient.invalidateQueries({ queryKey: ["rapporti-counts"] });
      toast.success(vars.attiva ? "Agenzia attivata" : "Agenzia disattivata");
    },
    onError: (e: any) => toast.error(e?.message || "Errore aggiornamento stato"),
  });

  const deleteCompagniaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compagnie").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenzie"] });
      setDeleteCompagnia(null);
      toast.success("Agenzia eliminata");
    },
    onError: (e: any) => toast.error(e.message || "Errore eliminazione"),
  });

  const openEdit = (c: any) => {
    setForm(dbToForm(c));
    setEditId(c.id);
    setEditOpen(true);
  };

  const handleOpenAgenziaById = (compagniaId: string) => {
    const c = (compagnie).find((x) => x.id === compagniaId);
    if (c) {
      openEdit(c);
    } else {
      toast.error("Agenzia non trovata");
    }
  };

  const filteredAnagrafica = useMemo(
    () => filterAgenzieList(compagnie, {
      search: debouncedSearch,
      tipo: filterTipo,
      onlyPluri,
      gruppiMap,
    }),
    [compagnie, debouncedSearch, filterTipo, onlyPluri, gruppiMap],
  );

  const pluriCount = compagnie.filter((c: any) => gruppiMap[c.gruppo_compagnia_id]?.is_pluri).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compagnie Assicurative / Agenzie</h1>
          <p className="text-muted-foreground">
            Gestione compagnie assicurative, agenzie e provvigioni —{" "}
            <span className="font-semibold">{compagnie.filter((c: any) => c.attiva !== false).length}</span> agenzie ·{" "}
            <span className="font-semibold">{Object.keys(gruppiMap).length}</span> compagnie assicurative
          </p>
        </div>
        {activeTab === "anagrafica" && (
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm(emptyForm); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Nuova Agenzia</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <CompagniaFormDialog
                form={form} setForm={setForm}
                onSave={() => createMutation.mutate()}
                saving={createMutation.isPending}
                title="Nuova Agenzia"
                saveLabel="Crea Agenzia"
                compagniaId={null}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <CompagniaFormDialog
            form={form} setForm={setForm}
            onSave={() => updateMutation.mutate()}
            saving={updateMutation.isPending}
            title="Modifica Agenzia"
            saveLabel="Salva Modifiche"
            compagniaId={editId}
          />
        </DialogContent>
      </Dialog>

      {/* Main page tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="agenzie" className="gap-2">
            <Layers className="w-4 h-4" />Compagnie Assicurative
          </TabsTrigger>
          <TabsTrigger value="anagrafica" className="gap-2">
            <Building2 className="w-4 h-4" />Agenzie
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenzie" className="mt-4">
          <CompagnieMadriTab onOpenAgenzia={handleOpenAgenziaById} />
        </TabsContent>

        <TabsContent value="anagrafica" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Cerca per nome o codice</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per nome o codice..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1 w-52">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <SearchableSelect
                    options={[
                      { value: "all", label: "Tutti" },
                      { value: "agenzia", label: "Agenzia" },
                      { value: "broker", label: "Broker" },
                      { value: "direzione", label: "Direzione" },
                      { value: "plurimandataria", label: "Plurimandataria" },
                    ]}
                    value={filterTipo}
                    onValueChange={setFilterTipo}
                    placeholder="Filtra per tipo..."
                  />
                </div>
                <Button variant="secondary" onClick={() => { setSearch(""); setDebouncedSearch(""); setFilterTipo("all"); setOnlyPluri(false); }}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5" />Elenco Agenzie ({filteredAnagrafica.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Caricamento...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codice</TableHead>
                      <TableHead>Ragione sociale</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Compagnia madre</TableHead>
                      <TableHead>Comune</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-center">Rapporti</TableHead>
                      <TableHead>Attiva</TableHead>
                      <TableHead className="w-12 text-right">Az.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnagrafica.map((c: any) => {
                      const grp = c.gruppo_compagnia_id ? gruppiMap[c.gruppo_compagnia_id] : null;
                      const rc = rapportiCounts[c.id] || { tot: 0, attivi: 0 };
                      const isAttiva = c.attiva !== false;
                      return (
                        <TableRow
                          key={c.id}
                          className={`cursor-pointer hover:bg-muted/50 ${!isAttiva ? "opacity-60" : ""}`}
                          onClick={() => openEdit(c)}
                        >
                          <TableCell className="font-mono text-sm">{c.codice || "—"}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell>
                            {(() => {
                              const t = c.tipo || "agenzia";
                              const cls =
                                t === "broker" ? "bg-blue-100 text-blue-800 border-blue-200" :
                                t === "direzione" ? "bg-purple-100 text-purple-800 border-purple-200" :
                                t === "plurimandataria" ? "bg-orange-100 text-orange-800 border-orange-200" :
                                "bg-emerald-100 text-emerald-800 border-emerald-200";
                              return <Badge variant="outline" className={cls}>{TIPI_LABEL[t] || t}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>{grp?.descrizione || "—"}</TableCell>
                          <TableCell>{c.comune || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={isAttiva ? "default" : "secondary"}>
                              {isAttiva ? (c.stato || "Attivo") : "Non Operativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant={rc.attivi >= 1 ? "default" : "outline"}
                              size="sm"
                              className="gap-1 h-7"
                              onClick={() => setRapportiTarget({ id: c.id, nome: c.nome })}
                              title="Gestisci rapporti con compagnie assicurative"
                            >
                              <Network className="w-3.5 h-3.5" />
                              {rc.attivi}{rc.tot > rc.attivi ? `/${rc.tot}` : ""}
                            </Button>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Provvigioni per rapporto"
                                onClick={() => setProvvigioniTarget({ id: c.id, nome: c.nome })}
                              >
                                <Percent className="w-4 h-4" />
                              </Button>
                              <Switch checked={c.attiva ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attiva: v })} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Elimina agenzia"
                              onClick={() => setDeleteCompagnia({ id: c.id, nome: c.nome, attiva: c.attiva ?? true })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredAnagrafica.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nessuna agenzia trovata — clicca "Nuova Agenzia" per crearne una</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>





      </Tabs>

      {/* Dialog gestione rapporti N:N agenzia ↔ agenzia */}
      <RapportiCompagniaDialog
        open={!!rapportiTarget}
        onOpenChange={(v) => !v && setRapportiTarget(null)}
        compagniaId={rapportiTarget?.id || null}
        compagniaNome={rapportiTarget?.nome || ""}
      />

      <ProvvigioniCompagniaDialog
        open={!!provvigioniTarget}
        onOpenChange={(v) => !v && setProvvigioniTarget(null)}
        compagniaId={provvigioniTarget?.id || null}
        compagniaNome={provvigioniTarget?.nome || ""}
        onOpenRapporti={() => {
          const t = provvigioniTarget;
          setProvvigioniTarget(null);
          if (t) setRapportiTarget(t);
        }}
      />


      <DeleteWithImpactDialog
        open={!!deleteCompagnia}
        onOpenChange={(o) => !o && setDeleteCompagnia(null)}
        entityId={deleteCompagnia?.id}
        entityType="compagnia"
        entityName={deleteCompagnia?.nome || "—"}
        checks={[
          { table: "titoli", column: "compagnia_id", label: "Polizze emesse" },
          { table: "prodotti", column: "compagnia_id", label: "Prodotti collegati" },
          { table: "sinistri", column: "compagnia_id", label: "Sinistri" },
          { table: "compagnia_rapporti", column: "compagnia_id", label: "Rapporti agenzia-compagnia" },
          { table: "provvigioni_compagnia_ramo", column: "compagnia_id", label: "Provvigioni per ramo" },
          { table: "flussi_compagnia", column: "compagnia_id", label: "Flussi/import" },
          { table: "rimessa_premi", column: "compagnia_id", label: "Rimesse premi" },
          { table: "trattative", column: "compagnia_id", label: "Trattative" },
          { table: "anagrafiche_professionali", column: "compagnia_id", label: "Liquidatori/periti collegati", blocking: false },
          { table: "document_folders", column: "compagnia_id", label: "Cartelle documentali", blocking: false },
        ]}
        onConfirmDelete={() => deleteCompagnia && deleteCompagniaMutation.mutate(deleteCompagnia.id)}
        onDeactivateInstead={
          deleteCompagnia?.attiva
            ? () => deleteCompagnia && toggleMutation.mutate({ id: deleteCompagnia.id, attiva: false })
            : undefined
        }
        isDeleting={deleteCompagniaMutation.isPending}
      />
    </div>
  );
};

export default CompagnieList;
