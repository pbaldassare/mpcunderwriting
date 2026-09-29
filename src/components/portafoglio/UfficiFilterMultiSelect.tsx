import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Building2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type UfficioOpt = { id: string; codice_ufficio: string; nome_ufficio: string };

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

/** Filtro sede: ricerca + multi-select (popover). */
export function UfficiFilterMultiSelect({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);

  const { data: uffici = [], isLoading } = useQuery({
    queryKey: ["uffici-filter-multi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uffici")
        .select("id, codice_ufficio, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      if (error) throw error;
      return (data || []) as UfficioOpt[];
    },
  });

  const selected = useMemo(() => {
    const set = new Set(value);
    return uffici.filter((u) => set.has(u.id));
  }, [uffici, value]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  const label =
    value.length === 0
      ? "Tutte le sedi"
      : value.length === 1
        ? selected[0]
          ? `${selected[0].codice_ufficio} — ${selected[0].nome_ufficio}`
          : "1 sede"
        : `${value.length} sedi`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filtro sede"
          disabled={isLoading}
          className={cn("min-w-[180px] max-w-[280px] justify-between bg-background font-normal", className)}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{isLoading ? "Sedi…" : label}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca sede..." />
          <CommandList>
            <CommandEmpty>Nessuna sede trovata</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__tutte__"
                onSelect={() => onChange([])}
                className="gap-2"
              >
                <Check className={cn("h-4 w-4", value.length === 0 ? "opacity-100" : "opacity-0")} />
                Tutte le sedi
              </CommandItem>
              {uffici.map((u) => {
                const checked = value.includes(u.id);
                const search = `${u.codice_ufficio} ${u.nome_ufficio}`;
                return (
                  <CommandItem
                    key={u.id}
                    value={search}
                    onSelect={() => toggle(u.id)}
                    className="gap-2"
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none"
                      aria-hidden
                    />
                    <span className="truncate">
                      <span className="font-medium">{u.codice_ufficio}</span>
                      <span className="text-muted-foreground"> — {u.nome_ufficio}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
            <div className="flex flex-wrap gap-1 min-w-0">
              {selected.slice(0, 3).map((u) => (
                <Badge key={u.id} variant="secondary" className="text-[10px] font-normal">
                  {u.codice_ufficio}
                </Badge>
              ))}
              {selected.length > 3 && (
                <Badge variant="outline" className="text-[10px]">+{selected.length - 3}</Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs shrink-0"
              onClick={() => onChange([])}
            >
              <X className="h-3 w-3" />
              Pulisci
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
