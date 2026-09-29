import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import ServerPagination from "@/components/ServerPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RcaCompagniaLogo } from "@/components/rca/RcaCompagniaLogo";
import { RcaPageHeader, RcaTableCard, RcaToolbar } from "@/components/rca/RcaPageChrome";
import { formatEuroPremio } from "@/lib/rca/assicurapp";
import { formatScadenzaRca } from "@/lib/rca/clientela";
import { quoteKindLabel } from "@/lib/rca/cvt";
import { selectedOfferFromSnapshot } from "@/lib/rca/offerteUi";
import { labelGaranziaAssicurapp } from "@/lib/rca/garanzie";
import { prodottoLabel, statoPreventivoLabel, type RcaPreventivoRow } from "@/lib/rca/preventivi";

export default function RcaPreventiviListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debounced]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["rca-preventivi"],
    queryFn: async (): Promise<RcaPreventivoRow[]> => {
      const { data, error } = await (supabase.from("rca_preventivi") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as RcaPreventivoRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => {
      const nome = String((r.client_snapshot as { display_name?: string })?.display_name || "").toLowerCase();
      return r.targa.toLowerCase().includes(q) || nome.includes(q) || (r.quote_uid || "").toLowerCase().includes(q);
    });
  }, [data, debounced]);
  const pageRows = filtered.slice(range.from, range.to + 1);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <RcaPageHeader
        title="Preventivi RCA"
        subtitle="Preventivi salvati in CBnet, con offerte Assicurapp e compagnia scelta."
        actions={
          <Button onClick={() => navigate("/rca/preventivi/nuovo")}>Nuovo preventivo</Button>
        }
      />

      <RcaToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Cerca targa, cliente o codice…"
        count={filtered.length}
        countLabel="preventivi"
      />

      <RcaTableCard>
        <Table className="w-full min-w-0 table-fixed" containerClassName="overflow-x-hidden">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[20%]" />
            <col className="w-[14%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Targa</TableHead>
              <TableHead className="px-3">Cliente</TableHead>
              <TableHead className="px-3">Tipo</TableHead>
              <TableHead className="px-3">Offerta salvata</TableHead>
              <TableHead className="px-3">Stato</TableHead>
              <TableHead className="px-3">Creato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Nessun preventivo salvato
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => {
                const kind = String((r.quote_snapshot as { quote_kind?: string })?.quote_kind || "rca");
                const saved = selectedOfferFromSnapshot(r.quote_snapshot);
                return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/rca/preventivi/${r.id}`)}>
                  <TableCell className="px-3 py-2.5 font-mono font-medium">{r.targa}</TableCell>
                  <TableCell className="truncate px-3 py-2.5">
                    {String((r.client_snapshot as { display_name?: string })?.display_name || "—")}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {prodottoLabel(r.prodotto_code, kind)}
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {quoteKindLabel(kind)}
                      {(r.garanzie_richieste || []).length
                        ? ` · ${(r.garanzie_richieste || []).map(labelGaranziaAssicurapp).slice(0, 2).join(", ")}`
                        : ""}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {saved ? (
                      <div className="flex items-center gap-2">
                        <RcaCompagniaLogo slug={saved.company_slug} label={saved.label} className="h-9 w-9 rounded-lg" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{saved.label}</p>
                          <p className="text-xs text-muted-foreground">{formatEuroPremio(saved.premio)}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">In quotazione</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Badge variant="secondary">{statoPreventivoLabel(r.stato)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-2.5">{formatScadenzaRca(r.created_at)}</TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </RcaTableCard>

      <ServerPagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} />
    </div>
  );
}
