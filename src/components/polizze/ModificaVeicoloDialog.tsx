import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { TIPI_VEICOLO } from "@/lib/rcaConstants";
import { useLookupTipologiaVeicolo } from "@/hooks/useLookupTables";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

type VeicoloForm = {
  targa: string;
  marca: string;
  modello: string;
  versione: string;
  telaio: string;
  tipo_veicolo: string;
  veicolo_descrizione: string;
  data_immatricolazione: string;
  provincia_circolazione: string;
};

const EMPTY: VeicoloForm = {
  targa: "",
  marca: "",
  modello: "",
  versione: "",
  telaio: "",
  tipo_veicolo: "",
  veicolo_descrizione: "",
  data_immatricolazione: "",
  provincia_circolazione: "",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string | null;
  numeroPolizza?: string | null;
  disabled?: boolean;
  /** Invalidazione aggiuntiva dopo salvataggio (es. polizze_cliente). */
  onSaved?: () => void;
};

export function ModificaVeicoloDialog({
  open,
  onOpenChange,
  titoloId,
  numeroPolizza,
  disabled = false,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VeicoloForm>(EMPTY);
  const { data: tipiVeicolo = [] } = useLookupTipologiaVeicolo();
  const tipiVeicoloOpts = tipiVeicolo.length > 0 ? tipiVeicolo : TIPI_VEICOLO;

  const { data: veicolo, isLoading } = useQuery({
    queryKey: ["veicolo-polizza", titoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veicoli_polizza")
        .select("*")
        .eq("titolo_id", titoloId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!titoloId,
  });

  useEffect(() => {
    if (!open) return;
    const v: any = veicolo || {};
    setForm({
      targa: v.targa ?? "",
      marca: v.marca ?? "",
      modello: v.modello ?? "",
      versione: v.versione ?? "",
      telaio: v.telaio ?? "",
      tipo_veicolo: v.tipo_veicolo ?? "",
      veicolo_descrizione: v.veicolo_descrizione ?? "",
      data_immatricolazione: v.data_immatricolazione ?? "",
      provincia_circolazione: v.provincia_circolazione ?? "",
    });
  }, [open, veicolo]);

  const set = (key: keyof VeicoloForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!titoloId) throw new Error("Titolo mancante");
      const targa = form.targa.trim().toUpperCase() || null;
      const telaio = form.telaio.trim().toUpperCase() || null;
      if (telaio && telaio.length !== 17) {
        throw new Error("Telaio (VIN) deve avere 17 caratteri");
      }

      const payload = {
        titolo_id: titoloId,
        targa,
        marca: form.marca.trim().toUpperCase() || null,
        modello: form.modello.trim().toUpperCase() || null,
        versione: form.versione.trim() || null,
        telaio,
        tipo_veicolo: form.tipo_veicolo || null,
        veicolo_descrizione: form.veicolo_descrizione.trim() || null,
        data_immatricolazione: form.data_immatricolazione || null,
        provincia_circolazione: form.provincia_circolazione.trim().toUpperCase() || null,
      };

      const { error } = await supabase
        .from("veicoli_polizza")
        .upsert(payload, { onConflict: "titolo_id" });
      if (error) throw error;

      // Allinea targa_telaio sul titolo madre (usato in liste/filtri)
      const { error: errTitolo } = await supabase
        .from("titoli")
        .update({ targa_telaio: targa })
        .eq("id", titoloId);
      if (errTitolo) throw errTitolo;

      await logAttivita({
        azione: veicolo ? "modifica_veicolo" : "crea_veicolo",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { campi: Object.keys(payload), fonte: "cliente_detail" },
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veicolo-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["veicoli_polizza_madri"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      toast.success("Dati veicolo salvati");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Dati veicolo
            {numeroPolizza ? (
              <span className="font-mono text-sm font-normal text-muted-foreground">
                · {numeroPolizza}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Caricamento…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Targa</Label>
              <Input
                value={form.targa}
                onChange={(e) => set("targa", e.target.value.toUpperCase())}
                className="h-9 font-mono uppercase"
                placeholder="AB123CD"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo veicolo</Label>
              <SearchableSelect
                className="h-9"
                value={form.tipo_veicolo}
                onValueChange={(v) => set("tipo_veicolo", v)}
                options={tipiVeicoloOpts}
                placeholder="—"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marca</Label>
              <Input
                value={form.marca}
                onChange={(e) => set("marca", e.target.value.toUpperCase())}
                className="h-9"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modello</Label>
              <Input
                value={form.modello}
                onChange={(e) => set("modello", e.target.value.toUpperCase())}
                className="h-9"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Telaio (VIN)</Label>
              <Input
                value={form.telaio}
                onChange={(e) => set("telaio", e.target.value.toUpperCase())}
                className="h-9 font-mono uppercase"
                maxLength={17}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Versione</Label>
              <Input
                value={form.versione}
                onChange={(e) => set("versione", e.target.value)}
                className="h-9"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prov. circolazione</Label>
              <Input
                value={form.provincia_circolazione}
                onChange={(e) => set("provincia_circolazione", e.target.value.toUpperCase())}
                className="h-9 uppercase"
                maxLength={2}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Immatricolazione</Label>
              <Input
                type="date"
                value={form.data_immatricolazione}
                onChange={(e) => set("data_immatricolazione", e.target.value)}
                className="h-9"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Descrizione veicolo</Label>
              <Input
                value={form.veicolo_descrizione}
                onChange={(e) => set("veicolo_descrizione", e.target.value)}
                className="h-9"
                placeholder="es. AUDI A1 1.6 TDI"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            disabled={disabled || isLoading || saveMutation.isPending || !titoloId}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
