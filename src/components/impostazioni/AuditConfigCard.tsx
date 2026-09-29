import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, X, Plus, ShieldCheck } from "lucide-react";

const DEFAULT_EXCLUDED = ["updated_at", "created_at", "search_vector", "tsv", "updated_by", "created_by"];

export default function AuditConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [excluded, setExcluded] = useState<string[]>(DEFAULT_EXCLUDED);
  const [dedupSec, setDedupSec] = useState(2);
  const [newField, setNewField] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("audit_config" as any)
        .select("excluded_fields, dedup_window_seconds")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setExcluded((data as any).excluded_fields || DEFAULT_EXCLUDED);
        setDedupSec((data as any).dedup_window_seconds ?? 2);
      }
      setLoading(false);
    })();
  }, []);

  const addField = () => {
    const f = newField.trim().toLowerCase();
    if (!f || excluded.includes(f)) return;
    setExcluded([...excluded, f]);
    setNewField("");
  };

  const removeField = (f: string) => setExcluded(excluded.filter((x) => x !== f));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("audit_config" as any)
      .update({ excluded_fields: excluded, dedup_window_seconds: dedupSec, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error("Errore salvataggio: " + error.message);
    else toast.success("Configurazione audit salvata");
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> Configurazione Log Attività
        </CardTitle>
        <CardDescription>
          Campi esclusi dal tracciamento delle modifiche e finestra anti-duplicato (solo admin)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Campi esclusi dal log</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Le modifiche a questi campi non genereranno un'entrata nel log.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {excluded.map((f) => (
              <Badge key={f} variant="secondary" className="gap-1">
                {f}
                <button onClick={() => removeField(f)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            {excluded.length === 0 && (
              <span className="text-xs text-muted-foreground">Nessun campo escluso</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              placeholder="nome_campo"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
              className="max-w-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1">
              <Plus className="w-4 h-4" /> Aggiungi
            </Button>
          </div>
        </div>

        <div className="max-w-xs">
          <Label>Finestra anti-duplicato (secondi)</Label>
          <Input
            type="number"
            min={0}
            max={60}
            value={dedupSec}
            onChange={(e) => setDedupSec(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Eventi identici dello stesso utente entro questa finestra vengono marcati come duplicati.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salva configurazione audit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
