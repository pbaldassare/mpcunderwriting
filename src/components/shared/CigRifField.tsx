import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { isGeneratedCigTemporaneo, isValidCigWithFlag, normalizeCig } from "@/lib/validateCig";

type Props = {
  idPrefix?: string;
  cig: string;
  temporaneo: boolean;
  onCigChange: (cig: string) => void;
  onTemporaneoChange: (temporaneo: boolean, cig?: string) => void;
  warningEmpty?: boolean;
};

export default function CigRifField({
  idPrefix = "cig",
  cig,
  temporaneo,
  onCigChange,
  onTemporaneoChange,
  warningEmpty,
}: Props) {
  const [loading, setLoading] = useState(false);
  const trimmed = cig.trim();
  const valido = !trimmed || isValidCigWithFlag(cig, temporaneo);

  const genera = async (): Promise<string | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("next_cig_temporaneo");
      if (error) throw error;
      const num = String(data || "").trim();
      if (!num) throw new Error("CIG temporaneo vuoto");
      return num;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Impossibile generare il CIG temporaneo");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const onTemp = async (checked: boolean) => {
    if (!checked) {
      onTemporaneoChange(false);
      return;
    }
    const cur = normalizeCig(cig);
    if (!cur || isGeneratedCigTemporaneo(cur)) {
      const num = await genera();
      if (!num) {
        onTemporaneoChange(false);
        return;
      }
      onTemporaneoChange(true, num);
      return;
    }
    onTemporaneoChange(true);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1" htmlFor={`${idPrefix}-input`}>
        CIG / CIG temporaneo
      </Label>
      <Input
        id={`${idPrefix}-input`}
        value={cig}
        onChange={(e) => onCigChange(e.target.value.toUpperCase())}
        maxLength={temporaneo ? 40 : 10}
        placeholder={temporaneo ? "CIG temporaneo" : "10 caratteri alfanumerici"}
        className={`h-8 text-xs font-mono ${
          (warningEmpty && !trimmed) || (trimmed && !valido)
            ? "border-destructive focus-visible:ring-destructive"
            : ""
        }`}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-temp`}
          checked={temporaneo}
          disabled={loading}
          onCheckedChange={(v) => void onTemp(v === true)}
        />
        <Label htmlFor={`${idPrefix}-temp`} className="text-[10px] cursor-pointer">
          CIG temporaneo (formato libero){loading ? "…" : ""}
        </Label>
      </div>
      {warningEmpty && !trimmed ? (
        <p className="text-[10px] text-amber-700">Ente senza CIG: l’E/C e il PDF non lo mostrano. Puoi incassare comunque.</p>
      ) : trimmed && !valido ? (
        <p className="text-[10px] text-destructive">CIG definitivo: 10 caratteri alfanumerici</p>
      ) : null}
    </div>
  );
}
