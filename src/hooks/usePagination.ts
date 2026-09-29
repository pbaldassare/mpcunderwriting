import { useMemo, useState, useCallback } from "react";

/**
 * Hook standardizzato per la paginazione client-side.
 * - Riusa il PAGE_SIZE di default = 25 (memory: server-side pagination limit 25).
 * - Espone helper per resettare a pagina 0 quando cambiano i filtri.
 *
 * Uso tipico:
 *   const { page, setPage, pageRows, pages, resetPage } = usePagination(filteredRows);
 *   <Filters onChange={(f) => { setFilters(f); resetPage(); }} />
 */
export function usePagination<T>(rows: T[], pageSize: number = 25) {
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pages - 1);

  const pageRows = useMemo(
    () => rows.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [rows, safePage, pageSize]
  );

  const resetPage = useCallback(() => setPage(0), []);

  return {
    page: safePage,
    setPage,
    resetPage,
    pages,
    pageSize,
    pageRows,
    total: rows.length,
  };
}
