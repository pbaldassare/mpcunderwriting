import { useState } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileStack } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
const statiNota = ["bozza", "pronta", "spedita", "chiusa"];

const NoteRestituzioneList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [ufficioId, setUfficioId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [filtroStato, setFiltroStato] = useState("all");
  const [filtroUfficio, setFiltroUfficio] = useState("all");
  const { page, setPage, pageSize, range } = useServerPagination(25, [filtroStato, filtroUfficio]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uffici").select("*").eq("attivo", true).order("nome_ufficio");
      if (error) throw error;
      return data;
    },
  });

  const { data: clienti = [] } = useQuery({
    queryKey: ["clienti_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      if (error) throw error;
      return data;
    },
  });

  const { data: noteResult, isLoading } = useQuery({
    queryKey: ["note_restituzione", page, filtroStato, filtroUfficio],
    queryFn: async () => {
      let q = supabase
        .from("note_restituzione")
        .select("*, uffici(nome_ufficio), cliente:profiles!note_restituzione_cliente_id_fkey(nome, cognome), creatore:profiles!note_restituzione_created_by_fkey(nome, cognome)", { count: "exact" });

      if (filtroStato !== "all") q = q.eq("stato", filtroStato);
      if (filtroUfficio !== "all") q = q.eq("ufficio_id", filtroUfficio);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
  });

  const note = noteResult?.data || [];
  const totalCount = noteResult?.count || 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      const uffId = ufficioId || profile?.ufficio_id;
      const { data, error } = await supabase.from("note_restituzione").insert({
        ufficio_id: uffId,
        cliente_id: clienteId || null,
        note: noteText || null,
        created_by: user?.id,
        stato: "bozza",
        flag_json: { libretto: false, quietanza: false, delega: false, contrassegno: false },
      }).select().single();
      if (error) throw error;
      await logAttivita({ azione: "creazione_nota_restituzione", entita_tipo: "nota_restituzione", entita_id: data.id });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["note_restituzione"] });
      setOpen(false);
      setClienteId("");
      setUfficioId("");
      setNoteText("");
      toast.success("Nota di restituzione creata");
      navigate(`/note-restituzione/${data.id}`);
    },
    onError: (err: any) => toast.error("Errore"),
  });

  const statoBadge = (s: string) => {
    switch (s) {
      case "pronta": return "default";
      case "spedita": return "secondary";
      case "chiusa": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Note di Restituzione</h1>
          <p className="text-muted-foreground">Gestione documenti RC Auto da restituire</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuova Nota</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuova Nota di Restituzione</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Sede *</Label>
                <Select value={ufficioId} onValueChange={setUfficioId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona sede" /></SelectTrigger>
                  <SelectContent>{uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona cliente" /></SelectTrigger>
                  <SelectContent>{clienti.map((c) => <SelectItem key={c.id} value={c.id}>{c.cognome} {c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Note aggiuntive..." />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!ufficioId || createMutation.isPending} className="w-full">Crea Nota</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filtroStato} onValueChange={(v) => { setFiltroStato(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiNota.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroUfficio} onValueChange={(v) => { setFiltroUfficio(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sede" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le sedi</SelectItem>
            {uffici.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome_ufficio}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileStack className="w-5 h-5" />Note ({totalCount})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Caricamento...</p> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Creata da</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {note.map((n: any) => (
                    <TableRow key={n.id} className="cursor-pointer" onClick={() => navigate(`/note-restituzione/${n.id}`)}>
                      <TableCell className="font-medium">{n.cliente ? `${n.cliente.cognome} ${n.cliente.nome}` : "—"}</TableCell>
                      <TableCell>{n.uffici?.nome_ufficio || "—"}</TableCell>
                      <TableCell><Badge variant={statoBadge(n.stato)}>{n.stato}</Badge></TableCell>
                      <TableCell>{n.creatore ? `${n.creatore.nome} ${n.creatore.cognome}` : "—"}</TableCell>
                      <TableCell>{n.created_at ? format(new Date(n.created_at), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {note.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna nota</TableCell></TableRow>}
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

export default NoteRestituzioneList;
