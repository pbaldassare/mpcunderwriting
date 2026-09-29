import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getStatoLabel, getStatoColor } from "@/components/trattative/StatoPipeline";
import { toast } from "sonner";
import { Archive, Search, RotateCcw, Download, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const StoricoTrattativePage = () => {
  const queryClient = useQueryClient();
  const [filtroStato, setFiltroStato] = useState("tutti");
  const [filtroSearch, setFiltroSearch] = useState("");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [reopenId, setReopenId] = useState<string | null>(null);

  const { data: trattative, isLoading } = useQuery({
    queryKey: ["trattative_storico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattative")
        .select("*, prospect:prospect_id(nome, cognome), cliente:cliente_id(nome, cognome, ragione_sociale, tipo_cliente), ramo:ramo_id(descrizione), compagnia_rel:compagnia_id(nome), ufficio:ufficio_id(nome_ufficio)")
        .or("archiviata.eq.true,stato.in.(chiusa_vinta,chiusa_persa)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("trattative")
        .update({ archiviata: false, stato: "aperta" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trattative_storico"] });
      queryClient.invalidateQueries({ queryKey: ["trattative_all"] });
      toast.success("Trattativa riaperta");
      setReopenId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getSoggettoName = (t: any) => {
    if (t.cliente) {
      return t.cliente.tipo_cliente === "privato"
        ? `${t.cliente.cognome || ""} ${t.cliente.nome || ""}`.trim()
        : t.cliente.ragione_sociale || "—";
    }
    if (t.prospect) return `${t.prospect.nome || ""} ${t.prospect.cognome || ""}`.trim();
    return "—";
  };

  const filtered = trattative?.filter((t) => {
    if (filtroStato === "chiusa_vinta" && t.stato !== "chiusa_vinta") return false;
    if (filtroStato === "chiusa_persa" && t.stato !== "chiusa_persa") return false;
    if (filtroStato === "archiviate" && !t.archiviata) return false;
    if (filtroFonte !== "tutti" && (t.fonte || "") !== filtroFonte) return false;
    if (filtroSearch) {
      const s = filtroSearch.toLowerCase();
      if (!getSoggettoName(t).toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const vinte = trattative?.filter((t) => t.stato === "chiusa_vinta") || [];
  const perse = trattative?.filter((t) => t.stato === "chiusa_persa") || [];
  const premioVinto = vinte.reduce((a, t) => a + (Number(t.premio_previsto) || 0), 0);
  const perso = perse.reduce((a, t) => a + (Number(t.premio_previsto) || 0), 0);
  const fonti = [...new Set((trattative || []).map((t) => t.fonte).filter(Boolean))];

  const exportCSV = () => {
    if (!filtered?.length) return;
    const header = "Tipo;Soggetto;Ramo;Agenzia;Ufficio;Premio;Stato;Fonte;Data";
    const rows = filtered.map((t) => [
      t.cliente_id ? "Cliente" : "Prospect",
      getSoggettoName(t),
      t.ramo?.descrizione || t.prodotto || "",
      t.compagnia_rel?.nome || t.compagnia || "",
      t.ufficio?.nome_ufficio || "",
      t.premio_previsto || "",
      getStatoLabel(t.stato),
      t.fonte || "",
      format(new Date(t.created_at), "dd/MM/yyyy"),
    ].join(";"));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storico_trattative_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span><span>›</span><span>Trattative</span><span>›</span><span>Storico</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Archive className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Storico Trattative</h1>
            <p className="text-sm text-muted-foreground">{trattative?.length || 0} trattative in storico</p>
          </div>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={exportCSV} disabled={!filtered?.length}>
          <Download className="w-4 h-4" />Esporta CSV
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Totale</p>
          <p className="text-2xl font-bold">{trattative?.length || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs text-muted-foreground">Vinte</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{vinte.length}</p>
          <p className="text-xs text-muted-foreground">€ {premioVinto.toLocaleString("it-IT")}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs text-muted-foreground">Perse</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{perse.length}</p>
          <p className="text-xs text-muted-foreground">€ {perso.toLocaleString("it-IT")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Tasso Vittoria</p>
          <p className="text-2xl font-bold">
            {vinte.length + perse.length > 0 ? `${Math.round((vinte.length / (vinte.length + perse.length)) * 100)}%` : "—"}
          </p>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-64" placeholder="Cerca soggetto..." value={filtroSearch} onChange={(e) => setFiltroSearch(e.target.value)} />
        </div>
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti</SelectItem>
            <SelectItem value="chiusa_vinta">Solo Vinte</SelectItem>
            <SelectItem value="chiusa_persa">Solo Perse</SelectItem>
            <SelectItem value="archiviate">Solo Archiviate</SelectItem>
          </SelectContent>
        </Select>
        {fonti.length > 0 && (
          <Select value={filtroFonte} onValueChange={setFiltroFonte}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutte le fonti</SelectItem>
              {fonti.map((f) => <SelectItem key={f} value={f!}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      ) : !filtered?.length ? (
        <Card className="p-8 text-center">
          <Archive className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nessuna trattativa in storico</h3>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Garanzia</TableHead>
                <TableHead>Agenzia</TableHead>
                <TableHead>Ufficio</TableHead>
                <TableHead>Premio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge variant={t.cliente_id ? "default" : "secondary"}>
                      {t.cliente_id ? "Cliente" : "Prospect"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{getSoggettoName(t)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.ramo?.descrizione || t.prodotto || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.compagnia_rel?.nome || t.compagnia || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.ufficio?.nome_ufficio || "—"}</TableCell>
                  <TableCell>{t.premio_previsto ? `€ ${Number(t.premio_previsto).toLocaleString("it-IT")}` : "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full text-white ${getStatoColor(t.stato)}`}>
                      {getStatoLabel(t.stato)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.fonte || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(t.created_at), "dd/MM/yyyy", { locale: it })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" title="Riapri trattativa" onClick={() => setReopenId(t.id)}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog open={!!reopenId} onOpenChange={(o) => !o && setReopenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Riapri trattativa</AlertDialogTitle>
            <AlertDialogDescription>
              La trattativa verrà rimessa in stato "Aperta" e tornerà nella lista principale. Confermi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => reopenId && reopenMutation.mutate(reopenId)}>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoricoTrattativePage;
