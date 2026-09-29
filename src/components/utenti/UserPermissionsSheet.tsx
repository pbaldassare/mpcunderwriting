import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLevelByRole, ROLE_LABELS, VISIBILITY_LABEL, VisibilityScope, LEVELS } from "@/lib/userLevels";
import PermissionsMatrix from "./PermissionsMatrix";
import { KeyRound, Power, Shield, User as UserIcon, Eye, Settings2, Save, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ProfileAvatarUpload from "./ProfileAvatarUpload";
import ProfileInfoForm from "./ProfileInfoForm";
import { Separator as Sep2 } from "@/components/ui/separator";

interface Props {
  user: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

const UserPermissionsSheet = ({ user, open, onOpenChange, onSaved }: Props) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [visibility, setVisibility] = useState<VisibilityScope>("self_only");
  const [ruolo, setRuolo] = useState<string>("");
  const [attivo, setAttivo] = useState(true);
  const [riceveProvvigioni, setRiceveProvvigioni] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetPwd, setResetPwd] = useState("");

  const { data: uffici } = useQuery({
    queryKey: ["uffici-sheet"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  useEffect(() => {
    if (user) {
      const p = (user.permessi_json as Record<string, any>) || {};
      setPermissions(typeof p === "object" ? Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "boolean")) : {});
      setVisibility((p?._visibility as VisibilityScope) || getLevelByRole(user.ruolo).defaultVisibility);
      setRuolo(user.ruolo || "");
      setAttivo(user.attivo !== false);
      setRiceveProvvigioni(!!p?.riceve_provvigioni);
      setResetPwd("");
    }
  }, [user]);

  if (!user) return null;
  const level = getLevelByRole(ruolo);
  const Icon = level.icon;

  const handleSave = async () => {
    setSaving(true);
    const newPermissions = {
      ...permissions,
      riceve_provvigioni: riceveProvvigioni,
      _visibility: visibility,
    };

    const { error } = await supabase.from("profiles").update({
      ruolo,
      attivo,
      permessi_json: newPermissions,
    }).eq("id", user.id);

    if (error) {
      toast.error("Errore aggiornamento", { description: error.message });
      setSaving(false);
      return;
    }

    if (ruolo !== user.ruolo) {
      await supabase.from("user_roles").delete().eq("user_id", user.id);
      await supabase.from("user_roles").insert({ user_id: user.id, role: ruolo as any });
    }

    toast.success("Utente aggiornato");
    onSaved();
    setSaving(false);
  };

  const handleApplyTemplate = () => {
    const lvl = LEVELS.find((l) => l.roles.includes(ruolo)) || level;
    setPermissions(lvl.defaultPermissions);
    setVisibility(lvl.defaultVisibility);
    toast.success(`Template "${lvl.label}" applicato`);
  };

  const handleResetPassword = async () => {
    if (!resetPwd || resetPwd.length < 6) {
      toast.error("Inserisci una password (min 6 caratteri)");
      return;
    }
    const { data: s } = await supabase.auth.getSession();
    const token = s?.session?.access_token;
    const res = await supabase.functions.invoke("provision-user", {
      body: { user_id: user.id, password: resetPwd, only_password: true },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.error) {
      toast.info("Per reset password contatta l'admin sistema (richiede edge function dedicata)");
    } else {
      toast.success("Password reimpostata");
      setResetPwd("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${level.bgClass}`}>
              <Icon className={`w-6 h-6 ${level.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate">{user.cognome} {user.nome}</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-[10px]">{level.id}</Badge>
                <Badge className="text-[10px]">{level.label}</Badge>
                {!attivo && <Badge variant="destructive" className="text-[10px]">Sospeso</Badge>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="anagrafica" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="anagrafica" className="text-xs"><UserIcon className="w-3.5 h-3.5 mr-1" />Anagrafica</TabsTrigger>
            <TabsTrigger value="visibility" className="text-xs"><Eye className="w-3.5 h-3.5 mr-1" />Visibilità</TabsTrigger>
            <TabsTrigger value="permissions" className="text-xs"><Settings2 className="w-3.5 h-3.5 mr-1" />Permessi</TabsTrigger>
            <TabsTrigger value="security" className="text-xs"><Shield className="w-3.5 h-3.5 mr-1" />Sicurezza</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-3 pr-3">
            <TabsContent value="anagrafica" className="space-y-4 mt-0">
              <div className="rounded-lg border p-3">
                <ProfileAvatarUpload
                  userId={user.id}
                  avatarUrl={user.avatar_url || null}
                  fallback={`${(user.nome || "")[0] || ""}${(user.cognome || "")[0] || ""}`.toUpperCase() || "U"}
                  onChange={(url) => { user.avatar_url = url; }}
                />
              </div>

              <ProfileInfoForm
                userId={user.id}
                mode="admin"
                initial={{
                  nome: user.nome || "",
                  cognome: user.cognome || "",
                  telefono: user.telefono || "",
                  note: user.note || "",
                }}
                onSaved={(info) => {
                  user.nome = info.nome;
                  user.cognome = info.cognome;
                  user.telefono = info.telefono;
                  user.note = info.note;
                  onSaved();
                }}
              />

              <Sep2 />

              <div><Label className="text-xs">Email</Label><Input value={user.email || ""} disabled /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Ruolo</Label>
                  <Select value={ruolo} onValueChange={setRuolo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.flatMap((l) => l.roles).filter((r) => r !== "cliente" && r !== "prospect").map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Sede assegnata</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/30">
                    {user.uffici?.nome_ufficio ? (
                      <span className="text-sm">{user.uffici.nome_ufficio}</span>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Sede mancante</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Account attivo</Label>
                  <p className="text-xs text-muted-foreground">Se disattivato, l'utente non può accedere</p>
                </div>
                <Switch checked={attivo} onCheckedChange={setAttivo} />
              </div>
              <div className="rounded-lg border bg-primary/5 p-3 flex items-start gap-2">
                <ExternalLink className="w-4 h-4 mt-0.5 text-primary" />
                <div className="flex-1 text-xs">
                  <p className="font-medium text-foreground">Anagrafica completa, Sede, RUI, percentuali e IBAN</p>
                  <p className="text-muted-foreground mt-0.5">
                    si gestiscono in <strong>Anagrafiche Amministrative</strong>. Qui solo ruolo, permessi e password.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const tabMap: Record<string, string> = {
                      backoffice: "specialist",
                      account_executive: "account_executive",
                      corrispondente_1: "corrispondente",
                      corrispondente_2: "corrispondente",
                      corrispondente_3: "corrispondente",
                      responsabile_sede: "responsabile_sede",
                    };
                    const tab = tabMap[ruolo];
                    if (!tab) {
                      toast.info("Questo ruolo non ha un'anagrafica amministrativa");
                      return;
                    }
                    window.location.href = `/archivi/anagrafiche-amministrative?tab=${tab}&edit=${user.id}`;
                  }}
                >
                  Apri anagrafica
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ruolo, attivo e permessi si salvano col pulsante "Salva modifiche". Dati anagrafici col pulsante dedicato sopra.
              </p>
            </TabsContent>

            <TabsContent value="visibility" className="space-y-3 mt-0">
              <p className="text-sm text-muted-foreground">Quali dati può vedere questo utente?</p>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as VisibilityScope)} className="space-y-2">
                {(Object.keys(VISIBILITY_LABEL) as VisibilityScope[]).map((v) => (
                  <label key={v} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
                    <RadioGroupItem value={v} />
                    <span className="text-sm">{VISIBILITY_LABEL[v]}</span>
                  </label>
                ))}
              </RadioGroup>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-3 mt-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Spunta i moduli accessibili</p>
                <Button variant="outline" size="sm" onClick={handleApplyTemplate}>
                  Applica template {level.label}
                </Button>
              </div>
              <PermissionsMatrix
                permissions={permissions}
                onChange={(k, v) => setPermissions((p) => ({ ...p, [k]: v }))}
              />
              <div className="flex items-center justify-between rounded-lg border p-3 mt-3">
                <div>
                  <Label className="font-medium">Riceve provvigioni</Label>
                  <p className="text-xs text-muted-foreground">Abilitazione modulo. Le percentuali si impostano in Anagrafiche Amministrative.</p>
                </div>
                <Switch checked={riceveProvvigioni} onCheckedChange={setRiceveProvvigioni} />
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-3 mt-0">
              <div className="rounded-lg border p-3 space-y-2">
                <Label className="font-medium flex items-center gap-1.5"><KeyRound className="w-4 h-4" />Reset password</Label>
                <div className="flex gap-2">
                  <Input type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="Nuova password" />
                  <Button onClick={handleResetPassword} variant="outline">Imposta</Button>
                </div>
              </div>
              <div className="rounded-lg border p-3 bg-destructive/5">
                <Label className="font-medium flex items-center gap-1.5 text-destructive"><Power className="w-4 h-4" />Sospensione</Label>
                <p className="text-xs text-muted-foreground mt-1">Disattiva l'account dalla tab Anagrafica per impedire l'accesso senza eliminare i dati.</p>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Separator className="my-2" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserPermissionsSheet;
