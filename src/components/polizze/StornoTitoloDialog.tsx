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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmTypingDialog } from "@/components/ui/confirm-typing-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const CAUSALI = [
  "Errore di emissione",
  "Duplicato compagnia",
  "Mancato pagamento definitivo",
  "Annullo amministrativo",
  "Altro",
];

const ensureExt = ensureAllegatoExt;

export const StornoTitoloDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [titoloRow, setTitoloRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rateFutureCancellabili, setRateFutureCancellabili] = useState<any[]>([]);
  const [splitRows, setSplitRows] = useState<any[]>([]);

  const [dataStorno, setDataStorno] = useState(todayISO);
  const [causale, setCausale] = useState(CAUSALI[0]);
  const [motivo, setMotivo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  const eraMessaCassa = !!titoloRow?.data_messa_cassa || titoloRow?.stato === "incassato";

  useEffect(() => {
    if (!open) return;
    setDataStorno(todayISO);
    setCausale(CAUSALI[0]);
    setMotivo("");
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (!dataStorno) throw new Error("Data storno obbligatoria");
      if (["stornato", "estinto", "sostituito", "annullato"].includes(titoloRow.stato)) {
        throw new Error(`Impossibile stornare un titolo in stato "${titoloRow.stato}".`);
      }

      // 1. Update titolo originale → stornato
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "stornato",
          data_storno: dataStorno,
          causale_storno: causale,
          motivo_storno: motivo || null,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      // 2. Cancella quietanze future non incassate
      const quietanzeEliminate: string[] = [];
      const ids = rateFutureCancellabili.map((r: any) => r.id);
      if (ids.length > 0) {
        await supabase.from("movimenti_polizza").delete().in("titolo_id", ids);
        await supabase.from("premi_garanzia_polizza").delete().in("titolo_id", ids);
        const { error: errDel } = await supabase.from("titoli").delete().in("id", ids);
        if (errDel) throw errDel;
        quietanzeEliminate.push(...ids);
      }

      // 3. Se titolo era già a cassa → crea titolo speculare negativo da_incassare
      let titoloStornoId: string | null = null;
      let importoRimborsato = 0;
      if (eraMessaCassa) {
        const { data: rest } = await supabase
          .from("titoli")
          .select("riga")
          .eq("numero_titolo", titoloRow.numero_titolo);
        const maxRiga = Math.max(
          ...((rest || []).map((r: any) => Number(r.riga || 0))),
          Number(titoloRow.riga || 0),
        );
        const labelData = dataStorno.split("-").reverse().join("/");
        importoRimborsato = Number(titoloRow.premio_lordo || 0);

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
            garanzia_da: dataStorno,
            garanzia_a: dataStorno,
            premio_lordo: -Number(titoloRow.premio_lordo || 0),
            premio_netto: -Number(titoloRow.premio_netto || 0),
            provvigioni: titoloRow.provvigioni != null ? -Number(titoloRow.provvigioni) : null,
            accessori: titoloRow.accessori != null ? -Number(titoloRow.accessori) : null,
            tasse: titoloRow.tasse != null ? -Number(titoloRow.tasse) : null,
            riga: maxRiga + 1,
            sostituisce_polizza: titoloRow.numero_titolo,
            sostituisce_riga: titoloRow.riga,
            stato: "attivo",
            note: `Storno polizza ${labelData} (${causale})`,
            tipo_portafoglio: titoloRow.tipo_portafoglio,
            tipo_mandatario: titoloRow.tipo_mandatario,
          } as any)
          .select("id")
          .single();
        if (errIns) throw errIns;
        titoloStornoId = insTit!.id;

        if (splitRows.length > 0) {
          const rows = splitRows.map((s: any) => ({
            titolo_id: titoloStornoId,
            anagrafica_commerciale_id: s.anagrafica_commerciale_id,
            commerciale_user_id: s.commerciale_user_id,
            percentuale: s.percentuale,
            ordine: s.ordine,
            note: s.note,
          }));
          await supabase.from("titoli_split_commerciali").insert(rows as any);
        }

        await supabase
          .from("titoli")
          .update({ titolo_storno_id: titoloStornoId } as any)
          .eq("id", titoloId);
      }

      // 4. Documento opzionale
      const { data: { user } } = await supabase.auth.getUser();
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${titoloId}/storno_${Date.now()}_${safeName}`;
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

      // 5. Snapshot in titoli_storni
      await supabase.from("titoli_storni").insert({
        titolo_id: titoloId,
        titolo_storno_id: titoloStornoId,
        data_storno: dataStorno,
        causale,
        motivo: motivo || null,
        importo_rimborsato: importoRimborsato,
        era_messa_cassa: eraMessaCassa,
        documento_id: documentoId,
        created_by: user?.id,
      } as any);

      // 6. Movimento ST
      const descrParts: string[] = [`Storno polizza (${causale})`];
      if (eraMessaCassa) descrParts.push(`titolo già a cassa — creato storno speculare da incassare`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "ST",
        data_movimento: dataStorno,
        descrizione: descrParts.join(" — "),
        stato: "stornato",
      } as any);

      // 7. Log
      await logAttivita({
        azione: "storno_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_storno: dataStorno,
          causale,
          motivo,
          era_messa_cassa: eraMessaCassa,
          quietanze_cancellate: quietanzeEliminate,
          titolo_storno_id: titoloStornoId,
          documento_id: documentoId,
        },
      });

      return { quietanzeEliminate, titoloStornoId, documentoNome };
    },
    onSuccess: ({ quietanzeEliminate, titoloStornoId, documentoNome }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      const parts: string[] = ["Polizza stornata"];
      if (quietanzeEliminate.length > 0) parts.push(`${quietanzeEliminate.length} quietanze future rimosse`);
      if (titoloStornoId) parts.push("titolo speculare di storno creato (da incassare)");
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => toast.error(err.message || "Errore durante lo storno"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Storno Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Annullamento amministrativo del titolo"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {eraMessaCassa && (
              <div className="text-xs border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 rounded-md p-2">
                Il titolo è già <strong>a cassa</strong>: lo storno creerà un <strong>titolo speculare negativo</strong> in stato <strong>da incassare</strong> (verrà incassato in remittance).
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-st-dlg">Data storno *</Label>
                <Input id="data-st-dlg" type="date" value={dataStorno} onChange={(e) => setDataStorno(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="causale-st-dlg">Causale *</Label>
                <Select value={causale} onValueChange={setCausale}>
                  <SelectTrigger id="causale-st-dlg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAUSALI.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-st-dlg">Motivo</Label>
              <Textarea id="motivo-st-dlg" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Note libere" />
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

            <OperazioneAllegatoField
              file={file}
              displayName={displayName}
              onFileChange={(f, name) => { setFile(f); setDisplayName(name); }}
              onDisplayNameChange={setDisplayName}
              id="storno-allegato"
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Annulla</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={mutation.isPending || loading || !dataStorno}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma storno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmTypingDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Conferma storno polizza"
        confirmationText={numeroPolizza || "STORNA"}
        actionLabel="Conferma storno"
        loading={mutation.isPending}
        onConfirm={() => { setConfirmOpen(false); mutation.mutate(); }}
        description={
          <>
            <div>Polizza <strong>{numeroPolizza || "—"}</strong>.</div>
            <div>Data: <strong>{dataStorno}</strong> · Causale: <strong>{causale}</strong></div>
            <div>Quietanze future cancellate: <strong>{rateFutureCancellabili.length}</strong></div>
            {eraMessaCassa && <div>Verrà creato un <strong>titolo speculare negativo</strong> da incassare.</div>}
            <div className="text-destructive">La polizza passerà in stato <strong>Stornata</strong> e i campi non saranno più modificabili.</div>
          </>
        }
      />
    </>
  );
};
