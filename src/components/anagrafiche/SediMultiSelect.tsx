import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SedeAssegnata {
  ufficio_id: string;
  primaria: boolean;
}

interface Props {
  value: SedeAssegnata[];
  onChange: (next: SedeAssegnata[]) => void;
  required?: boolean;
}

const SediMultiSelect = ({ value, onChange, required }: Props) => {
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_multi_select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici" as any)
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []) as unknown as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const checkedIds = new Set(value.map((v) => v.ufficio_id));
  const primaria = value.find((v) => v.primaria)?.ufficio_id || value[0]?.ufficio_id || "";

  const toggle = (uId: string, on: boolean) => {
    if (on) {
      const next = [...value, { ufficio_id: uId, primaria: value.length === 0 }];
      onChange(next);
    } else {
      const filtered = value.filter((v) => v.ufficio_id !== uId);
      if (filtered.length > 0 && !filtered.some((v) => v.primaria)) {
        filtered[0].primaria = true;
      }
      onChange(filtered);
    }
  };

  const setPrimaria = (uId: string) => {
    onChange(value.map((v) => ({ ...v, primaria: v.ufficio_id === uId })));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          Sedi collegate {required && <span className="text-destructive">*</span>}
        </Label>
        <Badge variant="secondary" className="text-[10px]">
          {value.length} sede{value.length !== 1 ? "i" : ""} • primaria: {value.find((v) => v.primaria) ? "✓" : "—"}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Flagga tutte le Sedi a cui l'utente è collegato. La <strong>Primaria</strong> governa default operativi (IBAN, log, email).
        Su tutte le Sedi flaggate l'utente ha visibilità e scrittura piena.
      </p>
      <ScrollArea className="h-56 rounded-md border bg-muted/20 p-2">
        <RadioGroup value={primaria} onValueChange={setPrimaria}>
          {uffici.map((u) => {
            const isChecked = checkedIds.has(u.id);
            const isPrim = primaria === u.id;
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-background border border-transparent hover:border-border"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(c) => toggle(u.id, !!c)}
                  id={`sede-${u.id}`}
                />
                <Label htmlFor={`sede-${u.id}`} className="flex-1 cursor-pointer text-sm">
                  <span className="font-medium">{u.codice_ufficio}</span> — {u.nome_ufficio}
                </Label>
                {isChecked && (
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value={u.id} disabled={!isChecked} />
                    <span className={`text-[11px] flex items-center gap-0.5 ${isPrim ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      <Star className="w-3 h-3" /> Primaria
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </RadioGroup>
      </ScrollArea>
    </div>
  );
};

export default SediMultiSelect;
