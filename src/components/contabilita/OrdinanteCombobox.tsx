import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { popoverMatchTriggerWidthClass } from "@/components/SearchableSelect";
import { fetchOrdinantiSuggeriti } from "@/lib/ordinantiBancari";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

/**
 * Ordinante = nome sul bonifico (non il cliente).
 * Lista da movimenti già caricati + possibilità di digitare un valore nuovo.
 */
export function OrdinanteCombobox({
  value,
  onChange,
  className,
  placeholder = "Cerca o digita ordinante…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: suggeriti = [] } = useQuery({
    queryKey: ["ordinanti-suggeriti", debounced],
    queryFn: () => fetchOrdinantiSuggeriti({ search: debounced, limit: 60 }),
    staleTime: 30_000,
  });

  const trimmed = search.trim();
  const exactInList = useMemo(
    () => suggeriti.some((o) => o.toLowerCase() === trimmed.toLowerCase()),
    [suggeriti, trimmed],
  );
  const showCreate = trimmed.length >= 2 && !exactInList;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={popoverMatchTriggerWidthClass} align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Filtra lista o digita nuovo…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmed.length < 2
                ? "Digita almeno 2 caratteri o scegli dalla lista."
                : "Nessun ordinante in elenco — usa «Usa questo valore»."}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="text-muted-foreground italic">— Nessuno —</span>
                </CommandItem>
              )}
              {showCreate && (
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => {
                    onChange(trimmed);
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span>
                    Usa questo valore: <strong>{trimmed}</strong>
                  </span>
                </CommandItem>
              )}
              {suggeriti.map((o) => (
                <CommandItem
                  key={o}
                  value={o}
                  onSelect={() => {
                    onChange(o);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
