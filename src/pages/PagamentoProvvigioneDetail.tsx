import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const PagamentoProvvigioneDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: distinta, isLoading } = useQuery({
    queryKey: ["pagamento_provvigione", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamenti_provvigioni")
        .select("*, pagato_a:profiles!pagamenti_provvigioni_pagato_a_user_id_fkey(nome, cognome, email), creatore:profiles!pagamenti_provvigioni_creato_da_fkey(nome, cognome)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: righe = [] } = useQuery({
    queryKey: ["pagamento_righe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamenti_provvigioni_righe")
        .select("*, provvigione:provvigioni_generate(*, titolo:titoli(numero_titolo, premio_lordo, prodotto:prodotti(nome_prodotto)))")
        .eq("pagamento_id", id!)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const exportCSV = async () => {
    if (!distinta || righe.length === 0) return;
    const header = "Titolo,Prodotto,Premio Lordo,% Provvigione,Importo Provvigione";
    const rows = righe.map((r: any) => {
      const p = r.provvigione;
      return [
        p?.titolo?.numero_titolo || "",
        p?.titolo?.prodotto?.nome_prodotto || "",
        p?.titolo?.premio_lordo || 0,
        p?.percentuale || 0,
        r.importo || 0,
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distinta_${distinta.pagato_a?.cognome}_${format(new Date(distinta.created_at), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await logAttivita({
      azione: "esportazione_distinta",
      entita_tipo: "pagamenti_provvigioni",
      entita_id: id!,
    });
    toast.success("CSV esportato");
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Caricamento...</div>;
  if (!distinta) return <div className="p-8 text-center text-muted-foreground">Distinta non trovata</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/pagamenti-provvigioni")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Distinta Pagamento</h1>
            <p className="text-muted-foreground text-sm">
              {distinta.pagato_a?.cognome} {distinta.pagato_a?.nome} — {format(new Date(distinta.created_at), "dd/MM/yyyy")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />Esporta CSV
        </Button>
      </div>

      {/* Info distinta */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Beneficiario</CardTitle></CardHeader>
          <CardContent><p className="font-semibold">{distinta.pagato_a?.cognome} {distinta.pagato_a?.nome}</p><p className="text-xs text-muted-foreground">{distinta.pagato_a?.email}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Periodo</CardTitle></CardHeader>
          <CardContent><p className="font-semibold">{format(new Date(distinta.periodo_da), "dd/MM/yyyy")} - {format(new Date(distinta.periodo_a), "dd/MM/yyyy")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Metodo / Riferimento</CardTitle></CardHeader>
          <CardContent><Badge variant="outline" className="mr-2">{distinta.metodo}</Badge><span className="text-sm">{distinta.riferimento || "-"}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Totale</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">€{(distinta.totale_importo || 0).toFixed(2)}</p></CardContent>
        </Card>
      </div>

      {distinta.note && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Note</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{distinta.note}</p></CardContent>
        </Card>
      )}

      {/* Righe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provvigioni incluse ({righe.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Prodotto</TableHead>
                <TableHead className="text-right">Premio Lordo</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.provvigione?.titolo?.numero_titolo || "-"}</TableCell>
                  <TableCell>{r.provvigione?.titolo?.prodotto?.nome_prodotto || "-"}</TableCell>
                  <TableCell className="text-right">€{(r.provvigione?.titolo?.premio_lordo || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.provvigione?.percentuale || 0}%</TableCell>
                  <TableCell className="text-right font-semibold">€{(r.importo || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Creata da {distinta.creatore?.cognome} {distinta.creatore?.nome} il {format(new Date(distinta.created_at), "dd/MM/yyyy HH:mm")}
      </p>
    </div>
  );
};

export default PagamentoProvvigioneDetail;
