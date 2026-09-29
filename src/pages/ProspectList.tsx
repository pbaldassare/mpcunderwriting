import { useState, useRef, useCallback, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Search, Eye } from "lucide-react";
import ServerPagination from "@/components/ServerPagination";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";
import { FiscalCodeInput } from "@/components/ui/FiscalCodeInput";
import { useLookupZone, useLookupIndotti, useLookupAttivita, useLookupSettori, useLookupContratti, useLookupFasceFatturato, useLookupFasceDipendenti, useGruppiStatistici } from "@/hooks/useLookupTables";
import { assertFiscalValid } from "@/lib/assertFiscalValid";
import { buildIlikeOr, PROSPECT_SEARCH_COLUMNS } from "@/lib/searchNoEmail";
const STATI_PROSPECT = [
  { value: "nuovo", label: "Nuovo", color: "bg-kpi-blue-bg text-kpi-blue-text border-kpi-blue-border" },
  { value: "in_trattativa", label: "In Trattativa", color: "bg-kpi-yellow-bg text-kpi-yellow-text border-kpi-yellow-border" },
  { value: "preventivo_inviato", label: "Preventivo Inviato", color: "bg-kpi-orange-bg text-kpi-orange-text border-kpi-orange-border" },
  { value: "chiuso_vinto", label: "Chiuso Vinto", color: "bg-kpi-green-bg text-kpi-green-text border-kpi-green-border" },
  { value: "chiuso_perso", label: "Chiuso Perso", color: "bg-destructive/10 text-destructive border-destructive/30" },
];

const FONTI = ["Referral", "Web", "Telefono", "Evento", "Altro"];

const initialForm = {
  tipo_cliente: "privato" as "privato" | "azienda" | "ente",
  nome: "", cognome: "", email: "", telefono: "", fonte: "", note: "",
  codice_fiscale: "", data_nascita: "", luogo_nascita: "",
  indirizzo_residenza: "", cap_residenza: "", citta_residenza: "", provincia_residenza: "",
  ragione_sociale: "", partita_iva: "", codice_fiscale_azienda: "", codice_sdi: "", forma_giuridica: "",
  indirizzo_sede: "", cap_sede: "", citta_sede: "", provincia_sede: "",
  referente_nome: "", referente_cognome: "", referente_telefono: "", referente_email: "",
  pec: "", cellulare: "", fax: "",
  codice_ricerca: "", titolo: "", sesso: "", comune_nascita: "", provincia_nascita: "", nazione: "", attenzione_di: "",
  indirizzo_alternativo: "", cap_alternativo: "", citta_alternativa: "", provincia_alternativa: "",
  indirizzo_fiscale: "", cap_fiscale: "", citta_fiscale: "", provincia_fiscale: "",
  zona: "", indotto: "", attivita: "", settore: "", contratto: "", gruppo_statistico: "",
  fascia_fatturato: "", fascia_dipendenti: "", azienda_stat: "", matricola: "", riferimento: "", codice_ateco: "",
  cliente_associato: false, cliente_captive: false, internazionale: false,
};

