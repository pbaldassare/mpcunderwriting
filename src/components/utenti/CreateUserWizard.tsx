import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEVELS, LevelConfig, ROLE_LABELS } from "@/lib/userLevels";
import { Sparkles, UserPlus, Building2, ShieldCheck, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Source = "scratch" | "anagrafica" | "cliente";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

const STEPS = [
  { id: 1, label: "Sorgente", icon: Sparkles },
  { id: 2, label: "Dati base", icon: UserPlus },
  { id: 3, label: "Livello & Ruolo", icon: ShieldCheck },
  { id: 4, label: "Conferma", icon: CheckCircle2 },
];

const CreateUserWizard = ({ open, onOpenChange, onCreated }: Props) => {
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<Source>("scratch");
  const [selectedAnagId, setSelectedAnagId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [ufficioId, setUfficioId] = useState<string>("");
  const [level, setLevel] = useState<LevelConfig>(LEVELS[4]);
  const [role, setRole] = useState<string>(LEVELS[4].roles[0]);
  const [password, setPassword] = useState("Leone123!");
  const [saving, setSaving] = useState(false);

  const { data: uffici } = useQuery({
    queryKey: ["uffici-attivi"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  const { data: anagrafiche } = useQuery({
    queryKey: ["anag-prof-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, email, tipo, ufficio_id")
        .in("tipo", ["account_executive", "corrispondente", "executive", "produttore_sede", "responsabile_sede"])
        .eq("attivo", true)
        .not("email", "is", null)
        .order("cognome");
      return data || [];
    },
    enabled: source === "anagrafica" && step === 1,
  });

  const reset = () => {
    setStep(1);
    setSource("scratch");
    setSelectedAnagId("");
    setNome(""); setCognome(""); setEmail(""); setUfficioId("");
    setLevel(LEVELS[4]); setRole(LEVELS[4].roles[0]);
    setPassword("Leone123!");
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  // Auto-fill from anagrafica
  useEffect(() => {
    if (source === "anagrafica" && selectedAnagId && anagrafiche) {
      const a = anagrafiche.find((x) => x.id === selectedAnagId);
      if (a) {
        setNome(a.nome || "");
        setCognome(a.cognome || "");
        setEmail(a.email || "");
        setUfficioId(a.ufficio_id || "");
      }
    }
  }, [selectedAnagId, source, anagrafiche]);

  const canNext = () => {
    if (step === 1) return source === "scratch" || (source === "anagrafica" && !!selectedAnagId);
    if (step === 2) return !!nome && !!cognome && !!email;
    if (step === 3) return !!role;
    return true;
  };

  const handleCreate = async () => {
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await supabase.functions.invoke("create-user", {
      body: {
        nome, cognome, email, ruolo: role,
        ufficio_id: ufficioId || null,
        permessi_json: level.defaultPermissions,
        password,
      },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.error || (res.data as any)?.error) {
      toast.error("Errore", { description: (res.data as any)?.error || res.error?.message });
      setSaving(false);
      return;
    }

    toast.success("Utente creato", { description: `${email} • password: ${password}` });
    onCreated();
    onOpenChange(false);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Nuovo Utente — Procedura guidata
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 py-3 border-y bg-muted/30 -mx-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-all",
                      isActive && "bg-primary text-primary-foreground shadow-md scale-110",
                      isDone && "bg-primary/20 text-primary",
                      !isActive && !isDone && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={cn("text-xs font-medium hidden sm:inline", isActive ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1 mx-2", isDone ? "bg-primary/40" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        <div className="py-2 min-h-[280px]">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Da dove proviene il nuovo utente?</p>
              <RadioGroup value={source} onValueChange={(v) => setSource(v as Source)} className="space-y-2">
                {[
                  { v: "scratch", t: "Crea da zero", d: "Inserisci email e dati manualmente (consigliato per Admin, CFO, Sede, Manager)" },
                  { v: "anagrafica", t: "Promuovi da Anagrafica Professionale", d: "Usa dati di un AE / Corrispondente / Executive già censito" },
                  { v: "cliente", t: "Promuovi da Cliente", d: "Caso raro — gestito automaticamente dal portale clienti" },
                ].map((o) => (
                  <label key={o.v} className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    source === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                    o.v === "cliente" && "opacity-60 cursor-not-allowed",
                  )}>
                    <RadioGroupItem value={o.v} disabled={o.v === "cliente"} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{o.t}</div>
                      <div className="text-xs text-muted-foreground">{o.d}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>

              {source === "anagrafica" && (
                <div className="pt-2">
                  <Label className="text-xs">Seleziona professionista *</Label>
                  <Select value={selectedAnagId} onValueChange={setSelectedAnagId}>
                    <SelectTrigger><SelectValue placeholder="Cerca…" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {anagrafiche?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.cognome} {a.nome} — {a.email} ({a.tipo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label className="text-xs">Cognome *</Label><Input value={cognome} onChange={(e) => setCognome(e.target.value)} /></div>
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={source === "anagrafica"} />
              </div>
              <div>
                <Label className="text-xs">Sede di appartenenza</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona sede" /></SelectTrigger>
                  <SelectContent>
                    {uffici?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Scegli il livello di accesso. I permessi predefiniti vengono applicati automaticamente.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {LEVELS.filter((l) => l.id !== "L6").map((l) => {
                  const Icon = l.icon;
                  const active = level.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => { setLevel(l); setRole(l.roles[0]); }}
                      className={cn(
                        "p-3 rounded-lg border-2 text-left transition-all",
                        l.bgClass,
                        active ? l.borderClass + " ring-2 ring-primary" : "border-border/40 hover:border-border",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("w-4 h-4", l.color)} />
                        <span className="text-[10px] font-bold text-muted-foreground">{l.id}</span>
                      </div>
                      <div className="text-sm font-semibold">{l.label}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2">{l.shortDesc}</div>
                    </button>
                  );
                })}
              </div>

              {level.roles.length > 1 && (
                <div>
                  <Label className="text-xs">Ruolo specifico</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {level.roles.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nome completo</span>
                  <span className="font-medium">{cognome} {nome}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="font-mono text-sm">{email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sede</span>
                  <span className="text-sm">{uffici?.find((u) => u.id === ufficioId)?.nome_ufficio || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Livello</span>
                  <Badge>{level.id} · {level.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ruolo</span>
                  <Badge variant="outline">{ROLE_LABELS[role] || role}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs">Password iniziale</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-[11px] text-muted-foreground mt-1">L'utente potrà modificarla al primo accesso.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}>
            {step > 1 ? "Indietro" : "Annulla"}
          </Button>
          {step < 4 ? (
            <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
              Avanti <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button disabled={saving} onClick={handleCreate}>
              {saving ? "Creazione…" : "Crea utente"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserWizard;
