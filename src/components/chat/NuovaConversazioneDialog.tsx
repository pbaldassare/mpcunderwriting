import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UserCheck, Briefcase, FileText, AlertTriangle, Users, Loader2, X, Search, Plus } from "lucide-react";
import { findAllRelatedUsers, type RelatedUser } from "@/lib/findRelatedUsers";
import { matchesSearchFields } from "@/lib/searchNoEmail";

interface NuovaConversazioneDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (canaleId: string) => void;
  ambito?: "interno" | "contestuale";
}

const RUOLI_INTERNI = [
  { value: "admin", label: "Admin" },
  { value: "ufficio", label: "Sede" },
  { value: "executive", label: "Executive" },
  { value: "produttore", label: "Produttore" },
  { value: "corrispondente", label: "Corrispondente" },
  { value: "backoffice", label: "Specialist" },
  { value: "contabilita", label: "Contabilità" },
  { value: "cfo", label: "CFO" },
  { value: "consul", label: "Consul" },
  { value: "prospect", label: "Prospect" },
];

interface EntitaResult {
  id: string;
  label: string;
  subtitle?: string;
  tipo: string; // "cliente" | "prospect" | "titolo" | "trattativa" | "sinistro"
  entitaTipo: string; // the DB entity type
}

const ROLE_COLORS: Record<string, string> = {
  cliente: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  prospect: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  produttore: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  ufficio: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  commerciale: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  assegnato: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  responsabile: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  backoffice: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  contabilita: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  cfo: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  staff: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default function NuovaConversazioneDialog({ open, onClose, onCreated, ambito = "interno" }: NuovaConversazioneDialogProps) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filtroRuolo, setFiltroRuolo] = useState<string>("tutti");
  const [filtroUfficio, setFiltroUfficio] = useState<string>("tutti");
  const [ricerca, setRicerca] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [nomeGruppo, setNomeGruppo] = useState("");
  const [tipo, setTipo] = useState<"diretto" | "gruppo" | "broadcast">("diretto");

  // Unified entity selection
  const [entityTab, setEntityTab] = useState<string>("clienti");
  const [entitaTipo, setEntitaTipo] = useState<string>("");
  const [entitaId, setEntitaId] = useState<string>("");
  const [entitaLabel, setEntitaLabel] = useState<string>("");
  const [visibileCliente, setVisibileCliente] = useState(false);
  const [autoLinkedUsers, setAutoLinkedUsers] = useState<RelatedUser[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [entitaRicerca, setEntitaRicerca] = useState("");
  const [addPartecipanteRicerca, setAddPartecipanteRicerca] = useState("");
  const [showAddPartecipante, setShowAddPartecipante] = useState(false);

  // Load all profiles for manual add (excludes 'cliente')
  const { data: allProfiles } = useQuery({
    queryKey: ["all_profiles_chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, ufficio_id, email, telefono, note, avatar_url")
        .eq("attivo", true)
        .neq("ruolo", "cliente")
        .order("cognome");
      return (data || []).filter((u: any) => u.id !== profile?.id);
    },
    enabled: open,
  });

  // Load ALL active profiles (excludes 'cliente') for internal mode — universal search
  const { data: utentiStaff } = useQuery({
    queryKey: ["profiles_all_chat_internal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, ufficio_id, email, telefono, note, avatar_url")
        .eq("attivo", true)
        .neq("ruolo", "cliente")
        .order("cognome");
      return (data || []).filter((u: any) => u.id !== profile?.id);
    },
    enabled: open && ambito === "interno",
  });

  const { data: uffici } = useQuery({
    queryKey: ["uffici_lista"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
    enabled: open,
  });

  // Unified entity search
  const { data: entitaResults } = useQuery({
    queryKey: ["entita_search_unified", entityTab, entitaRicerca],
    queryFn: async (): Promise<EntitaResult[]> => {
      if (entityTab === "libero" || !entitaRicerca || entitaRicerca.length < 2) return [];

      if (entityTab === "clienti") {
        // Search both clienti and prospect
        const [clientiRes, prospectRes] = await Promise.all([
          supabase
            .from("clienti")
            .select("id, nome, cognome, ragione_sociale, tipo_cliente, email, telefono, user_id")
            .or(`cognome.ilike.%${entitaRicerca}%,ragione_sociale.ilike.%${entitaRicerca}%,nome.ilike.%${entitaRicerca}%,codice_fiscale.ilike.%${entitaRicerca}%`)
            .limit(8),
          supabase
            .from("prospect")
            .select("id, nome, cognome, ragione_sociale, tipo_cliente, email, telefono, user_id")
            .or(`cognome.ilike.%${entitaRicerca}%,ragione_sociale.ilike.%${entitaRicerca}%,nome.ilike.%${entitaRicerca}%`)
            .limit(8),
        ]);

        const clienti: EntitaResult[] = (clientiRes.data || []).map((c: any) => ({
          id: c.id,
          label: c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim(),
          subtitle: `${c.tipo_cliente || "Privato"} ${c.email ? `• ${c.email}` : ""} ${c.telefono ? `• ${c.telefono}` : ""}`.trim(),
          tipo: "Cliente",
          entitaTipo: "cliente",
        }));
        const prospect: EntitaResult[] = (prospectRes.data || []).map((p: any) => ({
          id: p.id,
          label: p.ragione_sociale || `${p.cognome || ""} ${p.nome || ""}`.trim(),
          subtitle: `${p.tipo_cliente || "Privato"} ${p.email ? `• ${p.email}` : ""} ${p.telefono ? `• ${p.telefono}` : ""}`.trim(),
          tipo: "Prospect",
          entitaTipo: "prospect",
        }));
        return [...clienti, ...prospect];
      }

      if (entityTab === "polizze") {
        const { data } = await supabase
          .from("titoli")
          .select("id, numero_titolo, stato, cliente_anagrafica_id, compagnia_id, clienti:cliente_anagrafica_id(nome, cognome, ragione_sociale), compagnie:compagnia_id(nome)")
          .or(`numero_titolo.ilike.%${entitaRicerca}%`)
          .limit(10);
        
        // Also search by client name
        const { data: byClient } = await supabase
          .from("titoli")
          .select("id, numero_titolo, stato, cliente_anagrafica_id, compagnia_id, clienti:cliente_anagrafica_id!inner(nome, cognome, ragione_sociale), compagnie:compagnia_id(nome)")
          .or(`clienti.cognome.ilike.%${entitaRicerca}%,clienti.ragione_sociale.ilike.%${entitaRicerca}%`, { referencedTable: "clienti" })
          .limit(10);

        const allTitoli = [...(data || []), ...(byClient || [])];
        const seen = new Set<string>();
        return allTitoli.filter((t: any) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        }).slice(0, 12).map((t: any) => {
          const clienteNome = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          const compNome = t.compagnie?.nome || "";
          return {
            id: t.id,
            label: t.numero_titolo || t.id.slice(0, 8),
            subtitle: `${clienteNome}${compNome ? ` • ${compNome}` : ""}${t.stato ? ` • ${t.stato}` : ""}`,
            tipo: "Polizza",
            entitaTipo: "titolo",
          };
        });
      }

      if (entityTab === "trattative") {
        const { data } = await supabase
          .from("trattative")
          .select("id, prodotto, stato, cliente_id, prospect_id, compagnia_id, clienti:cliente_id(nome, cognome, ragione_sociale), prospect:prospect_id(nome, cognome, ragione_sociale), compagnie:compagnia_id(nome)")
          .or(`prodotto.ilike.%${entitaRicerca}%`)
          .limit(12);
        return (data || []).map((t: any) => {
          const clienteNome = t.clienti?.ragione_sociale || `${t.clienti?.cognome || ""} ${t.clienti?.nome || ""}`.trim();
          const prospectNome = t.prospect?.ragione_sociale || `${t.prospect?.cognome || ""} ${t.prospect?.nome || ""}`.trim();
          const soggetto = clienteNome || prospectNome || "—";
          const compNome = t.compagnie?.nome || "";
          return {
            id: t.id,
            label: t.prodotto || "Trattativa",
            subtitle: `${soggetto}${compNome ? ` • ${compNome}` : ""} • ${t.stato || ""}`,
            tipo: clienteNome ? "Cliente" : "Prospect",
            entitaTipo: "trattativa",
          };
        });
      }

      if (entityTab === "sinistri") {
        const { data } = await supabase
          .from("sinistri")
          .select("id, numero_sinistro, tipo_sinistro, stato, cliente_anagrafica_id, clienti:cliente_anagrafica_id(nome, cognome, ragione_sociale)")
          .or(`numero_sinistro.ilike.%${entitaRicerca}%`)
          .limit(10);
        return (data || []).map((s: any) => {
          const clienteNome = s.clienti?.ragione_sociale || `${s.clienti?.cognome || ""} ${s.clienti?.nome || ""}`.trim();
          return {
            id: s.id,
            label: s.numero_sinistro || s.id.slice(0, 8),
            subtitle: `${s.tipo_sinistro || ""} • ${clienteNome} • ${s.stato || ""}`,
            tipo: "Sinistro",
            entitaTipo: "sinistro",
          };
        });
      }

      return [];
    },
    enabled: open && ambito === "contestuale" && entityTab !== "libero" && entitaRicerca.length >= 2,
  });

  // When related users are found, auto-add them
  useEffect(() => {
    if (autoLinkedUsers.length > 0) {
      const relatedIds = autoLinkedUsers.map(u => u.userId).filter(id => id !== profile?.id);
      setSelectedUsers((prev) => {
        const set = new Set(prev);
        relatedIds.forEach(id => set.add(id));
        return Array.from(set);
      });
      if (autoLinkedUsers.some(u => u.ruolo === "cliente" || u.ruolo === "prospect")) {
        setVisibileCliente(true);
      }
    }
  }, [autoLinkedUsers, profile?.id]);

  const handleSelectEntita = async (r: EntitaResult) => {
    setEntitaId(r.id);
    setEntitaLabel(r.label);
    setEntitaTipo(r.entitaTipo);
    setEntitaRicerca("");

    setLoadingRelated(true);
    try {
      const related = await findAllRelatedUsers(r.entitaTipo, r.id);
      setAutoLinkedUsers(related);
    } catch (e) {
      console.error("Error finding related users:", e);
    } finally {
      setLoadingRelated(false);
    }
  };

  const clearEntita = () => {
    setEntitaId("");
    setEntitaLabel("");
    setEntitaTipo("");
    setAutoLinkedUsers([]);
    setSelectedUsers([]);
    setVisibileCliente(false);
  };

  // Manual add participant search (nome, cognome, telefono, note — mai email)
  const filteredAddProfiles = (allProfiles || []).filter((u: any) => {
    if (selectedUsers.includes(u.id)) return false;
    if (!addPartecipanteRicerca || addPartecipanteRicerca.length < 2) return false;
    return matchesSearchFields(addPartecipanteRicerca, [u.nome, u.cognome, u.telefono, u.note]);
  }).slice(0, 8);

  const removeUser = (id: string) => {
    setSelectedUsers(prev => prev.filter(x => x !== id));
  };

  // For internal mode (search across nome, cognome, telefono, note — mai email)
  const utentiFiltrati = (utentiStaff || []).filter((u: any) => {
    if (filtroRuolo !== "tutti" && u.ruolo !== filtroRuolo) return false;
    if (filtroUfficio !== "tutti" && u.ufficio_id !== filtroUfficio) return false;
    if (ricerca && !matchesSearchFields(ricerca, [u.nome, u.cognome, u.telefono, u.note])) return false;
    return true;
  });

  const toggleUser = (id: string) => {
    if (tipo === "diretto" && ambito === "interno") {
      setSelectedUsers([id]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const selectAllFiltered = () => {
    const ids = utentiFiltrati.map((u: any) => u.id);
    setSelectedUsers((prev) => {
      const set = new Set(prev);
      ids.forEach((id: string) => set.add(id));
      return Array.from(set);
    });
  };

  const generateAutoName = (): string | null => {
    if (nomeGruppo) return nomeGruppo;
    if (entityTab === "libero" && !entitaLabel) return null;
    if (entitaLabel) {
      const labels: Record<string, string> = { cliente: "Cliente", prospect: "Prospect", titolo: "Polizza", trattativa: "Trattativa", sinistro: "Sinistro" };
      return `${labels[entitaTipo] || ""}: ${entitaLabel}`;
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || selectedUsers.length === 0) return;

      if (ambito === "contestuale") {
        const nome = generateAutoName();
        const finalEntitaTipo = entityTab === "libero" ? "argomento" : entitaTipo;
        const { data: canale, error: canaleErr } = await supabase
          .from("chat_canali")
          .insert({
            nome,
            tipo: "gruppo",
            creato_da: profile.id,
            ambito: "contestuale",
            entita_tipo: finalEntitaTipo,
            entita_id: entityTab === "libero" ? null : entitaId || null,
            visibile_cliente: visibileCliente,
          })
          .select()
          .single();

        if (canaleErr) {
          console.error("Errore creazione canale contestuale:", canaleErr);
          throw new Error(canaleErr.message || "Errore creazione canale");
        }
        if (!canale) throw new Error("Errore creazione canale");

        const allMembers = Array.from(new Set([profile.id, ...selectedUsers]));
        const { error: membriErr } = await supabase.from("chat_canali_membri").insert(
          allMembers.map((uid) => ({
            canale_id: canale.id,
            user_id: uid,
            ruolo_canale: uid === profile.id ? "admin" : "membro",
          }))
        );
        if (membriErr) {
          console.error("Errore inserimento membri:", membriErr);
          throw new Error(membriErr.message || "Errore aggiunta partecipanti");
        }
        return canale.id;
      }

      const effectiveTipo = selectedUsers.length === 1 && tipo === "diretto" ? "diretto" : tipo === "diretto" ? "gruppo" : tipo;
      const nome = effectiveTipo === "diretto" ? null : nomeGruppo || null;

      const { data: canale, error: canaleErr } = await supabase
        .from("chat_canali")
        .insert({ nome, tipo: effectiveTipo, creato_da: profile.id, ambito: "interno" })
        .select()
        .single();

      if (canaleErr) {
        console.error("Errore creazione canale interno:", canaleErr);
        throw new Error(canaleErr.message || "Errore creazione canale");
      }
      if (!canale) throw new Error("Errore creazione canale");

      const allMembers = Array.from(new Set([profile.id, ...selectedUsers]));
      const { error: membriErr } = await supabase.from("chat_canali_membri").insert(
        allMembers.map((uid) => ({
          canale_id: canale.id,
          user_id: uid,
          ruolo_canale: uid === profile.id ? "admin" : "membro",
        }))
      );
      if (membriErr) {
        console.error("Errore inserimento membri:", membriErr);
        throw new Error(membriErr.message || "Errore aggiunta partecipanti");
      }
      return canale.id;
    },
    onSuccess: (canaleId) => {
      if (canaleId) {
        qc.invalidateQueries({ queryKey: ["chat_canali"] });
        qc.invalidateQueries({ queryKey: ["chat_canali_staff_meta"] });
        toast.success("Conversazione creata");
        onCreated(canaleId);
        resetForm();
      }
    },
    onError: (err: any) => toast.error(err?.message || "Errore nella creazione della conversazione"),
  });

  const resetForm = () => {
    setSelectedUsers([]);
    setNomeGruppo("");
    setRicerca("");
    setFiltroRuolo("tutti");
    setFiltroUfficio("tutti");
    setTipo("diretto");
    setEntityTab("clienti");
    setEntitaTipo("");
    setEntitaId("");
    setEntitaLabel("");
    setEntitaRicerca("");
    setVisibileCliente(false);
    setAutoLinkedUsers([]);
    setLoadingRelated(false);
    setAddPartecipanteRicerca("");
    setShowAddPartecipante(false);
  };

  // Build participant list with role info
  const participantsList = selectedUsers.map(id => {
    const linked = autoLinkedUsers.find(u => u.userId === id);
    const prof = (allProfiles || []).find((p: any) => p.id === id);
    return {
      id,
      nome: linked?.nome || (prof ? `${prof.cognome || ""} ${prof.nome || ""}`.trim() : id.slice(0, 8)),
      ruolo: linked?.ruolo || prof?.ruolo || "staff",
    };
  });

  // Group counts
  const roleCounts: Record<string, number> = {};
  participantsList.forEach(p => {
    roleCounts[p.ruolo] = (roleCounts[p.ruolo] || 0) + 1;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ambito === "contestuale" ? "Nuova Chat Contestuale" : "Nuova Conversazione"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* ========== CONTEXTUAL: Unified Entity Tabs ========== */}
          {ambito === "contestuale" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Collega a entità</Label>

              {/* Selected entity chip */}
              {entitaId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <Badge className="text-[10px] capitalize">{entitaTipo === "titolo" ? "Polizza" : entitaTipo}</Badge>
                    <span className="text-sm font-medium flex-1">{entitaLabel}</span>
                    {loadingRelated && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearEntita}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Related users summary */}
                  {autoLinkedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Auto-collegati:</span>
                      {Object.entries(roleCounts).map(([ruolo, count]) => (
                        <Badge key={ruolo} className={`text-[9px] px-1.5 py-0 capitalize ${ROLE_COLORS[ruolo] || ROLE_COLORS.staff}`}>
                          {count} {ruolo}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Tabs for entity type search */
                <Tabs value={entityTab} onValueChange={(v) => { setEntityTab(v); setEntitaRicerca(""); }}>
                  <TabsList className="w-full h-8">
                    <TabsTrigger value="clienti" className="text-[10px] flex-1 h-6 px-1.5">
                      <UserCheck className="h-3 w-3 mr-1" />Clienti/Prospect
                    </TabsTrigger>
                    <TabsTrigger value="polizze" className="text-[10px] flex-1 h-6 px-1.5">
                      <FileText className="h-3 w-3 mr-1" />Polizze
                    </TabsTrigger>
                    <TabsTrigger value="trattative" className="text-[10px] flex-1 h-6 px-1.5">
                      <Briefcase className="h-3 w-3 mr-1" />Trattative
                    </TabsTrigger>
                    <TabsTrigger value="sinistri" className="text-[10px] flex-1 h-6 px-1.5">
                      <AlertTriangle className="h-3 w-3 mr-1" />Sinistri
                    </TabsTrigger>
                    <TabsTrigger value="libero" className="text-[10px] flex-1 h-6 px-1.5">
                      <Users className="h-3 w-3 mr-1" />Libero
                    </TabsTrigger>
                  </TabsList>

                  {entityTab !== "libero" && (
                    <div className="mt-2 space-y-1">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={entitaRicerca}
                          onChange={(e) => setEntitaRicerca(e.target.value)}
                          placeholder={
                            entityTab === "clienti" ? "Cerca per nome, ragione sociale, CF..." :
                            entityTab === "polizze" ? "Cerca per numero polizza o nome cliente..." :
                            entityTab === "trattative" ? "Cerca per prodotto..." :
                            "Cerca per numero sinistro..."
                          }
                          className="h-8 text-xs pl-7"
                        />
                      </div>
                      {entitaResults && entitaResults.length > 0 && (
                        <ScrollArea className="max-h-44 border rounded-md bg-background">
                          <div>
                            {entitaResults.map((r) => (
                              <button
                                key={`${r.entitaTipo}-${r.id}`}
                                onClick={() => handleSelectEntita(r)}
                                className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${
                                    r.tipo === "Cliente" ? ROLE_COLORS.cliente :
                                    r.tipo === "Prospect" ? ROLE_COLORS.prospect :
                                    "bg-muted"
                                  }`}>
                                    {r.tipo}
                                  </Badge>
                                  <span className="text-xs font-medium truncate">{r.label}</span>
                                </div>
                                {r.subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.subtitle}</p>}
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                      {entitaRicerca.length >= 2 && entitaResults && entitaResults.length === 0 && (
                        <p className="text-[10px] text-muted-foreground text-center py-2">Nessun risultato</p>
                      )}
                    </div>
                  )}
                </Tabs>
              )}

              <div className="flex items-center gap-2">
                <Switch id="visibile_cliente" checked={visibileCliente} onCheckedChange={setVisibileCliente} />
                <Label htmlFor="visibile_cliente" className="text-xs">Visibile al cliente</Label>
              </div>
            </div>
          )}

          {/* ========== INTERNAL: Type + filters ========== */}
          {ambito === "interno" && (
            <>
              <div className="flex gap-2">
                {(["diretto", "gruppo", "broadcast"] as const).map((t) => (
                  <Badge key={t} variant={tipo === t ? "default" : "outline"} className="cursor-pointer capitalize" onClick={() => { setTipo(t); setSelectedUsers([]); }}>
                    {t}
                  </Badge>
                ))}
              </div>
              {tipo !== "diretto" && (
                <Input value={nomeGruppo} onChange={(e) => setNomeGruppo(e.target.value)} placeholder="Nome del gruppo (opzionale)" />
              )}
              <div className="flex gap-2">
                <Select value={filtroRuolo} onValueChange={setFiltroRuolo}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Ruolo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti i ruoli</SelectItem>
                    {RUOLI_INTERNI.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroUfficio} onValueChange={setFiltroUfficio}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Sede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti gli uffici</SelectItem>
                    {(uffici || []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca staff per nome..." className="h-8 text-xs" />
              {tipo !== "diretto" && utentiFiltrati.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={selectAllFiltered}>Seleziona tutti ({utentiFiltrati.length})</Button>
              )}
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-1">
                  {utentiFiltrati.map((u: any) => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer text-sm">
                      <Checkbox checked={selectedUsers.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                      <span className="font-medium flex-1">{u.cognome} {u.nome}</span>
                      <span className="text-xs text-muted-foreground capitalize">{u.ruolo}</span>
                    </label>
                  ))}
                  {!utentiFiltrati.length && <p className="text-center text-xs text-muted-foreground py-4">Nessun utente trovato</p>}
                </div>
              </ScrollArea>
            </>
          )}

          {/* ========== CONTEXTUAL: Unified participants ========== */}
          {ambito === "contestuale" && (
            <div className="space-y-2">
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Partecipanti ({participantsList.length})</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAddPartecipante(!showAddPartecipante)}>
                  <Plus className="h-3 w-3 mr-1" /> Aggiungi
                </Button>
              </div>

              {/* Group name */}
              <Input
                value={nomeGruppo}
                onChange={(e) => setNomeGruppo(e.target.value)}
                placeholder={entitaLabel ? `Auto: ${entitaTipo === "titolo" ? "Polizza" : entitaTipo}: ${entitaLabel}` : "Nome conversazione (opzionale)"}
                className="h-8 text-xs"
              />

              {/* Manual add */}
              {showAddPartecipante && (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={addPartecipanteRicerca}
                      onChange={(e) => setAddPartecipanteRicerca(e.target.value)}
                      placeholder="Cerca utente per nome..."
                      className="h-8 text-xs pl-7"
                      autoFocus
                    />
                  </div>
                  {filteredAddProfiles.length > 0 && (
                    <div className="border rounded-md max-h-32 overflow-auto bg-background">
                      {filteredAddProfiles.map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => { setSelectedUsers(prev => [...prev, u.id]); setAddPartecipanteRicerca(""); }}
                          className="w-full text-left px-3 py-1.5 hover:bg-muted border-b last:border-b-0 flex items-center gap-2"
                        >
                          <span className="text-xs font-medium">{u.cognome} {u.nome}</span>
                          <Badge className={`text-[9px] px-1 py-0 ml-auto capitalize ${ROLE_COLORS[u.ruolo] || ROLE_COLORS.staff}`}>
                            {u.ruolo}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Participants list */}
              <ScrollArea className="max-h-40 border rounded-lg">
                <div className="p-1">
                  {participantsList.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted text-sm">
                      <span className="text-xs font-medium flex-1 truncate">{p.nome}</span>
                      <Badge className={`text-[9px] px-1.5 py-0 capitalize shrink-0 ${ROLE_COLORS[p.ruolo] || ROLE_COLORS.staff}`}>
                        {p.ruolo}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => removeUser(p.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {participantsList.length === 0 && (
                    <div className="text-center py-4 space-y-1">
                      <AlertTriangle className="h-4 w-4 mx-auto text-amber-500" />
                      <p className="text-xs text-muted-foreground">
                        {entitaId
                          ? "Nessun utente collegato trovato. Aggiungi partecipanti manualmente."
                          : entityTab === "libero"
                            ? "Aggiungi partecipanti manualmente"
                            : "Seleziona un'entità per auto-collegare i partecipanti"}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ========== Summary + Create ========== */}
          {selectedUsers.length > 0 && ambito === "interno" && (
            <p className="text-xs text-muted-foreground">{selectedUsers.length} partecipante/i selezionato/i</p>
          )}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={selectedUsers.length === 0 || createMutation.isPending || (ambito === "contestuale" && entityTab !== "libero" && !entitaId)}
            className="w-full"
          >
            Crea conversazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
