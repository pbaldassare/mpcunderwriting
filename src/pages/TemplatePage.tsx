import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientiSearch } from "@/hooks/useClienteSearch";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Tag, Mail, Copy, CopyPlus, Search, User, FileText, Send, Palette, Link2 } from "lucide-react";
import { SendTestEmailDialog } from "@/components/template/SendTestEmailDialog";
import { EmailBrandingTab } from "@/components/template/EmailBrandingTab";
import { AssociazioniTemplateTab } from "@/components/template/AssociazioniTemplateTab";
import { SedeTemplateSelect, type UfficioOption } from "@/components/template/SedeTemplateSelect";
import { duplicateTemplateNome, labelSedeTemplate } from "@/lib/emailBrandingSede";
import { useAuth } from "@/contexts/AuthContext";
import {
  canChangeTemplateSede,
  canEditTemplate,
  canManageTemplateCategorie,
  filterTemplatesPerSede,
  forceUfficioIdForSave,
  lockedSedeUfficioId,
} from "@/lib/sistemaSede";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

const PLACEHOLDER_VARS = [
  { label: "Nome cliente", value: "{{cliente_nome}}" },
  { label: "Cognome cliente", value: "{{cliente_cognome}}" },
  { label: "Email cliente", value: "{{cliente_email}}" },
  { label: "Codice Fiscale", value: "{{cliente_codice_fiscale}}" },
  { label: "Ragione Sociale", value: "{{azienda_ragione_sociale}}" },
  { label: "N° Polizza", value: "{{polizza_numero}}" },
  { label: "Scadenza Polizza", value: "{{polizza_scadenza}}" },
  { label: "Premio Polizza", value: "{{polizza_premio}}" },
  { label: "Agenzia", value: "{{compagnia_nome}}" },
  { label: "Sede", value: "{{sede_nome}}" },
  { label: "Indirizzo Sede", value: "{{sede_indirizzo}}" },
  { label: "Email Sede", value: "{{sede_email}}" },
  { label: "Telefono Sede", value: "{{sede_telefono}}" },
  { label: "Codice Sede", value: "{{sede_codice}}" },
  { label: "Data Oggi", value: "{{data_oggi}}" },
];

const EXAMPLE_DATA: Record<string, string> = {
  "{{cliente_nome}}": "Mario",
  "{{cliente_cognome}}": "Rossi",
  "{{cliente_email}}": "mario.rossi@email.it",
  "{{cliente_codice_fiscale}}": "RSSMRA80A01H501Z",
  "{{azienda_ragione_sociale}}": "Rossi S.r.l.",
  "{{polizza_numero}}": "POL-2026-001234",
  "{{polizza_scadenza}}": "30/06/2026",
  "{{polizza_premio}}": "1.250,00",
  "{{compagnia_nome}}": "Allianz",
  "{{sede_nome}}": "Sede di Milano",
  "{{sede_indirizzo}}": "Via Roma 10, 20121 Milano",
  "{{sede_email}}": "sede.milano@agenzia.it",
  "{{sede_telefono}}": "02 1234567",
  "{{sede_codice}}": "MI-001",
  "{{data_oggi}}": new Date().toLocaleDateString("it-IT"),
};

function replaceVarsWithData(text: string, data: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(data)) {
    result = result.split(key).join(val);
  }
  return result;
}

interface Categoria { id: string; nome: string; descrizione: string | null; }
interface Template { id: string; categoria_id: string; nome: string; oggetto: string; corpo: string; attivo: boolean; created_at: string; ufficio_id: string | null; }

interface ClienteResult {
  id: string;
  nome: string | null;
  cognome: string | null;
  ragione_sociale: string | null;
  codice_fiscale: string | null;
  email: string | null;
  tipo_cliente: string;
}

interface PolizzaResult {
  id: string;
  numero_titolo: string | null;
  data_scadenza: string | null;
  premio_lordo: number | null;
  prodotto_nome: string | null;
  compagnia_nome: string | null;
  sede_nome: string | null;
  sede_indirizzo: string | null;
  sede_email: string | null;
  sede_telefono: string | null;
  sede_codice: string | null;
}

// --- Search hooks ---
function useClienteSearch(searchTerm: string) {
  return useQuery({
    queryKey: ["search_clienti", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      return (await fetchClientiSearch(searchTerm, { onlyAttivi: false, limit: 15 })) as ClienteResult[];
    },
    enabled: searchTerm.length >= 2,
  });
}

