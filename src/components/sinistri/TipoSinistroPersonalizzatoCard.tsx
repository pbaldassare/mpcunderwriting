import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TIPI_SINISTRO } from "@/lib/tipiSinistro";
import { Tag } from "lucide-react";

interface Props {
  sinistroId: string;
  tipoSinistro: string | null;
  tipoSinistroPersonalizzato: string | null;
  canEdit: boolean;
  onSaved?: () => void;
}

export default function TipoSinistroPersonalizzatoCard({
  sinistroId, tipoSinistro, tipoSinistroPersonalizzato, canEdit, onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [testo, setTesto] = useState(tipoSinistroPersonalizzato ?? "");
  const [tipoStd, setTipoStd] = useState(tipoSinistro ?? "");
  const [saving, setSaving] = useState(false);

  const salvaTesto = async () => {
    setSaving(true);
    const { error } = await supabase.from("sinistri")
      .update({ tipo_sinistro_personalizzato: testo.trim() || null })
      .eq("id", sinistroId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Tipo personalizzato aggiornato");
    setEditing(false);
    onSaved?.();
  };

  const riclassifica = async (value: string) => {
    setTipoStd(value);
    setSaving(true);
    const { error } = await supabase.from("sinistri")
      .update({ tipo_sinistro: value, tipo_sinistro_personalizzato: null })
      .eq("id", sinistroId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Sinistro riclassificato");
    onSaved?.();
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4 text-amber-600" />
          Tipo sinistro personalizzato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing ? (
          <div className="flex items-center justify-between gap-3">
            <p className="whitespace-pre-wrap">
              {tipoSinistroPersonalizzato || <span className="text-muted-foreground italic">— nessun valore —</span>}
            </p>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Modifica</Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Input value={testo} onChange={e => setTesto(e.target.value)} maxLength={500} />
            <div className="flex gap-2">
              <Button size="sm" onClick={salvaTesto} disabled={saving}>Salva</Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setTesto(tipoSinistroPersonalizzato ?? ""); }}>Annulla</Button>
            </div>
          </div>
        )}

        {canEdit && (
          <div className="pt-2 border-t">
            <Label className="text-xs">Riclassifica come tipo standard</Label>
            <Select value={tipoStd} onValueChange={riclassifica}>
              <SelectTrigger><SelectValue placeholder="Seleziona tipo predefinito" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {TIPI_SINISTRO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Selezionando un tipo standard, il valore personalizzato viene rimosso.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
