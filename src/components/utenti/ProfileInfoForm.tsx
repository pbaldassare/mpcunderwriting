import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { Save, Loader2 } from "lucide-react";

export interface ProfileInfo {
  nome: string;
  cognome: string;
  telefono: string;
  note: string;
}

interface Props {
  userId: string;
  initial: ProfileInfo;
  mode: "self" | "admin";
  onSaved?: (info: ProfileInfo) => void;
  /** Se true non mostra il pulsante; salvataggio gestito esternamente via ref/imperative */
  hideSubmit?: boolean;
}

const NOTE_MAX = 500;

const ProfileInfoForm = ({ userId, initial, mode, onSaved, hideSubmit }: Props) => {
  const [form, setForm] = useState<ProfileInfo>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
  }, [initial.nome, initial.cognome, initial.telefono, initial.note, userId]);

  const update = <K extends keyof ProfileInfo>(k: K, v: ProfileInfo[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (form.note.length > NOTE_MAX) {
      toast.error(`Note troppo lunghe (max ${NOTE_MAX} caratteri)`);
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim() || null,
      cognome: form.cognome.trim() || null,
      telefono: form.telefono.trim() || null,
      note: form.note.trim() || null,
    };
    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("id, nome, cognome, telefono, note");
    if (error) {
      console.error("[ProfileInfoForm] update error", error);
      toast.error("Errore salvataggio", { description: error.message });
      setSaving(false);
      return;
    }
    if (!data || data.length === 0) {
      console.warn("[ProfileInfoForm] update returned 0 rows (RLS block?)", { userId, payload });
      toast.error("Salvataggio non riuscito", {
        description: "Permessi insufficienti o utente non trovato. Contatta l'amministratore.",
      });
      setSaving(false);
      return;
    }
    await logAttivita({
      azione: mode === "self" ? "aggiornamento_profilo_personale" : "aggiornamento_profilo_utente",
      entita_tipo: "profile",
      entita_id: userId,
    });
    toast.success("Dati personali salvati");
    onSaved?.(form);
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Nome</Label>
          <Input
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
            maxLength={100}
            placeholder="Mario"
          />
        </div>
        <div>
          <Label className="text-xs">Cognome</Label>
          <Input
            value={form.cognome}
            onChange={(e) => update("cognome", e.target.value)}
            maxLength={100}
            placeholder="Rossi"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Recapito telefonico</Label>
        <Input
          value={form.telefono}
          onChange={(e) => update("telefono", e.target.value)}
          maxLength={30}
          placeholder="+39 ..."
          inputMode="tel"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Note sintetiche</Label>
          <span className="text-[10px] text-muted-foreground">
            {form.note.length}/{NOTE_MAX}
          </span>
        </div>
        <Textarea
          value={form.note}
          onChange={(e) => update("note", e.target.value.slice(0, NOTE_MAX))}
          rows={3}
          placeholder="Brevi annotazioni opzionali"
        />
      </div>
      {!hideSubmit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Salva dati personali
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileInfoForm;
