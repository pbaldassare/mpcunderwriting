import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { frazionamentoMesi, frazionamentoToRate } from "@/lib/frazionamento";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
import {
  addDaysISO,
  computeShiftedDates,
  diffDaysISO,
  resolveTitoloMadreId,
  type QuietanzeSospensioneSnapshot,
} from "@/lib/sospensioneQuietanze";
import { PolizzaEditorInline, type PolizzaEditorHandle, type PolizzaEditorState } from "./PolizzaEditorInline";
import { OperazionePolizzaDialogShell } from "./operazione/OperazionePolizzaDialogShell";
import { OperazioneAllegatoField, ensureAllegatoExt } from "./operazione/OperazioneAllegatoField";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const addMonthsISO = (iso: string, months: number) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const minISO = (a: string, b: string) => (a < b ? a : b);

export const RiattivazionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [titoloRow, setTitoloRow] = useState<Record<string, unknown> | null>(null);
  const [loadingTitolo, setLoadingTitolo] = useState(false);
  const [editorState, setEditorState] = useState<PolizzaEditorState | null>(null);
  const [dataRiattivazione, setDataRiattivazione] = useState(todayISO);
  const [oneri, setOneri] = useState<string>("0");
  const [motivo, setMotivo] = useState("Riattivazione su richiesta cliente");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nuovoNumero, setNuovoNumero] = useState("");
  const [madreId, setMadreId] = useState(titoloId);

  const handleEditorStateChange = useCallback((state: PolizzaEditorState) => {
    setEditorState(state);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDataRiattivazione(todayISO);
    setOneri("0");
    setMotivo("Riattivazione su richiesta cliente");
    setFile(null);
    setDisplayName("");
    setNuovoNumero("");
    setEditorState(null);
    setLoadingTitolo(true);
    (async () => {
      const resolvedMadreId = await resolveTitoloMadreId(supabase, titoloId);
      setMadreId(resolvedMadreId);
      const { data } = await supabase.from("titoli").select("*").eq("id", resolvedMadreId).single();
      setTitoloRow(data);
      setLoadingTitolo(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  const preview = useMemo(() => {
    const titolo = editorState?.titolo ?? titoloRow;
    if (!titolo) return [] as Array<{ da: string; a: string; importo: number }>;
    const fraz = (titolo.frazionamento as string) || "Annuale";
    const anni = (titolo.anni_durata as number) || 1;
    const mesi = frazionamentoMesi(fraz, anni);
    const ratePerAnno = frazionamentoToRate(fraz, anni);
    const importoFirma = editorState?.totaleLordo ?? Number(titolo.premio_lordo || 0);
    const importoRata = ratePerAnno > 0 ? +(importoFirma / ratePerAnno).toFixed(2) : importoFirma;
    const fineCopertura = (titolo.durata_a as string) || (titolo.data_scadenza as string);
    const startBase = titolo.garanzia_a as string;
    if (!fineCopertura || !startBase) return [];
    if (fraz === "Poliennale") return [];
    const out: Array<{ da: string; a: string; importo: number }> = [];
    let cursor = startBase;
    let safety = 0;
    while (cursor < fineCopertura && safety < 120) {
      const da = cursor;
      const a = minISO(addMonthsISO(da, mesi), fineCopertura);
      if (da >= a) break;
      out.push({ da, a, importo: importoRata });
      cursor = a;
      safety++;
    }
    return out;
  }, [titoloRow, editorState]);

  const oneriNum = Number(oneri.replace(",", ".")) || 0;

  const riattivazioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataRiattivazione) throw new Error("Data riattivazione obbligatoria");
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (titoloRow.stato !== "sospeso") {
        throw new Error("La polizza non è sospesa. Solo le polizze sospese possono essere riattivate.");
      }

      const madreIdResolved = await resolveTitoloMadreId(supabase, titoloId);
      const dataSospensione = titoloRow.data_sospensione as string | null;
      if (!dataSospensione) throw new Error("Data sospensione mancante sulla polizza");
      const shiftDays = diffDaysISO(dataSospensione, dataRiattivazione);

      const snapshotId = await editorRef.current?.commit("riattivazione");
      const updatedState = editorRef.current?.getState();

      const { data: titoloFresh } = await supabase
        .from("titoli")
        .select("*")
        .eq("id", madreIdResolved)
        .single();
      const titoloForOps = titoloFresh ?? updatedState?.titolo ?? titoloRow;

      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId: madreIdResolved,
        numeroCorrente: titoloRow.numero_titolo as string,
        numeroNuovo: nuovoNumero,
        causale: "riattivazione",
        motivo,
      });
      const numeroEffettivo = numeroCambiato ? nuovoNumero.trim() : (titoloRow.numero_titolo as string);

      const quietanzeRipristinate: string[] = [];
      const snapshot = titoloRow.quietanze_sospensione_snapshot as QuietanzeSospensioneSnapshot | null;
      let frozenEntries = snapshot?.quietanze ?? [];

      if (frozenEntries.length === 0 && titoloRow.numero_titolo) {
        const { data: sospese } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato")
          .eq("numero_titolo", titoloRow.numero_titolo as string)
          .eq("stato", "sospeso")
          .not("sostituisce_polizza", "is", null);
        frozenEntries = (sospese || []).map((q: Record<string, unknown>) => ({
          id: q.id as string,
          riga: q.riga as number | null,
          garanzia_da: q.garanzia_da as string | null,
          garanzia_a: q.garanzia_a as string | null,
          premio_lordo: q.premio_lordo as number | null,
          stato: q.stato as string,
        }));
      }

      for (const entry of frozenEntries) {
        const shifted = computeShiftedDates(
          entry.garanzia_da,
          entry.garanzia_a,
          dataSospensione,
          dataRiattivazione,
          shiftDays,
        );
        const { error: errQ } = await supabase
          .from("titoli")
          .update({
            garanzia_da: shifted.garanzia_da,
            garanzia_a: shifted.garanzia_a,
            stato: "attivo",
          } as never)
          .eq("id", entry.id);
        if (errQ) throw errQ;
        quietanzeRipristinate.push(entry.id);
      }

      const madreUpdate: Record<string, unknown> = {
        stato: "attivo",
        data_riattivazione: dataRiattivazione,
        data_sospensione: null,
        limite_riattivazione: null,
        motivo_sospensione: null,
        quietanze_sospensione_snapshot: null,
      };
      const garanziaA = titoloForOps.garanzia_a as string | undefined;
      const dataScadenza = titoloForOps.data_scadenza as string | undefined;
      const durataA = titoloForOps.durata_a as string | undefined;
      if (garanziaA) madreUpdate.garanzia_a = addDaysISO(garanziaA, shiftDays);
      if (dataScadenza) madreUpdate.data_scadenza = addDaysISO(dataScadenza, shiftDays);
      if (durataA) madreUpdate.durata_a = addDaysISO(durataA, shiftDays);

      const { error: errUp } = await supabase
        .from("titoli")
        .update(madreUpdate as never)
        .eq("id", madreIdResolved);
      if (errUp) throw errUp;

      const premioLordoFallback =
        updatedState?.totaleLordo ??
        Number(titoloFresh?.premio_lordo ?? titoloRow.premio_lordo ?? 0);
      const frazFallback = (titoloForOps.frazionamento as string) || "Annuale";
      const anniFallback = (titoloForOps.anni_durata as number) || 1;
      const ratePerAnnoFallback = frazionamentoToRate(frazFallback, anniFallback);
      const importoRataFallback =
        ratePerAnnoFallback > 0
          ? +(premioLordoFallback / ratePerAnnoFallback).toFixed(2)
          : premioLordoFallback;

      const previewFallback = (() => {
        const fraz = frazFallback;
        const mesi = frazionamentoMesi(fraz, anniFallback);
        const fineCopertura = durataA || dataScadenza;
        const startBase = garanziaA;
        if (!fineCopertura || !startBase || fraz === "Poliennale") return [];
        const out: Array<{ da: string; a: string; importo: number }> = [];
        let cursor = startBase;
        let safety = 0;
        while (cursor < fineCopertura && safety < 120) {
          const da = cursor;
          const a = minISO(addMonthsISO(da, mesi), fineCopertura);
          if (da >= a) break;
          out.push({ da, a, importo: importoRataFallback });
          cursor = a;
          safety++;
        }
        return out;
      })();

      const quietanzeCreate: string[] = [];
      let prevRiga = Number(titoloForOps.riga || 0);
      if (quietanzeRipristinate.length === 0) {
        for (const r of previewFallback) {
          const shifted = computeShiftedDates(r.da, r.a, dataSospensione, dataRiattivazione, shiftDays);
          const nuovaRiga = prevRiga + 1;
          const { data: ins, error: errIns } = await supabase
            .from("titoli")
            .insert({
              numero_titolo: numeroEffettivo,
              cliente_id: titoloForOps.cliente_id,
              cliente_anagrafica_id: titoloForOps.cliente_anagrafica_id,
              compagnia_id: titoloForOps.compagnia_id,
              compagnia_rapporto_id: titoloForOps.compagnia_rapporto_id,
              codice_rapporto: titoloForOps.codice_rapporto,
              ramo_id: titoloForOps.ramo_id,
              prodotto_id: titoloForOps.prodotto_id,
              prodotto_nome: titoloForOps.prodotto_nome,
              ufficio_id: titoloForOps.ufficio_id,
              ae_anagrafica_id: titoloForOps.ae_anagrafica_id,
              anagrafica_commerciale_id: titoloForOps.anagrafica_commerciale_id,
              commerciale_id: titoloForOps.commerciale_id,
              percentuale_commerciale: titoloForOps.percentuale_commerciale,
              percentuale_riparto: titoloForOps.percentuale_riparto,
              durata_da: titoloForOps.durata_da,
              durata_a: titoloForOps.durata_a,
              anni_durata: titoloForOps.anni_durata,
              data_scadenza: titoloForOps.data_scadenza,
              frazionamento: titoloForOps.frazionamento,
              rate: ratePerAnnoFallback,
              garanzia_da: shifted.garanzia_da,
              garanzia_a: shifted.garanzia_a,
              premio_lordo: r.importo,
              premio_netto_quietanza: titoloForOps.premio_netto_quietanza,
              addizionali_quietanza: titoloForOps.addizionali_quietanza,
              tasse_quietanza: titoloForOps.tasse_quietanza,
              provvigioni_quietanza: titoloForOps.provvigioni_quietanza,
              brokeraggio_quietanza: titoloForOps.brokeraggio_quietanza,
              riga: nuovaRiga,
              sostituisce_polizza: numeroEffettivo,
              sostituisce_riga: prevRiga,
              stato: "attivo",
              tipo_portafoglio: titoloForOps.tipo_portafoglio,
              tipo_mandatario: titoloForOps.tipo_mandatario,
            } as never)
            .select("id")
            .single();
          if (errIns) throw errIns;
          quietanzeCreate.push(ins!.id as string);
          prevRiga = nuovaRiga;
        }
      } else {
        const { data: maxRigaRow } = await supabase
          .from("titoli")
          .select("riga")
          .eq("numero_titolo", numeroEffettivo)
          .order("riga", { ascending: false })
          .limit(1)
          .maybeSingle();
        prevRiga = Number(maxRigaRow?.riga ?? titoloForOps.riga ?? 0);
      }

      const rigaOneri = prevRiga + 1;
      const { data: insOneri, error: errOneri } = await supabase
        .from("titoli")
        .insert({
          numero_titolo: numeroEffettivo,
          cliente_id: titoloForOps.cliente_id,
          cliente_anagrafica_id: titoloForOps.cliente_anagrafica_id,
          compagnia_id: titoloForOps.compagnia_id,
          compagnia_rapporto_id: titoloForOps.compagnia_rapporto_id,
          codice_rapporto: titoloForOps.codice_rapporto,
          ramo_id: titoloForOps.ramo_id,
          prodotto_id: titoloForOps.prodotto_id,
          prodotto_nome: titoloForOps.prodotto_nome,
          ufficio_id: titoloForOps.ufficio_id,
          ae_anagrafica_id: titoloForOps.ae_anagrafica_id,
          anagrafica_commerciale_id: titoloForOps.anagrafica_commerciale_id,
          commerciale_id: titoloForOps.commerciale_id,
          percentuale_commerciale: titoloForOps.percentuale_commerciale,
          percentuale_riparto: titoloForOps.percentuale_riparto,
          garanzia_da: dataRiattivazione,
          garanzia_a: dataRiattivazione,
          premio_lordo: oneriNum,
          premio_netto: oneriNum,
          riga: rigaOneri,
          sostituisce_polizza: numeroEffettivo,
          sostituisce_riga: titoloForOps.riga,
          stato: "attivo",
          note: "Oneri di riattivazione",
          is_oneri_riattivazione: true,
          tipo_portafoglio: titoloForOps.tipo_portafoglio,
          tipo_mandatario: titoloForOps.tipo_mandatario,
        } as never)
        .select("id")
        .single();
      if (errOneri) throw errOneri;
      const titoloOneriId = insOneri!.id as string;

      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        const finalName = ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${madreIdResolved}/riattivazione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase.from("documenti").insert({
          nome_file: finalName,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: madreIdResolved,
          caricato_da: user?.id,
        }).select("id").single();
        if (docErr) throw docErr;
        documentoId = (docIns?.id as string) || null;
        documentoNome = finalName;
      }

      const descrParts: string[] = ["Riattivazione polizza"];
      if (oneriNum > 0) descrParts.push(`oneri ${oneriNum.toFixed(2)} €`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloOneriId,
        tipo_documento: "RA",
        data_movimento: dataRiattivazione,
        descrizione: descrParts.join(" — "),
        stato: "attivo",
      } as never);

      await logAttivita({
        azione: "riattivazione_polizza",
        entita_tipo: "titolo",
        entita_id: madreIdResolved,
        dettagli_json: {
          data_riattivazione: dataRiattivazione,
          data_sospensione: dataSospensione,
          shift_days: shiftDays,
          oneri: oneriNum,
          motivo,
          quietanze_ripristinate: quietanzeRipristinate,
          quietanze_ricreate: quietanzeCreate,
          titolo_oneri_id: titoloOneriId,
          documento_id: documentoId,
          documento_nome: documentoNome,
          snapshot_id: snapshotId,
          numero_polizza_precedente: numeroCambiato ? titoloRow.numero_titolo : null,
          numero_polizza_nuovo: numeroCambiato ? numeroEffettivo : null,
        },
      });

      return { quietanzeRipristinate, quietanzeCreate, titoloOneriId, documentoNome, oneriNum };
    },
    onSuccess: ({ quietanzeRipristinate, quietanzeCreate, documentoNome, oneriNum: o }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      const parts: string[] = ["Polizza riattivata"];
      if (quietanzeRipristinate.length > 0) parts.push(`${quietanzeRipristinate.length} quietanze ripristinate`);
      if (quietanzeCreate.length > 0) parts.push(`${quietanzeCreate.length} quietanze ricreate`);
      parts.push(`titolo oneri creato (€ ${o.toFixed(2)})`);
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore durante la riattivazione");
    },
  });

  return (
    <>
      <OperazionePolizzaDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Riattivazione Polizza"
        description={
          numeroPolizza
            ? `Polizza ${numeroPolizza} — modifica date e garanzie se necessario, poi conferma in un unico passaggio.`
            : "Riattiva la polizza sospesa"
        }
        eventColumn={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-riatt-dlg">Data Riattivazione *</Label>
                <Input
                  id="data-riatt-dlg"
                  type="date"
                  value={dataRiattivazione}
                  onChange={(e) => setDataRiattivazione(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oneri-dlg">Oneri a carico cliente (€)</Label>
                <Input
                  id="oneri-dlg"
                  type="number"
                  min="0"
                  step="0.01"
                  value={oneri}
                  onChange={(e) => setOneri(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nuovo-numero-riatt-dlg">Nuovo numero polizza (opzionale)</Label>
              <Input
                id="nuovo-numero-riatt-dlg"
                value={nuovoNumero}
                onChange={(e) => setNuovoNumero(e.target.value)}
                placeholder={numeroPolizza || "Lasciare vuoto se invariato"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se la compagnia ha emesso un nuovo numero in fase di riattivazione, inseriscilo qui. Il numero precedente
                verrà archiviato.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-riatt-dlg">Motivo</Label>
              <Textarea id="motivo-riatt-dlg" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>

            <div className="border rounded-md p-3 bg-muted/30">
              <div className="text-sm font-semibold mb-2">Quietanze che verranno ricreate</div>
              {loadingTitolo ? (
                <div className="text-xs text-muted-foreground">Caricamento…</div>
              ) : preview.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nessuna quietanza futura da ricreare (polizza in scadenza o poliennale). Le quietanze congelate
                  verranno ripristinate con shift date.
                </div>
              ) : (
                <ul className="text-xs space-y-1 tabular-nums">
                  {preview.map((r, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span>
                        {r.da} → {r.a}
                      </span>
                      <span className="font-medium">{r.importo.toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
              {editorState && editorState.totaleLordo !== editorState.originalPremioLordo && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Importi rata calcolati sul premio lordo aggiornato ({editorState.totaleLordo.toFixed(2)} €).
                </p>
              )}
              <div className="text-xs mt-2 pt-2 border-t flex justify-between tabular-nums">
                <span>+ Titolo Oneri di Riattivazione (sempre creato, anche a €0)</span>
                <span className="font-medium">{oneriNum.toFixed(2)} €</span>
              </div>
            </div>

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
          <PolizzaEditorInline ref={editorRef} titoloId={madreId} onStateChange={handleEditorStateChange} />
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={riattivazioneMutation.isPending}>
              Annulla
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={riattivazioneMutation.isPending || !dataRiattivazione || loadingTitolo}
            >
              {riattivazioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma riattivazione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Stai per riattivare la polizza <strong>{numeroPolizza || "—"}</strong>.
                </div>
                <div>
                  Data riattivazione: <strong>{dataRiattivazione || "—"}</strong>
                </div>
                {nuovoNumero.trim() && nuovoNumero.trim() !== (numeroPolizza || "") && (
                  <div>
                    Nuovo numero polizza: <strong>{nuovoNumero.trim()}</strong>{" "}
                    <span className="text-muted-foreground">(precedente archiviato)</span>
                  </div>
                )}
                <div>
                  Quietanze: ripristino congelate o ricreate da preview: <strong>{preview.length}</strong>
                </div>
                <div>
                  Oneri cliente: <strong>{oneriNum.toFixed(2)} €</strong> (titolo oneri sempre creato)
                </div>
                {file && (
                  <div>
                    Allegato:{" "}
                    <strong>{ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name)}</strong>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                riattivazioneMutation.mutate();
              }}
            >
              Conferma riattivazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RiattivazionePolizzaDialog;
