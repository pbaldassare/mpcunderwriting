import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  trattativa: any;
  onSaved: () => void;
  onEvento: (tipo: string, desc: string, dettagli?: any) => void;
}

export const TrattativaDettagliTab = ({ trattativa, onSaved, onEvento }: Props) => {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ramo_id: trattativa.ramo_id || "",
    compagnia_id: trattativa.compagnia_id || "",
    ufficio_id: trattativa.ufficio_id || "",
    assegnato_a: trattativa.assegnato_a || "",
    premio_previsto: trattativa.premio_previsto ? String(trattativa.premio_previsto) : "",
    premio_effettivo: trattativa.premio_effettivo ? String(trattativa.premio_effettivo) : "",
    priorita: trattativa.priorita || "media",
    data_apertura: trattativa.data_apertura || null,
    data_scadenza: trattativa.data_scadenza || null,
    sottoprodotto: trattativa.sottoprodotto || "",
    motivo_chiusura: trattativa.motivo_chiusura || "",
    note: trattativa.note || "",
  });

  useEffect(() => {
    setForm({
      ramo_id: trattativa.ramo_id || "",
      compagnia_id: trattativa.compagnia_id || "",
      ufficio_id: trattativa.ufficio_id || "",
      assegnato_a: trattativa.assegnato_a || "",
      premio_previsto: trattativa.premio_previsto ? String(trattativa.premio_previsto) : "",
      premio_effettivo: trattativa.premio_effettivo ? String(trattativa.premio_effettivo) : "",
      priorita: trattativa.priorita || "media",
      data_apertura: trattativa.data_apertura || null,
      data_scadenza: trattativa.data_scadenza || null,
      sottoprodotto: trattativa.sottoprodotto || "",
      motivo_chiusura: trattativa.motivo_chiusura || "",
      note: trattativa.note || "",
    });
  }, [trattativa]);

  const { data: rami = [] } = useQuery({
    queryKey: ["rami_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return (data || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }));
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["compagnie_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return (data || []).map((c) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return (data || []).map((u) => ({ value: u.id, label: u.nome_ufficio }));
    },
  });

  const { data: operatori = [] } = useQuery({
    queryKey: ["operatori_lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return (data || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }));
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes: Record<string, unknown> = {};
      const dettagli: Record<string, unknown> = {};

      const fields = [
        "ramo_id", "compagnia_id", "ufficio_id", "assegnato_a",
        "priorita", "sottoprodotto", "motivo_chiusura", "note",
        "data_apertura", "data_scadenza",
      ];

      for (const f of fields) {
        const newVal = (form as any)[f] || null;
        const oldVal = trattativa[f] || null;
        if (newVal !== oldVal) {
          changes[f] = newVal;
          dettagli[`${f}_precedente`] = oldVal;
          dettagli[`${f}_nuovo`] = newVal;
        }
      }

      const newPP = form.premio_previsto ? parseFloat(form.premio_previsto) : null;
      const oldPP = trattativa.premio_previsto ? Number(trattativa.premio_previsto) : null;
      if (newPP !== oldPP) { changes.premio_previsto = newPP; dettagli.premio_previsto_prec = oldPP; dettagli.premio_previsto_nuovo = newPP; }

      const newPE = form.premio_effettivo ? parseFloat(form.premio_effettivo) : null;
      const oldPE = trattativa.premio_effettivo ? Number(trattativa.premio_effettivo) : null;
      if (newPE !== oldPE) { changes.premio_effettivo = newPE; dettagli.premio_effettivo_prec = oldPE; dettagli.premio_effettivo_nuovo = newPE; }

      if (Object.keys(changes).length === 0) { toast.info("Nessuna modifica"); setSaving(false); return; }

      changes.updated_at = new Date().toISOString();
      const { error } = await supabase.from("trattative").update(changes).eq("id", trattativa.id);
      if (error) throw error;

      onEvento("modifica", "Campi aggiornati", dettagli);
      toast.success("Salvato");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const DateField = ({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <DateInput
        value={value?.slice(0, 10) ?? ""}
        placeholder="Seleziona data"
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );

  const isClosed = trattativa.stato === "chiusa_vinta" || trattativa.stato === "chiusa_persa";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <RamoSottoramoSelect
            gruppoRamoId={(form as any).gruppo_ramo_id || null}
            ramoId={form.ramo_id || null}
            onChange={({ gruppoRamoId, ramoId }) =>
              setForm({ ...form, ramo_id: ramoId || "", gruppo_ramo_id: gruppoRamoId } as any)
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Agenzia</Label>
          <SearchableSelect options={compagnie} value={form.compagnia_id} onValueChange={(v) => setForm({ ...form, compagnia_id: v })} placeholder="Seleziona agenzia..." />
        </div>
        <div className="space-y-1.5">
          <Label>Ufficio</Label>
          <SearchableSelect options={uffici} value={form.ufficio_id} onValueChange={(v) => setForm({ ...form, ufficio_id: v })} placeholder="Seleziona ufficio..." />
        </div>
        <div className="space-y-1.5">
          <Label>Assegnato a</Label>
          <SearchableSelect options={operatori} value={form.assegnato_a} onValueChange={(v) => setForm({ ...form, assegnato_a: v })} placeholder="Seleziona operatore..." />
        </div>
        <div className="space-y-1.5">
          <Label>Priorità</Label>
          <Select value={form.priorita} onValueChange={(v) => setForm({ ...form, priorita: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bassa">Bassa</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Sottoprodotto</Label>
          <Input value={form.sottoprodotto} onChange={(e) => setForm({ ...form, sottoprodotto: e.target.value })} placeholder="Es. RCA, Incendio..." />
        </div>
        <div className="space-y-1.5">
          <Label>Premio Previsto (€)</Label>
          <Input type="number" value={form.premio_previsto} onChange={(e) => setForm({ ...form, premio_previsto: e.target.value })} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <Label>Premio Effettivo (€)</Label>
          <Input type="number" value={form.premio_effettivo} onChange={(e) => setForm({ ...form, premio_effettivo: e.target.value })} placeholder="0.00" />
        </div>
        <DateField label="Data Apertura" value={form.data_apertura} onChange={(v) => setForm({ ...form, data_apertura: v })} />
        <DateField label="Data Scadenza" value={form.data_scadenza} onChange={(v) => setForm({ ...form, data_scadenza: v })} />
        {isClosed && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>Motivo Chiusura</Label>
            <Input value={form.motivo_chiusura} onChange={(e) => setForm({ ...form, motivo_chiusura: e.target.value })} placeholder="Motivo della chiusura..." />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={4} placeholder="Note sulla trattativa..." />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" />
          Salva Modifiche
        </Button>
      </div>
    </div>
  );
};
