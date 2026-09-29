import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, XCircle, Network, X, Check, ChevronsUpDown, ChevronDown, ChevronRight, FolderOpen, Copy, ListPlus, Percent } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ProvvigioniRapportiTab from "./ProvvigioniRapportiTab";
import { toast } from "sonner";
import { validateIban } from "@/lib/validateIban";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RapportoDocumentiDialog from "./RapportoDocumentiDialog";

interface RamoGroupRow {
  gruppo_ramo_id: string;
  all: boolean;
  ramo_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compagniaId: string | null;
  compagniaNome: string;
}

const TIPI_RAPPORTO = [
  "Agenzia",
  "Direzione",
  "Broker",
  "Mandato diretto",
  "Mandato principale",
  "Sub-agenzia",
  "Convenzione broker",
  "Coverholder",
  "Altro",
];

interface RapportoForm {
  id?: string;
  nome_rapporto: string;
  gruppo_compagnia_id: string;
  codice_rapporto: string;
  tipo_rapporto: string;
  rami_abilitati: string;
  data_inizio: string;
  data_fine: string;
  attivo: boolean;
  percentuale_provvigione: string;
  percentuale_ra: string;
  conto_bancario_id: string | null;
  conto_etichetta: string;
  conto_banca: string;
  conto_iban: string;
  conto_intestato_a: string;
  conto_bic: string;
  conto_abi: string;
  conto_cab: string;
  conto_note: string;
  sede_denominazione: string;
  sede_indirizzo: string;
  sede_cap: string;
  sede_citta: string;
  sede_provincia: string;
  referente_compagnia: string;
  email_referente: string;
  telefono_referente: string;
  email_messe_a_cassa: string;
  email_estratto_conto: string;
  note: string;
}

const emptyForm: RapportoForm = {
  nome_rapporto: "",
  gruppo_compagnia_id: "",
  codice_rapporto: "",
  tipo_rapporto: "Agenzia",
  rami_abilitati: "",
  data_inizio: new Date().toISOString().slice(0, 10),
  data_fine: "",
  attivo: true,
  percentuale_provvigione: "",
  percentuale_ra: "4.60",
  conto_bancario_id: null,
  conto_etichetta: "",
  conto_banca: "",
  conto_iban: "",
  conto_intestato_a: "",
  conto_bic: "",
  conto_abi: "",
  conto_cab: "",
  conto_note: "",
  sede_denominazione: "",
  sede_indirizzo: "",
  sede_cap: "",
  sede_citta: "",
  sede_provincia: "",
  referente_compagnia: "",
  email_referente: "",
  telefono_referente: "",
  email_messe_a_cassa: "",
  email_estratto_conto: "",
  note: "",
};

