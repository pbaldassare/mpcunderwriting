import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { X } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";

export interface ProvvigioniFilters {
  da: string;
  a: string;
  ramoId: string | null;
  compagniaId: string | null;
  produttoreId: string | null;
  clienteId: string | null;
  tipoDestinatario: string | null;
  search: string;
}

interface Option { value: string; label: string }

interface Props {
  filters: ProvvigioniFilters;
  onChange: (f: ProvvigioniFilters) => void;
  rami?: Option[];
  compagnie?: Option[];
  produttori?: Option[];
  clienti?: Option[];
  showTipo?: boolean;
  showSearch?: boolean;
  loadingRami?: boolean;
  loadingCompagnie?: boolean;
  loadingProduttori?: boolean;
  loadingClienti?: boolean;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export const defaultFilters = (): ProvvigioniFilters => ({
  da: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  a: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  ramoId: null,
  compagniaId: null,
  produttoreId: null,
  clienteId: null,
  tipoDestinatario: null,
  search: "",
});

export const ProvvigioniFiltersBar = ({
  filters, onChange, rami = [], compagnie = [], produttori = [], clienti = [],
  showTipo = false, showSearch = true,
  loadingRami, loadingCompagnie, loadingProduttori, loadingClienti,
}: Props) => {
  const set = (patch: Partial<ProvvigioniFilters>) => onChange({ ...filters, ...patch });

  const presets = [
    { label: "Mese corrente", da: format(startOfMonth(new Date()), "yyyy-MM-dd"), a: format(endOfMonth(new Date()), "yyyy-MM-dd") },
    { label: "Mese scorso", da: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), a: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") },
    { label: "Ultimi 3 mesi", da: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"), a: today() },
    { label: "Anno", da: format(startOfYear(new Date()), "yyyy-MM-dd"), a: format(endOfYear(new Date()), "yyyy-MM-dd") },
  ];

  const hasFilters = filters.ramoId || filters.compagniaId || filters.produttoreId || filters.clienteId || filters.tipoDestinatario || filters.search;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Da</Label>
          <Input type="date" value={filters.da} onChange={(e) => set({ da: e.target.value })} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">A</Label>
          <Input type="date" value={filters.a} onChange={(e) => set({ a: e.target.value })} className="h-9 w-[150px]" />
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button key={p.label} variant="outline" size="sm" className="h-9" onClick={() => set({ da: p.da, a: p.a })}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {(rami.length > 0 || loadingRami) && (
          <div className="space-y-1">
            <Label className="text-xs">Ramo</Label>
            <FilterSearchableSelect value={filters.ramoId} onValueChange={(v) => set({ ramoId: v })} options={rami} placeholder="Ramo" allLabel="Tutti i rami" className="w-[200px] h-9" loading={loadingRami} />
          </div>
        )}
        {(compagnie.length > 0 || loadingCompagnie) && (
          <div className="space-y-1">
            <Label className="text-xs">Compagnia</Label>
            <FilterSearchableSelect value={filters.compagniaId} onValueChange={(v) => set({ compagniaId: v })} options={compagnie} placeholder="Compagnia" allLabel="Tutte" className="w-[200px] h-9" loading={loadingCompagnie} />
          </div>
        )}
        {(produttori.length > 0 || loadingProduttori) && (
          <div className="space-y-1">
            <Label className="text-xs">Produttore</Label>
            <FilterSearchableSelect value={filters.produttoreId} onValueChange={(v) => set({ produttoreId: v })} options={produttori} placeholder="Produttore" allLabel="Tutti" className="w-[220px] h-9" loading={loadingProduttori} />
          </div>
        )}
        {(clienti.length > 0 || loadingClienti) && (
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <FilterSearchableSelect value={filters.clienteId} onValueChange={(v) => set({ clienteId: v })} options={clienti} placeholder="Cliente" allLabel="Tutti" className="w-[220px] h-9" loading={loadingClienti} />
          </div>
        )}
        {showTipo && (
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <FilterSearchableSelect
              value={filters.tipoDestinatario}
              onValueChange={(v) => set({ tipoDestinatario: v })}
              options={[
                { value: "admin", label: "Consulbrokers SPA" },
                { value: "commerciale", label: "Produttore" },
                { value: "ae", label: "Account Executive" },
                { value: "sede", label: "Sede" },
                { value: "consul", label: "Consul (legacy)" },
              ]}

              placeholder="Tipo"
              allLabel="Tutti i tipi"
              className="w-[200px] h-9"
            />
          </div>
        )}
        {showSearch && (
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Cerca</Label>
            <Input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="N° polizza, cliente..." className="h-9" />
          </div>
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange({ ...defaultFilters(), da: filters.da, a: filters.a })}>
            <X className="h-4 w-4 mr-1" /> Reset
          </Button>
        )}
      </div>
    </div>
  );
};
