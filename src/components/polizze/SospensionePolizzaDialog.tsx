import { useState, useEffect, useRef } from "react";
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
import {
  buildQuietanzeSnapshot,
  resolveTitoloMadreId,
  selectQuietanzeToFreeze,
} from "@/lib/sospensioneQuietanze";
import { PolizzaEditorInline, type PolizzaEditorHandle } from "./PolizzaEditorInline";
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

export const SospensionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const editorRef = useRef<PolizzaEditorHandle>(null);

  const [dataSospensione, setDataSospensione] = useState(todayISO);
  const [limiteRiattivazione, setLimiteRiattivazione] = useState(addMonthsISO(todayISO, 10));
  const [limiteManual, setLimiteManual] = useState(false);
  const [motivo, setMotivo] = useState("Sospensione su richiesta cliente");
  const [oneriSospensione, setOneriSospensione] = useState<string>("0");
  const [nuovoNumeroPolizza, setNuovoNumeroPolizza] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [madreIdForEdit, setMadreIdForEdit] = useState(titoloId);
  const [previewFreeze, setPreviewFreeze] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const oneriNum = Number((oneriSospensione || "0").replace(",", ".")) || 0;

  useEffect(() => {
    if (open) {
      setDataSospensione(todayISO);
      setLimiteRiattivazione(addMonthsISO(todayISO, 10));
      setLimiteManual(false);
      setMotivo("Sospensione su richiesta cliente");
      setOneriSospensione("0");
      setNuovoNumeroPolizza(numeroPolizza || "");
      setFile(null);
      setDisplayName("");
      resolveTitoloMadreId(supabase, titoloId).then(setMadreIdForEdit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId]);

  useEffect(() => {
    if (!limiteManual && dataSospensione) {
      setLimiteRiattivazione(addMonthsISO(dataSospensione, 10));
    }
  }, [dataSospensione, limiteManual]);

  useEffect(() => {
    if (!open || !dataSospensione) {
      setPreviewFreeze([]);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      const madreId = await resolveTitoloMadreId(supabase, titoloId);
      const { data: titoloRow } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga")
        .eq("id", madreId)
        .single();
      if (cancelled || !titoloRow?.numero_titolo || titoloRow.riga == null) {
        if (!cancelled) {
          setPreviewFreeze([]);
          setPreviewLoading(false);
        }
        return;
      }
      const { data: allRows } = await supabase
        .from("titoli")
        .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa, sostituisce_polizza, is_oneri_sospensione, is_oneri_riattivazione")
        .eq("numero_titolo", titoloRow.numero_titolo)
        .not("sostituisce_polizza", "is", null);
      const candidates = (allRows || []).filter(
        (r: Record<string, unknown>) => !r.is_oneri_sospensione && !r.is_oneri_riattivazione,
      );
      const toFreeze = selectQuietanzeToFreeze(
        candidates as never,
        Number(titoloRow.riga),
        dataSospensione,
      );
      if (!cancelled) {
        setPreviewFreeze(toFreeze as Record<string, unknown>[]);
        setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, titoloId, dataSospensione]);

  const sospensioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataSospensione) throw new Error("Data sospensione obbligatoria");
      if (!titoloId) throw new Error("Specificare una polizza");

      const madreId = await resolveTitoloMadreId(supabase, titoloId);

      const snapshotId = await editorRef.current?.commit("sospensione");

      const { data: titoloRow, error: errFetch } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga, cliente_id, cliente_anagrafica_id, compagnia_id, compagnia_rapporto_id, codice_rapporto, ramo_id, prodotto_id, prodotto_nome, ufficio_id, ae_anagrafica_id, anagrafica_commerciale_id, commerciale_id, percentuale_commerciale, percentuale_riparto, tipo_portafoglio, tipo_mandatario")
        .eq("id", madreId)
        .single();
      if (errFetch) throw errFetch;

      let quietanzeCongelate: string[] = [];
      let quietanzeSnapshot: ReturnType<typeof buildQuietanzeSnapshot> | null = null;
      if (titoloRow?.numero_titolo && titoloRow.riga != null) {
        const { data: allRows } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa, sostituisce_polizza, is_oneri_sospensione, is_oneri_riattivazione")
          .eq("numero_titolo", titoloRow.numero_titolo)
          .not("sostituisce_polizza", "is", null);
        const candidates = (allRows || []).filter(
          (r: Record<string, unknown>) => !r.is_oneri_sospensione && !r.is_oneri_riattivazione,
        );
        const toFreeze = selectQuietanzeToFreeze(
          candidates as never,
          Number(titoloRow.riga),
          dataSospensione,
        );
        if (toFreeze.length > 0) {
          quietanzeSnapshot = buildQuietanzeSnapshot(dataSospensione, toFreeze);
          quietanzeCongelate = toFreeze.map((r) => r.id);
          const { error: errFreeze } = await supabase
            .from("titoli")
            .update({ stato: "sospeso" } as never)
            .in("id", quietanzeCongelate);
          if (errFreeze) throw errFreeze;
        }
      }

      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "sospeso",
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione || null,
          motivo_sospensione: motivo || null,
          quietanze_sospensione_snapshot: quietanzeSnapshot as never,
        } as never)
        .eq("id", madreId);
      if (errUp) throw errUp;

      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId: madreId,
        numeroCorrente: titoloRow.numero_titolo,
        numeroNuovo: nuovoNumeroPolizza,
        causale: "sospensione",
        motivo: motivo || null,
      });

      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        const finalName = ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${madreId}/sospensione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase.from("documenti").insert({
          nome_file: finalName,
          path_storage: path,
          bucket_name: "documenti_titoli",
          entita_tipo: "titolo",
          entita_id: madreId,
          caricato_da: user?.id,
        }).select("id").single();
        if (docErr) throw docErr;
        documentoId = (docIns?.id as string) || null;
        documentoNome = finalName;
      }

      const numeroEffettivo =
        nuovoNumeroPolizza && nuovoNumeroPolizza !== titoloRow.numero_titolo
          ? nuovoNumeroPolizza
          : titoloRow.numero_titolo;
      const { data: maxRigaRow } = await supabase
        .from("titoli")
        .select("riga")
        .eq("numero_titolo", numeroEffettivo)
        .order("riga", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rigaSosp = ((maxRigaRow?.riga as number | undefined) ?? titoloRow.riga ?? 0) + 1;

      const { data: insSosp, error: errSosp } = await supabase
        .from("titoli")
        .insert({
          numero_titolo: numeroEffettivo,
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
          garanzia_da: dataSospensione,
          garanzia_a: dataSospensione,
          data_scadenza: dataSospensione,
          frazionamento: "Rata unica",
          premio_lordo: oneriNum,
          premio_netto: oneriNum,
          riga: rigaSosp,
          sostituisce_polizza: numeroEffettivo,
          sostituisce_riga: titoloRow.riga,
          stato: "attivo",
          note: `Sospensione polizza${motivo ? ": " + motivo : ""}`,
          is_oneri_sospensione: true,
          tipo_portafoglio: titoloRow.tipo_portafoglio,
          tipo_mandatario: titoloRow.tipo_mandatario,
        } as never)
        .select("id")
        .single();
      if (errSosp) throw errSosp;
      const titoloSospensioneId = insSosp!.id as string;

      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloSospensioneId,
        tipo_documento: "SO",
        data_movimento: dataSospensione,
        descrizione: `Sospensione polizza${motivo ? ": " + motivo : ""}${oneriNum > 0 ? ` (oneri ${oneriNum.toFixed(2)} €)` : ""}${documentoNome ? ` (allegato: ${documentoNome})` : ""}`,
        stato: "sospeso",
      } as never);

      await logAttivita({
        azione: "sospensione_polizza",
        entita_tipo: "titolo",
        entita_id: madreId,
        dettagli_json: {
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione,
          motivo,
          oneri_sospensione: oneriNum,
          titolo_sospensione_id: titoloSospensioneId,
          quietanze_congelate: quietanzeCongelate,
          documento_id: documentoId,
          documento_nome: documentoNome,
          snapshot_id: snapshotId,
          numero_polizza_cambiato: numeroCambiato,
          numero_polizza_nuovo: numeroCambiato ? nuovoNumeroPolizza : null,
        },
      });

      return { quietanzeCongelate, documentoNome, numeroCambiato, titoloSospensioneId, oneriNum };
    },
    onSuccess: ({ quietanzeCongelate, documentoNome, numeroCambiato, oneriNum: o }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-numeri-storici", titoloId] });
      const parts: string[] = ["Polizza sospesa"];
      parts.push(`titolo sospensione creato (€ ${o.toFixed(2)})`);
      if (numeroCambiato) parts.push(`nuovo numero polizza ${nuovoNumeroPolizza}`);
      if (quietanzeCongelate.length > 0) parts.push(`${quietanzeCongelate.length} quietanze congelate`);
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore durante la sospensione");
    },
  });

  return (
    <>
      <OperazionePolizzaDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title="Sospensione Polizza"
        description={
          numeroPolizza
            ? `Polizza ${numeroPolizza} — modifica date e garanzie se necessario, poi conferma in un unico passaggio.`
            : "Sospendi la polizza corrente"
        }
        eventColumn={
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data-sosp-dlg">Data Sospensione *</Label>
                <Input
                  id="data-sosp-dlg"
                  type="date"
                  value={dataSospensione}
                  onChange={(e) => setDataSospensione(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="limite-riatt-dlg">Limite Riattivazione</Label>
                <Input
                  id="limite-riatt-dlg"
                  type="date"
                  value={limiteRiattivazione}
                  onChange={(e) => {
                    setLimiteRiattivazione(e.target.value);
                    setLimiteManual(true);
                  }}
                  className="tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-sosp-dlg">Motivo</Label>
              <Textarea
                id="motivo-sosp-dlg"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo della sospensione (opzionale)"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="oneri-sosp-dlg">Oneri di sospensione (€)</Label>
              <Input
                id="oneri-sosp-dlg"
                type="number"
                min="0"
                step="0.01"
                value={oneriSospensione}
                onChange={(e) => setOneriSospensione(e.target.value)}
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Verrà comunque creato un titolo di sospensione, anche se l&apos;importo è 0 €, così appare in Incassi
                ed estratti conto.
              </p>
            </div>

            <div className="border rounded-md p-3 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="text-sm font-semibold mb-2">Quietanze che verranno congelate</div>
              {previewLoading ? (
                <div className="text-xs text-muted-foreground">Caricamento anteprima…</div>
              ) : previewFreeze.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Nessuna quietanza futura o in corso da congelare alla data selezionata.
                </div>
              ) : (
                <ul className="text-xs space-y-1 tabular-nums">
                  {previewFreeze.map((q) => (
                    <li key={q.id as string} className="flex justify-between gap-3">
                      <span>
                        Riga {String(q.riga)} · {String(q.garanzia_da)} → {String(q.garanzia_a)}
                      </span>
                      <span className="font-medium">{Number(q.premio_lordo || 0).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Le quietanze congelate passeranno a stato sospeso e non saranno incassabili fino alla riattivazione.
              </p>
            </div>

            <div className="space-y-1.5 border-t pt-3">
              <Label htmlFor="sosp-nuovo-numero">Nuovo numero polizza (opzionale)</Label>
              <Input
                id="sosp-nuovo-numero"
                value={nuovoNumeroPolizza}
                onChange={(e) => setNuovoNumeroPolizza(e.target.value)}
                placeholder={numeroPolizza || "Lascia vuoto per mantenere il numero attuale"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se la compagnia emette un nuovo numero, inseriscilo. Attuale:{" "}
                <span className="font-mono">{numeroPolizza || "—"}</span>. Il vecchio sarà archiviato.
              </p>
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
        editorColumn={<PolizzaEditorInline ref={editorRef} titoloId={madreIdForEdit} />}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sospensioneMutation.isPending}>
              Annulla
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={sospensioneMutation.isPending || !dataSospensione}
            >
              {sospensioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </>
        }
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma sospensione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Stai per sospendere la polizza <strong>{numeroPolizza || "—"}</strong>.
                </div>
                <div>
                  Data sospensione: <strong>{dataSospensione || "—"}</strong>
                </div>
                <div>
                  Limite riattivazione: <strong>{limiteRiattivazione || "—"}</strong>
                </div>
                {previewFreeze.length > 0 && (
                  <div>
                    Quietanze da congelare: <strong>{previewFreeze.length}</strong>
                  </div>
                )}
                {file && (
                  <div>
                    Allegato:{" "}
                    <strong>{ensureAllegatoExt((displayName || file.name).trim() || file.name, file.name)}</strong>
                  </div>
                )}
                <div className="text-destructive">
                  Attenzione: le quietanze future e quella in corso verranno congelate (stato sospeso) e non saranno
                  incassabili fino alla riattivazione.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                sospensioneMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma sospensione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SospensionePolizzaDialog;
