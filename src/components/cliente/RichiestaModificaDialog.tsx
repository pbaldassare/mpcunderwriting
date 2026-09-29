import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string;
  campo: string;
  campoLabel: string;
  valoreAttuale?: string | null;
  onCreated?: () => void;
}

export const RichiestaModificaDialog = ({
  open, onOpenChange, clienteId, campo, campoLabel, valoreAttuale, onCreated,
}: Props) => {
  const { user } = useAuth();
  const [valoreProposto, setValoreProposto] = useState("");
  const [motivazione, setMotivazione] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user || !valoreProposto.trim()) {
      toast.error("Inserisci il nuovo valore");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("richieste_modifica_cliente").insert({
      cliente_id: clienteId,
      richiesto_da: user.id,
      campo,
      campo_label: campoLabel,
      valore_attuale: valoreAttuale ?? null,
      valore_proposto: valoreProposto.trim(),
      motivazione: motivazione.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success("Richiesta inviata all'agenzia");
    setValoreProposto("");
    setMotivazione("");
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Richiedi modifica: {campoLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Valore attuale</Label>
            <Input value={valoreAttuale ?? "—"} disabled />
          </div>
          <div>
            <Label>Nuovo valore *</Label>
            <Input value={valoreProposto} onChange={(e) => setValoreProposto(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Motivazione (opzionale)</Label>
            <Textarea value={motivazione} onChange={(e) => setMotivazione(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-muted-foreground">
            La richiesta sarà inviata all'agenzia. Il dato verrà aggiornato solo dopo l'approvazione.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Invio..." : "Invia richiesta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RichiestaModificaDialog;
