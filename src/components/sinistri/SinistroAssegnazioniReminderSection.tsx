import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { Plus, Bell, Pencil, Ban } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import {
  type SinistroReminderRow,
  type SinistroReminderCategoria,
  REMINDER_CATEGORIA_LABEL,
  REMINDER_CATEGORIA_OPTIONS,
  REMINDER_STATO_CLASS,
  REMINDER_STATO_LABEL,
} from "@/lib/sinistroPrescrizioniReminder";
import { useAuth } from "@/contexts/AuthContext";

interface SinistroContext {
  id: string;
  titolo_id?: string | null;
  cliente_anagrafica_id?: string | null;
  responsabile_id?: string | null;
  clienti?: { cognome?: string; nome?: string; ragione_sociale?: string; tipo_cliente?: string } | null;
  titoli?: { numero_titolo?: string | null } | null;
  profiles?: { nome?: string; cognome?: string } | null;
}

interface Props {
  sinistro: SinistroContext;
  disabled?: boolean;
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const parsed = parseISO(d);
  return isValid(parsed) ? format(parsed, "dd/MM/yyyy") : "—";
};

export default function SinistroAssegnazioniReminderSection({ sinistro, disabled }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<SinistroReminderRow | null>(null);
  const [testo, setTesto] = useState("");
  const [dataScadenza, setDataScadenza] = useState("");
  const [categoria, setCategoria] = useState<SinistroReminderCategoria>("altro");
  const [assegnatoA, setAssegnatoA] = useState(sinistro.responsabile_id || "");
  const [saving, setSaving] = useState(false);
  const [completingReminder, setCompletingReminder] = useState<SinistroReminderRow | null>(null);
  const [annullingReminder, setAnnullingReminder] = useState<SinistroReminderRow | null>(null);
  const [completing, setCompleting] = useState(false);
  const [annulling, setAnnulling] = useState(false);

  const clienteNome = resolveClienteNome(sinistro.clienti);
  const polizzaNumero = sinistro.titoli?.numero_titolo || "—";

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["sinistro-reminder", sinistro.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_reminder" as any)
        .select(`
          *,
          assegnato:profiles!sinistro_reminder_assegnato_a_fkey(nome, cognome)
        `)
        .eq("sinistro_id", sinistro.id)
        .neq("stato", "annullato")
        .order("data_scadenza", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SinistroReminderRow[];
    },
  });

  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-reminder", sinistro.responsabile_id],
    queryFn: async () => {
      const { data: ss } = await supabase.from("specialist_sinistri_sedi" as any).select("profilo_id");
      const ids = [...new Set(((ss || []) as unknown as { profilo_id: string }[]).map((r) => r.profilo_id))];
      if (sinistro.responsabile_id && !ids.includes(sinistro.responsabile_id)) {
        ids.push(sinistro.responsabile_id);
      }
      let q = supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return (data || []).map((p) => ({
        value: p.id,
        label: `${p.cognome || ""} ${p.nome || ""}`.trim() || p.id,
      }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sinistro-reminder", sinistro.id] });
    qc.invalidateQueries({ queryKey: ["sinistri-reminder-list"] });
    qc.invalidateQueries({ queryKey: ["sinistro-reminder-popup"] });
  };

  const resetForm = () => {
    setTesto("");
    setDataScadenza("");
    setCategoria("altro");
    setAssegnatoA(sinistro.responsabile_id || "");
    setEditRow(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: SinistroReminderRow) => {
    setEditRow(row);
    setTesto(row.testo);
    setDataScadenza(row.data_scadenza?.slice(0, 10) || row.data_promemoria?.slice(0, 10) || "");
    setCategoria(row.categoria || "altro");
    setAssegnatoA(row.assegnato_a || sinistro.responsabile_id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!testo.trim()) {
      toast.error("Inserisci il testo del reminder");
      return;
    }
    if (!dataScadenza) {
      toast.error("Inserisci la data di scadenza");
      return;
    }
    if (!assegnatoA) {
      toast.error("Seleziona il responsabile assegnato");
      return;
    }
    if (!user?.id) return;

    setSaving(true);
    try {
      const payload = {
        sinistro_id: sinistro.id,
        user_id: user.id,
        creato_da: user.id,
        assegnato_a: assegnatoA,
        titolo_id: sinistro.titolo_id || null,
        cliente_id: sinistro.cliente_anagrafica_id || null,
        testo: testo.trim(),
        categoria,
        data_scadenza: dataScadenza,
        data_promemoria: dataScadenza,
        stato: "attivo" as const,
        letto: false,
        completato: false,
      };

      if (editRow) {
        const { error } = await supabase
          .from("sinistro_reminder" as any)
          .update({
            testo: payload.testo,
            categoria: payload.categoria,
            data_scadenza: payload.data_scadenza,
            data_promemoria: payload.data_scadenza,
            assegnato_a: payload.assegnato_a,
            popup_mostrato_at: null,
          })
          .eq("id", editRow.id);
        if (error) throw error;
        toast.success("Reminder aggiornato");
      } else {
        const { error } = await supabase.from("sinistro_reminder" as any).insert(payload);
        if (error) throw error;
        toast.success("Reminder creato");
      }

      setDialogOpen(false);
      resetForm();
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleAnnullaReminder = async () => {
    if (!annullingReminder) return;
    setAnnulling(true);
    try {
      const { error } = await supabase
        .from("sinistro_reminder" as any)
        .update({ stato: "annullato", completato: true })
        .eq("id", annullingReminder.id);
      if (error) throw error;
      toast.success("Reminder annullato");
      setAnnullingReminder(null);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setAnnulling(false);
    }
  };

  const handleCompletaReminder = async () => {
    if (!completingReminder) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("sinistro_reminder" as any)
        .update({ stato: "completato", completato: true, letto: true })
        .eq("id", completingReminder.id);
      if (error) throw error;
      setCompletingReminder(null);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> Reminder sinistro
        </p>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuovo reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editRow ? "Modifica reminder" : "Nuovo reminder"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3">
                <div>
                  <span className="text-xs text-muted-foreground">Cliente</span>
                  <p className="font-medium truncate">{clienteNome}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Polizza</span>
                  <p className="font-medium truncate">{polizzaNumero}</p>
                </div>
              </div>
              <div>
                <Label>Responsabile assegnato *</Label>
                <SearchableSelect
                  value={assegnatoA}
                  onValueChange={setAssegnatoA}
                  options={responsabiliList}
                  placeholder="Seleziona responsabile..."
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={(v) => setCategoria(v as SinistroReminderCategoria)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_CATEGORIA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Testo *</Label>
                <Textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={3} placeholder="Cosa ricordare…" />
              </div>
              <div>
                <Label>Scadenza *</Label>
                <Input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {editRow ? "Salva modifiche" : "Crea reminder"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Caricamento reminder…</p>
      ) : reminders.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessun reminder attivo per questa pratica.</p>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-start gap-2 p-2.5 border rounded-md text-sm bg-muted/20">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {REMINDER_CATEGORIA_LABEL[r.categoria] || r.categoria}
                  </Badge>
                  <Badge className={`text-[10px] ${REMINDER_STATO_CLASS[r.stato]}`}>
                    {REMINDER_STATO_LABEL[r.stato]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Scadenza {fmtDate(r.data_scadenza || r.data_promemoria)}</span>
                </div>
                <p className={r.stato === "completato" ? "line-through text-muted-foreground" : ""}>{r.testo}</p>
                <p className="text-xs text-muted-foreground">
                  Assegnato a:{" "}
                  {r.assegnato
                    ? `${r.assegnato.cognome || ""} ${r.assegnato.nome || ""}`.trim()
                    : "—"}
                </p>
              </div>
              {!disabled && r.stato === "attivo" && (
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCompletingReminder(r)}>
                    ✓
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAnnullingReminder(r)}>
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!completingReminder} onOpenChange={(open) => !open && !completing && setCompletingReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Segnare come completato?</AlertDialogTitle>
            <AlertDialogDescription>
              Il reminder verrà contrassegnato come completato. Non riceverai più notifiche per questa scadenza,
              ma resterà visibile nello storico della pratica con testo barrato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompletaReminder} disabled={completing}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!annullingReminder} onOpenChange={(open) => !open && !annulling && setAnnullingReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare questo reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Il reminder verrà disattivato e rimosso dall&apos;elenco dei promemoria attivi.
              L&apos;operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annulling}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnnullaReminder}
              disabled={annulling}
              className="bg-destructive hover:bg-destructive/90"
            >
              Conferma annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
