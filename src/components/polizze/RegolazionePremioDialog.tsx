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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const ensureExt = ensureAllegatoExt;

export const RegolazionePremioDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [titoloRow, setTitoloRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [splitRows, setSplitRows] = useState<any[]>([]);

  const [dataReg, setDataReg] = useState(todayISO);
  const [periodoDa, setPeriodoDa] = useState("");
  const [periodoA, setPeriodoA] = useState("");
  const [imponibile, setImponibile] = useState<string>("");
  const [premioLordo, setPremioLordo] = useState<string>("0");
  const [premioNetto, setPremioNetto] = useState<string>("0");
  const [accessori, setAccessori] = useState<string>("0");
  const [tasse, setTasse] = useState<string>("0");
  const [provvigioni, setProvvigioni] = useState<string>("0");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) return;
    setDataReg(todayISO);
    setPeriodoDa("");
    setPeriodoA("");
    setImponibile("");
    setPremioLordo("0");
    setPremioNetto("0");
    setAccessori("0");
    setTasse("0");
    setProvvigioni("0");
    setNote("");
    setFile(null);
    setDisplayName("");
    setLoading(true);
    (async () => {
      const { data: tit } = await supabase.from("titoli").select("*").eq("id", titoloId).single();
      setTitoloRow(tit);
      const { data: splits } = await supabase
        .from("titoli_split_commerciali")
        .select("*")
        .eq("titolo_id", titoloId);
      setSplitRows(splits || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  const num = (s: string) => Number((s || "").replace(",", ".")) || 0;
  const premioLordoNum = num(premioLordo);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (!dataReg) throw new Error("Data regolazione obbligatoria");
      if (!titoloRow.regolazione) throw new Error("La polizza non è flaggata come regolabile.");

      // 1. Calcola nuova riga
      const { data: rest } = await supabase
        .from("titoli")
        .select("riga")
        .eq("numero_titolo", titoloRow.numero_titolo);
      const maxRiga = Math.max(
        ...((rest || []).map((r: any) => Number(r.riga || 0))),
        Number(titoloRow.riga || 0),
      );
      const labelData = dataReg.split("-").reverse().join("/");

      // 2. Crea titolo regolazione (RG)
      const noteFinale = [
        `Regolazione premio ${labelData}`,
        periodoDa && periodoA ? `periodo ${periodoDa} → ${periodoA}` : null,
        imponibile ? `imponibile ${num(imponibile).toFixed(2)} €` : null,
        note || null,
      ].filter(Boolean).join(" — ");

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
          garanzia_da: periodoDa || dataReg,
          garanzia_a: periodoA || dataReg,
          premio_lordo: premioLordoNum,
          premio_netto: num(premioNetto),
          accessori: num(accessori),
          tasse: num(tasse),
          provvigioni: num(provvigioni),
          riga: maxRiga + 1,
          sostituisce_polizza: titoloRow.numero_titolo,
          sostituisce_riga: titoloRow.riga,
          stato: "attivo",
          note: noteFinale,
          tipo_portafoglio: titoloRow.tipo_portafoglio,
          tipo_mandatario: titoloRow.tipo_mandatario,
        } as any)
        .select("id")
        .single();
      if (errIns) throw errIns;
      const titoloRegolazioneId = insTit!.id;

      // 3. Replica split commerciali
      if (splitRows.length > 0) {
        const rows = splitRows.map((s: any) => ({
          titolo_id: titoloRegolazioneId,
          anagrafica_commerciale_id: s.anagrafica_commerciale_id,
          commerciale_user_id: s.commerciale_user_id,
          percentuale: s.percentuale,
          ordine: s.ordine,
          note: s.note,
        }));
        await supabase.from("titoli_split_commerciali").insert(rows as any);
      }

      // 4. Documento opzionale
      const { data: { user } } = await supabase.auth.getUser();
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${titoloId}/regolazione_${Date.now()}_${safeName}`;
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

      // 5. Snapshot in titoli_regolazioni
      await supabase.from("titoli_regolazioni").insert({
        titolo_madre_id: titoloId,
        titolo_regolazione_id: titoloRegolazioneId,
        data_regolazione: dataReg,
        periodo_da: periodoDa || null,
        periodo_a: periodoA || null,
        imponibile_consuntivo: imponibile ? num(imponibile) : null,
        conguaglio_premio: premioLordoNum,
        note: note || null,
        documento_id: documentoId,
        created_by: user?.id,
      } as any);

      // 6. Movimento RG sul titolo madre
      const descrParts: string[] = [`Regolazione premio ${labelData}`];
      if (premioLordoNum !== 0) descrParts.push(`conguaglio ${premioLordoNum.toFixed(2)} €`);
      if (note) descrParts.push(note);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "RG",
        data_movimento: dataReg,
        descrizione: descrParts.join(" — "),
        stato: titoloRow.stato,
      } as any);

      // 7. Log
      await logAttivita({
        azione: "regolazione_premio",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_regolazione: dataReg,
          periodo_da: periodoDa,
          periodo_a: periodoA,
          imponibile: imponibile ? num(imponibile) : null,
          conguaglio_premio: premioLordoNum,
          note,
          titolo_regolazione_id: titoloRegolazioneId,
          documento_id: documentoId,
        },
      });

      return { titoloRegolazioneId, documentoNome };
    },
    onSuccess: ({ titoloRegolazioneId, documentoNome }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      const parts: string[] = ["Regolazione registrata"];
      if (titoloRegolazioneId) parts.push("titolo conguaglio creato");
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => toast.error(err.message || "Errore durante la regolazione"),
  });

  const polizzaRegolabile = !!titoloRow?.regolazione;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Regolazione Premio</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza} — conguaglio di fine periodo` : "Conguaglio di fine periodo"}
            </DialogDescription>
          </DialogHeader>

          {!loading && !polizzaRegolabile && (
            <div className="text-sm border border-destructive/40 bg-destructive/10 text-destructive rounded-md p-3">
              Questa polizza non è marcata come <strong>regolabile</strong>. Attiva il flag nella sezione "Regolazione" del titolo prima di emettere il conguaglio.
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-reg-dlg">Data regolazione *</Label>
                <Input id="data-reg-dlg" type="date" value={dataReg} onChange={(e) => setDataReg(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="periodo-da">Periodo da</Label>
                <Input id="periodo-da" type="date" value={periodoDa} onChange={(e) => setPeriodoDa(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="periodo-a">Periodo a</Label>
                <Input id="periodo-a" type="date" value={periodoA} onChange={(e) => setPeriodoA(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imponibile-dlg">Imponibile consuntivo / parametro (€)</Label>
              <Input id="imponibile-dlg" type="number" step="0.01" value={imponibile} onChange={(e) => setImponibile(e.target.value)} className="tabular-nums" placeholder="es. fatturato, retribuzioni, libro matricola" />
            </div>

            <div className="border rounded-md p-3 bg-muted/30 space-y-3">
              <div className="text-sm font-semibold">Conguaglio (positivo = a debito cliente, negativo = a credito cliente)</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Premio lordo</Label>
                  <Input type="number" step="0.01" value={premioLordo} onChange={(e) => setPremioLordo(e.target.value)} className="tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Premio netto</Label>
                  <Input type="number" step="0.01" value={premioNetto} onChange={(e) => setPremioNetto(e.target.value)} className="tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Accessori</Label>
                  <Input type="number" step="0.01" value={accessori} onChange={(e) => setAccessori(e.target.value)} className="tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tasse</Label>
                  <Input type="number" step="0.01" value={tasse} onChange={(e) => setTasse(e.target.value)} className="tabular-nums" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Provvigioni</Label>
                  <Input type="number" step="0.01" value={provvigioni} onChange={(e) => setProvvigioni(e.target.value)} className="tabular-nums" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-reg-dlg">Note</Label>
              <Textarea id="note-reg-dlg" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            <OperazioneAllegatoField
              file={file}
              displayName={displayName}
              onFileChange={(f, name) => { setFile(f); setDisplayName(name); }}
              onDisplayNameChange={setDisplayName}
              label="Lettera/comunicazione compagnia (opzionale)"
              id="regolazione-allegato"
            />
            <p className="text-xs text-muted-foreground -mt-1">Puoi caricarlo ora o aggiungerlo dopo dalle Appendici.</p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={mutation.isPending || loading || !polizzaRegolabile || !dataReg}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma regolazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma regolazione premio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                <div>Data: <strong>{dataReg}</strong></div>
                {(periodoDa || periodoA) && <div>Periodo: <strong>{periodoDa || "?"} → {periodoA || "?"}</strong></div>}
                <div>Conguaglio premio lordo: <strong>{premioLordoNum.toFixed(2)} €</strong></div>
                <div>Verrà creato un nuovo titolo "RG" sulla polizza, da incassare normalmente. Le quietanze future non vengono toccate.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); mutation.mutate(); }}>
              Conferma regolazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
