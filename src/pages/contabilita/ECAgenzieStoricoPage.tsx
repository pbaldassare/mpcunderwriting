import { useState, useEffect } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import ServerPagination from "@/components/ServerPagination";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import {
  cercaEcAgenziaStorico,
  formatClientiAnteprima,
  type EcAgenziaStoricoRow,
} from "@/lib/contabilita/ecAgenziaArchivio";

const ECAgenzieStoricoPage = () => {
  const [q, setQ] = useState("");
  const [riferimento, setRiferimento] = useState("");
  const [cliente, setCliente] = useState("");
  const [polizza, setPolizza] = useState("");
  const [agenziaId, setAgenziaId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const filterKey = [q, riferimento, cliente, polizza, agenziaId, dateFrom, dateTo];
  const { page, setPage, pageSize, range } = useServerPagination(25, filterKey);

  useEffect(() => { setPage(0); }, filterKey); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: agenzieOpts = [] } = useQuery({
    queryKey: ["ec-agenzie-storico-agenzie"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").order("nome");
      return (data || []).map((c: any) => ({ value: c.id, label: c.nome }));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ec-agenzie-storico", ...filterKey, page],
    queryFn: async () => {
      const result = await cercaEcAgenziaStorico({
        compagniaId: agenziaId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        q,
        riferimento,
        cliente,
        polizza,
        limit: range.to - range.from + 1,
        offset: range.from,
      });

      const compIds = Array.from(new Set(result.rows.map((d) => d.compagnia_id).filter(Boolean)));
      const compMap: Record<string, string> = {};
      if (compIds.length) {
        const { data: comps } = await supabase.from("compagnie").select("id, nome").in("id", compIds);
        (comps || []).forEach((c: any) => { compMap[c.id] = c.nome; });
      }

      return {
        rows: result.rows.map((d) => ({ ...d, agenzia_nome: compMap[d.compagnia_id] || "—" })),
        total: result.total,
      };
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  const handleDownload = async (row: EcAgenziaStoricoRow & { agenzia_nome?: string }) => {
    try {
      const { data: blob, error } = await supabase.storage
        .from(row.bucket_name || "documenti_generali")
        .download(row.path_storage);
      if (error) throw error;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = row.nome_file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error("Errore download: " + (e?.message || e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Storico E/C Agenzie</h1>
          <p className="text-sm text-muted-foreground">
            PDF archiviati — cerca per riferimento progressivo, cliente, polizza o pagamento (MI)
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ricerca libera (riferimento, cliente, polizza…)"
              className="pl-9"
            />
          </div>
          <Input
            value={riferimento}
            onChange={(e) => setRiferimento(e.target.value)}
            placeholder="Riferimento E/C (es. SAR106/250801)"
            className="font-mono text-sm"
          />
          <Input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nome cliente"
          />
          <Input
            value={polizza}
            onChange={(e) => setPolizza(e.target.value)}
            placeholder="N. polizza / titolo"
            className="font-mono text-sm"
          />
          <FilterSearchableSelect
            value={agenziaId}
            onValueChange={setAgenziaId}
            options={agenzieOpts}
            placeholder="Agenzia"
            allLabel="Tutte le agenzie"
          />
          <div>
            <label className="text-xs text-muted-foreground">Da</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">A</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Agenzia</TableHead>
              <TableHead>Riferimento</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead>Clienti (anteprima)</TableHead>
              <TableHead className="w-[120px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nessun E/C trovato</TableCell></TableRow>
            ) : rows.map((d: any, i: number) => (
              <TableRow key={d.documento_id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell className="text-sm">{d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                <TableCell className="font-medium">{d.agenzia_nome}</TableCell>
                <TableCell className="text-sm font-mono">{d.riferimento || "—"}</TableCell>
                <TableCell className="text-sm">{d.periodo_testo || "—"}</TableCell>
                <TableCell className="text-sm max-w-[240px] truncate" title={formatClientiAnteprima(d.righe, 5)}>
                  {formatClientiAnteprima(d.righe)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Scarica
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ServerPagination page={page} pageSize={pageSize} totalCount={total} onPageChange={setPage} />
    </div>
  );
};

export default ECAgenzieStoricoPage;
