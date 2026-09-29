import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, UserPlus, Search, RefreshCw, Settings2, Info, Trash2 } from "lucide-react";
import { LEVELS, getLevelByRole, ROLE_LABELS, UserLevel } from "@/lib/userLevels";
import UserLevelCard from "@/components/utenti/UserLevelCard";
import CreateUserWizard from "@/components/utenti/CreateUserWizard";
import UserPermissionsSheet from "@/components/utenti/UserPermissionsSheet";
import DeleteWithImpactDialog from "@/components/common/DeleteWithImpactDialog";
import { toast } from "sonner";
import { matchesProfileNameSearch } from "@/lib/searchNoEmail";

const GestioneUtentiPrivilegi = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterLevel, setFilterLevel] = useState<UserLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [sheetUser, setSheetUser] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get("wizard") === "open") {
      setCreateOpen(true);
      searchParams.delete("wizard");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: users = [], refetch, isLoading } = useQuery({
    queryKey: ["users-priv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cognome, email, ruolo, attivo, ufficio_id, permessi_json, percentuale_base, percentuale_ra, created_at, uffici(nome_ufficio)")
        .neq("ruolo", "cliente")
        .neq("ruolo", "prospect")
        .order("cognome");
      if (error) throw error;
      return data || [];
    },
  });



  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    LEVELS.forEach((l) => (c[l.id] = 0));
    users.forEach((u) => {
      const lvl = getLevelByRole(u.ruolo);
      c[lvl.id] = (c[lvl.id] || 0) + 1;
    });
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterLevel !== "all") {
        const lvl = getLevelByRole(u.ruolo);
        if (lvl.id !== filterLevel) return false;
      }
      if (statusFilter === "active" && !u.attivo) return false;
      if (statusFilter === "suspended" && u.attivo) return false;
      if (search && !matchesProfileNameSearch(u, search)) return false;
      return true;
    });
  }, [users, filterLevel, statusFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<UserLevel, any[]>();
    LEVELS.forEach((l) => map.set(l.id, []));
    filtered.forEach((u) => {
      const lvl = getLevelByRole(u.ruolo);
      map.get(lvl.id)!.push(u);
    });
    return map;
  }, [filtered]);

  const toggleAttivo = async (user: any, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ attivo: value }).eq("id", user.id);
    if (error) toast.error("Errore");
    else {
      toast.success(value ? "Utente attivato" : "Utente sospeso");
      refetch();
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const { error } = await supabase.from("profiles").delete().eq("id", deleteUser.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Errore eliminazione");
      return;
    }
    toast.success("Utente eliminato");
    setDeleteUser(null);
    refetch();
  };

  const initials = (u: any) => `${(u.cognome?.[0] || "").toUpperCase()}${(u.nome?.[0] || "").toUpperCase()}` || "?";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centro Utenti & Privilegi</h1>
            <p className="text-sm text-muted-foreground">Gestione gerarchica accessi, ruoli e permessi modulari</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Aggiorna
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Nuovo Utente
          </Button>
        </div>
      </div>

      {/* KPI per livello */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {LEVELS.map((l) => (
          <UserLevelCard
            key={l.id}
            level={l}
            count={counts[l.id] || 0}
            active={filterLevel === l.id}
            onClick={() => setFilterLevel(filterLevel === l.id ? "all" : l.id)}
          />
        ))}
      </div>

      {/* Info-box gerarchia livelli */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-3 flex gap-3 items-start">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Gerarchia accessi:</span> i livelli vanno da
            <span className="font-medium text-foreground"> L1 Admin</span> (controllo totale) a
            <span className="font-medium text-foreground"> L6 Cliente/Prospect</span> (portale read-only).
            Ogni livello eredita una visibilità coerente: Sede vede la propria sede, Manager vede i suoi produttori,
            Produttore vede solo il proprio portafoglio. Clicca una card sopra per filtrare.
          </div>
        </CardContent>
      </Card>




      {/* Filtri */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cerca per nome o cognome…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
              <TabsTrigger value="active" className="text-xs">Attivi</TabsTrigger>
              <TabsTrigger value="suspended" className="text-xs">Sospesi</TabsTrigger>
            </TabsList>
          </Tabs>
          {filterLevel !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterLevel("all")}>
              Mostra tutti i livelli
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{filtered.length} utenti</span>
        </CardContent>
      </Card>

      {/* Lista raggruppata per livello */}
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Caricamento…</p>}
        {!isLoading && filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nessun utente trovato</CardContent></Card>
        )}

        {LEVELS.map((l) => {
          const list = grouped.get(l.id) || [];
          if (list.length === 0) return null;
          const Icon = l.icon;
          return (
            <div key={l.id}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${l.bgClass}`}>
                  <Icon className={`w-3.5 h-3.5 ${l.color}`} />
                </div>
                <h2 className="font-semibold text-sm">{l.label}</h2>
                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                <div className="flex-1 h-px bg-border ml-2" />
              </div>
              <div className="grid gap-2">
                {list.map((u: any) => (
                  <Card key={u.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={`${l.bgClass} ${l.color} text-xs font-bold`}>
                          {initials(u)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{u.cognome} {u.nome}</p>
                          <Badge variant="outline" className="text-[10px] h-4">{ROLE_LABELS[u.ruolo] || u.ruolo}</Badge>
                          {!u.attivo && <Badge variant="destructive" className="text-[10px] h-4">Sospeso</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                          {u.uffici?.nome_ufficio && <> · {u.uffici.nome_ufficio}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground hidden md:inline">
                            {u.attivo ? "Attivo" : "Sospeso"}
                          </span>
                          <Switch checked={!!u.attivo} onCheckedChange={(v) => toggleAttivo(u, v)} />
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setSheetUser(u); setSheetOpen(true); }}>
                          <Settings2 className="w-3.5 h-3.5 mr-1" /> Permessi
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <CreateUserWizard open={createOpen} onOpenChange={setCreateOpen} onCreated={refetch} />
      <UserPermissionsSheet user={sheetUser} open={sheetOpen} onOpenChange={setSheetOpen} onSaved={refetch} />

      <DeleteWithImpactDialog
        open={!!deleteUser}
        onOpenChange={(o) => { if (!o) setDeleteUser(null); }}
        entityId={deleteUser?.id}
        entityType="utente"
        entityName={deleteUser ? `${deleteUser.cognome || ""} ${deleteUser.nome || ""} (${deleteUser.email || "—"})`.trim() : "—"}
        checks={[
          { table: "titoli", column: "commerciale_id", label: "Polizze (commerciale)" },
          { table: "titoli", column: "produttore_id", label: "Polizze (produttore)" },
          { table: "titoli", column: "backoffice_id", label: "Polizze (backoffice)" },
          { table: "clienti", column: "commerciale_id", label: "Clienti (commerciale)" },
          { table: "clienti", column: "backoffice_id", label: "Clienti (backoffice)" },
          { table: "clienti", column: "user_id", label: "Account cliente collegato" },
          { table: "sinistri", column: "assegnato_a", label: "Sinistri assegnati" },
          { table: "trattative", column: "assegnato_a", label: "Trattative assegnate" },
        ]}
        onConfirmDelete={confirmDelete}
        onDeactivateInstead={() => deleteUser && toggleAttivo(deleteUser, false)}
        isDeleting={deleting}
        extraNotes={
          <div>
            <span className="font-semibold">Nota:</span> elimina solo il profilo. L'account auth.users
            associato resta e va rimosso a parte.
          </div>
        }
      />
    </div>
  );
};

export default GestioneUtentiPrivilegi;
