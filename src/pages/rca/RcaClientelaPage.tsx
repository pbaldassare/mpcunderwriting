import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { RcaPageHeader, RcaSegmented, RcaToolbar } from "@/components/rca/RcaPageChrome";
import { RcaVeicoliTable } from "@/components/rca/RcaVeicoliTable";
import { fetchRcaClientela } from "@/lib/rca/fetchClientela";
import { filterRcaClientelaRows, type RcaClientelaFiltroTipo } from "@/lib/rca/clientela";
import { sortRcaByScadenza } from "@/lib/rca/scadenze";

const FILTRI_TIPO: { value: RcaClientelaFiltroTipo; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "auto", label: "Auto" },
  { value: "autocarro", label: "Autocarro" },
];

const FILTRI_ORDINE: { value: "cliente" | "scadenza"; label: string }[] = [
  { value: "cliente", label: "Cliente" },
  { value: "scadenza", label: "Scadenza" },
];

export default function RcaClientelaPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tipo, setTipo] = useState<RcaClientelaFiltroTipo>("tutti");
  const [sortBy, setSortBy] = useState<"cliente" | "scadenza">("cliente");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced, tipo, sortBy]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-clientela"],
    queryFn: fetchRcaClientela,
  });

  const filtered = useMemo(() => {
    const base = filterRcaClientelaRows(data, { search: debounced, tipo });
    return sortBy === "scadenza" ? sortRcaByScadenza(base) : base;
  }, [data, debounced, tipo, sortBy]);
  const pageRows = filtered.slice(range.from, range.to + 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title="Clientela RCA"
        subtitle="Clienti con auto o autocarro: targa, nominativo e scadenza polizza."
        actions={
          <Button type="button" variant="outline" onClick={() => navigate("/rca/scadenze")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Apri scadenze
          </Button>
        }
      />

      <RcaToolbar search={search} onSearch={setSearch} count={filtered.length}>
        <RcaSegmented label="Tipo veicolo" value={tipo} options={FILTRI_TIPO} onChange={setTipo} />
        <RcaSegmented label="Ordina per" value={sortBy} options={FILTRI_ORDINE} onChange={setSortBy} />
      </RcaToolbar>

      <RcaVeicoliTable rows={pageRows} isLoading={isLoading} today={today} />

      <ServerPagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
