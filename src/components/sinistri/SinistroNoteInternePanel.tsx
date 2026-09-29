import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { StickyNote, Plus, Pencil, Trash2 } from "lucide-react";

export type SinistroNotaInternaRow = {
  id: string;
  sinistro_id: string;
  testo: string;
  created_at: string;
  created_by: string | null;
  profiles?: { nome?: string | null; cognome?: string | null } | null;
};

interface Props {
  sinistroId: string;
  currentUserId?: string | null;
  disabled?: boolean;
}

const fmtDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : "—";
};

const authorLabel = (row: SinistroNotaInternaRow) => {
  const nome = `${row.profiles?.nome || ""} ${row.profiles?.cognome || ""}`.trim();
  return nome || "Operatore";
};

export default function SinistroNoteInternePanel({ sinistroId, currentUserId, disabled }: Props) {
  const qc = useQueryClient();
  const [testo, setTesto] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingNote, setEditingNote] = useState<SinistroNotaInternaRow | null>(null);
  const [editText, setEditText] = useState("");
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingNote, setDeletingNote] = useState<SinistroNotaInternaRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: note = [], isLoading } = useQuery({
    queryKey: ["sinistro-note-interne", sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_note_interne" as any)
        .select("id, sinistro_id, testo, created_at, created_by, profiles:created_by(nome, cognome)")
        .eq("sinistro_id", sinistroId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SinistroNotaInternaRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro-note-interne", sinistroId] });
  };

  const handleAdd = async () => {
    const trimmed = testo.trim();
    if (!trimmed) {
      toast.error("Inserisci il testo della nota");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("sinistro_note_interne" as any).insert({
        sinistro_id: sinistroId,
        testo: trimmed,
        created_by: currentUserId || null,
      });
      if (error) throw error;
      toast.success("Nota aggiunta");
      setTesto("");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (n: SinistroNotaInternaRow) => {
    setEditingNote(n);
    setEditText(n.testo);
  };

  const closeEdit = () => {
    setEditingNote(null);
    setEditText("");
    setEditConfirmOpen(false);
  };

  const handleEditSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      toast.error("Il testo della nota non può essere vuoto");
      return;
    }
    if (!editingNote) return;

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("sinistro_note_interne" as any)
        .update({ testo: trimmed })
        .eq("id", editingNote.id);
      if (error) throw error;
      toast.success("Nota aggiornata");
      closeEdit();
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    } finally {
      setSavingEdit(false);
      setEditConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingNote) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("sinistro_note_interne" as any)
        .delete()
        .eq("id", deletingNote.id);
      if (error) throw error;
      toast.success("Nota eliminata");
      setDeletingNote(null);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-md border border-border/70 bg-background p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <StickyNote className="h-4 w-4" /> Note interne
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Diario operativo della pratica (visibile solo agli operatori).
          </p>
        </div>
      </div>

      {!disabled && (
        <div className="space-y-2 rounded-md border border-dashed border-border/80 p-3 bg-muted/10">
          <Label htmlFor="nuova-nota-interna">Nuova nota</Label>
          <Textarea
            id="nuova-nota-interna"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={3}
            placeholder="Scrivi una nota operativa…"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAdd} disabled={saving || !testo.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi nota
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Caricamento…</p>
      ) : note.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nessuna nota interna</p>
      ) : (
        <ul className="space-y-3">
          {[...note].reverse().map((n) => (
            <li key={n.id} className="rounded-md border border-border/60 bg-muted/15 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1.5">
                <span className="font-medium text-foreground">{authorLabel(n)}</span>
                <div className="flex items-center gap-2">
                  <time dateTime={n.created_at}>{fmtDateTime(n.created_at)}</time>
                  {!disabled && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Modifica nota"
                        onClick={() => openEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label="Elimina nota"
                        onClick={() => setDeletingNote(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.testo}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editingNote} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifica nota</DialogTitle>
            <DialogDescription>Aggiorna il testo della nota interna.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            placeholder="Testo nota…"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={closeEdit} disabled={savingEdit}>
              Annulla
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editText.trim()) {
                  toast.error("Il testo della nota non può essere vuoto");
                  return;
                }
                setEditConfirmOpen(true);
              }}
              disabled={savingEdit || !editText.trim()}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi modifica?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per salvare le modifiche a questa nota interna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingEdit}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditSave} disabled={savingEdit}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questa nota?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;operazione è irreversibile. La nota verrà rimossa dal diario della pratica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
