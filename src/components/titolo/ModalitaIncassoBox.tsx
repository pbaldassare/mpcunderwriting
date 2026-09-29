import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HandCoins, Pencil } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MODALITA_INCASSO_OPTIONS,
  modalitaIncassoLabel,
  type ModalitaIncasso,
  type ModalitaIncassoRow,
} from "@/lib/modalitaIncasso";
import { logAttivita } from "@/lib/logAttivita";

interface Props {
  titoloId: string;
  /** Solo titoli incassati: permette rettifica a posteriori. */
  canEdit?: boolean;
}

/**
 * Box read-only (con rettifica) per modalità incasso / trattenuta provvigioni.
 */
export const ModalitaIncassoBox = ({ titoloId, canEdit = false }: Props) => {
  const qc = useQueryClient();
  const [dlgOpen, setDlgOpen] = useState(false);
  const [modalita, setModalita] = useState<ModalitaIncasso>("standard");
  const [note, setNote] = useState("");

  const { data: row } = useQuery({
    queryKey: ["titoli-modalita-incasso", titoloId],
    enabled: !!titoloId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_modalita_incasso") as any)
        .select(
          "id, titolo_id, modalita, anagrafica_commerciale_id, importo_dovuto_lordo, importo_provvigione_lorda, importo_ra, importo_trattenuto_netto, importo_versato_consul, stato, note, applicata_il, anagrafiche_professionali:anagrafica_commerciale_id(ragione_sociale, cognome, nome)",
        )
        .eq("titolo_id", titoloId)
        .eq("stato", "attiva")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const ap = (data as any).anagrafiche_professionali;
      return {
        ...data,
        produttore_nome:
          ap?.ragione_sociale || `${ap?.cognome || ""} ${ap?.nome || ""}`.trim() || null,
      } as ModalitaIncassoRow;
    },
  });

  const rettificaMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("rettifica_modalita_incasso_titolo", {
        p_titolo_id: titoloId,
        p_modalita: modalita,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error || "Rettifica non riuscita");
      await logAttivita({
        azione: "rettifica_modalita_incasso_ui",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { modalita, note: note.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Modalità incasso aggiornata");
      setDlgOpen(false);
      qc.invalidateQueries({ queryKey: ["titoli-modalita-incasso", titoloId] });
      qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      qc.invalidateQueries({ queryKey: ["ec-produttori-mese"] });
      qc.invalidateQueries({ queryKey: ["provvigioni-generate"] });
    },
    onError: (e: any) => toast.error(e?.message || "Errore rettifica"),
  });

  const openRettifica = () => {
    setModalita((row?.modalita as ModalitaIncasso) || "standard");
    setNote("");
    setDlgOpen(true);
  };

  if (!row && !canEdit) return null;

  return (
    <>
      <div className="mt-4 rounded-md border border-violet-400/50 bg-violet-50/40 dark:bg-violet-950/20 p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
            <HandCoins className="w-4 h-4" />
            Modalità incasso / provvigioni
          </div>
          {canEdit && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openRettifica}>
              <Pencil className="w-3 h-3 mr-1" /> Rettifica
            </Button>
          )}
        </div>
        {row ? (
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modalità</span>
              <span className="font-medium">{modalitaIncassoLabel(row.modalita)}</span>
            </div>
            {row.modalita === "produttore_trattiene_provv" && (
              <>
                {row.produttore_nome && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Produttore</span>
                    <span>{row.produttore_nome}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provvigione trattenuta</span>
                  <span className="font-mono">{fmtEuro(Number(row.importo_provvigione_lorda) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">RA</span>
                  <span className="font-mono">{fmtEuro(Number(row.importo_ra) || 0)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Netto trattenuto</span>
                  <span className="font-mono">{fmtEuro(Number(row.importo_trattenuto_netto) || 0)}</span>
                </div>
              </>
            )}
            {row.note && (
              <p className="text-[10px] text-muted-foreground italic pt-1">{row.note}</p>
            )}
            <p className="text-[10px] text-muted-foreground pt-1">
              Registrata il {new Date(row.applicata_il).toLocaleString("it-IT")}. In E/C produttore compare come voce separata, non nel conteggio da liquidare.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Incasso standard. Usa Rettifica per registrare trattenuta provvigioni a posteriori.
          </p>
        )}
      </div>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rettifica modalità incasso</DialogTitle>
            <DialogDescription>
              Corregge la modalità su un titolo già incassato. Aggiorna importo incassato e stato provvigioni produttore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Modalità</Label>
              <Select value={modalita} onValueChange={(v) => setModalita(v as ModalitaIncasso)}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALITA_INCASSO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Note (opzionale)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 text-xs min-h-[72px]"
                placeholder="Motivo della rettifica..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Annulla</Button>
            <Button
              onClick={() => rettificaMutation.mutate()}
              disabled={rettificaMutation.isPending}
            >
              {rettificaMutation.isPending ? "Salvataggio..." : "Conferma rettifica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalitaIncassoBox;
