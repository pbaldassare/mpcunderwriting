import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Building2, Save, Loader2 } from "lucide-react";
import AuditConfigCard from "@/components/impostazioni/AuditConfigCard";

interface ImpostazioneSistema {
  id: string;
  chiave: string;
  valore_json: unknown;
  descrizione: string | null;
  updated_at: string;
}

interface ImpostazioneUfficio {
  id: string;
  ufficio_id: string;
  chiave: string;
  valore_json: unknown;
  updated_at: string;
}

interface Ufficio {
  id: string;
  nome_ufficio: string;
}

const PARAM_CONFIG: Record<string, { label: string; type: "string" | "number" | "password"; min?: number; max?: number; description?: string }> = {
  password_default: {
    label: "Password iniziale nuovi utenti",
    type: "string",
    description: "Password assegnata automaticamente quando viene creato un nuovo utente (cliente, prospect, corrispondente). L'utente dovrà cambiarla al primo accesso.",
  },
  giorni_tolleranza_matching_banca: {
    label: "Tolleranza date matching bancario (giorni)",
    type: "number",
    min: 0,
    max: 30,
    description: "Finestra in giorni entro cui la riconciliazione AI considera un movimento bancario abbinabile a un titolo (data incasso ± giorni).",
  },
  soglia_score_ok: {
    label: "Soglia auto-approvazione AI (0-100)",
    type: "number",
    min: 0,
    max: 100,
    description: "Punteggio minimo per cui il matching bancario AI viene approvato automaticamente senza revisione manuale.",
  },
  soglia_score_verifica: {
    label: "Soglia revisione manuale AI (0-100)",
    type: "number",
    min: 0,
    max: 100,
    description: "Punteggio minimo per proporre il match in coda di verifica. Sotto questa soglia il match viene scartato.",
  },
  limiti_upload_file_mb: {
    label: "Dimensione massima file caricabili (MB)",
    type: "number",
    min: 1,
    max: 100,
    description: "Limite per i file caricati nel documentale e negli allegati di polizze, sinistri e clienti.",
  },
  giorni_alert_eventi_sinistri: {
    label: "Anticipo notifiche eventi sinistri (giorni)",
    type: "number",
    min: 1,
    max: 90,
    description: "Numero di giorni di anticipo per generare gli alert su scadenze e follow-up dei sinistri.",
  },
  infordat_username: {
    label: "Infordat — username",
    type: "string",
    description: "Account banca dati Infordat usato dalla ricerca bandi.",
  },
  infordat_password: {
    label: "Infordat — password",
    type: "password",
    description: "Password banca dati Infordat. Non viene mostrata in chiaro dopo il salvataggio se lasci il campo vuoto.",
  },
};

const HIDDEN_KEYS = new Set(["admin_anagrafica_id"]);

