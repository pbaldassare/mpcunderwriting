import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchableSelectItemClass } from "@/components/SearchableSelect";

interface FilterOption {
  value: string;
  label: string;
  /** Testo secondario mostrato sotto il label (es. codice agenzia) */
  description?: string;
  /** Testo usato per la ricerca; se omesso usa label + description */
  searchText?: string;
}

interface FilterSearchableSelectProps {
  value: string | null;
  onValueChange: (v: string | null) => void;
  options: FilterOption[];
  placeholder: string;
  allLabel: string;
  className?: string;
  loading?: boolean;
}

export function FilterSearchableSelect({ value, onValueChange, options, placeholder, allLabel, className, loading }: FilterSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? options.find((o) => o.value === value)?.label || placeholder : allLabel;

  return (
    <Popover open={open && !loading} onOpenChange={(o) => !loading && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={loading} className={cn("justify-between bg-background font-normal", className)}>
          <span className={cn("truncate", loading && "text-muted-foreground/70")}>{loading ? "Caricamento..." : selectedLabel}</span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-70" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cerca ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" className={searchableSelectItemClass} onSelect={() => { onValueChange(null); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} /> {allLabel}
              </CommandItem>
              {options.map((opt) => {
                const searchValue = opt.searchText || [opt.label, opt.description].filter(Boolean).join(" ");
                return (
                  <CommandItem
                    key={opt.value}
                    value={searchValue}
                    className={searchableSelectItemClass}
                    onSelect={() => { onValueChange(opt.value); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[11px] text-muted-foreground font-mono">{opt.description}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