function usePolizzaSearch(searchTerm: string, clienteId?: string) {
  return useQuery({
    queryKey: ["search_polizze", searchTerm, clienteId],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      const term = `%${searchTerm}%`;
      let query = supabase
        .from("titoli")
        .select("id, numero_titolo, data_scadenza, premio_lordo, prodotto_id, ufficio_id, cliente_anagrafica_id, prodotti(nome_prodotto, compagnia_id, compagnie(nome)), uffici(nome_ufficio, indirizzo, email, telefono, codice_ufficio)")
        .or(`numero_titolo.ilike.${term}`)
        .limit(15);
      if (clienteId) {
        query = query.eq("cliente_anagrafica_id", clienteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        numero_titolo: t.numero_titolo,
        data_scadenza: t.data_scadenza,
        premio_lordo: t.premio_lordo,
        prodotto_nome: t.prodotti?.nome_prodotto || null,
        compagnia_nome: t.prodotti?.compagnie?.nome || null,
        sede_nome: t.uffici?.nome_ufficio || null,
        sede_indirizzo: t.uffici?.indirizzo || null,
        sede_email: t.uffici?.email || null,
        sede_telefono: t.uffici?.telefono || null,
        sede_codice: t.uffici?.codice_ufficio || null,
      })) as PolizzaResult[];
    },
    enabled: searchTerm.length >= 2,
  });
}

function buildDataMap(cliente?: ClienteResult | null, polizza?: PolizzaResult | null): Record<string, string> {
  const data = { ...EXAMPLE_DATA, "{{data_oggi}}": new Date().toLocaleDateString("it-IT") };
  if (cliente) {
    data["{{cliente_nome}}"] = cliente.nome || "";
    data["{{cliente_cognome}}"] = cliente.cognome || "";
    data["{{cliente_email}}"] = cliente.email || "";
    data["{{cliente_codice_fiscale}}"] = cliente.codice_fiscale || "";
    data["{{azienda_ragione_sociale}}"] = cliente.ragione_sociale || "";
  }
  if (polizza) {
    data["{{polizza_numero}}"] = polizza.numero_titolo || "";
    data["{{polizza_scadenza}}"] = polizza.data_scadenza ? new Date(polizza.data_scadenza).toLocaleDateString("it-IT") : "";
    data["{{polizza_premio}}"] = polizza.premio_lordo != null ? polizza.premio_lordo.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "";
    data["{{compagnia_nome}}"] = polizza.compagnia_nome || "";
    data["{{sede_nome}}"] = polizza.sede_nome || "";
    data["{{sede_indirizzo}}"] = polizza.sede_indirizzo || "";
    data["{{sede_email}}"] = polizza.sede_email || "";
    data["{{sede_telefono}}"] = polizza.sede_telefono || "";
    data["{{sede_codice}}"] = polizza.sede_codice || "";
  }
  return data;
}