const ImpostazioniPage = () => {
  const { isAdmin, profile } = useAuth();
  const [sistemaSettings, setSistemaSettings] = useState<ImpostazioneSistema[]>([]);
  const [ufficioSettings, setUfficioSettings] = useState<ImpostazioneUfficio[]>([]);
  const [uffici, setUffici] = useState<Ufficio[]>([]);
  const [selectedUfficio, setSelectedUfficio] = useState<string>("");
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({});
  const [editedUfficioValues, setEditedUfficioValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSistema();
    if (isAdmin) fetchUffici();
  }, [isAdmin]);

  useEffect(() => {
    const uffId = isAdmin ? selectedUfficio : profile?.ufficio_id;
    if (uffId) fetchUfficioSettings(uffId);
  }, [selectedUfficio, isAdmin, profile]);

  const fetchSistema = async () => {
    const { data } = await supabase.from("impostazioni_sistema").select("*").order("chiave");
    if (data) {
      setSistemaSettings(data as ImpostazioneSistema[]);
      const vals: Record<string, unknown> = {};
      data.forEach((s: ImpostazioneSistema) => { vals[s.chiave] = s.valore_json; });
      setEditedValues(vals);
    }
    setLoading(false);
  };

  const fetchUffici = async () => {
    const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
    if (data) setUffici(data);
  };

  const fetchUfficioSettings = async (ufficioId: string) => {
    const { data } = await supabase.from("impostazioni_ufficio").select("*").eq("ufficio_id", ufficioId);
    if (data) {
      setUfficioSettings(data as ImpostazioneUfficio[]);
      const vals: Record<string, unknown> = {};
      data.forEach((s: ImpostazioneUfficio) => { vals[s.chiave] = s.valore_json; });
      setEditedUfficioValues(vals);
    }
  };

  const saveSistema = async () => {
    setSaving(true);
    try {
      for (const setting of sistemaSettings) {
        const newVal = editedValues[setting.chiave];
        if (JSON.stringify(newVal) !== JSON.stringify(setting.valore_json)) {
          await supabase.from("impostazioni_sistema").update({ valore_json: newVal as any }).eq("id", setting.id);
        }
      }
      await logAttivita({
        azione: "modifica_impostazioni",
        entita_tipo: "impostazioni_sistema",
        entita_id: "sistema",
        dettagli_json: { valori: editedValues },
      });
      toast.success("Impostazioni di sistema salvate");
      fetchSistema();
    } catch {
      toast.error("Errore nel salvataggio");
    }
    setSaving(false);
  };

  const saveUfficio = async () => {
    const ufficioId = isAdmin ? selectedUfficio : profile?.ufficio_id;
    if (!ufficioId) return;
    setSaving(true);
    try {
      for (const [chiave, valore] of Object.entries(editedUfficioValues)) {
        const existing = ufficioSettings.find((s) => s.chiave === chiave);
        if (existing) {
          await supabase.from("impostazioni_ufficio").update({ valore_json: valore as any }).eq("id", existing.id);
        } else {
          await supabase.from("impostazioni_ufficio").insert({ ufficio_id: ufficioId, chiave, valore_json: valore as any });
        }
      }
      await logAttivita({
        azione: "modifica_impostazioni",
        entita_tipo: "impostazioni_ufficio",
        entita_id: ufficioId,
        dettagli_json: { valori: editedUfficioValues },
      });
      toast.success("Impostazioni ufficio salvate");
      fetchUfficioSettings(ufficioId);
    } catch {
      toast.error("Errore nel salvataggio");
    }
    setSaving(false);
  };

  const renderField = (chiave: string, value: unknown, onChange: (chiave: string, val: unknown) => void) => {
    const config = PARAM_CONFIG[chiave];
    const label = config?.label || chiave;
    const type = config?.type || "string";
    const description = config?.description;

    return (
      <div key={chiave} className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <Input
          type={type === "number" ? "number" : type === "password" ? "password" : "text"}
          value={typeof value === "string" ? value : String(value ?? "")}
          min={config?.min}
          max={config?.max}
          onChange={(e) => {
            const v = type === "number" ? Number(e.target.value) : e.target.value;
            onChange(chiave, v);
          }}
        />
        {description && (
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6" /> Impostazioni
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configurazione parametri di sistema e ufficio</p>
      </div>

      <Tabs defaultValue={isAdmin ? "sistema" : "ufficio"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="sistema">Sistema</TabsTrigger>}
          <TabsTrigger value="ufficio">Sede</TabsTrigger>
          {isAdmin && <TabsTrigger value="audit">Log Attività</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="sistema">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parametri di Sistema</CardTitle>
                <CardDescription>Configurazione globale dell'applicazione (solo admin)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sistemaSettings
                    .filter((s) => !HIDDEN_KEYS.has(s.chiave))
                    .map((s) =>
                      renderField(s.chiave, editedValues[s.chiave], (chiave, val) =>
                        setEditedValues((prev) => ({ ...prev, [chiave]: val }))
                      )
                    )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={saveSistema} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salva parametri sistema
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="ufficio">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Parametri Ufficio
              </CardTitle>
              <CardDescription>Override dei parametri di sistema per ufficio specifico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin && (
                <div className="max-w-xs">
                   <Label>Seleziona sede</Label>
                  <Select value={selectedUfficio} onValueChange={setSelectedUfficio}>
                    <SelectTrigger><SelectValue placeholder="Scegli sede..." /></SelectTrigger>
                    <SelectContent>
                      {uffici.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(isAdmin ? selectedUfficio : profile?.ufficio_id) ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(PARAM_CONFIG).map((chiave) =>
                      renderField(
                        chiave,
                        editedUfficioValues[chiave] ?? editedValues[chiave] ?? "",
                        (k, val) => setEditedUfficioValues((prev) => ({ ...prev, [k]: val }))
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    I valori vuoti ereditano le impostazioni di sistema.
                  </p>
                  <div className="flex justify-end pt-2">
                    <Button onClick={saveUfficio} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Salva parametri ufficio
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Seleziona un ufficio per configurarne i parametri.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="audit">
            <AuditConfigCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ImpostazioniPage;
