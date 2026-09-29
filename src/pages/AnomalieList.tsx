import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldCheck, Eye, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const GRAVITA_COLORS: Record<string, string> = {
  media: "bg-yellow-100 text-yellow-800 border-yellow-300",
  alta: "bg-orange-100 text-orange-800 border-orange-300",
  critica: "bg-red-100 text-red-800 border-red-300",
};

const STATO_COLORS: Record<string, string> = {
  aperta: "bg-red-50 text-red-700 border-red-200",
  in_verifica: "bg-blue-50 text-blue-700 border-blue-200",
  risolta: "bg-green-50 text-green-700 border-green-200",
};

const ENTITY_ROUTES: Record<string, string> = {
  titolo: "/titoli",
  sinistro: "/sinistri",
  rimessa: "/contabilita/storico-rimesse",
  cliente: "/prospect",
};

const AnomalieList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, profile } = useAuth();

  const [filtroGravita, setFiltroGravita] = useState("tutte");
  const [filtroStato, setFiltroStato] = useState("aperta");
  const [filtroTipo, setFiltroTipo] = useState("tutti");

  const [resolveDialog, setResolveDialog] = useState<{ id: string; tipo: string } | null>(null);
  const [noteRisoluzione, setNoteRisoluzione] = useState("");

  const { data: anomalie = [], isLoading } = useQuery({
    queryKey: ["anomalie_sistema", filtroGravita, filtroStato, filtroTipo],
    queryFn: async () => {
      let q = supabase
        .from("anomalie_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (filtroStato !== "tutte") q = q.eq("stato", filtroStato);
      if (filtroGravita !== "tutte") q = q.eq("gravita", filtroGravita);
      if (filtroTipo !== "tutti") q = q.eq("tipo", filtroTipo);

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici_list"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici").select("id, nome_ufficio").eq("attivo", true);
      return data || [];
    },
  });

  const updateStato = useMutation({
    mutationFn: async ({ id, stato, note }: { id: string; stato: string; note?: string }) => {
      const update: any = { stato };
      if (stato === "risolta") {
        update.risolta_da = profile?.id;
        update.data_risoluzione = new Date().toISOString();
        update.note_risoluzione = note || "";
      }
      const { error } = await supabase.from("anomalie_sistema").update(update).eq("id", id);
      if (error) throw error;

      await logAttivita({
        azione: stato === "risolta" ? "anomalia_risolta" : "anomalia_in_verifica",
        entita_tipo: "anomalia",
        entita_id: id,
        dettagli_json: { stato, note },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalie_sistema"] });
      toast.success("Anomalia aggiornata");
      setResolveDialog(null);
      setNoteRisoluzione("");
    },
    onError: (e: any) => {
      toast.error("Errore");
    },
  });

  const runChecks = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_data_quality_checks");
      if (error) throw error;
      await logAttivita({
        azione: "controllo_qualita_dati",
        entita_tipo: "manutenzione",
        entita_id: "00000000-0000-0000-0000-000000000000",
        dettagli_json: data as any,
      });
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["anomalie_sistema"] });
      toast.success("Controlli completati", { description: `${data?.totale_nuove || 0} nuove anomalie trovate` });
    },
    onError: (e: any) => {
      toast.error("Errore");
    },
  });

  const ufficiMap = Object.fromEntries(uffici.map((u: any) => [u.id, u.nome_ufficio]));

  const tipiUnici = [...new Set(anomalie.map((a: any) => a.tipo))].sort();

  const goToEntity = (entita_tipo: string, entita_id: string) => {
    const base = ENTITY_ROUTES[entita_tipo];
    if (base) navigate(`${base}/${entita_id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anomalie Sistema</h1>
          <p className="text-sm text-muted-foreground">Data quality & controlli automatici</p>
        </div>
        {isAdmin && (
          <Button onClick={() => runChecks.mutate()} disabled={runChecks.isPending}>
            {runChecks.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Esegui Controlli Qualità
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["critica", "alta", "media"] as const).map((g) => {
          const count = anomalie.filter((a: any) => a.gravita === g && a.stato !== "risolta").length;
          return (
            <Card key={g} className="cursor-pointer" onClick={() => { setFiltroGravita(g); setFiltroStato("tutte"); }}>
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${g === "critica" ? "text-destructive" : g === "alta" ? "text-orange-500" : "text-yellow-500"}`} />
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{g}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{anomalie.filter((a: any) => a.stato !== "risolta").length}</p>
              <p className="text-xs text-muted-foreground">Totale aperte</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filtroStato} onValueChange={setFiltroStato}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutti gli stati</SelectItem>
            <SelectItem value="aperta">Aperta</SelectItem>
            <SelectItem value="in_verifica">In verifica</SelectItem>
            <SelectItem value="risolta">Risolta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroGravita} onValueChange={setFiltroGravita}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Gravità" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte</SelectItem>
            <SelectItem value="critica">Critica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Media</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i tipi</SelectItem>
            {tipiUnici.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : anomalie.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nessuna anomalia trovata</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gravità</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Descrizione</TableHead>
                  <TableHead className="hidden lg:table-cell">Sede</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalie.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Badge variant="outline" className={GRAVITA_COLORS[a.gravita] || ""}>{a.gravita}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.tipo}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-xs truncate text-sm">{a.descrizione}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{ufficiMap[a.ufficio_id] || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATO_COLORS[a.stato] || ""}>{a.stato}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {format(new Date(a.created_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {ENTITY_ROUTES[a.entita_tipo] && (
                          <Button size="icon" variant="ghost" onClick={() => goToEntity(a.entita_tipo, a.entita_id)} title="Vai all'entità">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        {a.stato === "aperta" && (
                          <Button size="sm" variant="outline" onClick={() => updateStato.mutate({ id: a.id, stato: "in_verifica" })}>
                            <Eye className="w-3 h-3 mr-1" /> Verifica
                          </Button>
                        )}
                        {a.stato !== "risolta" && (
                          <Button size="sm" variant="default" onClick={() => setResolveDialog({ id: a.id, tipo: a.tipo })}>
                            <ShieldCheck className="w-3 h-3 mr-1" /> Risolvi
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Risolvi anomalia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Tipo: <span className="font-mono">{resolveDialog?.tipo}</span></p>
            <Textarea
              placeholder="Note di risoluzione (obbligatorie)"
              value={noteRisoluzione}
              onChange={(e) => setNoteRisoluzione(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(null)}>Annulla</Button>
            <Button
              disabled={!noteRisoluzione.trim() || updateStato.isPending}
              onClick={() => resolveDialog && updateStato.mutate({ id: resolveDialog.id, stato: "risolta", note: noteRisoluzione })}
            >
              {updateStato.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Conferma Risoluzione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnomalieList;
