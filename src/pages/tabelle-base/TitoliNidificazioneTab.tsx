import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIA_LABEL, NIDIFICAZIONE_CATEGORIE } from "@/lib/nidificazione";

export default function TitoliNidificazioneTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [preposizione, setPreposizione] = useState("di");
  const [categoria, setCategoria] = useState<(typeof NIDIFICAZIONE_CATEGORIE)[number]>("incarico");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["lookup-titoli-nidificazione"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lookup_titoli_nidificazione" as never)
        .select("*")
        .order("categoria")
        .order("descrizione");
      if (error) throw error;
      return (data || []) as {
        id: string;
        codice: string;
        descrizione: string;
        preposizione: string;
        categoria: (typeof NIDIFICAZIONE_CATEGORIE)[number];
        attivo: boolean;
      }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lookup_titoli_nidificazione" as never).insert({
        codice: codice.trim().toLowerCase().replace(/\s+/g, "_"),
        descrizione: descrizione.trim(),
        preposizione: preposizione.trim() || "di",
        categoria,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-titoli-nidificazione"] });
      qc.invalidateQueries({ queryKey: ["lookup", "lookup_titoli_nidificazione"] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      setOpen(false);
      setCodice("");
      setDescrizione("");
      setPreposizione("di");
      toast.success("Titolo aggiunto");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase
        .from("lookup_titoli_nidificazione" as never)
        .update({ attivo } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-titoli-nidificazione"] });
      qc.invalidateQueries({ queryKey: ["lookup", "lookup_titoli_nidificazione"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lookup_titoli_nidificazione" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lookup-titoli-nidificazione"] });
      qc.invalidateQueries({ queryKey: ["tabelle-base-counts"] });
      toast.success("Titolo eliminato");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Titoli nidificazione</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Nuovo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Etichetta</TableHead>
              <TableHead>Prep.</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Attivo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}>Caricamento…</TableCell></TableRow>
            ) : (
              items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.codice}</TableCell>
                  <TableCell>{l.descrizione}</TableCell>
                  <TableCell>{l.preposizione}</TableCell>
                  <TableCell>{CATEGORIA_LABEL[l.categoria]}</TableCell>
                  <TableCell>
                    <Switch checked={l.attivo} onCheckedChange={(v) => toggle.mutate({ id: l.id, attivo: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuovo titolo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Codice</Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="sindaco" /></div>
            <div><Label>Etichetta</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Sindaco" /></div>
            <div><Label>Preposizione</Label><Input value={preposizione} onChange={(e) => setPreposizione(e.target.value)} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as typeof categoria)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIDIFICAZIONE_CATEGORIE.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save.mutate()} disabled={!codice.trim() || !descrizione.trim() || save.isPending}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
