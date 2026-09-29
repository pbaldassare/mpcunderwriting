import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Pencil, ShieldAlert, UserPlus, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVELS, ROLE_LABELS } from "@/lib/userLevels";
import { matchesSearchFields } from "@/lib/searchNoEmail";
import SediMultiSelect, { type SedeAssegnata } from "@/components/anagrafiche/SediMultiSelect";
import {
  fetchSediSpecialistSinistri,
  saveSediSpecialistSinistri,
  removeSpecialistSinistri,
} from "@/lib/specialistSinistriSedi";

interface ProfileLite {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  ruolo: string | null;
  ufficio_id: string | null;
  attivo: boolean | null;
}

interface SpecialistSinistriRow extends ProfileLite {
  sedi: SedeAssegnata[];
}

const ELIGIBLE_RUOLI = ["admin", "ufficio", "backoffice", "contabilita"] as const;
const DEFAULT_PASSWORD = "Leone123!";
const L3_PERMESSI = LEVELS.find((l) => l.id === "L3")!.defaultPermissions;

const emptyCreate = {
  nome: "",
  cognome: "",
  email: "",
  password: DEFAULT_PASSWORD,
};

const SpecialistSinistriList = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sediForm, setSediForm] = useState<SedeAssegnata[]>([]);
  const [sediCreate, setSediCreate] = useState<SedeAssegnata[]>([]);
  const [newUser, setNewUser] = useState(emptyCreate);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_select_specialist_sinistri"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []) as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const ufficioMap = Object.fromEntries(
    uffici.map((u) => [u.id, `${u.codice_ufficio} — ${u.nome_ufficio}`])
  );

  const { data: junctionRows = [], isLoading } = useQuery({
    queryKey: ["specialist-sinistri-sedi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id, ufficio_id, primaria");
      if (error) throw error;
      return (data || []) as unknown as { profilo_id: string; ufficio_id: string; primaria: boolean }[];
    },
  });

  const profiloIds = [...new Set(junctionRows.map((r) => r.profilo_id))];

  const { data: profiles = [] } = useQuery({
    queryKey: ["specialist-sinistri-profiles", profiloIds],
    enabled: profiloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cognome, email, ruolo, ufficio_id, attivo")
        .in("id", profiloIds)
        .order("cognome", { ascending: true });
      if (error) throw error;
      return (data || []) as ProfileLite[];
    },
  });

  const items: SpecialistSinistriRow[] = profiles.map((p) => ({
    ...p,
    sedi: junctionRows
      .filter((r) => r.profilo_id === p.id)
      .map((r) => ({ ufficio_id: r.ufficio_id, primaria: r.primaria })),
  }));

  const alreadyAssigned = new Set(profiloIds);

  const saveSediMutation = useMutation({
    mutationFn: async ({ profiloId, sedi }: { profiloId: string; sedi: SedeAssegnata[] }) => {
      if (sedi.length === 0) throw new Error("Seleziona almeno una sede");
      await saveSediSpecialistSinistri(profiloId, sedi);
      const primaria = sedi.find((s) => s.primaria) || sedi[0];
      if (primaria) {
        const { error } = await supabase
          .from("profiles")
          .update({ ufficio_id: primaria.ufficio_id, updated_at: new Date().toISOString() } as any)
          .eq("id", profiloId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-sedi"] });
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-profiles"] });
      setDialogOpen(false);
      setEditingId(null);
      setSediForm([]);
      toast.success("Sedi di copertura aggiornate");
    },
    onError: (e: Error) => toast.error(e.message || "Errore salvataggio"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const nome = newUser.nome.trim();
      const cognome = newUser.cognome.trim();
      const email = newUser.email.trim().toLowerCase();
      if (!nome || !cognome || !email) {
        throw new Error("Nome, cognome ed email sono obbligatori");
      }
      if (sediCreate.length === 0) throw new Error("Seleziona almeno una sede");
      if (!newUser.password || newUser.password.length < 6) {
        throw new Error("Password minimo 6 caratteri");
      }

      const primaria = sediCreate.find((s) => s.primaria) || sediCreate[0];

      // Se l'email esiste già: collega il profilo esistente (se idoneo), non creare un doppione
      const { data: existing } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo, attivo")
        .ilike("email", email)
        .maybeSingle();

      if (existing) {
        if (alreadyAssigned.has(existing.id)) {
          throw new Error(
            `Questa email è già uno Specialist Sinistri: ${existing.cognome || ""} ${existing.nome || ""}`.trim()
          );
        }
        const ruoloOk = existing.ruolo && (ELIGIBLE_RUOLI as readonly string[]).includes(existing.ruolo);
        if (!ruoloOk) {
          throw new Error(
            `Email già registrata con ruolo non idoneo (${existing.ruolo || "—"}). Usa un'email diversa.`
          );
        }
        await saveSediSpecialistSinistri(existing.id, sediCreate);
        await supabase
          .from("profiles")
          .update({ ufficio_id: primaria.ufficio_id, updated_at: new Date().toISOString() } as any)
          .eq("id", existing.id);
        return { userId: existing.id, created: false as const, email };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await supabase.functions.invoke("create-user", {
        body: {
          nome,
          cognome,
          email,
          ruolo: "ufficio",
          ufficio_id: primaria.ufficio_id,
          permessi_json: L3_PERMESSI,
          password: newUser.password,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.error || (res.data as any)?.error) {
        throw new Error((res.data as any)?.error || res.error?.message || "Errore creazione");
      }
      const newId = (res.data as any)?.user_id as string;
      if (!newId) throw new Error("Creazione utente riuscita ma manca user_id");

      await saveSediSpecialistSinistri(newId, sediCreate);
      return { userId: newId, created: true as const, email };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-sedi"] });
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-profiles"] });
      if (result.created) {
        toast.success("Specialist Sinistri creato", {
          description: `${result.email} • password: ${newUser.password}`,
          action: {
            label: "Copia credenziali",
            onClick: () => navigator.clipboard.writeText(`${result.email} / ${newUser.password}`),
          },
          duration: 10000,
        });
      } else {
        toast.success("Profilo esistente collegato come Specialist Sinistri", {
          description: result.email,
        });
      }
      setCreateOpen(false);
      setNewUser(emptyCreate);
      setSediCreate([]);
    },
    onError: (e: Error) => toast.error(e.message || "Errore creazione"),
  });

  const removeMutation = useMutation({
    mutationFn: async (profiloId: string) => {
      await removeSpecialistSinistri(profiloId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-sedi"] });
      queryClient.invalidateQueries({ queryKey: ["specialist-sinistri-profiles"] });
      toast.success("Specialist Sinistri rimosso");
    },
    onError: (e: Error) => toast.error(e.message || "Errore rimozione"),
  });

  const openEdit = async (item: SpecialistSinistriRow) => {
    setEditingId(item.id);
    try {
      const rows = await fetchSediSpecialistSinistri(item.id);
      setSediForm(rows.length > 0 ? rows : item.sedi);
    } catch {
      setSediForm(item.sedi);
    }
    setDialogOpen(true);
  };

  const filtered = items.filter((p) =>
    matchesSearchFields(search, [
      p.nome,
      p.cognome,
      p.ruolo ? ROLE_LABELS[p.ruolo] || p.ruolo : null,
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary">{filtered.length} risultati</Badge>
        <div className="flex-1" />
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <UserPlus className="w-4 h-4" /> Nuovo Specialist Sinistri
        </Button>
      </div>

      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          Crea uno <strong>Specialist Sinistri</strong> con nome, cognome, email e sedi di copertura.
          Viene creato un utente di sistema (ruolo <code className="text-foreground">ufficio</code>)
          selezionabile come Responsabile Interno nei sinistri. Distinto dallo Specialist commerciale
          (ruolo backoffice) e dal Liquidatore esterno (anagrafiche compagnie).
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cognome / Nome</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sedi di copertura</TableHead>
              <TableHead className="text-center">Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nessuno Specialist Sinistri. Crea il primo con nome, cognome, email e sede.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p, idx) => {
                const primaria = p.sedi.find((s) => s.primaria)?.ufficio_id;
                return (
                  <TableRow
                    key={p.id}
                    className={cn("hover:bg-muted/50 cursor-pointer", idx % 2 === 1 && "bg-muted/20")}
                    onClick={() => openEdit(p)}
                  >
                    <TableCell>
                      <div className="font-medium">{p.cognome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.nome || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.ruolo ? ROLE_LABELS[p.ruolo] || p.ruolo : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-wrap gap-1">
                        {p.sedi.length === 0 ? (
                          <Badge variant="destructive" className="text-[10px]">Sede mancante</Badge>
                        ) : (
                          p.sedi.map((s) => (
                            <Badge
                              key={s.ufficio_id}
                              variant={s.ufficio_id === primaria ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {ufficioMap[s.ufficio_id] || s.ufficio_id.slice(0, 8)}
                              {s.primaria ? " ★" : ""}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.attivo ? "secondary" : "outline"} className="text-[10px]">
                        {p.attivo ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)} title="Modifica sedi">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Rimuovi da Specialist Sinistri"
                        onClick={() => {
                          if (confirm("Rimuovere questo utente dagli Specialist Sinistri?")) {
                            removeMutation.mutate(p.id);
                          }
                        }}
                      >
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

      {/* Edit sedi */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setSediForm([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sedi di copertura — Specialist Sinistri</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingId && (
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const p = items.find((i) => i.id === editingId);
                  return p
                    ? `${p.cognome || ""} ${p.nome || ""}`.trim() || p.email || editingId
                    : editingId;
                })()}
              </p>
            )}
            <SediMultiSelect value={sediForm} onChange={setSediForm} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              disabled={saveSediMutation.isPending || !editingId}
              onClick={() => editingId && saveSediMutation.mutate({ profiloId: editingId, sedi: sediForm })}
            >
              {saveSediMutation.isPending ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crea nuovo */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewUser(emptyCreate);
            setSediCreate([]);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Nuovo Specialist Sinistri
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <p className="text-xs text-muted-foreground">
              Inserisci nome, cognome, email e collega almeno una sede. Verrà creato un utente di sistema
              (ruolo ufficio) utilizzabile come Responsabile Interno nei sinistri.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cognome *</Label>
                <Input
                  value={newUser.cognome}
                  onChange={(e) => setNewUser({ ...newUser, cognome: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newUser.nome}
                  onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label>Password iniziale *</Label>
                <div className="flex gap-1">
                  <Input
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => navigator.clipboard.writeText(newUser.password)}
                    title="Copia"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <SediMultiSelect value={sediCreate} onChange={setSediCreate} required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creazione..." : "Crea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SpecialistSinistriList;
