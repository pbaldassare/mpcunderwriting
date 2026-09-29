import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { OperazioneAllegatoField, ensureAllegatoExt } from "@/components/polizze/operazione/OperazioneAllegatoField";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const CAUSALI = [
  "Recesso cliente",
  "Recesso compagnia",
  "Vendita bene",
  "Cessazione attività",
  "Disdetta anticipata",
  "Sinistro totale",
  "Altro",
];

const ensureExt = ensureAllegatoExt;

export const EstinzionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [titoloRow, setTitoloRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rateFutureCancellabili, setRateFutureCancellabili] = useState<any[]>([]);
  const [splitRows, setSplitRows] = useState<any[]>([]);

  const [dataEstinzione, setDataEstinzione] = useState(todayISO);
  const [causale, setCausale] = useState(CAUSALI[0]);
  const [motivo, setMotivo] = useState("");
  const [rimborso, setRimborso] = useState<string>("0");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) return;
    setDataEstinzione(todayISO);
    setCausale(CAUSALI[0]);
    setMotivo("");
    setRimborso("0");
    setFile(null);
    setDisplayName("");
    setLoading(true);
    (async () => {
      const { data: tit } = await supabase.from("titoli").select("*").eq("id", titoloId).single();
      setTitoloRow(tit);
      if (tit?.numero_titolo && tit?.riga != null) {
        const { data: future } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa")
          .eq("numero_titolo", tit.numero_titolo)
          .gt("riga", tit.riga)
          .neq("stato", "incassato")
          .is("data_messa_cassa", null)
          .order("riga", { ascending: true });
        setRateFutureCancellabili(future || []);
      }
      const { data: splits } = await supabase
        .from("titoli_split_commerciali")
        .select("*")
        .eq("titolo_id", titoloId);
      setSplitRows(splits || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  const rimborsoNum = Number(rimborso.replace(",", ".")) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (!dataEstinzione) throw new Error("Data estinzione obbligatoria");

      // 1. Update polizza madre → estinto
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "estinto",
          data_estinzione: dataEstinzione,
          causale_estinzione: causale,
          motivo_estinzione: motivo || null,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      // 2. Cancella quietanze future cancellabili (pattern sospensione)
      const quietanzeEliminate: string[] = [];
      const ids = rateFutureCancellabili.map((r: any) => r.id);
      if (ids.length > 0) {
        await supabase.from("movimenti_polizza").delete().in("titolo_id", ids);
        await supabase.from("premi_garanzia_polizza").delete().in("titolo_id", ids);
        const { error: errDel } = await supabase.from("titoli").delete().in("id", ids);
        if (errDel) throw errDel;
        quietanzeEliminate.push(...ids);
      }

      // 3. Titolo rimborso (se > 0)
      let titoloRimborsoId: string | null = null;
      if (rimborsoNum > 0) {
        // ricalcola maxRiga dopo le delete
        const { data: rest } = await supabase
          .from("titoli")
          .select("riga")
          .eq("numero_titolo", titoloRow.numero_titolo);
        const maxRiga = Math.max(
          ...((rest || []).map((r: any) => Number(r.riga || 0))),
          Number(titoloRow.riga || 0),
        );
        const labelData = dataEstinzione.split("-").reverse().join("/");

        const { data: insTit, error: errIns } = await supabase
          .from("titoli")
          .insert({
            numero_titolo: titoloRow.numero_titolo,
            cliente_id: titoloRow.cliente_id,
            cliente_anagrafica_id: titoloRow.cliente_anagrafica_id,
            compagnia_id: titoloRow.compagnia_id,
            compagnia_rapporto_id: (titoloRow as any).compagnia_rapporto_id,
            codice_rapporto: (titoloRow as any).codice_rapporto,
            ramo_id: titoloRow.ramo_id,
            prodotto_id: titoloRow.prodotto_id,
            prodotto_nome: titoloRow.prodotto_nome,
            ufficio_id: titoloRow.ufficio_id,
            ae_anagrafica_id: (titoloRow as any).ae_anagrafica_id,
            anagrafica_commerciale_id: (titoloRow as any).anagrafica_commerciale_id,
            commerciale_id: titoloRow.commerciale_id,
            percentuale_commerciale: titoloRow.percentuale_commerciale,
            percentuale_riparto: titoloRow.percentuale_riparto,
            garanzia_da: dataEstinzione,
            garanzia_a: dataEstinzione,
            premio_lordo: -rimborsoNum,
            premio_netto: -rimborsoNum,
            riga: maxRiga + 1,
            sostituisce_polizza: titoloRow.numero_titolo,
            sostituisce_riga: titoloRow.riga,
            stato: "attivo",
            note: `Rimborso estinzione ${labelData} (${causale})`,
            tipo_portafoglio: titoloRow.tipo_portafoglio,
            tipo_mandatario: titoloRow.tipo_mandatario,
          } as any)
          .select("id")
          .single();
        if (errIns) throw errIns;
        titoloRimborsoId = insTit!.id;

        if (splitRows.length > 0) {
          const rows = splitRows.map((s: any) => ({
            titolo_id: titoloRimborsoId,
            anagrafica_commerciale_id: s.anagrafica_commerciale_id,
            commerciale_user_id: s.commerciale_user_id,
            percentuale: s.percentuale,
            ordine: s.ordine,
            note: s.note,
          }));
          await supabase.from("titoli_split_commerciali").insert(rows as any);
        }
      }

      // 4. Upload documento opzionale
      const { data: { user } } = await supabase.auth.getUser();
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${titoloId}/estinzione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase
          .from("documenti")
          .insert({
            nome_file: finalName,
            path_storage: path,
            bucket_name: "documenti_titoli",
            entita_tipo: "titolo",
            entita_id: titoloId,
            caricato_da: user?.id,
          })
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentoId = docIns?.id || null;
        documentoNome = finalName;
      }

      // 5. Movimento ES
      const descrParts: string[] = [`Estinzione polizza (${causale})`];
      if (rimborsoNum > 0) descrParts.push(`rimborso ${rimborsoNum.toFixed(2)} €`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "ES",
        data_movimento: dataEstinzione,
        descrizione: descrParts.join(" — "),
        stato: "estinto",
      } as any);

      // 6. Log
      await logAttivita({
        azione: "estinzione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_estinzione: dataEstinzione,
          causale,
          motivo,
          quietanze_cancellate: quietanzeEliminate,
          rimborso: rimborsoNum,
          titolo_rimborso_id: titoloRimborsoId,
          documento_id: documentoId,
          documento_nome: documentoNome,
        },
      });

      return { quietanzeEliminate, titoloRimborsoId, documentoNome };
    },
    onSuccess: ({ quietanzeEliminate, titoloRimborsoId, documentoNome }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      const parts: string[] = ["Polizza estinta"];
      if (quietanzeEliminate.length > 0) parts.push(`${quietanzeEliminate.length} quietanze future rimosse`);
      if (titoloRimborsoId) parts.push("titolo rimborso creato");
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => toast.error(err.message || "Errore durante l'estinzione"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estinzione Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Chiusura anticipata del contratto"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-est-dlg">Data estinzione *</Label>
                <Input
                  id="data-est-dlg"
                  type="date"
                  value={dataEstinzione}
                  onChange={(e) => setDataEstinzione(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="causale-est-dlg">Causale *</Label>
                <Select value={causale} onValueChange={setCausale}>
                  <SelectTrigger id="causale-est-dlg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSALI.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-est-dlg">Motivo</Label>
              <Textarea
                id="motivo-est-dlg"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Note libere"
              />
            </div>

            <div className="border rounded-md p-3 bg-muted/30">
              <div className="text-sm font-semibold mb-2">Quietanze future che verranno cancellate</div>
              {loading ? (
                <div className="text-xs text-muted-foreground">Caricamento…</div>
              ) : rateFutureCancellabili.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nessuna quietanza futura da cancellare.</div>
              ) : (
                <ul className="text-xs space-y-1 tabular-nums">
                  {rateFutureCancellabili.map((r: any) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span>Riga {r.riga} · {r.garanzia_da} → {r.garanzia_a}</span>
                      <span className="font-medium">{Number(r.premio_lordo || 0).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rimborso-dlg">Importo rimborso al cliente (€)</Label>
              <Input
                id="rimborso-dlg"
                type="number"
                min="0"
                step="0.01"
                value={rimborso}
                onChange={(e) => setRimborso(e.target.value)}
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Se &gt; 0 viene creato un titolo negativo "Rimborso Estinzione" da contabilizzare.
              </p>
            </div>

            <OperazioneAllegatoField
              file={file}
              displayName={displayName}
              onFileChange={(f, name) => { setFile(f); setDisplayName(name); }}
              onDisplayNameChange={setDisplayName}
              id="estinzione-allegato"
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Annulla</Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={mutation.isPending || loading || !dataEstinzione}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma estinzione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma estinzione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                <div>Data: <strong>{dataEstinzione}</strong> · Causale: <strong>{causale}</strong></div>
                <div>Quietanze future cancellate: <strong>{rateFutureCancellabili.length}</strong></div>
                {rimborsoNum > 0 && <div>Rimborso al cliente: <strong>{rimborsoNum.toFixed(2)} €</strong></div>}
                {file && <div>Allegato: <strong>{ensureExt((displayName || file.name).trim() || file.name, file.name)}</strong></div>}
                <div className="text-destructive">La polizza passerà in stato <strong>Estinta</strong> e i campi non saranno più modificabili.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); mutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma estinzione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EstinzionePolizzaDialog;
