import { useMemo } from "react";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { useGruppiRamo, useRamiAll } from "@/hooks/useRamiLookup";
import { cn } from "@/lib/utils";

interface Props {
  gruppoRamoId: string | null;
  ramoId: string | null;
  onChange: (next: { gruppoRamoId: string | null; ramoId: string | null }) => void;
  className?: string;
  /** When true, render in a single row of two selects. Default true. */
  inline?: boolean;
}

/**
 * Filter variant: both fields optional, "Tutti" option, gruppo filters sottorami.
 * Selecting only the gruppo is meaningful: callers should expand to ramo_id IN (...).
 */
export function RamoSottoramoFilter({ gruppoRamoId, ramoId, onChange, className, inline = true }: Props) {
  const { data: gruppi = [] } = useGruppiRamo();
  const { data: rami = [] } = useRamiAll();

  const sottorami = useMemo(
    () => (gruppoRamoId ? rami.filter((r) => r.gruppo_ramo_id === gruppoRamoId) : rami),
    [rami, gruppoRamoId],
  );

  const handleGruppo = (g: string | null) => {
    if (ramoId) {
      const cur = rami.find((r) => r.value === ramoId);
      if (cur && cur.gruppo_ramo_id !== g) {
        onChange({ gruppoRamoId: g, ramoId: null });
        return;
      }
    }
    onChange({ gruppoRamoId: g, ramoId });
  };

  const handleRamo = (r: string | null) => {
    if (!r) {
      onChange({ gruppoRamoId, ramoId: null });
      return;
    }
    const ramo = rami.find((x) => x.value === r);
    onChange({ gruppoRamoId: ramo?.gruppo_ramo_id || gruppoRamoId, ramoId: r });
  };

  return (
    <div className={cn(inline ? "flex flex-wrap gap-2" : "grid gap-2", className)}>
      <FilterSearchableSelect
        value={gruppoRamoId}
        onValueChange={handleGruppo}
        options={gruppi}
        placeholder="Gruppo Ramo"
        allLabel="Tutti i rami"
      />
      <FilterSearchableSelect
        value={ramoId}
        onValueChange={handleRamo}
        options={sottorami}
        placeholder="Garanzia"
        allLabel={gruppoRamoId ? "Tutte le garanzie del gruppo" : "Tutte le garanzie"}
      />
    </div>
  );
}

/** Helper: expand a (gruppoRamoId, ramoId) filter pair to a list of ramo_id to filter by. */
export function expandRamoFilter(
  gruppoRamoId: string | null,
  ramoId: string | null,
  rami: { value: string; gruppo_ramo_id: string | null }[],
): { ramoIds: string[] | null } {
  if (ramoId) return { ramoIds: [ramoId] };
  if (gruppoRamoId) return { ramoIds: rami.filter((r) => r.gruppo_ramo_id === gruppoRamoId).map((r) => r.value) };
  return { ramoIds: null };
}
