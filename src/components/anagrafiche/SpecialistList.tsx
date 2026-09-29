import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Search, Pencil, UserCog, ExternalLink, UserPlus, KeyRound, Copy, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { LEVELS } from "@/lib/userLevels";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { ValidatedInput } from "@/components/ui/validated-input";
import SediMultiSelect, { type SedeAssegnata } from "@/components/anagrafiche/SediMultiSelect";
import { fetchSediProfilo, saveSediProfilo } from "@/lib/profiloSedi";
import { matchesSearchFields } from "@/lib/searchNoEmail";

interface SpecialistRow {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  attivo: boolean | null;
  descrizione: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  fax: string | null;
  codice_fiscale: string | null;
  nome_rui: string | null;
  data_iscrizione_rui: string | null;
  numero_rui: string | null;
  sezione_rui: string | null;
  codice_contabile: string | null;
  percentuale_ra: number | null;
  iban: string | null;
  intestatario_cc: string | null;
  conto_bancario_id: string | null;
  percentuale_base: number | null;
  percentuale_consulenza: number | null;
  note: string | null;
}

const emptyForm = {
  cognome: "", nome: "", email: "", telefono: "", fax: "",
  codice_fiscale: "", descrizione: "", ufficio_id: "",
  indirizzo: "", cap: "", citta: "", provincia: "",
  nome_rui: "", sezione_rui: "", numero_rui: "", data_iscrizione_rui: "",
  codice_contabile: "",
  percentuale_base: "", percentuale_consulenza: "", percentuale_ra: "",
  iban: "", intestatario_cc: "", conto_bancario_id: "",
  note: "",
  attivo: true,
};

const DateField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <DateInput
    value={value?.slice(0, 10) ?? ""}
    onChange={(e) => onChange(e.target.value)}
  />
);

const SELECT_FIELDS =
  "id, nome, cognome, email, ruolo, ufficio_id, attivo, descrizione, indirizzo, cap, citta, provincia, telefono, fax, codice_fiscale, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui, codice_contabile, percentuale_ra, iban, intestatario_cc, conto_bancario_id, percentuale_base, percentuale_consulenza, note";

interface SpecialistListProps {
  editId?: string | null;
  onEditConsumed?: () => void;
}

