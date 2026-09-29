import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type FilterMultiOption = { value: string; label: string };

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  options: FilterMultiOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allLabel?: string;
  className?: string;
  disabled?: boolean;
}

/** Filtro generico multi-selezione (popover + ricerca). `value=[]` = tutti. */
export function FilterMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Tutti",
  searchPlaceholder = "Cerca…",
  emptyLabel = "Nessun risultato",
  allLabel,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const allText = allLabel || placeholder;

  const selected = useMemo(() => {
    const set = new Set(value);
    return options.filter((o) => set.has(o.value));
  }, [options, value]);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };

  const label =
    value.length === 0
      ? allText
      : value.length === 1
        ? selected[0]?.label || "1 selezionato"
        : `${value.length} selezionati`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-9 w-full justify-between bg-background font-normal", className)}
        >
          <span className="truncate text-left">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,var(--radix-popover-trigger-width))] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => onChange([])} className="gap-2">
                <Check className={cn("h-4 w-4", value.length === 0 ? "opacity-100" : "opacity-0")} />
                {allText}
              </CommandItem>
              {options.length > 1 && (
                <CommandItem
                  value="__select_all__"
                  onSelect={() => onChange(options.map((o) => o.value))}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value.length > 0 && value.length === options.length ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Seleziona tutti
                </CommandItem>
              )}
              {options.map((o) => {
                const checked = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                    className="gap-2"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" aria-hidden />
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
            <div className="flex flex-wrap gap-1 min-w-0">
              {selected.slice(0, 2).map((o) => (
                <Badge key={o.value} variant="secondary" className="text-[10px] font-normal max-w-[100px] truncate">
                  {o.label}
                </Badge>
              ))}
              {selected.length > 2 && (
                <Badge variant="outline" className="text-[10px]">+{selected.length - 2}</Badge>
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
