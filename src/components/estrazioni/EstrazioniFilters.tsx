import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown, Filter, RotateCcw } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";

export interface EstrazioniFiltersState {
  period: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  ufficio_id: string | null;
  produttore_id: string | null;
  compagnia_id: string | null;
  cliente_id: string | null;
}

interface EstrazioniFiltersProps {
  filters: EstrazioniFiltersState;
  onChange: (filters: EstrazioniFiltersState) => void;
  showUfficio?: boolean;
  showProduttore?: boolean;
  showCompagnia?: boolean;
  showCliente?: boolean;
  /** Se valorizzato, forza la sede e nasconde "Tutte le sedi" (utenti sede). */
  lockUfficioId?: string | null;
}

export const defaultFilters: EstrazioniFiltersState = {
  period: "all",
  dateFrom: null,
  dateTo: null,
  ufficio_id: null,
  produttore_id: null,
  compagnia_id: null,
  cliente_id: null,
};

export function getDateRange(period: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (period) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_3_months":
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case "last_6_months":
      return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "all":
      return { from: null, to: null };
    default:
      return { from: null, to: null };
  }
}

// Searchable Combobox component
function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  allLabel,
  className,
}: {
  value: string | null;
  onValueChange: (val: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label || placeholder
    : allLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between bg-background font-normal", className)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cerca ${placeholder.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Nessun risultato</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                {allLabel}
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const EstrazioniFilters = ({
  filters,
  onChange,
  showUfficio = true,
  showProduttore = false,
  showCompagnia = false,
  showCliente = false,
  lockUfficioId = null,
}: EstrazioniFiltersProps) => {
  const ufficioLocked = !!lockUfficioId;
  const { data: uffici } = useQuery({
    queryKey: ["uffici-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
    enabled: showUfficio,
  });

  const { data: produttori } = useQuery({
    queryKey: ["produttori-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    },
    enabled: showProduttore,
  });

  const { data: compagnie } = useQuery({
    queryKey: ["agenzie-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
    enabled: showCompagnia,
  });

  const handlePeriodChange = (val: string) => {
    if (val === "custom") {
      onChange({ ...filters, period: val });
    } else {
      const range = getDateRange(val);
      onChange({ ...filters, period: val, dateFrom: range.from, dateTo: range.to });
    }
  };

  const isCustom = filters.period === "custom";
  const hasFilters =
    filters.period !== "all" ||
    (!ufficioLocked && filters.ufficio_id) ||
    filters.produttore_id ||
    filters.compagnia_id ||
    filters.cliente_id;

  const handleReset = () => {
    onChange({
      ...defaultFilters,
      ufficio_id: ufficioLocked ? lockUfficioId : null,
    });
  };

  const ufficiOptions = (uffici || [])
    .filter((u) => !ufficioLocked || u.id === lockUfficioId)
    .map((u) => ({ value: u.id, label: u.nome_ufficio }));

  return (
    <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filtri</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" /> Azzera
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Periodo */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutto</SelectItem>
            <SelectItem value="this_month">Questo mese</SelectItem>
            <SelectItem value="last_3_months">Ultimi 3 mesi</SelectItem>
            <SelectItem value="last_6_months">Ultimi 6 mesi</SelectItem>
            <SelectItem value="this_year">Quest'anno</SelectItem>
            <SelectItem value="custom">Personalizzato</SelectItem>
          </SelectContent>
        </Select>

        {/* Date personalizzate */}
        {isCustom && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Da"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.dateFrom || undefined} onSelect={(d) => onChange({ ...filters, dateFrom: d || null })} className="p-3 pointer-events-auto" locale={it} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "A"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filters.dateTo || undefined} onSelect={(d) => onChange({ ...filters, dateTo: d || null })} className="p-3 pointer-events-auto" locale={it} />
              </PopoverContent>
            </Popover>
          </>
        )}

        {/* Ufficio */}
        {showUfficio && (
          ufficioLocked ? (
            <Button
              variant="outline"
              disabled
              className="w-[200px] justify-between bg-background font-normal opacity-100"
              title="Sede bloccata sul tuo profilo"
            >
              <span className="truncate">
                {ufficiOptions.find((o) => o.value === lockUfficioId)?.label || "La tua sede"}
              </span>
            </Button>
          ) : (
            <SearchableSelect
              value={filters.ufficio_id}
              onValueChange={(v) => onChange({ ...filters, ufficio_id: v })}
              options={ufficiOptions}
              placeholder="Sede"
              allLabel="Tutte le sedi"
              className="w-[200px]"
            />
          )
        )}

        {/* Produttore */}
        {showProduttore && (
          <SearchableSelect
            value={filters.produttore_id}
            onValueChange={(v) => onChange({ ...filters, produttore_id: v })}
            options={(produttori || []).map((p) => ({ value: p.id, label: `${p.cognome || ""} ${p.nome || ""}`.trim() }))}
            placeholder="Produttore"
            allLabel="Tutti i produttori"
            className="w-[220px]"
          />
        )}

        {/* Agenzia */}
        {showCompagnia && (
          <SearchableSelect
            value={filters.compagnia_id}
            onValueChange={(v) => onChange({ ...filters, compagnia_id: v })}
            options={(compagnie || []).map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Agenzia"
            allLabel="Tutte le agenzie"
            className="w-[220px]"
          />
        )}

        {/* Cliente */}
        {showCliente && (
          <ClienteSearchSelect
            value={filters.cliente_id || ""}
            onValueChange={(v) => onChange({ ...filters, cliente_id: v || null })}
            placeholder="Cliente"
            searchPlaceholder="Nome, più nomi, indirizzo…"
            clearable
            clearLabel="Tutti i clienti"
            className="w-[240px]"
          />
        )}
      </div>
    </div>
  );
};

export default EstrazioniFilters;
