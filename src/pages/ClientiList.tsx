import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Search } from "lucide-react";
import ServerPagination from "@/components/ServerPagination";
import { NuovoClienteDialog } from "@/components/clienti/NuovoClienteDialog";

const ClientiList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { page, setPage, pageSize, range } = useServerPagination(25, [debouncedSearch]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: clientiResult, isLoading } = useQuery({
    queryKey: ["clienti", debouncedSearch, page, pageSize],
    queryFn: async () => {
      const term = debouncedSearch.trim();

      // Con ricerca: ranking per rilevanza (RPC) prima della paginazione
      if (term) {
        const { data, error } = await supabase.rpc("search_clienti_ranked", {
          p_search: term,
          p_limit: pageSize,
          p_offset: range.from,
        });
        if (error) throw error;
        const payload = data as { data?: any[]; total_count?: number } | null;
        return {
          data: payload?.data ?? [],
          totalCount: Number(payload?.total_count ?? 0),
        };
      }

      const { data, error, count } = await supabase
        .from("clienti")
        .select("*", { count: "exact" })
        .is("merged_into", null)
        .order("cognome", { ascending: true, nullsFirst: false })
        .order("ragione_sociale", { ascending: true, nullsFirst: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], totalCount: count || 0 };
    },
  });

  const clienti = clientiResult?.data || [];
  const totalCount = clientiResult?.totalCount || 0;

  const { data: polizzeCountMap = {} } = useQuery({
    queryKey: ["count_polizze_per_cliente"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_polizze_per_cliente");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.cliente_id] = Number(r.count); });
      return map;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clienti</h1>
          <p className="text-muted-foreground">Anagrafica clienti privati, aziende ed enti</p>
        </div>
        <NuovoClienteDialog
          trigger={<Button><Plus className="w-4 h-4 mr-2" />Nuovo Cliente</Button>}
          onCreated={(nuovoId) => {
            queryClient.invalidateQueries({ queryKey: ["clienti"] });
            queryClient.invalidateQueries({ queryKey: ["count_polizze_per_cliente"] });
            if (nuovoId) navigate(`/archivi/clienti/${nuovoId}`);
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Clienti ({totalCount})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, CF, P.IVA..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Caricamento...</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Denominazione</TableHead>
                  <TableHead>CF / P.IVA</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Città</TableHead>
                  <TableHead className="text-center">Polizze</TableHead>
                  <TableHead>Portale</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clienti.map((c) => {
                  const denominazione = c.tipo_cliente === "privato"
                    ? [c.cognome, c.nome].filter(Boolean).join(" ") || "—"
                    : c.ragione_sociale || "—";
                  const cfPiva = c.codice_fiscale || c.partita_iva || c.codice_fiscale_azienda || "—";
                  const citta = c.citta_residenza || c.citta_sede || "—";
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/archivi/clienti/${c.id}`)}>
                      <TableCell className="font-mono text-xs">{c.codice_cliente || c.codice_ricerca || "—"}</TableCell>
                      <TableCell className="font-medium">{denominazione}</TableCell>
                      <TableCell className="font-mono text-xs">{cfPiva}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>{c.telefono || "—"}</TableCell>
                      <TableCell>{citta}</TableCell>
                      <TableCell className="text-center">
                        {(polizzeCountMap[c.id] || 0) > 0 ? (
                          <Badge variant="default" className="min-w-[2rem] justify-center">{polizzeCountMap[c.id]}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.area_riservata_tipo && c.area_riservata_tipo !== "nessuna" ? (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">Attivo</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.attivo ? "default" : "secondary"}>
                          {c.attivo ? "Attivo" : "Disattivo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clienti.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nessun cliente trovato
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientiList;
