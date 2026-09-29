import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";
import { useCfoFilters } from "@/hooks/useCfoFilters";

export function CfoGlobalFilters() {
  const { filters, setFilters, resetFilters } = useCfoFilters();

  const { data: uffici = [] } = useQuery({
    queryKey: ["cfo-uffici"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
      return data ?? [];
    },
  });

  const { data: compagnie = [] } = useQuery({
    queryKey: ["cfo-compagnie"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome")
        .eq("attiva", true)
        .order("nome");
      return data ?? [];
    },
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Dal</Label>
        <DatePicker
          value={filters.dataDa}
          onChange={(d) => d && setFilters({ dataDa: d })}
          placeholder="Data inizio"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Al</Label>
        <DatePicker
          value={filters.dataA}
          onChange={(d) => d && setFilters({ dataA: d })}
          placeholder="Data fine"
        />
      </div>
      <div className="space-y-1 min-w-[180px]">
        <Label className="text-xs text-muted-foreground">Sede</Label>
        <SearchableSelect
          options={uffici.map((u) => ({ value: u.id, label: u.nome_ufficio }))}
          value={filters.ufficioId ?? ""}
          onValueChange={(v) => setFilters({ ufficioId: v || null })}
          placeholder="Tutte le sedi"
          clearable
          clearLabel="Tutte le sedi"
        />
      </div>
      <div className="space-y-1 min-w-[200px]">
        <Label className="text-xs text-muted-foreground">Compagnia</Label>
        <SearchableSelect
          options={compagnie.map((c) => ({ value: c.id, label: c.nome }))}
          value={filters.compagniaId ?? ""}
          onValueChange={(v) => setFilters({ compagniaId: v || null })}
          placeholder="Tutte"
          clearable
          clearLabel="Tutte"
        />
      </div>
      <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