const SpecialistList = ({ editId, onEditConsumed }: SpecialistListProps = {}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [sediForm, setSediForm] = useState<SedeAssegnata[]>([]);
  const [sediCreate, setSediCreate] = useState<SedeAssegnata[]>([]);

  // --- Create new Specialist user ---
  const [createOpen, setCreateOpen] = useState(false);
  const initialNewUser = {
    cognome: "", nome: "", email: "", telefono: "", fax: "", codice_fiscale: "",
    descrizione: "", ufficio_id: "", codice_contabile: "",
    indirizzo: "", cap: "", citta: "", provincia: "",
    nome_rui: "", sezione_rui: "", numero_rui: "", data_iscrizione_rui: "",
    percentuale_base: "", percentuale_consulenza: "", percentuale_ra: "",
    iban: "", intestatario_cc: "",
    password: "Leone123!",
  };
  const [newUser, setNewUser] = useState(initialNewUser);

  // --- Reset password ---
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPwd, setResetPwd] = useState("Leone123!");

  // --- Delete with impact ---
  const [deleteTarget, setDeleteTarget] = useState<SpecialistRow | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["specialist-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(SELECT_FIELDS)
        .eq("ruolo", "backoffice")
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SpecialistRow[];
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_select_specialist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici" as any)
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []) as unknown as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const ufficioMap = Object.fromEntries(uffici.map(u => [u.id, `${u.codice_ufficio} — ${u.nome_ufficio}`]));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nessuno Specialist selezionato");
      if (sediForm.length === 0) throw new Error("Seleziona almeno una Sede");
      const primaria = sediForm.find((s) => s.primaria) || sediForm[0];
      const payload: Record<string, unknown> = {
        cognome: form.cognome || null,
        nome: form.nome || null,
        email: form.email || null,
        telefono: form.telefono || null,
        fax: form.fax || null,
        codice_fiscale: form.codice_fiscale ? form.codice_fiscale.toUpperCase() : null,
        descrizione: form.descrizione || null,
        ufficio_id: primaria.ufficio_id,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        nome_rui: form.nome_rui || null,
        sezione_rui: form.sezione_rui || null,
        numero_rui: form.numero_rui || null,
        data_iscrizione_rui: form.data_iscrizione_rui || null,
        codice_contabile: form.codice_contabile || null,
        percentuale_base: form.percentuale_base ? Number(form.percentuale_base) : null,
        percentuale_consulenza: form.percentuale_consulenza ? Number(form.percentuale_consulenza) : null,
        percentuale_ra: form.percentuale_ra ? Number(form.percentuale_ra) : null,
        iban: form.iban || null,
        intestatario_cc: form.intestatario_cc || null,
        conto_bancario_id: form.conto_bancario_id || null,
        note: form.note || null,
        attivo: form.attivo,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("profiles").update(payload as any).eq("id", editingId);
      if (error) throw error;
      // salva sedi multiple
      await saveSediProfilo(editingId, sediForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] });
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setSediForm([]);
      toast.success("Specialist aggiornato");
    },
    onError: (e: Error) => toast.error(e.message || "Errore aggiornamento"),
  });


  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("profiles").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] });
      setDeleteTarget(null);
      toast.success("Specialist eliminato");
    },
    onError: (e: Error) => toast.error(e.message || "Errore eliminazione"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newUser.cognome || !newUser.email) throw new Error("Cognome ed email sono obbligatori");
      if (sediCreate.length === 0) throw new Error("Seleziona almeno una Sede");
      if (!newUser.password || newUser.password.length < 6) throw new Error("Password minimo 6 caratteri");

      const primaria = sediCreate.find((s) => s.primaria) || sediCreate[0];

      // Pre-check: email già usata in profiles?
      const emailNorm = newUser.email.trim().toLowerCase();
      const { data: existing } = await supabase
        .from("profiles")
        .select("nome, cognome, ruolo")
        .ilike("email", emailNorm)
        .maybeSingle();
      if (existing) {
        const who = `${existing.nome || ""} ${existing.cognome || ""}`.trim() || "(senza nome)";
        throw new Error(`Email già registrata: ${emailNorm} → ${who} (ruolo: ${existing.ruolo}). Usa un'email diversa.`);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await supabase.functions.invoke("create-user", {
        body: {
          nome: newUser.nome,
          cognome: newUser.cognome,
          email: newUser.email,
          telefono: newUser.telefono || null,
          fax: newUser.fax || null,
          codice_fiscale: newUser.codice_fiscale ? newUser.codice_fiscale.toUpperCase() : null,
          descrizione: newUser.descrizione || null,
          ruolo: "backoffice",
          ufficio_id: primaria.ufficio_id,
          codice_contabile: newUser.codice_contabile || null,
          indirizzo: newUser.indirizzo || null,
          cap: newUser.cap || null,
          citta: newUser.citta || null,
          provincia: newUser.provincia || null,
          nome_rui: newUser.nome_rui || null,
          sezione_rui: newUser.sezione_rui || null,
          numero_rui: newUser.numero_rui || null,
          data_iscrizione_rui: newUser.data_iscrizione_rui || null,
          percentuale_base: newUser.percentuale_base ? Number(newUser.percentuale_base) : null,
          percentuale_consulenza: newUser.percentuale_consulenza ? Number(newUser.percentuale_consulenza) : null,
          percentuale_ra: newUser.percentuale_ra ? Number(newUser.percentuale_ra) : null,
          iban: newUser.iban ? newUser.iban.toUpperCase() : null,
          intestatario_cc: newUser.intestatario_cc || null,
          permessi_json: LEVELS[2].defaultPermissions,
          password: newUser.password,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.error || (res.data as any)?.error) {
        throw new Error((res.data as any)?.error || res.error?.message || "Errore creazione");
      }
      const newId = (res.data as any)?.user_id as string;
      // salva eventuali sedi aggiuntive
      if (newId && sediCreate.length > 1) {
        await saveSediProfilo(newId, sediCreate);
      }
      return newId;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] });
      const email = newUser.email;
      const pwd = newUser.password;
      toast.success("Specialist creato", {
        description: `${email} • password: ${pwd}`,
        action: {
          label: "Copia credenziali",
          onClick: () => navigator.clipboard.writeText(`${email} / ${pwd}`),
        },
        duration: 10000,
      });
      setCreateOpen(false);
      setNewUser(initialNewUser);
      setSediCreate([]);
      // Apri subito edit per completare eventuali campi mancanti
      setTimeout(() => {
        if (newId) {
          queryClient.invalidateQueries({ queryKey: ["specialist-profiles"] }).then(() => {
            setTimeout(() => {
              setEditingId(newId);
            }, 100);
          });
        }
      }, 200);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPwdMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("Nessuno Specialist selezionato");
      if (!resetPwd || resetPwd.length < 6) throw new Error("Password minimo 6 caratteri");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await supabase.functions.invoke("create-user", {
        body: { action: "reset-password", user_id: editingId, password: resetPwd },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.error || (res.data as any)?.error) {
        throw new Error((res.data as any)?.error || res.error?.message || "Errore reset");
      }
    },
    onSuccess: () => {
      const pwd = resetPwd;
      const email = form.email;
      toast.success("Password resettata", {
        description: `${email} • nuova password: ${pwd}`,
        action: {
          label: "Copia",
          onClick: () => navigator.clipboard.writeText(`${email} / ${pwd}`),
        },
        duration: 10000,
      });
      setResetOpen(false);
      setResetPwd("Leone123!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (item: SpecialistRow) => {
    setEditingId(item.id);
    setForm({
      cognome: item.cognome || "",
      nome: item.nome || "",
      email: item.email || "",
      telefono: item.telefono || "",
      fax: item.fax || "",
      codice_fiscale: item.codice_fiscale || "",
      descrizione: item.descrizione || "",
      ufficio_id: item.ufficio_id || "",
      indirizzo: item.indirizzo || "",
      cap: item.cap || "",
      citta: item.citta || "",
      provincia: item.provincia || "",
      nome_rui: item.nome_rui || "",
      sezione_rui: item.sezione_rui || "",
      numero_rui: item.numero_rui || "",
      data_iscrizione_rui: item.data_iscrizione_rui || "",
      codice_contabile: item.codice_contabile || "",
      percentuale_base: item.percentuale_base?.toString() || "",
      percentuale_consulenza: item.percentuale_consulenza?.toString() || "",
      percentuale_ra: item.percentuale_ra?.toString() || "",
      iban: item.iban || "",
      intestatario_cc: item.intestatario_cc || "",
      conto_bancario_id: item.conto_bancario_id || "",
      note: item.note || "",
      attivo: item.attivo ?? true,
    });
    // carica sedi multiple
    fetchSediProfilo(item.id).then((rows) => {
      if (rows.length > 0) setSediForm(rows);
      else if (item.ufficio_id) setSediForm([{ ufficio_id: item.ufficio_id, primaria: true }]);
      else setSediForm([]);
    }).catch(() => setSediForm(item.ufficio_id ? [{ ufficio_id: item.ufficio_id, primaria: true }] : []));
    setDialogOpen(true);
  };

  // Deep-link: apri in edit la riga richiesta dal Centro Utenti o subito dopo creazione
  useEffect(() => {
    if (!editId || items.length === 0) return;
    const target = items.find((i) => i.id === editId);
    if (target) {
      openEdit(target);
      onEditConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, items]);

  // Apri dialog edit quando editingId viene impostato programmaticamente (post-create)
  useEffect(() => {
    if (editingId && !dialogOpen && items.length > 0) {
      const target = items.find((i) => i.id === editingId);
      if (target) openEdit(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, items]);

  const filtered = items.filter((p) =>
    matchesSearchFields(search, [p.nome, p.cognome, p.codice_contabile, p.codice_fiscale]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, cognome, codice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} risultati</Badge>
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Nuovo Specialist
        </Button>
      </div>

      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
        <UserCog className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          Gli <strong>Specialist</strong> sono utenti di sistema (ruolo <code className="text-foreground">backoffice</code>).
          Qui crei e modifichi l'utenza completa: dati personali, RUI, percentuali e coordinate bancarie.
          Centro Utenti & Privilegi resta disponibile per gestione massiva di ruoli e permessi.
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/utenti-privilegi")}>
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Centro Utenti
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Cognome / Nome</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead>Tel / Email</TableHead>
              <TableHead>Dati RUI</TableHead>
              <TableHead>% Provv / Cons / RA</TableHead>
              <TableHead className="text-center">Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nessuno Specialist trovato</TableCell></TableRow>
            ) : (
              filtered.map((p, idx) => {
                const ruiParts = [
                  p.sezione_rui ? `Sez. ${p.sezione_rui}` : null,
                  p.numero_rui ? `N° ${p.numero_rui}` : null,
                  p.data_iscrizione_rui ? format(parseISO(p.data_iscrizione_rui), "dd/MM/yyyy") : null,
                ].filter(Boolean);
                return (
                  <TableRow
                    key={p.id}
                    className={cn("hover:bg-muted/50 cursor-pointer", idx % 2 === 1 && "bg-muted/20")}
                    onClick={() => openEdit(p)}
                  >
                    <TableCell className="font-medium">{p.codice_contabile || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.cognome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.nome || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.ufficio_id ? (
                        ufficioMap[p.ufficio_id] || "—"
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Sede mancante</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.telefono && <div>Tel {p.telefono}</div>}
                      {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                      {!p.telefono && !p.email && "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ruiParts.length > 0 ? ruiParts.map((r, i) => <div key={i} className="text-xs">{r}</div>) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="text-xs">Provv: {p.percentuale_base ?? 0}%</div>
                      <div className="text-xs">Cons: {p.percentuale_consulenza ?? 0}%</div>
                      <div className="text-xs">RA: {p.percentuale_ra ?? 0}%</div>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch checked={p.attivo ?? true} onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, attivo: v })} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Modifica anagrafica">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)} title="Elimina">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Specialist</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <Tabs defaultValue="dati">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="dati">Dati</TabsTrigger>
                <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
                <TabsTrigger value="rui">RUI</TabsTrigger>
                <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
                <TabsTrigger value="banca">Banca</TabsTrigger>
              </TabsList>

              <TabsContent value="dati" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Codice contabile</Label><Input value={form.codice_contabile} onChange={(e) => setForm({ ...form, codice_contabile: e.target.value })} /></div>
                  <div><Label>Cognome *</Label><Input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
                  <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Descrizione</Label><Input value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} /></div>
                  <div><Label>Codice Fiscale</Label><Input value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value.toUpperCase() })} /></div>
                  <div><Label>Telefono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                  <div><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
                </div>
                <SediMultiSelect value={sediForm} onChange={setSediForm} required />

                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={form.attivo} onCheckedChange={(v) => setForm({ ...form, attivo: v })} />
                  <Label>Attivo</Label>
                </div>
              </TabsContent>

              <TabsContent value="indirizzo" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={form.indirizzo} onChange={(v) => setForm({ ...form, indirizzo: v })} onSelect={(c) => setForm((f) => ({ ...f, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                  <div><Label>CAP</Label><Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
                  <div><Label>Città</Label><Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
                  <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value.toUpperCase() })} maxLength={2} /></div>
                </div>
                <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} /></div>
              </TabsContent>

              <TabsContent value="rui" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome RUI</Label><Input value={form.nome_rui} onChange={(e) => setForm({ ...form, nome_rui: e.target.value })} /></div>
                  <div><Label>Sezione RUI</Label><Input value={form.sezione_rui} onChange={(e) => setForm({ ...form, sezione_rui: e.target.value })} placeholder="Es. B" /></div>
                  <div><Label>Numero RUI</Label><Input value={form.numero_rui} onChange={(e) => setForm({ ...form, numero_rui: e.target.value })} /></div>
                  <div><Label>Data iscrizione RUI</Label><DateField value={form.data_iscrizione_rui} onChange={(v) => setForm({ ...form, data_iscrizione_rui: v })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="provvigioni" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={form.percentuale_base} onChange={(e) => setForm({ ...form, percentuale_base: e.target.value })} /></div>
                  <div><Label>% Consulenza</Label><Input type="number" step="0.01" value={form.percentuale_consulenza} onChange={(e) => setForm({ ...form, percentuale_consulenza: e.target.value })} /></div>
                  <div><Label>% RA</Label><Input type="number" step="0.01" value={form.percentuale_ra} onChange={(e) => setForm({ ...form, percentuale_ra: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="banca" className="space-y-3 mt-3">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <Label className="font-semibold">Conto incassi clienti collegato a questo Specialist</Label>
                  <p className="text-xs text-muted-foreground">
                    Se valorizzato, l'IBAN qui indicato verrà proposto al cliente nei suoi E/C al posto di quello della Sede.
                    Selezionare un conto già censito in <strong>Conti Bancari</strong>.
                  </p>
                  <ContoBancarioSelect
                    value={form.conto_bancario_id || null}
                    onChange={(id) => setForm({ ...form, conto_bancario_id: id || "" })}
                    tipi={["incasso_clienti"]}
                    placeholder="Usa l'IBAN della Sede / default"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div><Label>IBAN (campo libero — legacy)</Label><ValidatedInput kind="iban" value={form.iban} onChange={(v) => setForm({ ...form, iban: v })} className="font-mono" /></div>
                  <div><Label>Intestatario C/C (legacy)</Label><Input value={form.intestatario_cc} onChange={(e) => setForm({ ...form, intestatario_cc: e.target.value })} /></div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex sm:justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setResetPwd("Leone123!"); setResetOpen(true); }} className="gap-1.5">
                <KeyRound className="w-4 h-4" /> Reset password
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: nuovo Specialist (crea utente Auth + profilo) */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setNewUser(initialNewUser); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Nuovo Specialist
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
            className="space-y-4"
          >
            <p className="text-xs text-muted-foreground">
              Verrà creato un utente di sistema con ruolo <code>backoffice</code>. Compila tutte le sezioni: dati anagrafici, RUI, percentuali e banca.
            </p>

            <Tabs defaultValue="dati">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="dati">Dati</TabsTrigger>
                <TabsTrigger value="indirizzo">Indirizzo</TabsTrigger>
                <TabsTrigger value="rui">RUI</TabsTrigger>
                <TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>
                <TabsTrigger value="banca">Banca</TabsTrigger>
              </TabsList>

              <TabsContent value="dati" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Codice contabile</Label><Input value={newUser.codice_contabile} onChange={(e) => setNewUser({ ...newUser, codice_contabile: e.target.value })} /></div>
                  <div><Label>Cognome *</Label><Input value={newUser.cognome} onChange={(e) => setNewUser({ ...newUser, cognome: e.target.value })} required /></div>
                  <div><Label>Nome</Label><Input value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} /></div>
                  <div><Label>Email *</Label><ValidatedInput kind="email" value={newUser.email} onChange={(v) => setNewUser({ ...newUser, email: v })} type="email" required uppercase={false} /></div>
                  <div className="col-span-2"><Label>Descrizione</Label><Input value={newUser.descrizione} onChange={(e) => setNewUser({ ...newUser, descrizione: e.target.value })} /></div>
                  <div><Label>Codice Fiscale</Label><ValidatedInput kind="cf" value={newUser.codice_fiscale} onChange={(v) => setNewUser({ ...newUser, codice_fiscale: v })} /></div>
                  <div><Label>Telefono</Label><Input value={newUser.telefono} onChange={(e) => setNewUser({ ...newUser, telefono: e.target.value })} /></div>
                  <div><Label>Fax</Label><Input value={newUser.fax} onChange={(e) => setNewUser({ ...newUser, fax: e.target.value })} /></div>
                  <div className="col-span-2">
                    <Label>Password iniziale *</Label>
                    <div className="flex gap-1">
                      <Input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
                      <Button type="button" variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(newUser.password)} title="Copia">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <SediMultiSelect value={sediCreate} onChange={setSediCreate} required />

              </TabsContent>

              <TabsContent value="indirizzo" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Indirizzo</Label><AddressAutocomplete value={newUser.indirizzo} onChange={(v) => setNewUser({ ...newUser, indirizzo: v })} onSelect={(c) => setNewUser((u) => ({ ...u, cap: c.cap, citta: c.citta, provincia: c.provincia }))} /></div>
                  <div><Label>CAP</Label><Input value={newUser.cap} onChange={(e) => setNewUser({ ...newUser, cap: e.target.value })} /></div>
                  <div><Label>Città</Label><Input value={newUser.citta} onChange={(e) => setNewUser({ ...newUser, citta: e.target.value })} /></div>
                  <div><Label>Provincia</Label><Input value={newUser.provincia} onChange={(e) => setNewUser({ ...newUser, provincia: e.target.value.toUpperCase() })} maxLength={2} /></div>
                </div>
              </TabsContent>

              <TabsContent value="rui" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome RUI</Label><Input value={newUser.nome_rui} onChange={(e) => setNewUser({ ...newUser, nome_rui: e.target.value })} /></div>
                  <div><Label>Sezione RUI</Label><Input value={newUser.sezione_rui} onChange={(e) => setNewUser({ ...newUser, sezione_rui: e.target.value })} placeholder="Es. B" /></div>
                  <div><Label>Numero RUI</Label><Input value={newUser.numero_rui} onChange={(e) => setNewUser({ ...newUser, numero_rui: e.target.value })} /></div>
                  <div><Label>Data iscrizione RUI</Label><DateField value={newUser.data_iscrizione_rui} onChange={(v) => setNewUser({ ...newUser, data_iscrizione_rui: v })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="provvigioni" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>% Provvigione</Label><Input type="number" step="0.01" value={newUser.percentuale_base} onChange={(e) => setNewUser({ ...newUser, percentuale_base: e.target.value })} /></div>
                  <div><Label>% Consulenza</Label><Input type="number" step="0.01" value={newUser.percentuale_consulenza} onChange={(e) => setNewUser({ ...newUser, percentuale_consulenza: e.target.value })} /></div>
                  <div><Label>% RA</Label><Input type="number" step="0.01" value={newUser.percentuale_ra} onChange={(e) => setNewUser({ ...newUser, percentuale_ra: e.target.value })} /></div>
                </div>
              </TabsContent>

              <TabsContent value="banca" className="space-y-3 mt-3">
                <div className="grid grid-cols-1 gap-3">
                  <div><Label>IBAN</Label><ValidatedInput kind="iban" value={newUser.iban} onChange={(v) => setNewUser({ ...newUser, iban: v })} className="font-mono" /></div>
                  <div><Label>Intestatario C/C</Label><Input value={newUser.intestatario_cc} onChange={(e) => setNewUser({ ...newUser, intestatario_cc: e.target.value })} /></div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creazione..." : "Crea Specialist"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: reset password */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Reset password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Imposta una nuova password per <strong>{form.email || "questo utente"}</strong>. L'utente dovrà usare questa password al prossimo accesso.
            </p>
            <div>
              <Label>Nuova password *</Label>
              <div className="flex gap-1">
                <Input value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(resetPwd)} title="Copia">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Annulla</Button>
            <Button onClick={() => resetPwdMutation.mutate()} disabled={resetPwdMutation.isPending}>
              {resetPwdMutation.isPending ? "Aggiornamento..." : "Aggiorna password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteWithImpactDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        entityId={deleteTarget?.id}
        entityType="Specialist"
        entityName={deleteTarget ? `${deleteTarget.cognome || ""} ${deleteTarget.nome || ""} (${deleteTarget.email || "—"})`.trim() : "—"}
        checks={[
          { table: "titoli", column: "backoffice_id", label: "Polizze (backoffice)" },
          { table: "titoli", column: "commerciale_id", label: "Polizze (commerciale)" },
          { table: "titoli", column: "produttore_id", label: "Polizze (produttore)" },
          { table: "clienti", column: "backoffice_id", label: "Clienti (backoffice)" },
          { table: "clienti", column: "commerciale_id", label: "Clienti (commerciale)" },
          { table: "sinistri", column: "assegnato_a", label: "Sinistri assegnati" },
          { table: "trattative", column: "assegnato_a", label: "Trattative assegnate" },
        ]}
        onConfirmDelete={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onDeactivateInstead={
          deleteTarget?.attivo
            ? () => deleteTarget && toggleMutation.mutate({ id: deleteTarget.id, attivo: false })
            : undefined
        }
        isDeleting={deleteMutation.isPending}
        extraNotes={
          <div>
            <span className="font-semibold">Nota:</span> elimina solo il profilo; l'account auth.users
            associato resta e va rimosso a parte.
          </div>
        }
      />
    </div>
  );
};

export default SpecialistList;