const ProspectList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [filtroStato, debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filtroSearch);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [filtroSearch, setPage]);
  const [form, setForm] = useState(initialForm);
  const scannedFilesRef = useRef<{ file: File; documentType: string }[]>([]);

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileReady = useCallback((file: File, documentType: DocumentType) => {
    scannedFilesRef.current.push({ file, documentType });
  }, []);

  const uploadScannedFiles = useCallback(async (prospectId: string) => {
    const files = scannedFilesRef.current;
    if (files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    for (const { file, documentType } of files) {
      const ts = Date.now();
      const path = `prospect/${prospectId}/${ts}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documenti_clienti").upload(path, file);
      if (uploadErr) { console.error("Upload error:", uploadErr); continue; }
      await supabase.from("documenti").insert({
        nome_file: file.name, path_storage: path, bucket_name: "documenti_clienti",
        entita_tipo: "prospect", entita_id: prospectId, caricato_da: userId, categoria: documentType,
      });
    }
    scannedFilesRef.current = [];
  }, []);

  // Lookup tables
  const { data: zoneOpts = [] } = useLookupZone();
  const { data: indottiOpts = [] } = useLookupIndotti();
  const { data: attivitaOpts = [] } = useLookupAttivita();
  const { data: settoriOpts = [] } = useLookupSettori();
  const { data: contrattiOpts = [] } = useLookupContratti();
  const { data: fasceFatturatoOpts = [] } = useLookupFasceFatturato();
  const { data: fasceDipendentiOpts = [] } = useLookupFasceDipendenti();
  const { data: gruppiStatOpts = [] } = useGruppiStatistici();

  const { data: prospectResult, isLoading } = useQuery({
    queryKey: ["prospect", page, filtroStato, debouncedSearch],
    queryFn: async () => {
      let q = supabase
        .from("prospect")
        .select("*, profiles:assegnato_a(nome, cognome), uffici:ufficio_id(nome_ufficio)", { count: "exact" });

      if (filtroStato !== "tutti") q = q.eq("stato", filtroStato);
      const searchOr = buildIlikeOr([...PROSPECT_SEARCH_COLUMNS], debouncedSearch);
      if (searchOr) q = q.or(searchOr);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const prospect = prospectResult?.data || [];
  const totalCount = prospectResult?.count || 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      assertFiscalValid([
        { label: "Codice Fiscale", value: form.codice_fiscale, kind: "cf16" },
        { label: "Partita IVA", value: form.partita_iva, kind: "piva" },
        { label: "Codice Fiscale Azienda", value: form.codice_fiscale_azienda, kind: "cf-azienda" },
      ]);
      const payload: Record<string, unknown> = {
        tipo_cliente: form.tipo_cliente,
        email: form.email || null, telefono: form.telefono || null,
        fonte: form.fonte || null, note: form.note || null,
        stato: "nuovo", assegnato_a: profile?.id || null,
        ufficio_id: profile?.ufficio_id || null,
        pec: form.pec || null, cellulare: form.cellulare || null, fax: form.fax || null,
        // Gestionali
        codice_ricerca: form.codice_ricerca || null, titolo: form.titolo || null,
        sesso: form.sesso || null, comune_nascita: form.comune_nascita || null,
        provincia_nascita: form.provincia_nascita || null, nazione: form.nazione || null,
        attenzione_di: form.attenzione_di || null,
        // Indirizzi aggiuntivi
        indirizzo_alternativo: form.indirizzo_alternativo || null, cap_alternativo: form.cap_alternativo || null,
        citta_alternativa: form.citta_alternativa || null, provincia_alternativa: form.provincia_alternativa || null,
        indirizzo_fiscale: form.indirizzo_fiscale || null, cap_fiscale: form.cap_fiscale || null,
        citta_fiscale: form.citta_fiscale || null, provincia_fiscale: form.provincia_fiscale || null,
        // Statistici
        zona: form.zona || null, indotto: form.indotto || null, attivita: form.attivita || null,
        settore: form.settore || null, contratto: form.contratto || null,
        gruppo_statistico: form.gruppo_statistico || null,
        fascia_fatturato: form.fascia_fatturato || null, fascia_dipendenti: form.fascia_dipendenti || null,
        azienda_stat: form.azienda_stat || null, matricola: form.matricola || null,
        riferimento: form.riferimento || null, codice_ateco: form.codice_ateco || null,
        cliente_associato: form.cliente_associato, cliente_captive: form.cliente_captive,
        internazionale: form.internazionale,
      };
      if (form.tipo_cliente === "privato") {
        payload.nome = form.nome || null; payload.cognome = form.cognome || null;
        payload.codice_fiscale = form.codice_fiscale || null;
        payload.data_nascita = form.data_nascita || null; payload.luogo_nascita = form.luogo_nascita || null;
        payload.indirizzo_residenza = form.indirizzo_residenza || null;
        payload.cap_residenza = form.cap_residenza || null;
        payload.citta_residenza = form.citta_residenza || null;
        payload.provincia_residenza = form.provincia_residenza || null;
      } else {
        payload.ragione_sociale = form.ragione_sociale || null;
        payload.partita_iva = form.partita_iva || null;
        payload.codice_fiscale_azienda = form.codice_fiscale_azienda || null;
        payload.codice_sdi = form.codice_sdi || null; payload.forma_giuridica = form.forma_giuridica || null;
        payload.indirizzo_sede = form.indirizzo_sede || null;
        payload.cap_sede = form.cap_sede || null; payload.citta_sede = form.citta_sede || null;
        payload.provincia_sede = form.provincia_sede || null;
        payload.referente_nome = form.referente_nome || null;
        payload.referente_cognome = form.referente_cognome || null;
        payload.referente_telefono = form.referente_telefono || null;
        payload.referente_email = form.referente_email || null;
      }
      const { data, error } = await supabase.from("prospect").insert(payload as any).select().single();
      if (error) throw error;
      await logAttivita({ azione: "creazione_prospect", entita_tipo: "prospect", entita_id: data.id, dettagli_json: { nome: form.nome, cognome: form.cognome, ragione_sociale: form.ragione_sociale, stato: "nuovo" } });
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) await uploadScannedFiles(data.id);
      queryClient.invalidateQueries({ queryKey: ["prospect"] });
      toast.success("Prospect creato con successo");
      setForm(initialForm);
      scannedFilesRef.current = [];
      setOpen(false);
    },
    onError: (err: Error) => toast.error("Errore nella creazione del prospect"),
  });

  const getStatoBadge = (stato: string) => {
    const s = STATI_PROSPECT.find((x) => x.value === stato);
    return s ? (
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
    ) : <Badge variant="secondary">{stato}</Badge>;
  };

  const getDenominazione = (p: any) => {
    if (p.tipo_cliente === "azienda" || p.tipo_cliente === "ente") {
      return p.ragione_sociale || `${p.nome || ""} ${p.cognome || ""}`.trim();
    }
    return `${p.nome || ""} ${p.cognome || ""}`.trim();
  };

  const isFormValid = form.tipo_cliente === "privato"
    ? !!(form.nome && form.cognome)
    : !!form.ragione_sociale;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Prospect & Trattative</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prospect & Trattative</h1>
            <p className="text-sm text-muted-foreground">Gestione prospect e trattative commerciali</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" />Nuovo Prospect</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuovo Prospect</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Tipo Prospect */}
              <div>
                <Label>Tipo Prospect</Label>
                <Select value={form.tipo_cliente} onValueChange={(v) => set("tipo_cliente", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privato">Privato</SelectItem>
                    <SelectItem value="azienda">Azienda</SelectItem>
                    <SelectItem value="ente">Ente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Document Scanner */}
              {form.tipo_cliente === "privato" ? (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner documentType="carta_identita" onFileReady={handleFileReady}
                    entityContext={(form.codice_fiscale || form.nome || form.cognome) ? {
                      entityType: "prospect",
                      scopeHint: `Nuovo prospect ${(form.cognome || "").trim()} ${(form.nome || "").trim()}`.trim() || "Nuovo prospect",
                      expectedCF: form.codice_fiscale || null,
                    } : undefined}
                    onExtracted={(data) => {
                      if (data.nome) set("nome", data.nome);
                      if (data.cognome) set("cognome", data.cognome);
                      if (data.codice_fiscale) set("codice_fiscale", (data.codice_fiscale as string).toUpperCase());
                      if (data.data_nascita) set("data_nascita", data.data_nascita);
                      if (data.luogo_nascita) set("luogo_nascita", data.luogo_nascita);
                      if (data.indirizzo) set("indirizzo_residenza", data.indirizzo);
                      if (data.cap) set("cap_residenza", data.cap);
                      if (data.citta) set("citta_residenza", data.citta);
                      if (data.provincia) set("provincia_residenza", (data.provincia as string).toUpperCase());
                    }} />
                  <AiDocumentScanner documentType="tessera_sanitaria" onFileReady={handleFileReady}
                    entityContext={(form.codice_fiscale || form.nome || form.cognome) ? {
                      entityType: "prospect",
                      scopeHint: `Nuovo prospect ${(form.cognome || "").trim()} ${(form.nome || "").trim()}`.trim() || "Nuovo prospect",
                      expectedCF: form.codice_fiscale || null,
                    } : undefined}
                    onExtracted={(data) => {
                      if (data.codice_fiscale) set("codice_fiscale", (data.codice_fiscale as string).toUpperCase());
                      if (data.nome) set("nome", data.nome);
                      if (data.cognome) set("cognome", data.cognome);
                      if (data.data_nascita) set("data_nascita", data.data_nascita);
                    }} />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner documentType="visura_camerale" onFileReady={handleFileReady}
                    entityContext={(form.partita_iva || form.ragione_sociale) ? {
                      entityType: "prospect",
                      scopeHint: form.ragione_sociale || "Nuova azienda prospect",
                      expectedPIVA: form.partita_iva || null,
                    } : undefined}
                    onExtracted={(data) => {
                      if (data.ragione_sociale) set("ragione_sociale", data.ragione_sociale);
                      if (data.partita_iva) set("partita_iva", data.partita_iva);
                      if (data.codice_fiscale) set("codice_fiscale_azienda", (data.codice_fiscale as string).toUpperCase());
                      if (data.codice_sdi) set("codice_sdi", data.codice_sdi);
                      if (data.forma_giuridica) set("forma_giuridica", (data.forma_giuridica as string).toLowerCase().replace(/\s/g, "_"));
                      if (data.indirizzo_sede) set("indirizzo_sede", data.indirizzo_sede);
                      if (data.cap) set("cap_sede", data.cap);
                      if (data.citta) set("citta_sede", data.citta);
                      if (data.provincia) set("provincia_sede", (data.provincia as string).toUpperCase());
                      if (data.pec) set("pec", data.pec);
                    }} />
                </div>
              )}

              {/* Campi condizionali per tipo */}
              {form.tipo_cliente === "privato" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Mario" /></div>
                    <div><Label>Cognome *</Label><Input value={form.cognome} onChange={(e) => set("cognome", e.target.value)} placeholder="Rossi" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice Fiscale</Label><FiscalCodeInput kind="cf16" value={form.codice_fiscale} onChange={(val) => {
                      set("codice_fiscale", val);
                      if (val.length === 16) {
                        const parsed = parseCF(val);
                        if (parsed) {
                          if (!form.sesso) set("sesso", parsed.sesso);
                          if (!form.data_nascita) set("data_nascita", parsed.dataNascita);
                          const info = lookupComune(parsed.codiceCatastale);
                          if (info) {
                            if (!form.comune_nascita) set("comune_nascita", info.comune);
                            if (!form.provincia_nascita) set("provincia_nascita", info.provincia);
                          }
                          toast.info("Dati estratti automaticamente dal Codice Fiscale");
                        }
                      }
                    }} /></div>
                    <div><Label>Data di Nascita</Label><Input type="date" value={form.data_nascita} onChange={(e) => set("data_nascita", e.target.value)} /></div>
                  </div>
                  <div><Label>Luogo di Nascita</Label><Input value={form.luogo_nascita} onChange={(e) => set("luogo_nascita", e.target.value)} /></div>
                  <div><Label>Indirizzo Residenza</Label><AddressAutocomplete value={form.indirizzo_residenza} onChange={(v) => set("indirizzo_residenza", v)} onSelect={(c) => { set("cap_residenza", c.cap); set("citta_residenza", c.citta); set("provincia_residenza", c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={form.cap_residenza} onChange={(e) => set("cap_residenza", e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={form.citta_residenza} onChange={(e) => set("citta_residenza", e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={form.provincia_residenza} onChange={(e) => set("provincia_residenza", e.target.value)} maxLength={2} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div><Label>Ragione Sociale *</Label><Input value={form.ragione_sociale} onChange={(e) => set("ragione_sociale", e.target.value)} placeholder="Azienda S.r.l." /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Partita IVA</Label><FiscalCodeInput kind="piva" value={form.partita_iva} onChange={(val) => set("partita_iva", val)} /></div>
                    <div><Label>Codice Fiscale Azienda</Label><FiscalCodeInput kind="cf-azienda" value={form.codice_fiscale_azienda} onChange={(val) => {
                      set("codice_fiscale_azienda", val);
                      if (val.length === 11 && /^\d{11}$/.test(val) && !form.partita_iva) {
                        set("partita_iva", val);
                        toast.info("Partita IVA copiata dal Codice Fiscale Azienda");
                      }
                    }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice SDI</Label><Input value={form.codice_sdi} onChange={(e) => set("codice_sdi", e.target.value)} maxLength={7} /></div>
                    <div>
                      <Label>Forma Giuridica</Label>
                      <SearchableSelect value={form.forma_giuridica} onValueChange={(v) => set("forma_giuridica", v)} placeholder="Seleziona..."
                        options={[
                          { value: "srl", label: "SRL" }, { value: "srls", label: "SRLS" },
                          { value: "spa", label: "SPA" }, { value: "snc", label: "SNC" },
                          { value: "sas", label: "SAS" }, { value: "ditta_individuale", label: "Ditta Individuale" },
                          { value: "cooperativa", label: "Cooperativa" }, { value: "altro", label: "Altro" },
                        ]} />
                    </div>
                  </div>
                  <div><Label>Indirizzo Sede</Label><AddressAutocomplete value={form.indirizzo_sede} onChange={(v) => set("indirizzo_sede", v)} onSelect={(c) => { set("cap_sede", c.cap); set("citta_sede", c.citta); set("provincia_sede", c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={form.cap_sede} onChange={(e) => set("cap_sede", e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={form.citta_sede} onChange={(e) => set("citta_sede", e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={form.provincia_sede} onChange={(e) => set("provincia_sede", e.target.value)} maxLength={2} /></div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Referente Aziendale</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome Referente</Label><Input value={form.referente_nome} onChange={(e) => set("referente_nome", e.target.value)} /></div>
                      <div><Label>Cognome Referente</Label><Input value={form.referente_cognome} onChange={(e) => set("referente_cognome", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div><Label>Telefono Referente</Label><Input value={form.referente_telefono} onChange={(e) => set("referente_telefono", e.target.value)} /></div>
                      <div><Label>Email Referente</Label><Input type="email" value={form.referente_email} onChange={(e) => set("referente_email", e.target.value)} /></div>
                    </div>
                  </div>
                </>
              )}

              {/* Contatti comuni */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Contatti</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@esempio.it" /></div>
                  <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+39..." /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div><Label>PEC</Label><Input type="email" value={form.pec} onChange={(e) => set("pec", e.target.value)} /></div>
                  <div><Label>Cellulare</Label><Input value={form.cellulare} onChange={(e) => set("cellulare", e.target.value)} /></div>
                  <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => set("fax", e.target.value)} /></div>
                </div>
              </div>

              {/* Fonte e Note */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fonte</Label>
                  <Select value={form.fonte} onValueChange={(v) => set("fonte", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona fonte" /></SelectTrigger>
                    <SelectContent>{FONTI.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} placeholder="Note aggiuntive..." /></div>

              {/* Sezioni Accordion */}
              <Accordion type="multiple" className="w-full border-t pt-4">
                {/* Dati Gestionali */}
                <AccordionItem value="gestionali">
                  <AccordionTrigger className="text-sm font-medium">Dati Gestionali</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Codice Ricerca</Label><Input value={form.codice_ricerca} onChange={(e) => set("codice_ricerca", e.target.value)} /></div>
                        <div>
                          <Label className="text-xs">Titolo</Label>
                          <Select value={form.titolo} onValueChange={(v) => set("titolo", v)}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sig">Sig.</SelectItem>
                              <SelectItem value="sig_ra">Sig.ra</SelectItem>
                              <SelectItem value="dott">Dott.</SelectItem>
                              <SelectItem value="dott_ssa">Dott.ssa</SelectItem>
                              <SelectItem value="ing">Ing.</SelectItem>
                              <SelectItem value="avv">Avv.</SelectItem>
                              <SelectItem value="prof">Prof.</SelectItem>
                              <SelectItem value="rag">Rag.</SelectItem>
                              <SelectItem value="geom">Geom.</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Sesso</Label>
                          <Select value={form.sesso} onValueChange={(v) => set("sesso", v)}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Maschio</SelectItem>
                              <SelectItem value="F">Femmina</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Comune Nascita</Label><Input value={form.comune_nascita} onChange={(e) => set("comune_nascita", e.target.value)} /></div>
                        <div><Label className="text-xs">Provincia Nascita</Label><Input value={form.provincia_nascita} onChange={(e) => set("provincia_nascita", e.target.value)} maxLength={2} /></div>
                        <div><Label className="text-xs">Nazione</Label><Input value={form.nazione} onChange={(e) => set("nazione", e.target.value)} /></div>
                      </div>
                      <div><Label className="text-xs">Attenzione di</Label><Input value={form.attenzione_di} onChange={(e) => set("attenzione_di", e.target.value)} /></div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Dati Statistici */}
                <AccordionItem value="statistici">
                  <AccordionTrigger className="text-sm font-medium">Dati Statistici</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Gruppo Statistico</Label><SearchableSelect value={form.gruppo_statistico} onValueChange={(v) => set("gruppo_statistico", v)} placeholder="— Seleziona —" options={gruppiStatOpts} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Zona</Label><SearchableSelect value={form.zona} onValueChange={(v) => set("zona", v)} placeholder="— Seleziona —" options={zoneOpts} /></div>
                        <div><Label className="text-xs">Indotto</Label><SearchableSelect value={form.indotto} onValueChange={(v) => set("indotto", v)} placeholder="— Seleziona —" options={indottiOpts} /></div>
                        <div><Label className="text-xs">Attività</Label><SearchableSelect value={form.attivita} onValueChange={(v) => set("attivita", v)} placeholder="— Seleziona —" options={attivitaOpts} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Settore</Label><SearchableSelect value={form.settore} onValueChange={(v) => set("settore", v)} placeholder="— Seleziona —" options={settoriOpts} /></div>
                        <div><Label className="text-xs">Azienda Stat.</Label><Input value={form.azienda_stat} onChange={(e) => set("azienda_stat", e.target.value)} /></div>
                        <div><Label className="text-xs">Contratto</Label><SearchableSelect value={form.contratto} onValueChange={(v) => set("contratto", v)} placeholder="— Seleziona —" options={contrattiOpts} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">Matricola</Label><Input value={form.matricola} onChange={(e) => set("matricola", e.target.value)} /></div>
                        <div><Label className="text-xs">Riferimento</Label><Input value={form.riferimento} onChange={(e) => set("riferimento", e.target.value)} /></div>
                        <div><Label className="text-xs">Codice ATECO</Label><Input value={form.codice_ateco} onChange={(e) => set("codice_ateco", e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Fascia Fatturato</Label><SearchableSelect value={form.fascia_fatturato} onValueChange={(v) => set("fascia_fatturato", v)} placeholder="— Seleziona —" options={fasceFatturatoOpts} /></div>
                        <div><Label className="text-xs">Fascia Dipendenti</Label><SearchableSelect value={form.fascia_dipendenti} onValueChange={(v) => set("fascia_dipendenti", v)} placeholder="— Seleziona —" options={fasceDipendentiOpts} /></div>
                      </div>
                      <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2"><Switch checked={form.cliente_associato} onCheckedChange={(v) => set("cliente_associato", v)} /><Label className="text-xs">Cliente Associato</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={form.cliente_captive} onCheckedChange={(v) => set("cliente_captive", v)} /><Label className="text-xs">Cliente Captive</Label></div>
                        <div className="flex items-center gap-2"><Switch checked={form.internazionale} onCheckedChange={(v) => set("internazionale", v)} /><Label className="text-xs">Internazionale</Label></div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Indirizzi Aggiuntivi */}
                <AccordionItem value="indirizzi">
                  <AccordionTrigger className="text-sm font-medium">Indirizzi Aggiuntivi</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-muted-foreground">Indirizzo Alternativo</p>
                      <div><AddressAutocomplete value={form.indirizzo_alternativo} onChange={(v) => set("indirizzo_alternativo", v)} onSelect={(c) => { set("cap_alternativo", c.cap); set("citta_alternativa", c.citta); set("provincia_alternativa", c.provincia); }} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">CAP</Label><Input value={form.cap_alternativo} onChange={(e) => set("cap_alternativo", e.target.value)} maxLength={5} /></div>
                        <div><Label className="text-xs">Città</Label><Input value={form.citta_alternativa} onChange={(e) => set("citta_alternativa", e.target.value)} /></div>
                        <div><Label className="text-xs">Provincia</Label><Input value={form.provincia_alternativa} onChange={(e) => set("provincia_alternativa", e.target.value)} maxLength={2} /></div>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mt-4">Indirizzo Fiscale</p>
                      <div><AddressAutocomplete value={form.indirizzo_fiscale} onChange={(v) => set("indirizzo_fiscale", v)} onSelect={(c) => { set("cap_fiscale", c.cap); set("citta_fiscale", c.citta); set("provincia_fiscale", c.provincia); }} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">CAP</Label><Input value={form.cap_fiscale} onChange={(e) => set("cap_fiscale", e.target.value)} maxLength={5} /></div>
                        <div><Label className="text-xs">Città</Label><Input value={form.citta_fiscale} onChange={(e) => set("citta_fiscale", e.target.value)} /></div>
                        <div><Label className="text-xs">Provincia</Label><Input value={form.provincia_fiscale} onChange={(e) => set("provincia_fiscale", e.target.value)} maxLength={2} /></div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !isFormValid}>Crea Prospect</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-64" placeholder="Cerca per nome, ragione sociale, CF, P.IVA..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            {STATI_PROSPECT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !prospect.length ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessun prospect trovato</h3>
          <p className="text-sm text-muted-foreground">Crea il primo prospect per iniziare.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Denominazione</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Assegnato a</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospect.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/prospect/${p.id}`)}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{p.tipo_cliente || "privato"}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{getDenominazione(p)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.telefono || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.fonte || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatoBadge(p.stato)}
                      {p.convertito_cliente_id && (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-kpi-green-bg text-kpi-green-text border border-kpi-green-border">
                          Convertito
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.profiles ? `${p.profiles.nome || ""} ${p.profiles.cognome || ""}`.trim() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-4">
            <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProspectList;
