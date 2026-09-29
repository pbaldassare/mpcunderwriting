import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Loader2, Network, Percent } from "lucide-react";
import ProvvigioniRapportiTab from "./ProvvigioniRapportiTab";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compagniaId: string | null;
  compagniaNome: string;
  onOpenRapporti?: () => void;
}

export default function ProvvigioniCompagniaDialog({
  open,
  onOpenChange,
  compagniaId,
  compagniaNome,
  onOpenRapporti,
}: Props) {
  const [selectedRapportoId, setSelectedRapportoId] = useState<string>("");

  const { data: rapporti = [], isLoading } = useQuery({
    queryKey: ["compagnia-rapporti-attivi", compagniaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compagnia_rapporti")
        .select("id, nome_rapporto, tipo_rapporto, gruppo_compagnia_id, gruppi_compagnia(descrizione)")
        .eq("compagnia_id", compagniaId!)
        .eq("attivo", true)
        .order("nome_rapporto");
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) return [] as any[];
      const ids = rows.map((r: any) => r.id);
      const { data: prov } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("compagnia_rapporto_id")
        .in("compagnia_rapporto_id", ids)
        .eq("attiva", true);
      const counts = new Map<string, number>();
      (prov || []).forEach((p: any) => {
        counts.set(p.compagnia_rapporto_id, (counts.get(p.compagnia_rapporto_id) || 0) + 1);
      });
      return rows.map((r: any) => ({ ...r, righe_provvigioni: counts.get(r.id) || 0 }));
    },
    enabled: !!compagniaId && open,
  });

  // Auto-select primo rapporto al cambio agenzia / al primo load
  useEffect(() => {
    if (!open) return;
    if (rapporti.length === 0) {
      setSelectedRapportoId("");
      return;
    }
    if (!rapporti.find((r: any) => r.id === selectedRapportoId)) {
      setSelectedRapportoId(rapporti[0].id);
    }
  }, [open, rapporti, selectedRapportoId]);

  const useTabs = rapporti.length > 1 && rapporti.length <= 4;
  const useSelect = rapporti.length > 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Percent className="w-5 h-5 text-primary" />
            Provvigioni — {compagniaNome}
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {rapporti.length} {rapporti.length === 1 ? "rapporto attivo" : "rapporti attivi"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento rapporti…
            </div>
          ) : rapporti.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 border-2 border-dashed border-border rounded-lg bg-muted/20">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Network className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center space-y-1 max-w-md">
                <p className="font-semibold text-foreground">Nessun rapporto configurato</p>
                <p className="text-sm text-muted-foreground">
                  Le provvigioni si gestiscono per ogni <strong>rapporto compagnia</strong>. Aggiungi
                  almeno un rapporto a questa agenzia per poter impostare le aliquote per ramo.
                </p>
              </div>
              {onOpenRapporti && (
                <Button variant="default" onClick={onOpenRapporti}>
                  <Network className="w-4 h-4 mr-2" /> Apri Rapporti
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {useTabs && (
                <div className="flex flex-wrap gap-1.5 pb-2 border-b">
                  {rapporti.map((r: any) => {
                    const active = r.id === selectedRapportoId;
                    const sub = r.gruppi_compagnia?.descrizione;
                    const n = r.righe_provvigioni || 0;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRapportoId(r.id)}
                        className={
                          "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 " +
                          (active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-foreground border-border hover:bg-muted")
                        }
                      >
                        <span>{r.nome_rapporto}</span>
                        {sub && <span className="opacity-70">· {sub}</span>}
                        <span
                          className={
                            "ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold " +
                            (n > 0
                              ? active ? "bg-primary-foreground/20" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : active ? "bg-primary-foreground/20" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")
                          }
                        >
                          {n > 0 ? `✓ ${n}` : "vuoto"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {useSelect && (
                <div className="max-w-md">
                  <SearchableSelect
                    options={rapporti.map((r: any) => ({
                      value: r.id,
                      label: `${r.nome_rapporto}${r.gruppi_compagnia?.descrizione ? ` · ${r.gruppi_compagnia.descrizione}` : ""} ${r.righe_provvigioni > 0 ? `· ✓ ${r.righe_provvigioni}` : "· vuoto"}`,
                    }))}
                    value={selectedRapportoId}
                    onValueChange={setSelectedRapportoId}
                    placeholder="Seleziona rapporto…"
                  />
                </div>
              )}
              {rapporti.length === 1 && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>
                    Rapporto: <span className="font-medium text-foreground">{rapporti[0].nome_rapporto}</span>
                    {rapporti[0].gruppi_compagnia?.descrizione && (
                      <span className="opacity-70"> · {rapporti[0].gruppi_compagnia.descrizione}</span>
                    )}
                  </span>
                  <span
                    className={
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold " +
                      ((rapporti[0].righe_provvigioni || 0) > 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")
                    }
                  >
                    {(rapporti[0].righe_provvigioni || 0) > 0 ? `✓ Configurato (${rapporti[0].righe_provvigioni} righe)` : "Vuoto — da configurare"}
                  </span>
                </div>
              )}

              {selectedRapportoId && (
                <ProvvigioniRapportiTab key={selectedRapportoId} fixedRapportoId={selectedRapportoId} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
