import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { RcaPageHeader, RcaSegmented, RcaToolbar } from "@/components/rca/RcaPageChrome";
import { RcaVeicoliTable } from "@/components/rca/RcaVeicoliTable";
import { fetchRcaClientela } from "@/lib/rca/fetchClientela";
import { filterRcaClientelaRows, type RcaClientelaFiltroTipo } from "@/lib/rca/clientela";
import { filterRcaScadenze, sortRcaByScadenza, type FinestraScadenzaRca } from "@/lib/rca/scadenze";

const FILTRI_TIPO: { value: RcaClientelaFiltroTipo; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "auto", label: "Auto" },
  { value: "autocarro", label: "Autocarro" },
];

const FINESTRE: { value: FinestraScadenzaRca; label: string }[] = [
  { value: "scadute", label: "Scadute" },
  { value: "30", label: "30 giorni" },
  { value: "60", label: "60 giorni" },
  { value: "90", label: "90 giorni" },
  { value: "tutte", label: "Tutte" },
];

export default function RcaScadenzePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tipo, setTipo] = useState<RcaClientelaFiltroTipo>("tutti");
  const [finestra, setFinestra] = useState<FinestraScadenzaRca>("30");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced, tipo, finestra]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-clientela"],
    queryFn: fetchRcaClientela,
  });

  const filtered = useMemo(() => {
    const byTipo = filterRcaClientelaRows(data, { search: debounced, tipo });
    return sortRcaByScadenza(filterRcaScadenze(byTipo, { finestra, today }));
  }, [data, debounced, tipo, finestra, today]);
  const pageRows = filtered.slice(range.from, range.to + 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title="Scadenze RCA"
        subtitle="Coda di rinnovo: prima le scadenze più vicine. Da qui parti con la preventivazione."
      />

      <RcaToolbar search={search} onSearch={setSearch} count={filtered.length}>
        <RcaSegmented label="Periodo" value={finestra} options={FINESTRE} onChange={setFinestra} />
        <RcaSegmented label="Tipo veicolo" value={tipo} options={FILTRI_TIPO} onChange={setTipo} />
      </RcaToolbar>

      <RcaVeicoliTable
        rows={pageRows}
        isLoading={isLoading}
        today={today}
        emptyText="Nessuna scadenza in questa finestra"
      />

      <ServerPagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
