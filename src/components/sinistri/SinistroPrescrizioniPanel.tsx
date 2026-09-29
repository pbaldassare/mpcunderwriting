import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, isValid, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, Send, CheckCircle } from "lucide-react";
import {
  type SinistroPrescrizioneRow,
  type PrescrizioneStato,
  PRESCRIZIONE_STATO_LABEL,
  PRESCRIZIONE_STATO_CLASS,
  DESTINATARIO_LABEL,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
  PRESCRIZIONE_BIENNALE_OGGETTO,
  buildPrescrizioneBiennaleAgenzia,
  calcScadenzaPrescrizioneBiennale,
} from "@/lib/sinistroPrescrizioniReminder";

type FormState = {
  destinatario_label: string;
  oggetto: string;
  corpo: string;
  data_scadenza_risposta: string;
  data_invio: string;
  canale: string;
  note: string;
  stato: PrescrizioneStato;
};

function emptyForm(dataAccadimento?: string | null, agenziaRiferimento?: string | null): FormState {
  const auto = buildPrescrizioneBiennaleAgenzia(dataAccadimento, agenziaRiferimento);
  return {
    destinatario_label: (agenziaRiferimento || "").trim() || auto?.destinatario_label || "",
    oggetto: auto?.oggetto || PRESCRIZIONE_BIENNALE_OGGETTO,
    corpo: auto?.corpo || "",
    data_scadenza_risposta: auto?.data_scadenza_risposta || calcScadenzaPrescrizioneBiennale(dataAccadimento),
    data_invio: "",
    canale: "",
    note: "",
    stato: "bozza",
  };
}

function fmtDateSafe(value?: string | null): string {
  if (!value) return "—";
  const d = parseISO(value);
  if (!isValid(d)) return "—";
  return format(d, "dd/MM/yyyy");
}

interface Props {
  sinistroId: string;
  /** Data accadimento (`data_evento`); fallback denuncia se assente. */
  dataDenuncia?: string | null;
  /** Nome agenzia di riferimento della polizza (non la compagnia assicurativa). */
  agenziaRiferimento?: string | null;
  disabled?: boolean;
}

