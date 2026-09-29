import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { format, startOfYear } from "date-fns";

export interface CfoFilters {
  dataDa: Date;
  dataA: Date;
  ufficioId: string | null;
  compagniaId: string | null;
}

export interface CfoRpcParams {
  _data_da?: string;
  _data_a?: string;
  _ufficio_id?: string;
  _compagnia_id?: string;
  [key: string]: unknown;
}

function defaultFilters(): CfoFilters {
  const now = new Date();
  return {
    dataDa: startOfYear(now),
    dataA: now,
    ufficioId: null,
    compagniaId: null,
  };
}

export function filtersToRpcParams(filters: CfoFilters): CfoRpcParams {
  const params: CfoRpcParams = {
    _data_da: format(filters.dataDa, "yyyy-MM-dd"),
    _data_a: format(filters.dataA, "yyyy-MM-dd"),
  };
  if (filters.ufficioId) params._ufficio_id = filters.ufficioId;
  if (filters.compagniaId) params._compagnia_id = filters.compagniaId;
  return params;
}

export function filtersToAiPayload(filters: CfoFilters) {
  return {
    data_da: format(filters.dataDa, "yyyy-MM-dd"),
    data_a: format(filters.dataA, "yyyy-MM-dd"),
    ufficio_id: filters.ufficioId,
    compagnia_id: filters.compagniaId,
  };
}

interface CfoFiltersContextValue {
  filters: CfoFilters;
  setFilters: (patch: Partial<CfoFilters>) => void;
  resetFilters: () => void;
  rpcParams: CfoRpcParams;
  aiFilters: ReturnType<typeof filtersToAiPayload>;
}

const CfoFiltersContext = createContext<CfoFiltersContextValue | null>(null);

export function CfoFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<CfoFilters>(defaultFilters);

  const value = useMemo<CfoFiltersContextValue>(() => {
    const setFilters = (patch: Partial<CfoFilters>) =>
      setFiltersState((prev) => ({ ...prev, ...patch }));
    return {
      filters,
      setFilters,
      resetFilters: () => setFiltersState(defaultFilters()),
      rpcParams: filtersToRpcParams(filters),
      aiFilters: filtersToAiPayload(filters),
    };
  }, [filters]);

  return <CfoFiltersContext.Provider value={value}>{children}</CfoFiltersContext.Provider>;
}

export function useCfoFilters() {
  const ctx = useContext(CfoFiltersContext);
  if (!ctx) throw new Error("useCfoFilters deve essere usato dentro CfoFiltersProvider");
  return ctx;
}
