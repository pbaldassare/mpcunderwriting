import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientiSearch } from "@/hooks/useClienteSearch";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { GitBranch, Pencil, Plus, Trash2 } from "lucide-react";
import { useTitoliNidificazione } from "@/hooks/useLookupTables";
import {
  CATEGORIA_LABEL,
  clienteDisplayName,
  findTitolo,
  formatNidificazionePhrase,
  formatNidificazioneSaveError,
  wouldCreateCycle,
  type ClienteNidificazioneLite,
  type RelazioneNidificazione,
} from "@/lib/nidificazione";

type RelazioneRow = {
  id: string;
  tipo_relazione: string;
  note: string | null;
  verso: "out" | "in";
  altro: ClienteNidificazioneLite;
  raw: RelazioneNidificazione;
};

type Props = {
  clienteId: string;
  cliente: ClienteNidificazioneLite;
  compact?: boolean;
  readOnly?: boolean;
};

function resetFormState(
  setSearch: (v: string) => void,
  setSelectedId: (v: string) => void,
  setSelectedCliente: (v: ClienteNidificazioneLite | null) => void,
  setTipo: (v: string) => void,
  setNote: (v: string) => void,
  setEditing: (v: RelazioneRow | null) => void,
) {
  setSearch("");
  setSelectedId("");
  setSelectedCliente(null);
  setTipo("");
  setNote("");
  setEditing(null);
}

