import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useVehicleMakes,
  useVehicleModels,
  useAddMarca,
  useAddModello,
} from "@/hooks/useVehicleLookup";

interface ComboboxBaseProps {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function VehicleCombobox({
  value,
  onValueChange,
  options,
  isLoading,
  onAddNew,
  isAdding,
  placeholder,
  disabled,
  className,
  emptyText,
}: ComboboxBaseProps & {
  options: { value: string; label: string }[];
  isLoading: boolean;
  onAddNew: (nome: string) => Promise<string>;
  isAdding: boolean;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const upperSearch = search.toUpperCase().trim();
  const exactMatch = options.find((o) => o.value === upperSearch);
  const showAdd = upperSearch.length > 0 && !exactMatch && !isAdding;

  const handleAdd = async () => {
    if (!upperSearch) return;
    try {
      const nuovo = await onAddNew(upperSearch);
      onValueChange(nuovo);
      setSearch("");
      setOpen(false);
      toast.success(`Aggiunto: ${nuovo}`);
    } catch (e: any) {
      toast.error("Errore aggiunta: " + (e?.message || "sconosciuto"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{value || placeholder || "Seleziona..."}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Cerca o digita per aggiungere..."
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3 w-3",
                          value === opt.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {showAdd && (
                  <CommandGroup>
                    <CommandItem
                      value={`__add__${upperSearch}`}
                      onSelect={handleAdd}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Aggiungi: «{upperSearch}»
                    </CommandItem>
                  </CommandGroup>
                )}
                {isAdding && (
                  <div className="py-2 flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function MarcaCombobox(props: ComboboxBaseProps) {
  const { data: options = [], isLoading } = useVehicleMakes();
  const addMarca = useAddMarca();
  return (
    <VehicleCombobox
      {...props}
      options={options}
      isLoading={isLoading}
      isAdding={addMarca.isPending}
      onAddNew={(nome) => addMarca.mutateAsync(nome)}
      emptyText="Nessuna marca trovata"
      placeholder={props.placeholder || "Cerca marca..."}
    />
  );
}

interface ModelloProps extends ComboboxBaseProps {
  marca: string;
}

export function ModelloCombobox({ marca, ...props }: ModelloProps) {
  const { data: options = [], isLoading } = useVehicleModels(marca);
  const addModello = useAddModello();
  return (
    <VehicleCombobox
      {...props}
      options={options}
      isLoading={isLoading}
      isAdding={addModello.isPending}
      onAddNew={(nome) => addModello.mutateAsync({ marcaNome: marca, nome })}
      emptyText={marca ? "Nessun modello — digita per aggiungere" : "Seleziona prima la marca"}
      placeholder={props.placeholder || "Cerca modello..."}
      disabled={props.disabled || !marca}
    />
  );
}
