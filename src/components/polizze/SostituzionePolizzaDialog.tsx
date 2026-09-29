import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import {
  buildOggettoSnapshot,
  buildVeicoloSnapshot,
  calcConguaglioProposto,
} from "@/lib/operazionePolizzaPremi";
import { PolizzaEditorInline, type PolizzaEditorHandle, type PolizzaEditorState } from "./PolizzaEditorInline";
import { OperazionePolizzaDialogShell } from "./operazione/OperazionePolizzaDialogShell";
import { OperazioneAllegatoField, ensureAllegatoExt } from "./operazione/OperazioneAllegatoField";
import { OperazioneRateRiferimento } from "./operazione/OperazioneRateRiferimento";
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
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const CAUSALI = [
  "Cambio veicolo",
  "Cambio bene assicurato",
  "Variazione massimali",
  "Aggiornamento dati",
  "Altro",
];

export const SostituzionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [titoloRow, setTitoloRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateFuture, setRateFuture] = useState<Record<string, unknown>[]>([]);
  const [splitRows, setSplitRows] = useState<Record<string, unknown>[]>([]);
  const [madreId, setMadreId] = useState(titoloId);
  const [editorState, setEditorState] = useState<PolizzaEditorState | null>(null);

  const [dataSostituzione, setDataSostituzione] = useState(todayISO);
  const [causale, setCausale] = useState(CAUSALI[0]);
  const [motivo, setMotivo] = useState("");
  const [nuovoNumeroPolizza, setNuovoNumeroPolizza] = useState("");
  const [conguaglio, setConguaglio] = useState<string>("0");
  const [conguaglioManual, setConguaglioManual] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  const handleEditorStateChange = useCallback((state: PolizzaEditorState) => {
    setEditorState(state);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDataSostituzione(todayISO);
    setCausale(CAUSALI[0]);
    setMotivo("");
    setNuovoNumeroPolizza(numeroPolizza || "");
    setConguaglio("0");
    setConguaglioManual(false);
    setFile(null);
    setDisplayName("");
    setLoading(true);
    (async () => {
      const resolvedMadreId = await resolveTitoloMadreId(supabase, titoloId);
      setMadreId(resolvedMadreId);
      const { data: tit } = await supabase.from("titoli").select("*").eq("id", resolvedMadreId).single();
      setTitoloRow(tit);
      if (tit?.numero_titolo && tit?.riga != null) {
        const { data: future } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa")
          .eq("numero_titolo", tit.numero_titolo)
          .gte("riga", tit.riga)
          .order("riga", { ascending: true });
        setRateFuture(future || []);
      } else {
        setRateFuture([]);
      }
      const { data: splits } = await supabase
        .from("titoli_split_commerciali")
        .select("*")
        .eq("titolo_id", resolvedMadreId);
      setSplitRows(splits || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId, numeroPolizza]);

  useEffect(() => {
    if (!editorState || conguaglioManual) return;
    const proposed = calcConguaglioProposto(editorState.totaleLordo, editorState.originalPremioLordo);
    setConguaglio(String(proposed));
  }, [editorState, conguaglioManual]);

  const conguaglioNum = Number(conguaglio.replace(",", ".")) || 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (!dataSostituzione) throw new Error("Data sostituzione obbligatoria");

      const state = editorRef.current?.getState();
      if (!state) throw new Error("Editor polizza non pronto");

      const madreIdResolved = await resolveTitoloMadreId(supabase, titoloId);

      const [{ data: titoloOrig }, { data: veicoloOrig }] = await Promise.all([
        supabase.from("titoli").select("*").eq("id", madreIdResolved).single(),
        supabase.from("veicoli_polizza").select("*").eq("titolo_id", madreIdResolved).maybeSingle(),
      ]);

      const isRca = state.isRca;
      const parametriPrec = isRca
        ? buildVeicoloSnapshot(veicoloOrig)
        : buildOggettoSnapshot(titoloOrig, null);

      const parametriNew = isRca
        ? buildVeicoloSnapshot(state.veicolo)
        : buildOggettoSnapshot(state.titolo, state.oggettoExtra);

      // 0. Snapshot pre-evento + applica modifiche inline (date, garanzie, oggetto)
      await editorRef.current?.commit("sostituzione");

      const { error: errTit } = await supabase
        .from("titoli")
        .update({
          data_sostituzione: dataSostituzione,
          causale_sostituzione: causale,
          motivo_sostituzione: motivo || null,
        } as never)
        .eq("id", madreIdResolved);
      if (errTit) throw errTit;

      let titoloConguaglioId: string | null = null;
      const maxRiga = Math.max(
        ...rateFuture.map((r) => Number(r.riga || 0)),
        Number(titoloRow.riga || 0),
      );
      const nuovaRiga = maxRiga + 1;
      const labelData = dataSostituzione.split("-").reverse().join("/");
      const noteConguaglio =
        conguaglioNum >= 0
          ? `Conguaglio sostituzione ${labelData}`
          : `Rimborso conguaglio sostituzione ${labelData}`;

      const { data: insTit, error: errIns } = await supabase
        .from("titoli")
        .insert({
          numero_titolo: titoloRow.numero_titolo,
          cliente_id: titoloRow.cliente_id,
          cliente_anagrafica_id: titoloRow.cliente_anagrafica_id,
          compagnia_id: titoloRow.compagnia_id,
          compagnia_rapporto_id: titoloRow.compagnia_rapporto_id,
          codice_rapporto: titoloRow.codice_rapporto,
          ramo_id: titoloRow.ramo_id,
          prodotto_id: titoloRow.prodotto_id,
          prodotto_nome: titoloRow.prodotto_nome,
          ufficio_id: titoloRow.ufficio_id,
          ae_anagrafica_id: titoloRow.ae_anagrafica_id,
          anagrafica_commerciale_id: titoloRow.anagrafica_commerciale_id,
          commerciale_id: titoloRow.commerciale_id,
          percentuale_commerciale: titoloRow.percentuale_commerciale,
          percentuale_riparto: titoloRow.percentuale_riparto,
          garanzia_da: dataSostituzione,
          garanzia_a: dataSostituzione,
          premio_lordo: conguaglioNum,
          premio_netto: conguaglioNum,
          riga: nuovaRiga,
          sostituisce_polizza: titoloRow.numero_titolo,
          sostituisce_riga: titoloRow.riga,
          stato: "attivo",
          note: noteConguaglio,
          tipo_portafoglio: titoloRow.tipo_portafoglio,
          tipo_mandatario: titoloRow.tipo_mandatario,
        } as never)
        .select("id")
        .single();
      if (errIns) throw errIns;
      titoloConguaglioId = insTit!.id as string;

      if (splitRows.length > 0) {
        const rows = splitRows.map((s) => ({
          titolo_id: titoloConguaglioId,
          anagrafica_commerciale_id: s.anagrafica_commerciale_id,
          commerciale_user_id: s.commerciale_user_id,
          percentuale: s.percentuale,
          ordine: s.ordine,
          note: s.note,
        }));
        await supabase.from("titoli_split_commerciali").insert(rows as never);
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: sostIns, error: errSost } = await supabase
        .from("titoli_sostituzioni")
        .insert({
          titolo_id: madreIdResolved,
          data_sostituzione: dataSostituzione,
          causale,
          motivo: motivo || null,
          parametri_precedenti: parametriPrec,
          parametri_nuovi: parametriNew,
          conguaglio: conguaglioNum,
          titolo_conguaglio_id: titoloConguaglioId,
          created_by: user?.id || null,
        } as never)
        .select("id")
        .single();
      if (errSost) throw errSost;

      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId: madreIdResolved,
        numeroCorrente: titoloRow.numero_titolo as string,
        numeroNuovo: nuovoNumeroPolizza,
        causale: "sostituzione",
        motivo: motivo || causale,
        riferimentoId: (sostIns?.id as string) || null,
      });

      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const finalName = ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${madreIdResolved}/sostituzione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase
          .from("documenti")
          .insert({
            nome_file: finalName,
            path_storage: path,
            bucket_name: "documenti_titoli",
            entita_tipo: "titolo",
            entita_id: madreIdResolved,
            caricato_da: user?.id,
          } as never)
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentoId = (docIns?.id as string) || null;
        documentoNome = finalName;
      }

      const descrParts: string[] = [`Sostituzione (${causale})`];
      if (conguaglioNum !== 0) descrParts.push(`conguaglio ${conguaglioNum.toFixed(2)} €`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: madreIdResolved,
        tipo_documento: "SO",
        data_movimento: dataSostituzione,
        descrizione: descrParts.join(" — "),
        stato: "attivo",
      } as never);

      await logAttivita({
        azione: "sostituzione_polizza",
        entita_tipo: "titolo",
        entita_id: madreIdResolved,
        dettagli_json: {
          data_sostituzione: dataSostituzione,
          causale,
          motivo,
          parametri_precedenti: parametriPrec,
          parametri_nuovi: parametriNew,
          conguaglio: conguaglioNum,
          titolo_conguaglio_id: titoloConguaglioId,
          sostituzione_id: sostIns?.id,
          documento_id: documentoId,
          documento_nome: documentoNome,
          numero_polizza_cambiato: numeroCambiato,
          numero_polizza_nuovo: numeroCambiato ? nuovoNumeroPolizza : null,
        },
      });

      return { titoloConguaglioId, documentoNome, numeroCambiato };
    },
    onSuccess: ({ documentoNome, numeroCambiato }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["veicoli-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["titoli-numeri-storici", titoloId] });
      const parts: string[] = ["Polizza sostituita"];
      if (numeroCambiato) parts.push(`nuovo numero polizza ${nuovoNumeroPolizza}`);
      parts.push(`titolo conguaglio creato (€ ${conguaglioNum.toFixed(2)})`);
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: Error) => toast.error(err.message || "Errore durante la sostituzione"),
  });

  const proposedConguaglio =
    editorState != null
      ? calcConguaglioProposto(editorState.totaleLordo, editorState.originalPremioLordo)
      : 0;

  return (
    <>
      <OperazionePolizzaDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Sostituzione Polizza"
        description={numeroPolizza ? `Polizza ${numeroPolizza}` : "Sostituzione oggetto assicurato"}
        eventColumn={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-sost-dlg">Data sostituzione *</Label>
                <Input
                  id="data-sost-dlg"
                  type="date"
                  value={dataSostituzione}
                  onChange={(e) => setDataSostituzione(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="causale-sost-dlg">Causale *</Label>
                <Select value={causale} onValueChange={setCausale}>
                  <SelectTrigger id="causale-sost-dlg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSALI.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-sost-dlg">Motivo</Label>
              <Textarea
                id="motivo-sost-dlg"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Note libere"
              />
            </div>

            <div className="border rounded-md p-3 space-y-2 bg-muted/20">
              <Label htmlFor="sost-nuovo-numero">Nuovo numero polizza (opzionale)</Label>
              <Input
                id="sost-nuovo-numero"
                value={nuovoNumeroPolizza}
                onChange={(e) => setNuovoNumeroPolizza(e.target.value)}
                placeholder={numeroPolizza || "Lascia vuoto per mantenere il numero attuale"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se la compagnia emette un nuovo numero a seguito della sostituzione, inseriscilo qui. Numero attuale:{" "}
                <span className="font-mono">{numeroPolizza || "—"}</span>. Il vecchio numero verrà archiviato nello
                storico della polizza.
              </p>
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="conguaglio-dlg">
                  Conguaglio (positivo = a carico cliente, negativo = rimborso)
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="conguaglio-manual"
                    checked={conguaglioManual}
                    onCheckedChange={(v) => setConguaglioManual(!!v)}
                  />
                  <Label htmlFor="conguaglio-manual" className="text-xs font-normal cursor-pointer">
                    Modifica manuale
                  </Label>
                </div>
              </div>
              <Input
                id="conguaglio-dlg"
                type="number"
                step="0.01"
                value={conguaglio}
                onChange={(e) => {
                  setConguaglioManual(true);
                  setConguaglio(e.target.value);
                }}
                disabled={!conguaglioManual}
                className="tabular-nums"
              />
              {!conguaglioManual && editorState && (
                <p className="text-xs text-muted-foreground">
                  Calcolato automaticamente dal premio lordo: {proposedConguaglio.toFixed(2)} €
                </p>
              )}
            </div>

            <OperazioneRateRiferimento rate={rateFuture as never} loading={loading} />

            <OperazioneAllegatoField
              file={file}
              displayName={displayName}
              onFileChange={(f, name) => {
                setFile(f);
                setDisplayName(name);
              }}
              onDisplayNameChange={setDisplayName}
            />
          </div>
        }
        editorColumn={
          <PolizzaEditorInline
            ref={editorRef}
            titoloId={madreId}
            showOggetto
            onStateChange={handleEditorStateChange}
          />
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Annulla
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={mutation.isPending || loading || !dataSostituzione}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma sostituzione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Polizza <strong>{numeroPolizza || "—"}</strong>.
                </div>
                {nuovoNumeroPolizza && nuovoNumeroPolizza !== numeroPolizza && (
                  <div>
                    Nuovo numero polizza: <strong className="font-mono">{nuovoNumeroPolizza}</strong> (il vecchio
                    verrà archiviato)
                  </div>
                )}
                <div>
                  Data: <strong>{dataSostituzione}</strong> · Causale: <strong>{causale}</strong>
                </div>
                <div>
                  Conguaglio: <strong>{conguaglioNum.toFixed(2)} €</strong> (
                  {conguaglioNum >= 0 ? "a carico cliente" : "a rimborso cliente"}) — titolo sempre creato
                </div>
                {file && (
                  <div>
                    Allegato:{" "}
                    <strong>{ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name)}</strong>
                  </div>
                )}
                <div className="text-muted-foreground">Le quietanze esistenti non vengono toccate.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                mutation.mutate();
              }}
            >
              Conferma sostituzione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SostituzionePolizzaDialog;