export default function ClienteNidificazionePanel({ clienteId, cliente, compact, readOnly }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: titoli = [] } = useTitoliNidificazione();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteNidificazioneLite | null>(null);
  const [tipo, setTipo] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<RelazioneRow | null>(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RelazioneRow | null>(null);

  const { data: relazioni = [] } = useQuery({
    queryKey: ["relazioni_cliente", clienteId],
    queryFn: async () => {
      const { data: rel1, error: e1 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_id, cliente_collegato_id, clienti_collegato:clienti!clienti_relazioni_cliente_collegato_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, gruppo_statistico)")
        .eq("cliente_id", clienteId);
      if (e1) throw e1;
      const { data: rel2, error: e2 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_id, cliente_collegato_id, clienti_origine:clienti!clienti_relazioni_cliente_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, gruppo_statistico)")
        .eq("cliente_collegato_id", clienteId);
      if (e2) throw e2;
      const rows: RelazioneRow[] = [];
      type RelOut = RelazioneNidificazione & { clienti_collegato: ClienteNidificazioneLite };
      type RelIn = RelazioneNidificazione & { clienti_origine: ClienteNidificazioneLite };
      ((rel1 || []) as RelOut[]).forEach((r) => {
        rows.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note ?? null,
          verso: "out",
          altro: r.clienti_collegato,
          raw: {
            id: r.id,
            cliente_id: r.cliente_id,
            cliente_collegato_id: r.cliente_collegato_id,
            tipo_relazione: r.tipo_relazione,
            note: r.note,
          },
        });
      });
      ((rel2 || []) as RelIn[]).forEach((r) => {
        rows.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note ?? null,
          verso: "in",
          altro: r.clienti_origine,
          raw: {
            id: r.id,
            cliente_id: r.cliente_id,
            cliente_collegato_id: r.cliente_collegato_id,
            tipo_relazione: r.tipo_relazione,
            note: r.note,
          },
        });
      });
      return rows;
    },
    enabled: !!clienteId,
  });

  const { data: searchHits = [], isFetching: searchLoading } = useQuery({
    queryKey: ["clienti_search_nidif", search],
    queryFn: async () => {
      const q = search.replace(/[,()]/g, " ").trim();
      if (q.length < 2) return [];
      const rows = await fetchClientiSearch(q, { onlyAttivi: false, limit: 25 });
      return rows
        .filter((c) => c.id !== clienteId)
        .map((c) => ({
          id: c.id,
          tipo_cliente: c.tipo_cliente,
          nome: c.nome,
          cognome: c.cognome,
          ragione_sociale: c.ragione_sociale,
          codice_fiscale: c.codice_fiscale,
          gruppo_statistico: c.gruppo_statistico ?? null,
        })) as ClienteNidificazioneLite[];
    },
    enabled: search.trim().length >= 2,
  });

  const phraseOf = (r: RelazioneRow) => {
    const titolo = findTitolo(r.tipo_relazione, titoli);
    return r.verso === "out"
      ? formatNidificazionePhrase(cliente, titolo, r.altro)
      : formatNidificazionePhrase(r.altro, titolo, cliente);
  };

  const closeForm = () => {
    setOpen(false);
    resetFormState(setSearch, setSelectedId, setSelectedCliente, setTipo, setNote, setEditing);
  };

  const openCreate = () => {
    resetFormState(setSearch, setSelectedId, setSelectedCliente, setTipo, setNote, setEditing);
    setOpen(true);
  };

  const openEdit = (r: RelazioneRow) => {
    setEditing(r);
    setTipo(r.tipo_relazione);
    setSelectedId(r.altro.id);
    setSelectedCliente(r.altro);
    setNote(r.note || "");
    setSearch("");
    setOpen(true);
  };

  const persistLink = async (mode: "insert" | "update") => {
    if (!selectedId || !tipo) throw new Error("Seleziona cliente e titolo");
    const existing = relazioni
      .filter((r) => r.id !== editing?.id)
      .map((r) => r.raw);
    const subjectId = editing?.verso === "in" ? selectedId : clienteId;
    const parentId = editing?.verso === "in" ? clienteId : selectedId;
    if (wouldCreateCycle(subjectId, parentId, existing)) {
      throw new Error("Questo collegamento creerebbe un ciclo nella nidificazione");
    }

    if (mode === "insert") {
      const { error } = await supabase.from("clienti_relazioni").insert({
        cliente_id: clienteId,
        cliente_collegato_id: selectedId,
        tipo_relazione: tipo,
        note: note.trim() || null,
      });
      if (error) throw error;
    } else if (editing) {
      const payload = editing.verso === "in"
        ? {
            cliente_id: selectedId,
            cliente_collegato_id: clienteId,
            tipo_relazione: tipo,
            note: note.trim() || null,
          }
        : {
            cliente_id: clienteId,
            cliente_collegato_id: selectedId,
            tipo_relazione: tipo,
            note: note.trim() || null,
          };
      const { error } = await supabase.from("clienti_relazioni").update(payload).eq("id", editing.id);
      if (error) throw error;
    }

    const altro = selectedCliente?.id === selectedId
      ? selectedCliente
      : searchHits.find((c) => c.id === selectedId);
    if (altro?.gruppo_statistico && !cliente.gruppo_statistico) {
      await supabase.from("clienti").update({ gruppo_statistico: altro.gruppo_statistico }).eq("id", clienteId);
    } else if (cliente.gruppo_statistico && altro && !altro.gruppo_statistico) {
      await supabase.from("clienti").update({ gruppo_statistico: cliente.gruppo_statistico }).eq("id", selectedId);
    }
  };

  const save = useMutation({
    mutationFn: async (mode: "insert" | "update") => persistLink(mode),
    onSuccess: (_d, mode) => {
      qc.invalidateQueries({ queryKey: ["relazioni_cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      setConfirmEdit(false);
      closeForm();
      toast.success(mode === "update" ? "Nidificazione aggiornata" : "Nidificazione aggiunta");
    },
    onError: (err: unknown) => {
      setConfirmEdit(false);
      toast.error(formatNidificazioneSaveError(err));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clienti_relazioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_cliente", clienteId] });
      setPendingDelete(null);
      toast.success("Collegamento rimosso");
    },
    onError: (err: unknown) => toast.error(formatNidificazioneSaveError(err)),
  });

  const titoloOptions = titoli.map((t) => ({
    value: t.codice,
    label: t.descrizione,
    description: CATEGORIA_LABEL[t.categoria],
    searchText: `${t.descrizione} ${t.categoria} ${t.codice}`,
  }));

  const actions = !readOnly;

  const actionButtons = (r: RelazioneRow, compactBtns?: boolean) => (
    actions ? (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={compactBtns ? "h-7 w-7" : undefined}
          onClick={() => openEdit(r)}
          title="Modifica"
        >
          <Pencil className={compactBtns ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={compactBtns ? "h-7 w-7" : undefined}
          onClick={() => setPendingDelete(r)}
          title="Elimina"
        >
          <Trash2 className={`text-destructive ${compactBtns ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
        </Button>
      </div>
    ) : null
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className={compact ? "text-sm font-medium" : "font-semibold"}>Nidificazione</span>
          <Badge variant="outline">{relazioni.length}</Badge>
        </div>
        {actions && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3 h-3 mr-1" /> Collega cliente
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Questo cliente è [titolo] di un altro cliente in anagrafica. Es. sindaco di Comune di Varese, figlio di Gianni.
      </p>

      {relazioni.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nessun collegamento di nidificazione.</p>
      ) : compact ? (
        <ul className="space-y-1">
          {relazioni.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <button type="button" className="text-left hover:underline" onClick={() => navigate(`/archivi/clienti/${r.altro.id}`)}>
                {phraseOf(r)}
              </button>
              {actionButtons(r, true)}
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nidificazione</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Note</TableHead>
              {actions && <TableHead className="w-24 text-right">Azioni</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {relazioni.map((r) => {
              const titolo = findTitolo(r.tipo_relazione, titoli);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => navigate(`/archivi/clienti/${r.altro.id}`)}>
                      {phraseOf(r)}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titolo ? CATEGORIA_LABEL[titolo.categoria] : r.tipo_relazione}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.note || "—"}</TableCell>
                  {actions && <TableCell className="text-right">{actionButtons(r)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) closeForm(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica nidificazione" : "Collega nidificazione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{editing?.verso === "in" ? "Questo cliente ha come collegato…" : "Questo cliente è…"}</Label>
              <SearchableSelect
                options={titoloOptions}
                value={tipo}
                onValueChange={setTipo}
                placeholder="Titolo (sindaco, figlio, …)"
                className="w-full mt-1"
                showSelectedDescription
              />
            </div>
            <div>
              <Label>{editing?.verso === "in" ? "… questa persona / ente" : "… di questo cliente"}</Label>
              <SearchableSelect
                className="w-full mt-1"
                options={(selectedCliente && !searchHits.some((c) => c.id === selectedCliente.id)
                  ? [selectedCliente, ...searchHits]
                  : searchHits
                ).map((c) => ({
                  value: c.id,
                  label: clienteDisplayName(c),
                  description: c.gruppo_statistico || undefined,
                }))}
                value={selectedId}
                onValueChange={(id) => {
                  setSelectedId(id);
                  setSelectedCliente(
                    searchHits.find((c) => c.id === id)
                      || (selectedCliente?.id === id ? selectedCliente : null),
                  );
                }}
                placeholder="Cerca in anagrafica…"
                searchPlaceholder="Digita almeno 2 caratteri…"
                searchValue={search}
                onSearchChange={setSearch}
                serverSideSearch
                emptyText={searchLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
              />
            </div>
            <div>
              <Label>Note (opzionale)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Annulla</Button>
            {editing ? (
              <Button onClick={() => setConfirmEdit(true)} disabled={!selectedId || !tipo || save.isPending}>
                Salva modifiche
              </Button>
            ) : (
              <Button onClick={() => save.mutate("insert")} disabled={!selectedId || !tipo || save.isPending}>
                Collega
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmEdit} onOpenChange={setConfirmEdit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi la modifica?</AlertDialogTitle>
            <AlertDialogDescription>
              La nidificazione verrà aggiornata in anagrafica. L&apos;operazione è immediata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => save.mutate("update")} disabled={save.isPending}>
              Conferma e salva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la nidificazione?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Verrà rimosso il collegamento «${phraseOf(pendingDelete)}».` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              disabled={remove.isPending}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