export default function SinistroPrescrizioniPanel({
  sinistroId,
  dataDenuncia,
  agenziaRiferimento,
  disabled,
}: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SinistroPrescrizioneRow | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(dataDenuncia, agenziaRiferimento));
  const [saving, setSaving] = useState(false);
  const autoCreatedRef = useRef(false);
  const backfillDoneRef = useRef(false);

  const agenziaLabel = (agenziaRiferimento || "").trim();

  const { data: prescrizioni = [], isLoading } = useQuery({
    queryKey: ["sinistro-prescrizioni", sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistro_prescrizioni")
        .select("*")
        .eq("sinistro_id", sinistroId)
        .order("data_scadenza_risposta", { ascending: true });
      if (error) throw error;
      return (data || []) as SinistroPrescrizioneRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sinistro-prescrizioni", sinistroId] });

  // Prescrizione biennale automatica verso agenzia di riferimento
  useEffect(() => {
    if (isLoading || disabled || autoCreatedRef.current || prescrizioni.length > 0) return;
    const draft = buildPrescrizioneBiennaleAgenzia(dataDenuncia, agenziaLabel || null);
    if (!draft) return;

    autoCreatedRef.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("sinistro_prescrizioni").insert({
          sinistro_id: sinistroId,
          creato_da: user.id,
          destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
          destinatario_label: agenziaLabel || draft.destinatario_label || null,
          oggetto: draft.oggetto,
          corpo: draft.corpo || null,
          data_scadenza_risposta: draft.data_scadenza_risposta,
          stato: "bozza",
        });
        if (error) throw error;
        invalidate();
      } catch {
        autoCreatedRef.current = false;
      }
    })();
  }, [isLoading, prescrizioni.length, dataDenuncia, disabled, sinistroId, agenziaLabel]);

  // Backfill label agenzia su bozze create senza nome (una sola volta per mount)
  useEffect(() => {
    if (backfillDoneRef.current || !agenziaLabel || isLoading || disabled || prescrizioni.length === 0) return;
    const toFix = prescrizioni.filter(
      (p) =>
        p.destinatario_tipo === PRESCRIZIONE_DESTINATARIO_AGENZIA &&
        !p.destinatario_label?.trim() &&
        p.stato === "bozza",
    );
    if (toFix.length === 0) return;

    backfillDoneRef.current = true;
    (async () => {
      try {
        for (const p of toFix) {
          const { error } = await supabase
            .from("sinistro_prescrizioni")
            .update({ destinatario_label: agenziaLabel })
            .eq("id", p.id);
          if (error) throw error;
        }
        invalidate();
      } catch {
        backfillDoneRef.current = false;
      }
    })();
  }, [agenziaLabel, isLoading, disabled, prescrizioni.length, sinistroId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(dataDenuncia, agenziaLabel || null));
    setDialogOpen(true);
  };

  const openEdit = (row: SinistroPrescrizioneRow) => {
    setEditing(row);
    setForm({
      destinatario_label: row.destinatario_label || agenziaLabel || "",
      oggetto: row.oggetto,
      corpo: row.corpo || "",
      data_scadenza_risposta: row.data_scadenza_risposta,
      data_invio: row.data_invio || "",
      canale: row.canale || "",
      note: row.note || "",
      stato: row.stato,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.oggetto.trim() || !form.data_scadenza_risposta) {
      toast.error("Oggetto e scadenza risposta sono obbligatori");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const payload = {
        sinistro_id: sinistroId,
        destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
        destinatario_label: form.destinatario_label.trim() || agenziaLabel || null,
        oggetto: form.oggetto.trim(),
        corpo: form.corpo.trim() || null,
        data_scadenza_risposta: form.data_scadenza_risposta,
        data_invio: form.data_invio || null,
        canale: form.canale.trim() || null,
        note: form.note.trim() || null,
        stato: form.stato,
      };

      if (editing) {
        const { error } = await supabase.from("sinistro_prescrizioni").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Prescrizione aggiornata");
      } else {
        const { error } = await supabase.from("sinistro_prescrizioni").insert({ ...payload, creato_da: user.id });
        if (error) throw error;
        toast.success("Prescrizione aggiunta");
      }
      setDialogOpen(false);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const updateStato = async (id: string, stato: PrescrizioneStato, dataInvio?: string) => {
    try {
      const update: Record<string, unknown> = { stato };
      if (dataInvio) update.data_invio = dataInvio;
      const { error } = await supabase.from("sinistro_prescrizioni").update(update).eq("id", id);
      if (error) throw error;
      toast.success(`Stato aggiornato: ${PRESCRIZIONE_STATO_LABEL[stato]}`);
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa prescrizione?")) return;
    try {
      const { error } = await supabase.from("sinistro_prescrizioni").delete().eq("id", id);
      if (error) throw error;
      toast.success("Prescrizione eliminata");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore eliminazione");
    }
  };

  const oggi = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={disabled} onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nuova prescrizione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica prescrizione" : "Nuova prescrizione perentoria"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Destinatario</Label>
                  <div className="h-10 px-3 flex items-center text-sm rounded-md border bg-muted/30">
                    {DESTINATARIO_LABEL[PRESCRIZIONE_DESTINATARIO_AGENZIA]}
                  </div>
                </div>
                <div>
                  <Label>Agenzia di riferimento</Label>
                  <Input
                    value={form.destinatario_label}
                    onChange={(e) => setForm({ ...form, destinatario_label: e.target.value })}
                    placeholder={agenziaLabel || "Nome agenzia di riferimento"}
                  />
                  {agenziaLabel && form.destinatario_label === agenziaLabel && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Compilato dalla polizza collegata
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Oggetto *</Label>
                <Input value={form.oggetto} onChange={(e) => setForm({ ...form, oggetto: e.target.value })} />
              </div>
              <div>
                <Label>Corpo comunicazione</Label>
                <Textarea value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Scadenza risposta *</Label>
                  <Input
                    type="date"
                    value={form.data_scadenza_risposta}
                    onChange={(e) => setForm({ ...form, data_scadenza_risposta: e.target.value })}
                  />
                  {dataDenuncia && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Biennale da denuncia ({fmtDateSafe(dataDenuncia)})
                    </p>
                  )}
                </div>
                <div>
                  <Label>Data invio</Label>
                  <Input type="date" value={form.data_invio} onChange={(e) => setForm({ ...form, data_invio: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Canale</Label>
                  <Input value={form.canale} onChange={(e) => setForm({ ...form, canale: e.target.value })} placeholder="PEC, email, raccomandata…" />
                </div>
                {editing && (
                  <div>
                    <Label>Stato</Label>
                    <Select value={form.stato} onValueChange={(v) => setForm({ ...form, stato: v as PrescrizioneStato })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRESCRIZIONE_STATO_LABEL).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label>Note</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {editing ? "Salva modifiche" : "Aggiungi prescrizione"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Destinatario</TableHead>
            <TableHead>Oggetto</TableHead>
            <TableHead>Scadenza</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Caricamento…</TableCell></TableRow>
          ) : prescrizioni.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nessuna prescrizione registrata</TableCell></TableRow>
          ) : (
            prescrizioni.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {DESTINATARIO_LABEL[p.destinatario_tipo] || "Agenzia di riferimento"}
                  {p.destinatario_label ? (
                    <span className="text-muted-foreground block text-xs">{p.destinatario_label}</span>
                  ) : agenziaLabel ? (
                    <span className="text-muted-foreground block text-xs">{agenziaLabel}</span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-xs truncate" title={p.oggetto}>{p.oggetto}</TableCell>
                <TableCell>{fmtDateSafe(p.data_scadenza_risposta)}</TableCell>
                <TableCell>
                  <Badge className={PRESCRIZIONE_STATO_CLASS[p.stato]}>{PRESCRIZIONE_STATO_LABEL[p.stato]}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {p.stato === "bozza" && !disabled && (
                      <Button size="sm" variant="outline" title="Segna inviata" onClick={() => updateStato(p.id, "inviata", oggi)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {p.stato === "inviata" && !disabled && (
                      <Button size="sm" variant="outline" title="Risposta ricevuta" onClick={() => updateStato(p.id, "risposta_ricevuta")}>
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!disabled && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
