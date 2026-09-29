import { useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useGruppiRamo, useRamiAll } from "@/hooks/useRamiLookup";
import { cn } from "@/lib/utils";

interface Props {
  /** Selected gruppo_ramo id (optional in state — if missing it is auto-derived from ramoId). */
  gruppoRamoId: string | null | undefined;
  /** Selected ramo (sottoramo) id. This is what is persisted on titoli/trattative. */
  ramoId: string | null | undefined;
  onChange: (next: { gruppoRamoId: string | null; ramoId: string | null }) => void;
  disabled?: boolean;
  /** "row" = side-by-side (default), "stacked" = vertical. */
  layout?: "row" | "stacked";
  required?: boolean;
  /** Show only the sottoramo input when gruppo is missing (default true: show both). */
  hideLabels?: boolean;
  /** Show only the Ramo (gruppo) select; sottoramo si compone nelle righe garanzia. */
  gruppoOnly?: boolean;
}

export function RamoSottoramoSelect({
  gruppoRamoId,
  ramoId,
  onChange,
  disabled,
  layout = "row",
  required,
  hideLabels,
  gruppoOnly,
}: Props) {
  const { data: gruppi = [] } = useGruppiRamo();
  const { data: rami = [] } = useRamiAll();

  // Auto-derive gruppo from ramoId if it's missing or out of sync
  const effectiveGruppo = useMemo(() => {
    if (gruppoRamoId) return gruppoRamoId;
    if (ramoId) return rami.find((r) => r.value === ramoId)?.gruppo_ramo_id || null;
    return null;
  }, [gruppoRamoId, ramoId, rami]);

  useEffect(() => {
    // Sync up: if state's gruppoRamoId is empty but ramoId implies one, push it back
    if (!gruppoRamoId && ramoId) {
      const derived = rami.find((r) => r.value === ramoId)?.gruppo_ramo_id || null;
      if (derived) onChange({ gruppoRamoId: derived, ramoId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ramoId, rami.length]);

  const sottorami = useMemo(
    () => (effectiveGruppo ? rami.filter((r) => r.gruppo_ramo_id === effectiveGruppo) : rami),
    [rami, effectiveGruppo],
  );

  const handleGruppoChange = (newGruppo: string) => {
    const g = newGruppo || null;
    if (ramoId) {
      const currentRamo = rami.find((r) => r.value === ramoId);
      if (currentRamo && currentRamo.gruppo_ramo_id !== g) {
        onChange({ gruppoRamoId: g, ramoId: null });
        return;
      }
    }
    onChange({ gruppoRamoId: g, ramoId: ramoId || null });
  };

  const handleRamoChange = (newRamo: string) => {
    const r = newRamo || null;
    if (!r) {
      onChange({ gruppoRamoId: effectiveGruppo, ramoId: null });
      return;
    }
    const ramo = rami.find((x) => x.value === r);
    onChange({
      gruppoRamoId: ramo?.gruppo_ramo_id || effectiveGruppo,
      ramoId: r,
    });
  };

  return (
    <div className={cn("grid gap-3", !gruppoOnly && layout === "row" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
      <div>
        {!hideLabels && (
          <Label className="text-xs">
            Gruppo Ramo {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <SearchableSelect
          options={gruppi}
          value={effectiveGruppo || ""}
          onValueChange={handleGruppoChange}
          placeholder="— Seleziona ramo —"
          disabled={disabled}
        />
      </div>
      {!gruppoOnly && (
        <div>
          {!hideLabels && (
            <Label className="text-xs">
              Garanzia {required && <span className="text-destructive">*</span>}
            </Label>
          )}
          <SearchableSelect
            options={sottorami}
            value={ramoId || ""}
            onValueChange={handleRamoChange}
            placeholder={effectiveGruppo ? "— Seleziona garanzia —" : "— Seleziona ramo prima —"}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
