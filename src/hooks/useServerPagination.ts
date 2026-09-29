import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Hook standardizzato per la paginazione server-side (Supabase `.range(from, to)`).
 * Sostituisce i pattern duplicati `const PAGE_SIZE = 25; const [page, setPage] = useState(0)`
 * presenti nelle pagine che usano `<ServerPagination>`.
 *
 * Uso tipico:
 *   const { page, setPage, pageSize, range, resetPage } = useServerPagination(25, [search, filtri]);
 *   const { data } = useQuery({
 *     queryKey: ["foo", page, search],
 *     queryFn: () => supabase.from("...").range(range.from, range.to),
 *   });
 *   <ServerPagination page={page} pageSize={pageSize} totalCount={count} onPageChange={setPage} />
 *
 * @param pageSize Default 25 (memory: server-side pagination limit 25)
 * @param resetDeps Dipendenze che resettano automaticamente la pagina a 0 quando cambiano
 */
export function useServerPagination(pageSize: number = 25, resetDeps: ReadonlyArray<unknown> = []) {
  const [page, setPage] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, resetDeps);

  const range = useMemo(
    () => ({ from: page * pageSize, to: (page + 1) * pageSize - 1 }),
    [page, pageSize]
  );

  const resetPage = useCallback(() => setPage(0), []);

  return { page, setPage, pageSize, range, resetPage };
}