// --- Preview Dialog Component ---
function PreviewDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (v: boolean) => void; template: Template | null }) {
  const [clienteSearch, setClienteSearch] = useState("");
  const [polizzaSearch, setPolizzaSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null);
  const [selectedPolizza, setSelectedPolizza] = useState<PolizzaResult | null>(null);
  const [showClienteResults, setShowClienteResults] = useState(false);
  const [showPolizzaResults, setShowPolizzaResults] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const { data: clientiResults = [] } = useClienteSearch(clienteSearch);
  const { data: polizzeResults = [] } = usePolizzaSearch(polizzaSearch, selectedCliente?.id);

  const dataMap = buildDataMap(selectedCliente, selectedPolizza);

  const resetSearch = useCallback(() => {
    setClienteSearch("");
    setPolizzaSearch("");
    setSelectedCliente(null);
    setSelectedPolizza(null);
    setShowClienteResults(false);
    setShowPolizzaResults(false);
  }, []);

  const renderedSubject = template ? replaceVarsWithData(template.oggetto, dataMap) : "";
  const renderedBody = template ? replaceVarsWithData(template.corpo, dataMap) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetSearch(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Anteprima: {template?.nome}</DialogTitle></DialogHeader>
        {template && (
          <div className="space-y-4">
            {/* Ricerca Cliente */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5"><User className="h-4 w-4" /> Cerca Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, cognome, ragione sociale, codice fiscale..."
                  className="pl-9"
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setShowClienteResults(true); }}
                  onFocus={() => setShowClienteResults(true)}
                />
                {showClienteResults && clientiResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {clientiResults.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                        onClick={() => {
                          setSelectedCliente(c);
                          setClienteSearch(c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim());
                          setShowClienteResults(false);
                        }}
                      >
                        <span className="font-medium">
                          {c.tipo_cliente === "azienda" || c.tipo_cliente === "ente"
                            ? c.ragione_sociale
                            : `${c.cognome || ""} ${c.nome || ""}`.trim()}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.codice_fiscale || c.email || ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCliente && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedCliente.tipo_cliente === "azienda" || selectedCliente.tipo_cliente === "ente"
                      ? selectedCliente.ragione_sociale
                      : `${selectedCliente.cognome || ""} ${selectedCliente.nome || ""}`.trim()}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedCliente(null); setClienteSearch(""); }}>Rimuovi</Button>
                </div>
              )}
            </div>

            {/* Ricerca Polizza */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5"><FileText className="h-4 w-4" /> Cerca Polizza</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero polizza..."
                  className="pl-9"
                  value={polizzaSearch}
                  onChange={e => { setPolizzaSearch(e.target.value); setShowPolizzaResults(true); }}
                  onFocus={() => setShowPolizzaResults(true)}
                />
                {showPolizzaResults && polizzeResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {polizzeResults.map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                        onClick={() => {
                          setSelectedPolizza(p);
                          setPolizzaSearch(p.numero_titolo || "");
                          setShowPolizzaResults(false);
                        }}
                      >
                        <span className="font-medium">{p.numero_titolo}</span>
                        <span className="text-xs text-muted-foreground">
                          {[p.prodotto_nome, p.compagnia_nome].filter(Boolean).join(" - ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPolizza && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedPolizza.numero_titolo} — {selectedPolizza.compagnia_nome || ""}</Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedPolizza(null); setPolizzaSearch(""); }}>Rimuovi</Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Anteprima */}
            <div>
              <Label className="text-xs text-muted-foreground">Oggetto</Label>
              <p className="font-medium mt-1">{renderedSubject}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Corpo</Label>
              <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm border mt-1">
                {renderedBody}
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">
              {selectedCliente || selectedPolizza
                ? "I dati mostrati provengono dal database."
                : "Seleziona un cliente e/o una polizza per vedere dati reali. Dati di esempio in uso."}
            </p>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button onClick={() => setSendDialogOpen(true)} disabled={!template}>
            <Send className="h-4 w-4 mr-2" /> Invia test
          </Button>
        </DialogFooter>

        <SendTestEmailDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          template={template}
          cliente={selectedCliente ? {
            id: selectedCliente.id,
            email: selectedCliente.email,
            nome: selectedCliente.nome,
            cognome: selectedCliente.cognome,
            ragione_sociale: selectedCliente.ragione_sociale,
          } : null}
          titolo={selectedPolizza ? { id: selectedPolizza.id, numero_titolo: selectedPolizza.numero_titolo } : null}
          renderedSubject={renderedSubject}
          renderedBody={renderedBody}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function TemplatePage() {
  const { profile } = useAuth();
  const scope = { ruolo: profile?.ruolo, ufficioId: profile?.ufficio_id };
  const lockedUfficio = lockedSedeUfficioId(scope);
  const sedeLocked = lockedUfficio !== undefined;
  const qc = useQueryClient();
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({ nome: "", oggetto: "", corpo: "", categoria_id: "", attivo: true, ufficio_id: null as string | null });
  const [newCatNome, setNewCatNome] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const corpoRef = useRef<HTMLTextAreaElement>(null);
  const oggettoRef = useRef<HTMLInputElement>(null);
  const [insertTarget, setInsertTarget] = useState<"corpo" | "oggetto">("corpo");

  const { data: categorie = [] } = useQuery({
    queryKey: ["template_categorie"],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_categorie").select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Categoria[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["template_email"],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_email").select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, codice_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return (data || []) as UfficioOption[];
    },
  });

  const ufficiById = Object.fromEntries(uffici.map((u) => [u.id, u.nome_ufficio]));

  const saveMut = useMutation({
    mutationFn: async (t: typeof form & { id?: string }) => {
      const payload = {
        nome: t.nome,
        oggetto: t.oggetto,
        corpo: t.corpo,
        categoria_id: t.categoria_id,
        attivo: t.attivo,
        ufficio_id: forceUfficioIdForSave(t.ufficio_id, scope),
      };
      if (t.id) {
        const { error } = await supabase.from("template_email").update(payload as any).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("template_email").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_email"] }); setDialogOpen(false); toast.success("Template salvato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const t = templates.find((x) => x.id === id);
      if (!t || !canEditTemplate(t, scope)) throw new Error("Puoi eliminare solo i template della tua sede.");
      const { error } = await supabase.from("template_email").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_email"] }); toast.success("Template eliminato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveCatMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("template_categorie").insert({ nome: newCatNome, descrizione: newCatDesc || null } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["template_categorie"] }); setCatDialogOpen(false); setNewCatNome(""); setNewCatDesc(""); toast.success("Categoria creata"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const t = templates.find((x) => x.id === id);
      if (!t || !canEditTemplate(t, scope)) throw new Error("Puoi modificare solo i template della tua sede.");
      const { error } = await supabase.from("template_email").update({ attivo } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template_email"] }),
  });

  const duplicateMut = useMutation({
    mutationFn: async (t: Template) => {
      const { error } = await supabase.from("template_email").insert({
        nome: duplicateTemplateNome(t.nome),
        oggetto: t.oggetto,
        corpo: t.corpo,
        categoria_id: t.categoria_id,
        attivo: t.attivo,
        ufficio_id: forceUfficioIdForSave(t.ufficio_id, scope),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template_email"] });
      toast.success("Template duplicato");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changeSedeMut = useMutation({
    mutationFn: async ({ id, ufficio_id }: { id: string; ufficio_id: string | null }) => {
      if (!canChangeTemplateSede(scope.ruolo)) {
        throw new Error("Le sedi non possono spostare i template su un'altra sede.");
      }
      const { error } = await supabase.from("template_email").update({ ufficio_id } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template_email"] });
      toast.success("Sede del template aggiornata");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const templatesVisibili = filterTemplatesPerSede(templates, scope);
  const filtered = selectedCat === "all" ? templatesVisibili : templatesVisibili.filter(t => t.categoria_id === selectedCat);
  const catMap = Object.fromEntries(categorie.map(c => [c.id, c.nome]));
  const ufficiSede = sedeLocked && lockedUfficio
    ? uffici.filter((u) => u.id === lockedUfficio)
    : uffici;

  function openNew(ufficioId: string | null = null) {
    setEditTemplate(null);
    setForm({
      nome: "",
      oggetto: "",
      corpo: "",
      categoria_id: categorie[0]?.id || "",
      attivo: true,
      ufficio_id: forceUfficioIdForSave(ufficioId, scope),
    });
    setDialogOpen(true);
  }

  function openEdit(t: Template) {
    setEditTemplate(t);
    setForm({ nome: t.nome, oggetto: t.oggetto, corpo: t.corpo, categoria_id: t.categoria_id, attivo: t.attivo, ufficio_id: t.ufficio_id ?? null });
    setDialogOpen(true);
  }

  function insertVar(v: string) {
    if (insertTarget === "oggetto" && oggettoRef.current) {
      const el = oggettoRef.current;
      const start = el.selectionStart || form.oggetto.length;
      const newVal = form.oggetto.slice(0, start) + v + form.oggetto.slice(start);
      setForm(f => ({ ...f, oggetto: newVal }));
    } else if (corpoRef.current) {
      const el = corpoRef.current;
      const start = el.selectionStart || form.corpo.length;
      const newVal = form.corpo.slice(0, start) + v + form.corpo.slice(start);
      setForm(f => ({ ...f, corpo: newVal }));
    }
  }

  const [mainTab, setMainTab] = useState<"templates" | "branding" | "associazioni">("templates");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Mail className="h-6 w-6" /> Template Email</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestisci modelli, branding e invio test delle comunicazioni</p>
        </div>
        {(mainTab === "templates" || mainTab === "associazioni") && (
          <div className="flex gap-2">
            {canManageTemplateCategorie(scope.ruolo) && (
              <Button variant="outline" size="sm" onClick={() => setCatDialogOpen(true)}><Tag className="h-4 w-4 mr-1" /> Nuova Categoria</Button>
            )}
            <Button size="sm" onClick={() => openNew(lockedUfficio ?? null)}><Plus className="h-4 w-4 mr-1" /> Nuovo Template</Button>
          </div>
        )}
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "templates" | "branding" | "associazioni")}>
        <TabsList>
          <TabsTrigger value="templates"><Mail className="h-4 w-4 mr-1.5" /> Templates</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-1.5" /> Branding email</TabsTrigger>
          <TabsTrigger value="associazioni"><Link2 className="h-4 w-4 mr-1.5" /> Associazioni Template</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <EmailBrandingTab />
        </TabsContent>

        <TabsContent value="associazioni" className="mt-4">
          <AssociazioniTemplateTab
            templates={templatesVisibili}
            uffici={ufficiSede}
            categorie={catMap}
            canChangeSede={canChangeTemplateSede(scope.ruolo)}
            lockedUfficioId={lockedUfficio}
            canEditTemplate={(t) => canEditTemplate(t, scope)}
            onNew={(ufficioId) => openNew(ufficioId)}
            onEdit={(id) => {
              const t = templatesVisibili.find((x) => x.id === id);
              if (t && canEditTemplate(t, scope)) openEdit(t);
            }}
            onPreview={(id) => {
              const t = templatesVisibili.find((x) => x.id === id);
              if (t) { setPreviewTemplate(t); setPreviewOpen(true); }
            }}
            onDuplicate={(id) => {
              const t = templatesVisibili.find((x) => x.id === id);
              if (t) duplicateMut.mutate(t);
            }}
            onChangeSede={(id, ufficioId) => changeSedeMut.mutate({ id, ufficio_id: ufficioId })}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Tabs value={selectedCat} onValueChange={setSelectedCat}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Tutti</TabsTrigger>
              {categorie.map(c => <TabsTrigger key={c.id} value={c.id}>{c.nome}</TabsTrigger>)}
            </TabsList>

            <TabsContent value={selectedCat} className="mt-4">
              {filtered.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Nessun template in questa categoria</CardContent></Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Oggetto</TableHead>
                        <TableHead className="text-center">Attivo</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.nome}</TableCell>
                          <TableCell><Badge variant="secondary">{catMap[t.categoria_id] || "—"}</Badge></TableCell>
                          <TableCell><Badge variant="outline">{labelSedeTemplate(t.ufficio_id, ufficiById)}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">{t.oggetto}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={t.attivo}
                              disabled={!canEditTemplate(t, scope)}
                              onCheckedChange={v => toggleMut.mutate({ id: t.id, attivo: v })}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                              </TooltipTrigger><TooltipContent>Anteprima & invia test</TooltipContent></Tooltip></TooltipProvider>
                              <Button variant="ghost" size="icon" title="Duplica" onClick={() => duplicateMut.mutate(t)}><CopyPlus className="h-4 w-4" /></Button>
                              {canEditTemplate(t, scope) && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit2 className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Eliminare questo template?")) deleteMut.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Dialog crea/modifica */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTemplate ? "Modifica Template" : "Nuovo Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome template</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Es. Sollecito pagamento" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{categorie.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Sede di default</Label>
                <SedeTemplateSelect
                  uffici={ufficiSede}
                  value={form.ufficio_id}
                  onChange={(id) => setForm((f) => ({ ...f, ufficio_id: forceUfficioIdForSave(id, scope) }))}
                  allowGlobale={!sedeLocked}
                  locked={sedeLocked}
                />
                <p className="text-xs text-muted-foreground">
                  {sedeLocked
                    ? "I template della sede usano il branding della tua sede, con fallback al branding globale."
                    : "Il branding email (logo, colore, firma, mittente) è quello di questa sede, con fallback al branding globale."}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Oggetto email</Label>
              <Input ref={oggettoRef} value={form.oggetto} onChange={e => setForm(f => ({ ...f, oggetto: e.target.value }))} onFocus={() => setInsertTarget("oggetto")} placeholder="Es. Sollecito pagamento polizza {{polizza_numero}}" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Corpo email</Label>
                <div className="flex items-center gap-1">
                  <Switch checked={form.attivo} onCheckedChange={v => setForm(f => ({ ...f, attivo: v }))} />
                  <span className="text-xs text-muted-foreground">Attivo</span>
                </div>
              </div>
              <Textarea ref={corpoRef} value={form.corpo} onChange={e => setForm(f => ({ ...f, corpo: e.target.value }))} onFocus={() => setInsertTarget("corpo")} className="min-h-[200px] font-mono text-sm" placeholder="Scrivi il corpo dell'email con le variabili..." />
            </div>

            {/* Barra variabili */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inserisci variabile (clicca per aggiungere nel campo {insertTarget})</Label>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDER_VARS.map(v => (
                  <Button key={v.value} type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => insertVar(v.value)}>
                    <Copy className="h-3 w-3 mr-1" />{v.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => saveMut.mutate({ ...form, id: editTemplate?.id })} disabled={!form.nome || !form.categoria_id}>
              {editTemplate ? "Salva modifiche" : "Crea template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog anteprima con ricerca reale */}
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} template={previewTemplate} />

      {/* Dialog nuova categoria */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={newCatNome} onChange={e => setNewCatNome(e.target.value)} placeholder="Es. Conferma" /></div>
            <div className="space-y-1.5"><Label>Descrizione</Label><Input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Opzionale" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Annulla</Button>
            <Button onClick={() => saveCatMut.mutate()} disabled={!newCatNome.trim()}>Crea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