export default function RapportiCompagniaDialog({ open, onOpenChange, compagniaId, compagniaNome }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RapportoForm>(emptyForm);
  const [ramiRows, setRamiRows] = useState<RamoGroupRow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [docsRapporto, setDocsRapporto] = useState<{ id: string; nome: string } | null>(null);

  const { data: rapporti = [], isLoading } = useQuery({
    queryKey: ["compagnia_rapporti", compagniaId],
    queryFn: async () => {
      if (!compagniaId) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporti" as any)
        .select("*, gruppi_compagnia:gruppo_compagnia_id(id, descrizione, codice)")
        .eq("compagnia_id", compagniaId)
        .order("attivo", { ascending: false })
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!compagniaId && open,
  });

  // Tipo compagnia: agenzia/direzione = relazione 1:1 → un solo rapporto principale
  const { data: compagniaTipo } = useQuery({
    queryKey: ["compagnia-tipo", compagniaId],
    enabled: !!compagniaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("tipo").eq("id", compagniaId!).maybeSingle();
      return (data as any)?.tipo as string | undefined;
    },
  });
  const isSingleRapporto = compagniaTipo === "agenzia" || compagniaTipo === "direzione";


  const { data: gruppi = [] } = useQuery({
    queryKey: ["gruppi_compagnia_for_rapporti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, descrizione, codice")
        .eq("attivo", true)
        .order("descrizione");
      return data || [];
    },
    staleTime: 300000 * 60 * 30,
  });

  const { data: gruppiRamo = [] } = useQuery({
    queryKey: ["gruppi_ramo_for_rapporti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_ramo" as any)
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("descrizione");
      return data || [];
    },
    staleTime: 300000 * 60 * 30,
  });

  const { data: ramiCatalog = [] } = useQuery({
    queryKey: ["rami_for_rapporti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rami" as any)
        .select("id, codice, descrizione, gruppo_ramo_id")
        .eq("attivo", true)
        .order("descrizione");
      return data || [];
    },
    staleTime: 300000 * 60 * 30,
  });

  // Tutti i rami abilitati per i rapporti di questa compagnia (per riepilogo in tabella)
  const rapportoIds = (rapporti as any[]).map((r) => r.id);
  const { data: rapportoRamiAll = [] } = useQuery({
    queryKey: ["compagnia_rapporto_rami_all", compagniaId, rapportoIds.length],
    queryFn: async () => {
      if (rapportoIds.length === 0) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .select("id, rapporto_id, gruppo_ramo_id, ramo_id")
        .in("rapporto_id", rapportoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: open && rapportoIds.length > 0,
  });

  // Load conto bancario fields when editing a rapporto with linked account
  useEffect(() => {
    if (!formOpen || !form.id || !form.conto_bancario_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conti_bancari" as any)
        .select("etichetta, banca, iban, intestato_a, bic, codice_abi, codice_cab, note")
        .eq("id", form.conto_bancario_id)
        .maybeSingle();
      if (cancelled || !data) return;
      const d = data as any;
      setForm((p) => ({
        ...p,
        conto_etichetta: d.etichetta || "",
        conto_banca: d.banca || "",
        conto_iban: d.iban || "",
        conto_intestato_a: d.intestato_a || "",
        conto_bic: d.bic || "",
        conto_abi: d.codice_abi || "",
        conto_cab: d.codice_cab || "",
        conto_note: d.note || "",
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, form.id]);

  const persistContoRapporto = async (currentContoId: string | null): Promise<string | null> => {
    const rawIban = (form.conto_iban || "").replace(/\s+/g, "").toUpperCase();
    if (!rawIban) return null;
    const ibanCheck = validateIban(rawIban);
    if (!ibanCheck.valid) {
      throw new Error(ibanCheck.error || "IBAN non valido");
    }
    const iban = ibanCheck.normalized || rawIban;
    const intestato = (form.conto_intestato_a || form.nome_rapporto || compagniaNome || "").trim();
    if (!intestato) throw new Error("Specifica l'intestatario del conto");
    const banca = (form.conto_banca || "Banca da definire").trim();
    const etichetta = (form.conto_etichetta || form.nome_rapporto || "Conto rapporto").trim();
    const payload: any = {
      tipo: "agenzia",
      compagnia_id: compagniaId,
      etichetta,
      banca,
      iban,
      intestato_a: intestato,
      bic: form.conto_bic || null,
      codice_abi: form.conto_abi || null,
      codice_cab: form.conto_cab || null,
      note: form.conto_note || null,
      attivo: true,
    };
    if (currentContoId) {
      const { error } = await supabase.from("conti_bancari" as any).update(payload).eq("id", currentContoId);
      if (error) throw error;
      return currentContoId;
    }
    const { data, error } = await supabase.from("conti_bancari" as any).insert(payload).select("id").single();
    if (error) throw error;
    return (data as any).id as string;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!compagniaId) throw new Error("Agenzia non valida");
      if (!form.gruppo_compagnia_id) throw new Error("Seleziona la Compagnia Assicurativa");
      if (!form.nome_rapporto.trim()) throw new Error("Inserisci il nome del rapporto");

      const validRamiRows = ramiRows.filter((g) => g.gruppo_ramo_id && (g.all || g.ramo_ids.length > 0));
      if (validRamiRows.length === 0) {
        throw new Error("Aggiungi almeno un Ramo abilitato (con 'Tutti' o almeno un sottoramo)");
      }

      const rawIban = (form.conto_iban || "").replace(/\s+/g, "").toUpperCase();
      if (!rawIban) throw new Error("IBAN obbligatorio");
      const ibanCheck = validateIban(rawIban);
      if (!ibanCheck.valid) throw new Error(ibanCheck.error || "IBAN non valido");

      if (form.sede_indirizzo && (!form.sede_citta || !form.sede_provincia)) {
        throw new Error("Se inserisci l'indirizzo della sede, specifica anche città e provincia");
      }

      const basePayload: any = {
        compagnia_id: compagniaId,
        nome_rapporto: form.nome_rapporto.trim(),
        gruppo_compagnia_id: form.gruppo_compagnia_id,
        codice_rapporto: form.codice_rapporto || null,
        tipo_rapporto: form.tipo_rapporto || null,
        rami_abilitati: null,
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        attivo: form.attivo,
        percentuale_provvigione: form.percentuale_provvigione ? Number(form.percentuale_provvigione) : null,
        percentuale_ra: form.percentuale_ra !== "" ? Number(form.percentuale_ra) : 4.60,
        sede_denominazione: form.sede_denominazione || null,
        sede_indirizzo: form.sede_indirizzo || null,
        sede_cap: form.sede_cap || null,
        sede_citta: form.sede_citta || null,
        sede_provincia: form.sede_provincia ? form.sede_provincia.toUpperCase().slice(0, 2) : null,
        referente_compagnia: form.referente_compagnia || null,
        email_referente: form.email_referente || null,
        telefono_referente: form.telefono_referente || null,
        email_messe_a_cassa: form.email_messe_a_cassa || null,
        email_estratto_conto: form.email_estratto_conto || null,
        note: form.note || null,
      };

      // Flatten: per ogni gruppo, se "all" => 1 riga con ramo_id null, altrimenti N righe (una per sottoramo)
      const flatRami: { gruppo_ramo_id: string; ramo_id: string | null }[] = [];
      const seen = new Set<string>();
      for (const g of validRamiRows) {
        if (g.all) {
          const k = `${g.gruppo_ramo_id}|null`;
          if (!seen.has(k)) { seen.add(k); flatRami.push({ gruppo_ramo_id: g.gruppo_ramo_id, ramo_id: null }); }
        } else {
          for (const rid of g.ramo_ids) {
            const k = `${g.gruppo_ramo_id}|${rid}`;
            if (!seen.has(k)) { seen.add(k); flatRami.push({ gruppo_ramo_id: g.gruppo_ramo_id, ramo_id: rid }); }
          }
        }
      }

      let rapportoId: string;
      if (form.id) {
        const contoId = await persistContoRapporto(form.conto_bancario_id);
        const { error } = await supabase
          .from("compagnia_rapporti" as any)
          .update({ ...basePayload, conto_bancario_id: contoId })
          .eq("id", form.id);
        if (error) throw error;
        rapportoId = form.id;
      } else {
        const { data: created, error: insErr } = await supabase
          .from("compagnia_rapporti" as any)
          .insert({ ...basePayload, conto_bancario_id: null })
          .select("id")
          .single();
        if (insErr) throw insErr;
        rapportoId = (created as any).id as string;
        try {
          const contoId = await persistContoRapporto(null);
          const { error: upErr } = await supabase
            .from("compagnia_rapporti" as any)
            .update({ conto_bancario_id: contoId })
            .eq("id", rapportoId);
          if (upErr) throw upErr;
        } catch (e) {
          await supabase.from("compagnia_rapporti" as any).delete().eq("id", rapportoId);
          throw e;
        }
      }

      // Sync rami abilitati (delete + insert)
      const { error: delErr } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .delete()
        .eq("rapporto_id", rapportoId);
      if (delErr) throw delErr;
      if (flatRami.length > 0) {
        const { error: insRErr } = await supabase
          .from("compagnia_rapporto_rami" as any)
          .insert(flatRami.map((r) => ({ rapporto_id: rapportoId, gruppo_ramo_id: r.gruppo_ramo_id, ramo_id: r.ramo_id })));
        if (insRErr) throw insRErr;
      }
      return { ibanRejected: false };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporto_rami_all"] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporto_rami"] });
      setFormOpen(false);
      setForm(emptyForm);
      setShowAdvanced(false);
      toast.success("Rapporto salvato");
    },
    onError: (e: any) => {
      const msg = e?.message || "";
      if (msg.includes("intestato_a")) toast.error("Manca l'intestatario del conto bancario");
      else toast.error(msg || "Errore nel salvataggio");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compagnia_rapporti" as any)
        .update({ attivo: false, data_fine: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      toast.success("Rapporto chiuso");
    },
    onError: () => toast.error("Errore"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compagnia_rapporti" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      setDeleteId(null);
      toast.success("Rapporto eliminato");
    },
    onError: () => toast.error("Errore eliminazione"),
  });

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      nome_rapporto: r.nome_rapporto || "",
      gruppo_compagnia_id: r.gruppo_compagnia_id || "",
      codice_rapporto: r.codice_rapporto || "",
      tipo_rapporto: r.tipo_rapporto || "Agenzia",
      rami_abilitati: Array.isArray(r.rami_abilitati) ? r.rami_abilitati.join(", ") : "",
      data_inizio: r.data_inizio || "",
      data_fine: r.data_fine || "",
      attivo: r.attivo ?? true,
      percentuale_provvigione: r.percentuale_provvigione?.toString() || "",
      percentuale_ra: r.percentuale_ra?.toString() || "4.60",
      conto_bancario_id: r.conto_bancario_id || null,
      conto_etichetta: "",
      conto_banca: "",
      conto_iban: "",
      conto_intestato_a: "",
      conto_bic: "",
      conto_abi: "",
      conto_cab: "",
      conto_note: "",
      sede_denominazione: r.sede_denominazione || "",
      sede_indirizzo: r.sede_indirizzo || "",
      sede_cap: r.sede_cap || "",
      sede_citta: r.sede_citta || "",
      sede_provincia: r.sede_provincia || "",
      referente_compagnia: r.referente_compagnia || "",
      email_referente: r.email_referente || "",
      telefono_referente: r.telefono_referente || "",
      email_messe_a_cassa: r.email_messe_a_cassa || "",
      email_estratto_conto: r.email_estratto_conto || "",
      note: r.note || "",
    });
    // Carica rami abilitati dal DB e raggruppa per gruppo_ramo_id
    (async () => {
      const { data } = await supabase
        .from("compagnia_rapporto_rami" as any)
        .select("gruppo_ramo_id, ramo_id")
        .eq("rapporto_id", r.id);
      const rows = (data as any[] | null) || [];
      const byGroup = new Map<string, RamoGroupRow>();
      for (const x of rows) {
        const g = byGroup.get(x.gruppo_ramo_id) || { gruppo_ramo_id: x.gruppo_ramo_id, all: false, ramo_ids: [] };
        if (x.ramo_id === null) g.all = true;
        else if (!g.ramo_ids.includes(x.ramo_id)) g.ramo_ids.push(x.ramo_id);
        byGroup.set(x.gruppo_ramo_id, g);
      }
      // Se "all" => svuota ramo_ids
      const grouped = Array.from(byGroup.values()).map((g) => (g.all ? { ...g, ramo_ids: [] } : g));
      setRamiRows(grouped);
    })();
    // In modifica, mostra subito gli "Altri dettagli" se ci sono dati opzionali
    const hasAdvancedData = !!(
      r.codice_rapporto || r.tipo_rapporto !== "Agenzia" ||
      r.data_fine || r.percentuale_provvigione ||
      r.sede_denominazione || r.sede_indirizzo ||
      r.referente_compagnia || r.email_referente || r.telefono_referente ||
      r.note
    );
    setShowAdvanced(hasAdvancedData);
    setFormOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setRamiRows([]);
    setShowAdvanced(false);
    setFormOpen(true);
  };

  const openDuplicate = async (r: any) => {
    // Carica dati conto bancario di origine (se presente)
    let conto: any = null;
    if (r.conto_bancario_id) {
      const { data } = await supabase
        .from("conti_bancari" as any)
        .select("etichetta, banca, iban, intestato_a, bic, codice_abi, codice_cab, note")
        .eq("id", r.conto_bancario_id)
        .maybeSingle();
      conto = data || null;
    }
    setForm({
      // niente id => nuovo record
      nome_rapporto: `${r.nome_rapporto || "Rapporto"} (copia)`,
      gruppo_compagnia_id: r.gruppo_compagnia_id || "",
      codice_rapporto: r.codice_rapporto || "",
      tipo_rapporto: r.tipo_rapporto || "Agenzia",
      rami_abilitati: Array.isArray(r.rami_abilitati) ? r.rami_abilitati.join(", ") : "",
      data_inizio: new Date().toISOString().slice(0, 10),
      data_fine: "",
      attivo: true,
      percentuale_provvigione: r.percentuale_provvigione?.toString() || "",
      percentuale_ra: r.percentuale_ra?.toString() || "4.60",
      conto_bancario_id: null, // forza creazione nuovo record conto
      conto_etichetta: conto?.etichetta || "",
      conto_banca: conto?.banca || "",
      conto_iban: conto?.iban || "",
      conto_intestato_a: conto?.intestato_a || "",
      conto_bic: conto?.bic || "",
      conto_abi: conto?.codice_abi || "",
      conto_cab: conto?.codice_cab || "",
      conto_note: conto?.note || "",
      sede_denominazione: r.sede_denominazione || "",
      sede_indirizzo: r.sede_indirizzo || "",
      sede_cap: r.sede_cap || "",
      sede_citta: r.sede_citta || "",
      sede_provincia: r.sede_provincia || "",
      referente_compagnia: r.referente_compagnia || "",
      email_referente: r.email_referente || "",
      telefono_referente: r.telefono_referente || "",
      email_messe_a_cassa: r.email_messe_a_cassa || "",
      email_estratto_conto: r.email_estratto_conto || "",
      note: r.note || "",
    });
    // Copia rami abilitati
    const { data } = await supabase
      .from("compagnia_rapporto_rami" as any)
      .select("gruppo_ramo_id, ramo_id")
      .eq("rapporto_id", r.id);
    const rows = (data as any[] | null) || [];
    const byGroup = new Map<string, RamoGroupRow>();
    for (const x of rows) {
      const g = byGroup.get(x.gruppo_ramo_id) || { gruppo_ramo_id: x.gruppo_ramo_id, all: false, ramo_ids: [] };
      if (x.ramo_id === null) g.all = true;
      else if (!g.ramo_ids.includes(x.ramo_id)) g.ramo_ids.push(x.ramo_id);
      byGroup.set(x.gruppo_ramo_id, g);
    }
    const grouped = Array.from(byGroup.values()).map((g) => (g.all ? { ...g, ramo_ids: [] } : g));
    setRamiRows(grouped);
    setShowAdvanced(true);
    setFormOpen(true);
    toast.info("Rapporto duplicato in bozza: modifica e salva");
  };


  const gruppiOptions = (gruppi as any[]).map((g) => ({
    value: g.id,
    label: g.descrizione,
    description: g.codice || undefined,
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Rapporti con Compagnie Assicurative — <span className="text-primary">{compagniaNome}</span>
              <Badge variant="secondary" className="ml-2">
                {(rapporti as any[]).filter((r) => r.attivo).length}
                {(rapporti as any[]).some((r) => !r.attivo) ? `/${rapporti.length}` : ""}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {isSingleRapporto && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                Per <b>{compagniaTipo === "agenzia" ? "Agenzie" : "Direzioni"}</b> la relazione con la Compagnia è 1:1: esiste un solo <b>rapporto principale</b>, generato automaticamente dall'anagrafica e sincronizzato bidirezionalmente. Modifica i campi qui o sull'anagrafica: cambia tutto in entrambi i posti.
              </div>
            )}
            <div className="flex justify-end">
              {!isSingleRapporto && (
                <Button onClick={openNew} className="gap-2">
                  <Plus className="w-4 h-4" /> Nuovo Rapporto
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground text-sm">Caricamento...</p>
                ) : rapporti.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    {isSingleRapporto
                      ? "Rapporto principale non ancora generato. Riapri l'anagrafica e salva per crearlo."
                      : "Nessun rapporto registrato. Clicca \"Nuovo Rapporto\" per crearne uno."}
                  </p>

                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome rapporto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Codice</TableHead>
                        <TableHead>Garanzie</TableHead>
                        <TableHead>Inizio</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead className="text-right">% Provv.</TableHead>
                        <TableHead className="text-right">% RA</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rapporti as any[]).map((r, idx) => (
                        <TableRow key={r.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            <div>{r.nome_rapporto || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {r.gruppi_compagnia?.descrizione || ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{r.tipo_rapporto || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.sede_denominazione || r.sede_citta ? (
                              <>
                                <div>{r.sede_denominazione || "—"}</div>
                                <div className="text-muted-foreground">
                                  {[r.sede_citta, r.sede_provincia].filter(Boolean).join(" ")}
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.codice_rapporto || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                            {(() => {
                              const rows = (rapportoRamiAll as any[]).filter((x) => x.rapporto_id === r.id);
                              if (rows.length === 0) return "—";
                              const labels = rows.slice(0, 3).map((x) => {
                                const g = (gruppiRamo as any[]).find((gg) => gg.id === x.gruppo_ramo_id);
                                if (!x.ramo_id) return `${g?.descrizione || "?"} · Tutti`;
                                const ra = (ramiCatalog as any[]).find((rr) => rr.id === x.ramo_id);
                                return `${g?.descrizione || "?"} · ${ra?.descrizione || "?"}`;
                              });
                              return (
                                <span title={labels.join(" | ")}>
                                  {labels.join(", ")}{rows.length > 3 ? ` +${rows.length - 3}` : ""}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-sm">{r.data_inizio || "—"}</TableCell>
                          <TableCell className="text-sm">{r.data_fine || "—"}</TableCell>
                          <TableCell className="text-right text-sm">
                            {r.percentuale_provvigione != null ? `${r.percentuale_provvigione}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {r.percentuale_ra != null ? `${r.percentuale_ra}%` : "4.60%"}
                          </TableCell>
                          <TableCell>
                            {r.attivo ? (
                              <Badge className="bg-primary/10 text-primary border-primary/30">Attivo</Badge>
                            ) : (
                              <Badge variant="secondary">Chiuso</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDocsRapporto({ id: r.id, nome: `${r.nome_rapporto || "Rapporto"} — ${r.gruppi_compagnia?.descrizione || ""}` })}
                                title="Documenti"
                              >
                                <FolderOpen className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Modifica">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openDuplicate(r)} title="Duplica rapporto">
                                <Copy className="w-4 h-4 text-primary" />
                              </Button>

                              {r.attivo && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => closeMutation.mutate(r.id)}
                                  title="Chiudi rapporto"
                                >
                                  <XCircle className="w-4 h-4 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteId(r.id)}
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form create/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Rapporto" : "Nuovo Rapporto"}</DialogTitle>
          </DialogHeader>
          {(() => {
            const ibanRaw = (form.conto_iban || "").replace(/\s+/g, "").toUpperCase();
            const ibanCheck = ibanRaw ? validateIban(ibanRaw) : { valid: false as const, error: "IBAN obbligatorio" };
            const ibanError = !ibanRaw ? "IBAN obbligatorio" : (ibanCheck.valid ? null : ibanCheck.error);
            const validRamiRowsCount = ramiRows.filter((g) => g.gruppo_ramo_id && (g.all || g.ramo_ids.length > 0)).length;
            const ramiError = validRamiRowsCount === 0 ? "Aggiungi almeno un Ramo abilitato" : null;
            const sedeIndirizzoFilled = !!form.sede_indirizzo.trim();
            const cittaMissing = sedeIndirizzoFilled && !form.sede_citta.trim();
            const provMissing = sedeIndirizzoFilled && !form.sede_provincia.trim();
            const provInvalid = !!form.sede_provincia && form.sede_provincia.trim().length !== 2;
            const capInvalid = !!form.sede_cap && !/^\d{5}$/.test(form.sede_cap.trim());
            const canSave =
              !!form.gruppo_compagnia_id &&
              !!form.nome_rapporto.trim() &&
              !ramiError &&
              !ibanError &&
              !cittaMissing && !provMissing && !provInvalid && !capInvalid;

            return (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome del rapporto *</Label>
              <Input
                value={form.nome_rapporto}
                onChange={(e) => setForm((p) => ({ ...p, nome_rapporto: e.target.value }))}
                placeholder="es. Nobis – Agenzia Torino Centro"
                aria-invalid={!form.nome_rapporto.trim()}
              />
              <p className="text-[11px] text-muted-foreground">Etichetta libera che identifica univocamente questo rapporto.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Compagnia Assicurativa *</Label>
              <SearchableSelect
                options={gruppiOptions}
                value={form.gruppo_compagnia_id}
                onValueChange={(v) => setForm((p) => ({ ...p, gruppo_compagnia_id: v }))}
                placeholder="Seleziona Compagnia Assicurativa..."
              />
            </div>

            <div className={`space-y-2 border rounded-md p-3 bg-muted/30 ${ramiError ? "border-destructive" : ""}`}>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Rami e Sottorami abilitati *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (ramiRows.length > 0 && !confirm("Sostituire le righe già aggiunte con TUTTI i rami?")) return;
                      const allRows: RamoGroupRow[] = (gruppiRamo as any[]).map((g) => ({
                        gruppo_ramo_id: g.id,
                        all: true,
                        ramo_ids: [],
                      }));
                      setRamiRows(allRows);
                    }}
                    title="Abilita tutti i rami con tutti i sottorami"
                  >
                    <ListPlus className="w-3 h-3 mr-1" /> Tutti i Rami
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRamiRows((p) => [...p, { gruppo_ramo_id: "", all: true, ramo_ids: [] }])}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Aggiungi Ramo
                  </Button>
                </div>

              </div>
              {ramiRows.length === 0 ? (
                <p className={`text-[11px] ${ramiError ? "text-destructive" : "text-muted-foreground"}`}>
                  Aggiungi almeno un Ramo abilitato (con "Tutti i sottorami" oppure selezionando i singoli sottorami).
                </p>
              ) : (
                <div className="space-y-2">
                  {ramiRows.map((row, idx) => {
                    const sottoCatalog = (ramiCatalog as any[]).filter((rr) => rr.gruppo_ramo_id === row.gruppo_ramo_id);
                    const selectedLabels = row.ramo_ids
                      .map((id) => sottoCatalog.find((rr) => rr.id === id)?.descrizione)
                      .filter(Boolean) as string[];
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
                        <SearchableSelect
                          options={(gruppiRamo as any[]).map((g) => ({ value: g.id, label: g.descrizione, description: g.codice || undefined }))}
                          value={row.gruppo_ramo_id}
                          onValueChange={(v) =>
                            setRamiRows((p) => p.map((r, i) => (i === idx ? { gruppo_ramo_id: v, all: true, ramo_ids: [] } : r)))
                          }
                          placeholder="Ramo..."
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              disabled={!row.gruppo_ramo_id}
                              className="w-full justify-between font-normal"
                            >
                              <span className="truncate text-left">
                                {!row.gruppo_ramo_id
                                  ? "Seleziona prima un Ramo"
                                  : row.all
                                  ? "Tutti i sottorami"
                                  : selectedLabels.length === 0
                                  ? "Nessun sottoramo"
                                  : selectedLabels.length === 1
                                  ? selectedLabels[0]
                                  : `${selectedLabels.length} selezionati`}
                              </span>
                              <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cerca sottoramo..." />
                              <CommandList>
                                <CommandEmpty>Nessun sottoramo trovato.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__all__"
                                    onSelect={() =>
                                      setRamiRows((p) => p.map((r, i) => (i === idx ? { ...r, all: !r.all, ramo_ids: [] } : r)))
                                    }
                                  >
                                    <Checkbox checked={row.all} className="mr-2" />
                                    <span className="font-medium">Tutti i sottorami</span>
                                  </CommandItem>
                                </CommandGroup>
                                {!row.all && (
                                  <CommandGroup>
                                    {sottoCatalog.map((rr) => {
                                      const checked = row.ramo_ids.includes(rr.id);
                                      return (
                                        <CommandItem
                                          key={rr.id}
                                          value={`${rr.descrizione} ${rr.codice || ""}`}
                                          onSelect={() =>
                                            setRamiRows((p) =>
                                              p.map((r, i) =>
                                                i === idx
                                                  ? {
                                                      ...r,
                                                      ramo_ids: checked
                                                        ? r.ramo_ids.filter((x) => x !== rr.id)
                                                        : [...r.ramo_ids, rr.id],
                                                    }
                                                  : r,
                                              ),
                                            )
                                          }
                                        >
                                          <Checkbox checked={checked} className="mr-2" />
                                          <div className="flex flex-col">
                                            <span>{rr.descrizione}</span>
                                            {rr.codice && (
                                              <span className="text-[11px] text-muted-foreground">{rr.codice}</span>
                                            )}
                                          </div>
                                          {checked && <Check className="w-4 h-4 ml-auto opacity-50" />}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="text-[11px] text-muted-foreground min-w-[60px]">
                          {row.all ? "Tutti" : `${row.ramo_ids.length} sel.`}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setRamiRows((p) => p.filter((_, i) => i !== idx))}
                          title="Rimuovi"
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {ramiError && ramiRows.length > 0 && (
                <p className="text-xs text-destructive">{ramiError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Provvigione</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="es. 15.00"
                  value={form.percentuale_provvigione}
                  onChange={(e) => setForm((p) => ({ ...p, percentuale_provvigione: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Ritenuta d'acconto</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="4.60"
                  value={form.percentuale_ra}
                  onChange={(e) => setForm((p) => ({ ...p, percentuale_ra: e.target.value }))}
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-medium">Conto bancario del rapporto *</Label>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IBAN *</Label>
                <Input
                  placeholder="es. IT60X0542811101000000123456"
                  value={form.conto_iban}
                  maxLength={34}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, conto_iban: e.target.value.replace(/\s+/g, "").toUpperCase() }))
                  }
                  aria-invalid={!!ibanError}
                  className={ibanError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {ibanError && <p className="text-xs text-destructive">{ibanError}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Intestato a</Label>
                <Input
                  placeholder={form.nome_rapporto || "default: nome rapporto"}
                  value={form.conto_intestato_a}
                  onChange={(e) => setForm((p) => ({ ...p, conto_intestato_a: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground">Se vuoto, viene usato il nome del rapporto.</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAdvanced ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                {showAdvanced ? "Nascondi altri dettagli" : "Mostra altri dettagli (opzionali)"}
              </Button>
            </div>

            {showAdvanced && (
              <div className="space-y-4 border-l-2 border-muted pl-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Codice Rapporto</Label>
                    <Input
                      value={form.codice_rapporto}
                      onChange={(e) => setForm((p) => ({ ...p, codice_rapporto: e.target.value }))}
                      placeholder="es. AG12345"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tipo Rapporto</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={form.tipo_rapporto}
                      onChange={(e) => setForm((p) => ({ ...p, tipo_rapporto: e.target.value }))}
                    >
                      {TIPI_RAPPORTO.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Inizio</Label>
                    <Input
                      type="date"
                      value={form.data_inizio}
                      onChange={(e) => setForm((p) => ({ ...p, data_inizio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Fine</Label>
                    <Input
                      type="date"
                      value={form.data_fine}
                      onChange={(e) => setForm((p) => ({ ...p, data_fine: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                  <Label className="text-sm font-medium">Dettagli conto bancario</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Etichetta (es. Conto Nobis Torino)"
                      value={form.conto_etichetta}
                      onChange={(e) => setForm((p) => ({ ...p, conto_etichetta: e.target.value }))}
                    />
                    <Input
                      placeholder="Banca (es. Intesa Sanpaolo)"
                      value={form.conto_banca}
                      onChange={(e) => setForm((p) => ({ ...p, conto_banca: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="BIC"
                      value={form.conto_bic}
                      onChange={(e) => setForm((p) => ({ ...p, conto_bic: e.target.value.toUpperCase() }))}
                    />
                    <Input
                      placeholder="ABI"
                      value={form.conto_abi}
                      onChange={(e) => setForm((p) => ({ ...p, conto_abi: e.target.value }))}
                    />
                    <Input
                      placeholder="CAB"
                      value={form.conto_cab}
                      onChange={(e) => setForm((p) => ({ ...p, conto_cab: e.target.value }))}
                    />
                  </div>
                  <Input
                    placeholder="Note conto"
                    value={form.conto_note}
                    onChange={(e) => setForm((p) => ({ ...p, conto_note: e.target.value }))}
                  />
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                  <Label className="text-sm font-medium">Sede del rapporto (presso la Compagnia partner)</Label>
                  <Input
                    placeholder="Denominazione (es. Agenzia Nobis Torino Centro)"
                    value={form.sede_denominazione}
                    onChange={(e) => setForm((p) => ({ ...p, sede_denominazione: e.target.value }))}
                  />
                  <AddressAutocomplete
                    placeholder="Indirizzo (es. Via Moncalieri 12) — digita per cercare con Google Maps"
                    value={form.sede_indirizzo}
                    onChange={(v) => setForm((p) => ({ ...p, sede_indirizzo: v }))}
                    onSelect={(c) =>
                      setForm((p) => ({
                        ...p,
                        sede_indirizzo: c.indirizzo || p.sede_indirizzo,
                        sede_cap: c.cap || p.sede_cap,
                        sede_citta: c.citta || p.sede_citta,
                        sede_provincia: (c.provincia || p.sede_provincia).toUpperCase(),
                      }))
                    }
                  />
                  {sedeIndirizzoFilled && (
                    <p className="text-xs text-muted-foreground">
                      Indirizzo compilato: CAP, Città e Provincia sono obbligatori. Seleziona un suggerimento Google per compilarli automaticamente.
                    </p>
                  )}
                  <div className="grid grid-cols-[110px_1fr_90px] gap-3">
                    <div className="space-y-1">
                      <Input
                        placeholder="CAP"
                        value={form.sede_cap}
                        onChange={(e) => setForm((p) => ({ ...p, sede_cap: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                        aria-invalid={capInvalid}
                        className={capInvalid ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {capInvalid && <p className="text-xs text-destructive">CAP: 5 cifre</p>}
                    </div>
                    <div className="space-y-1">
                      <Input
                        placeholder={sedeIndirizzoFilled ? "Città *" : "Città"}
                        value={form.sede_citta}
                        onChange={(e) => setForm((p) => ({ ...p, sede_citta: e.target.value }))}
                        aria-invalid={cittaMissing}
                        className={cittaMissing ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {cittaMissing && <p className="text-xs text-destructive">Città obbligatoria con indirizzo</p>}
                    </div>
                    <div className="space-y-1">
                      <Input
                        placeholder={sedeIndirizzoFilled ? "Prov. *" : "Prov."}
                        maxLength={2}
                        value={form.sede_provincia}
                        onChange={(e) => setForm((p) => ({ ...p, sede_provincia: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) }))}
                        aria-invalid={provMissing || provInvalid}
                        className={(provMissing || provInvalid) ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {provMissing && <p className="text-xs text-destructive">Obbligatoria</p>}
                      {!provMissing && provInvalid && <p className="text-xs text-destructive">2 lettere</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                  <Label className="text-sm font-medium">Referente in Compagnia Assicurativa</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      placeholder="Nome referente"
                      value={form.referente_compagnia}
                      onChange={(e) => setForm((p) => ({ ...p, referente_compagnia: e.target.value }))}
                    />
                    <Input
                      placeholder="Email"
                      value={form.email_referente}
                      onChange={(e) => setForm((p) => ({ ...p, email_referente: e.target.value }))}
                    />
                    <Input
                      placeholder="Telefono"
                      value={form.telefono_referente}
                      onChange={(e) => setForm((p) => ({ ...p, telefono_referente: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3 border rounded-md p-3 bg-muted/10">
                  <Label className="text-sm font-medium">Indirizzi Email Funzionali</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email Messe a Cassa</Label>
                      <Input
                        type="email"
                        placeholder="messeacassa@compagnia.it"
                        value={form.email_messe_a_cassa}
                        onChange={(e) => setForm((p) => ({ ...p, email_messe_a_cassa: e.target.value }))}
                      />
                      <p className="text-[11px] text-muted-foreground">Destinatario comunicazioni di messa in pagamento</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email Estratto Conto</Label>
                      <Input
                        type="email"
                        placeholder="estrattoconto@compagnia.it"
                        value={form.email_estratto_conto}
                        onChange={(e) => setForm((p) => ({ ...p, email_estratto_conto: e.target.value }))}
                      />
                      <p className="text-[11px] text-muted-foreground">Destinatario invio E/C agenzia</p>
                    </div>
                  </div>
                </div>


                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Note</Label>
                  <Textarea
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Provvigioni per Ramo del singolo rapporto (solo per rapporti già salvati) */}
            {form.id && (
              <Accordion type="single" collapsible defaultValue="provv-rapporto" className="pt-2">
                <AccordionItem value="provv-rapporto" className="border rounded-md px-3">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-primary" />
                      Provvigioni per Ramo / Sottoramo (di questo rapporto)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ProvvigioniRapportiTab fixedRapportoId={form.id} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}


            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvataggio..." : "Salva Rapporto"}
              </Button>
            </div>
          </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente questo rapporto?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà rimossa ogni traccia del rapporto. Per mantenere lo storico,
              usa invece "Chiudi rapporto".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RapportoDocumentiDialog
        open={!!docsRapporto}
        onOpenChange={(v) => !v && setDocsRapporto(null)}
        rapportoId={docsRapporto?.id ?? null}
        rapportoNome={docsRapporto?.nome}
      />
    </>
  );
}
