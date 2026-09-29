import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  disabled?: boolean;
}

const ContoSediMultiSelect = ({ value, onChange, required, disabled }: Props) => {
  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_conto_sedi_multi"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici" as any)
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return (data || []) as unknown as { id: string; codice_ufficio: string; nome_ufficio: string }[];
    },
  });

  const checkedIds = new Set(value);

  const toggle = (uId: string, on: boolean) => {
    if (on) {
      onChange([...value, uId]);
    } else {
      onChange(value.filter((id) => id !== uId));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          Sedi abilitate {required && <span className="text-destructive">*</span>}
        </Label>
        <Badge variant="secondary" className="text-[10px]">
          {value.length} sede{value.length !== 1 ? "i" : ""} selezionate
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Seleziona le sedi che possono utilizzare questo conto nelle operazioni (messa a cassa, incassi, rimesse).
      </p>
      <ScrollArea className="h-48 rounded-md border bg-muted/20 p-2">
        {uffici.map((u) => {
          const isChecked = checkedIds.has(u.id);
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 p-2 rounded hover:bg-background border border-transparent hover:border-border"
            >
              <Checkbox
                checked={isChecked}
                disabled={disabled}
                onCheckedChange={(c) => toggle(u.id, !!c)}
                id={`conto-sede-${u.id}`}
              />
              <Label htmlFor={`conto-sede-${u.id}`} className="flex-1 cursor-pointer text-sm">
                <span className="font-medium">{u.codice_ufficio}</span> — {u.nome_ufficio}
              </Label>
            </div>
          );
        })}
      </ScrollArea>
      {required && value.length === 0 && (
        <p className="text-xs text-destructive">Seleziona almeno una sede.</p>
      )}
    </div>
  );
};

export default ContoSediMultiSelect;
