import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { logAttivita } from "@/lib/logAttivita";
import { buildDuplicaTitoloPayload, isDuplicaSorgentePolizza } from "@/lib/duplicaTitolo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

/**
 * Duplica una polizza: crea un nuovo record `titoli` copiando tutti i campi
 * tecnici dalla sorgente, ma azzerando identificativi univoci e stato.
 * Numero polizza, decorrenza e scadenza sono obbligatori e da inserire a mano.
 * Copia anche le righe di `premi_garanzia_polizza` collegate.
 */
export const DuplicaPolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [numero, setNumero] = useState("");
  const [decorrenza, setDecorrenza] = useState("");
  const [scadenza, setScadenza] = useState("");

  useEffect(() => {
    if (open) {
      setNumero("");
      setDecorrenza("");
      setScadenza("");
    }
  }, [open]);

  const canSave = !!numero.trim() && !!decorrenza && !!scadenza && !saving;

  const handleDuplica = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // 1) leggi sorgente
      const { data: src, error: errSrc } = await supabase
        .from("titoli")
        .select("*")
        .eq("id", titoloId)
        .maybeSingle();
      if (errSrc || !src) throw errSrc || new Error("Polizza sorgente non trovata");
      if (!isDuplicaSorgentePolizza(src as { sostituisce_polizza?: unknown; is_regolazione?: unknown })) {
        throw new Error("Si possono duplicare solo le polizze, non le quietanze");
      }

      const payload = buildDuplicaTitoloPayload(src as Record<string, unknown>, {
        numero,
        decorrenza,
        scadenza,
      });

      const { data: nuovo, error: errIns } = await supabase
        .from("titoli")
        .insert(payload)
        .select("id, numero_titolo")
        .single();
      if (errIns || !nuovo) throw errIns || new Error("Insert fallita");

      // 3) clona righe premi_garanzia_polizza
      const { data: premi } = await supabase
        .from("premi_garanzia_polizza")
        .select("*")
        .eq("titolo_id", titoloId);
      if (premi && premi.length > 0) {
        const cloneRows = premi.map((r: any) => {
          const { id: _id, created_at: _c, updated_at: _u, titolo_id: _t, ...rest } = r;
          return { ...rest, titolo_id: nuovo.id };
        });
        await supabase.from("premi_garanzia_polizza").insert(cloneRows);
      }

      // 4) log
      await logAttivita({
        entita_tipo: "titolo",
        entita_id: nuovo.id,
        azione: "duplicazione",
        dettagli_json: { da_numero: numeroPolizza || null, da_titolo_id: titoloId },
        severity: "info",
      }).catch(() => {});

      toast.success(`Polizza ${nuovo.numero_titolo} creata`);
      queryClient.invalidateQueries({ queryKey: ["titoli"] });
      queryClient.invalidateQueries({ queryKey: ["v_portafoglio_titoli"] });
      onOpenChange(false);
      onDone?.();
      navigate(`/titoli/${nuovo.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Errore in fase di duplicazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-teal-600" />
            Duplica Polizza
          </DialogTitle>
          <DialogDescription>
            Verrà creata una nuova polizza con gli stessi dati tecnici di{" "}
            <strong>{numeroPolizza || titoloId.slice(0, 8)}</strong>. Inserisci numero, decorrenza
            e scadenza della nuova polizza — sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="dup-num">Nuovo Numero Polizza *</Label>
            <Input
              id="dup-num"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Inserisci il nuovo numero di polizza"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dup-dec">Decorrenza *</Label>
              <Input
                id="dup-dec"
                type="date"
                value={decorrenza}
                onChange={(e) => setDecorrenza(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dup-sca">Scadenza *</Label>
              <Input
                id="dup-sca"
                type="date"
                value={scadenza}
                onChange={(e) => setScadenza(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            CIG, date di incasso/messa a cassa e altri identificativi univoci non vengono copiati. Tutti gli
            altri campi (cliente, compagnia, ramo, premi, garanzie, RCA) vengono clonati.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleDuplica} disabled={!canSave} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Duplica polizza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicaPolizzaDialog;
