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
import { ClienteSearchSelect } from "@/components/clienti/ClienteSearchSelect";
const ECClientiStoricoPage = () => {
  const [q, setQ] = useState("");
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Se filtro per numero polizza: trova prima i clienti che hanno quella polizza
  const { data: clientiConPolizza } = useQuery({
    queryKey: ["ec-clienti-storico-by-polizza", numeroPolizza],
    enabled: numeroPolizza.trim().length >= 3,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("cliente_anagrafica_id")
        .ilike("numero_titolo", `%${numeroPolizza.trim()}%`)
        .not("cliente_anagrafica_id", "is", null)
        .limit(1000);
      return Array.from(new Set((data || []).map((r: any) => r.cliente_anagrafica_id).filter(Boolean)));
    },
  });

  const { page, setPage, pageSize, range } = useServerPagination(25, [q, numeroPolizza, clienteId, dateFrom, dateTo, clientiConPolizza]);

  const { data, isLoading } = useQuery({
    queryKey: ["ec-clienti-storico", q, numeroPolizza, clienteId, dateFrom, dateTo, page, clientiConPolizza],
    queryFn: async () => {
      let query = supabase
        .from("documenti")
        .select("id, nome_file, path_storage, bucket_name, entita_id, created_at, categoria", { count: "exact" })
        .eq("categoria", "EC Cliente")
        .eq("entita_tipo", "cliente")
        .order("created_at", { ascending: false });

      if (clienteId) query = query.eq("entita_id", clienteId);
      if (q.trim()) query = query.ilike("nome_file", `%${q.trim()}%`);
      if (numeroPolizza.trim().length >= 3) {
        const ids = clientiConPolizza || [];
        if (ids.length === 0) {
          // nessun risultato possibile
          return { rows: [], total: 0 };
        }
        query = query.in("entita_id", ids);
      }
      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const from = range.from;
      const to = range.to;
      const { data: docs, count, error } = await query.range(from, to);
      if (error) throw error;

      const ids = Array.from(new Set((docs || []).map((d: any) => d.entita_id).filter(Boolean)));
      const map: Record<string, string> = {};
      if (ids.length) {
        const { data: cls } = await supabase
          .from("clienti")
          .select("id, nome, cognome, ragione_sociale")
          .in("id", ids);
        (cls || []).forEach((c: any) => {
          map[c.id] = c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
        });
      }
      return {
        rows: (docs || []).map((d: any) => ({ ...d, cliente_nome: map[d.entita_id] || "—" })),
        total: count || 0,
      };
    },
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  const handleDownload = async (row: any) => {
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
          <h1 className="text-2xl font-bold">Storico E/C Clienti</h1>
          <p className="text-sm text-muted-foreground">PDF "Estratto Conto Cliente" archiviati</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome file..." className="pl-9" />
          </div>
          <ClienteSearchSelect
            value={clienteId || ""}
            onValueChange={(v) => setClienteId(v || null)}
            placeholder="Cliente"
            searchPlaceholder="Nome, più nomi, indirizzo…"
            clearable
            clearLabel="Tutti i clienti"
            onlyAttivi={false}
          />
          <div>
            <label className="text-xs text-muted-foreground">N. Polizza</label>
            <Input value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="Es. 123456" />
          </div>
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
              <TableHead>Cliente</TableHead>
              <TableHead>Nome File</TableHead>
              <TableHead className="w-[120px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nessun E/C archiviato</TableCell></TableRow>
            ) : rows.map((d: any, i: number) => (
              <TableRow key={d.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell className="text-sm">{d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : "—"}</TableCell>
                <TableCell className="font-medium">{d.cliente_nome}</TableCell>
                <TableCell className="text-sm font-mono">{d.nome_file}</TableCell>
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

export default ECClientiStoricoPage;
