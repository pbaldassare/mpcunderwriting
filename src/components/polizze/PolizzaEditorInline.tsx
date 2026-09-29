import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  VEICOLO_EDITABLE_FIELDS,
  calcLordoGaranzia,
  type VeicoloEditableField,
} from "@/lib/operazionePolizzaPremi";

export type OggettoExtraState = {
  ubicazione_rischio: string;
  valore_assicurato: string;
  riferimento_oggetto: string;
};

export type GaranziaEditorRow = {
  id?: string;
  garanzia: string;
  codice_garanzia: string | null;
  firma: number;
  rata: number;
  imposta_provinciale: number;
  ssn: number;
  lordo_calcolato: number;
  is_rca_principale: boolean;
  ordine: number;
  /** Quando true il Lordo è inserito a mano e non viene ricalcolato dai sotto-importi. */
  lordoManualOverride?: boolean;
  _dirty?: boolean;
  _new?: boolean;
};

export type PolizzaEditorState = {
  titolo: Record<string, unknown> | null;
  veicolo: Record<string, unknown> | null;
  garanzie: GaranziaEditorRow[];
  oggettoExtra: OggettoExtraState;
  totaleLordo: number;
  originalPremioLordo: number;
  originalTotaleLordo: number;
  isRca: boolean;
};

export type PolizzaEditorHandle = {
  /** Salva snapshot pre-evento + applica le modifiche live. Ritorna l'id dello snapshot. */
  commit: (tipoEvento: "sospensione" | "riattivazione" | "sostituzione" | "estinzione") => Promise<string | null>;
  /** True se la polizza è bloccata (incassato + scaduto da >7gg): garanzie read-only */
  isLocked: () => boolean;
  /** Stato corrente dell'editor (premi, oggetto, date). */
  getState: () => PolizzaEditorState;
};

interface Props {
  titoloId: string;
  /** Mostra blocco "Parametri oggetto" (solo Sostituzione) */
  showOggetto?: boolean;
  /** Notifica cambiamenti di stato (premi, oggetto, date). */
  onStateChange?: (state: PolizzaEditorState) => void;
  /** Layout ridotto per dialog appendice. */
  compact?: boolean;
}

const AUTO_LORDO_KEYS = ["firma", "rata", "imposta_provinciale", "ssn"] as const;

const emptyOggettoExtra = (): OggettoExtraState => ({
  ubicazione_rischio: "",
  valore_assicurato: "",
  riferimento_oggetto: "",
});

export const PolizzaEditorInline = forwardRef<PolizzaEditorHandle, Props>(
  ({ titoloId, showOggetto = false, onStateChange, compact = false }, ref) => {
    const [loading, setLoading] = useState(true);
    const [titolo, setTitolo] = useState<Record<string, unknown> | null>(null);
    const [veicolo, setVeicolo] = useState<Record<string, unknown> | null>(null);
    const [garanzie, setGaranzie] = useState<GaranziaEditorRow[]>([]);
    const [originalGaranzie, setOriginalGaranzie] = useState<GaranziaEditorRow[]>([]);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const [originalTitolo, setOriginalTitolo] = useState<Record<string, unknown> | null>(null);
    const [originalVeicolo, setOriginalVeicolo] = useState<Record<string, unknown> | null>(null);
    const [oggettoExtra, setOggettoExtra] = useState<OggettoExtraState>(emptyOggettoExtra);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const [{ data: t }, { data: g }, { data: v }] = await Promise.all([
          supabase.from("titoli").select("*").eq("id", titoloId).maybeSingle(),
          supabase.from("premi_garanzia_polizza").select("*").eq("titolo_id", titoloId).order("ordine"),
          supabase.from("veicoli_polizza").select("*").eq("titolo_id", titoloId).maybeSingle(),
        ]);
        if (cancelled) return;
        setTitolo(t);
        setOriginalTitolo(t);
        setVeicolo(v);
        setOriginalVeicolo(v);
        const rows: GaranziaEditorRow[] = (g || []).map((r: Record<string, unknown>) => {
          const parts = {
            firma: Number(r.firma || 0),
            rata: Number(r.rata || 0),
            imposta_provinciale: Number(r.imposta_provinciale || 0),
            ssn: Number(r.ssn || 0),
          };
          const lordo = Number(r.lordo_calcolato || 0);
          return {
            id: r.id as string,
            garanzia: (r.garanzia as string) || "",
            codice_garanzia: (r.codice_garanzia as string | null) ?? null,
            ...parts,
            lordo_calcolato: lordo,
            // Se il lordo salvato non coincide con la somma dei sotto-importi la
            // riga è in modalità manuale (Lordo forzato a mano).
            lordoManualOverride: Math.abs(lordo - calcLordoGaranzia(parts)) > 0.005,
            is_rca_principale: !!r.is_rca_principale,
            ordine: Number(r.ordine || 0),
          };
        });
        setGaranzie(rows);
        setOriginalGaranzie(rows);
        setDeletedIds([]);
        setOggettoExtra(emptyOggettoExtra());
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [titoloId]);

    const isLocked = useCallback(() => {
      if (!titolo) return false;
      if (titolo.stato !== "incassato") return false;
      if (!titolo.garanzia_a) return false;
      const ga = new Date(String(titolo.garanzia_a) + "T00:00:00").getTime();
      return ga < Date.now() - 7 * 24 * 3600 * 1000;
    }, [titolo]);

    const originalTotaleLordo = useMemo(
      () => originalGaranzie.reduce((s, g) => s + Number(g.lordo_calcolato || 0), 0),
      [originalGaranzie],
    );

    const originalPremioLordo = useMemo(() => {
      const fromTitolo = Number(originalTitolo?.premio_lordo ?? 0);
      return originalTotaleLordo > 0 ? originalTotaleLordo : fromTitolo;
    }, [originalTitolo, originalTotaleLordo]);

    const totaleLordo = useMemo(
      () => garanzie.reduce((s, g) => s + Number(g.lordo_calcolato || 0), 0),
      [garanzie],
    );

    const isRca = !!veicolo || String(titolo?.targa_telaio || "").length > 0;

    const editorState = useMemo<PolizzaEditorState>(
      () => ({
        titolo,
        veicolo,
        garanzie,
        oggettoExtra,
        totaleLordo,
        originalPremioLordo,
        originalTotaleLordo,
        isRca,
      }),
      [titolo, veicolo, garanzie, oggettoExtra, totaleLordo, originalPremioLordo, originalTotaleLordo, isRca],
    );

    useEffect(() => {
      if (!loading && onStateChange) onStateChange(editorState);
    }, [editorState, loading, onStateChange]);

    const updateGar = (idx: number, patch: Partial<GaranziaEditorRow>) => {
      setGaranzie((prev) =>
        prev.map((g, i) => {
          if (i !== idx) return g;
          const merged = { ...g, ...patch, _dirty: true };
          // Il Lordo si ricalcola dai sotto-importi solo se NON è in override manuale.
          if (AUTO_LORDO_KEYS.some((k) => k in patch) && !merged.lordoManualOverride) {
            merged.lordo_calcolato = calcLordoGaranzia(merged);
          }
          return merged;
        }),
      );
    };

    // Lordo digitato a mano: attiva l'override e memorizza il valore così com'è.
    const setLordoManuale = (idx: number, value: number) => {
      setGaranzie((prev) =>
        prev.map((g, i) => (i === idx ? { ...g, lordo_calcolato: value, lordoManualOverride: true, _dirty: true } : g)),
      );
    };

    // Alterna Lordo automatico/manuale; tornando in automatico ricalcola dai sotto-importi.
    const toggleLordoManuale = (idx: number) => {
      setGaranzie((prev) =>
        prev.map((g, i) => {
          if (i !== idx) return g;
          const next = !g.lordoManualOverride;
          return {
            ...g,
            lordoManualOverride: next,
            lordo_calcolato: next ? g.lordo_calcolato : calcLordoGaranzia(g),
            _dirty: true,
          };
        }),
      );
    };

    const addGar = () => {
      setGaranzie((prev) => [
        ...prev,
        {
          garanzia: "",
          codice_garanzia: null,
          firma: 0,
          rata: 0,
          imposta_provinciale: 0,
          ssn: 0,
          lordo_calcolato: 0,
          is_rca_principale: false,
          ordine: prev.length + 1,
          _new: true,
          _dirty: true,
        },
      ]);
    };

    const removeGar = (idx: number) => {
      setGaranzie((prev) => {
        const row = prev[idx];
        if (row.id) setDeletedIds((d) => [...d, row.id!]);
        return prev.filter((_, i) => i !== idx);
      });
    };

    const updateVeicoloField = (field: VeicoloEditableField, value: string) => {
      setVeicolo((prev) => {
        const base = prev ?? {};
        if (["cc", "kw", "cv", "posti"].includes(field)) {
          return { ...base, [field]: value === "" ? null : Number(value) };
        }
        if (field === "targa" || field === "telaio" || field === "provincia_circolazione") {
          return { ...base, [field]: value.toUpperCase() };
        }
        return { ...base, [field]: value };
      });
    };

    useImperativeHandle(
      ref,
      () => ({
        isLocked,
        getState: () => editorState,
        commit: async (tipoEvento) => {
          if (!titolo) throw new Error("Polizza non caricata");
          const { data: { user } } = await supabase.auth.getUser();

          const payload = {
            titolo: originalTitolo,
            garanzie: originalGaranzie,
            veicolo: originalVeicolo,
            oggetto_extra: emptyOggettoExtra(),
          };
          const { data: snap, error: snapErr } = await supabase
            .from("titoli_eventi_snapshot")
            .insert({
              titolo_id: titoloId,
              tipo_evento: tipoEvento,
              payload_jsonb: payload as never,
              created_by: user?.id || null,
            } as never)
            .select("id")
            .single();
          if (snapErr) throw snapErr;

          const titoloPatch: Record<string, unknown> = {};
          if (titolo.garanzia_da !== originalTitolo?.garanzia_da) titoloPatch.garanzia_da = titolo.garanzia_da;
          if (titolo.garanzia_a !== originalTitolo?.garanzia_a) titoloPatch.garanzia_a = titolo.garanzia_a;
          if (titolo.data_scadenza !== originalTitolo?.data_scadenza) titoloPatch.data_scadenza = titolo.data_scadenza;
          if (titolo.descrizione_polizza !== originalTitolo?.descrizione_polizza) {
            titoloPatch.descrizione_polizza = titolo.descrizione_polizza;
          }

          const garanzieChanged = garanzie.some((g) => g._dirty || g._new) || deletedIds.length > 0;
          if (garanzieChanged && !isLocked()) {
            titoloPatch.premio_lordo = totaleLordo;
          }

          if (showOggetto && veicolo && originalVeicolo) {
            const targa = (veicolo.targa as string) || "";
            const telaio = (veicolo.telaio as string) || "";
            const newTargaTelaio = targa || telaio || null;
            if (newTargaTelaio !== originalTitolo?.targa_telaio) {
              titoloPatch.targa_telaio = newTargaTelaio;
            }
          }

          if (Object.keys(titoloPatch).length > 0) {
            const { error } = await supabase.from("titoli").update(titoloPatch as never).eq("id", titoloId);
            if (error) throw error;
          }

          if (!isLocked()) {
            if (deletedIds.length > 0) {
              const { error } = await supabase.from("premi_garanzia_polizza").delete().in("id", deletedIds);
              if (error) throw error;
            }
            const toUpsert = garanzie
              .filter((g) => g._dirty || g._new)
              .map((g) => ({
                id: g.id,
                titolo_id: titoloId,
                garanzia: g.garanzia,
                codice_garanzia: g.codice_garanzia,
                firma: g.firma,
                rata: g.rata,
                imposta_provinciale: g.imposta_provinciale,
                ssn: g.ssn,
                lordo_calcolato: g.lordo_calcolato,
                is_rca_principale: g.is_rca_principale,
                ordine: g.ordine,
                tipo_premio: "firma",
              }));
            if (toUpsert.length > 0) {
              const { error } = await supabase.from("premi_garanzia_polizza").upsert(toUpsert as never);
              if (error) throw error;
            }
          } else if (garanzieChanged) {
            toast.warning(
              "Premi non modificabili (polizza chiusa/incassata): le modifiche alle garanzie sono state ignorate.",
            );
          }

          if (showOggetto && veicolo) {
            const veicPatch: Record<string, unknown> = {};
            for (const k of VEICOLO_EDITABLE_FIELDS) {
              const cur = veicolo[k];
              const orig = originalVeicolo?.[k];
              if (cur !== orig) veicPatch[k] = cur ?? null;
            }
            if (Object.keys(veicPatch).length > 0) {
              if (veicolo.id) {
                const { error } = await supabase
                  .from("veicoli_polizza")
                  .update(veicPatch as never)
                  .eq("id", veicolo.id as string);
                if (error) throw error;
              }
            }
          }

          return snap?.id || null;
        },
      }),
      [
        titolo,
        originalTitolo,
        garanzie,
        originalGaranzie,
        deletedIds,
        veicolo,
        originalVeicolo,
        showOggetto,
        titoloId,
        totaleLordo,
        isLocked,
        editorState,
      ],
    );

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 border rounded-md bg-muted/30">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!titolo) {
      return <div className="text-sm text-muted-foreground border rounded-md p-3">Polizza non trovata</div>;
    }

    const locked = isLocked();
    const premioChanged = Math.abs(totaleLordo - originalPremioLordo) > 0.005;
    const fmtEuro = (n: number) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <div className="border rounded-md p-3 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-semibold">Snapshot polizza (modificabile)</div>
          <div className="flex items-center gap-2 flex-wrap">
            {premioChanged && (
              <div className="text-xs tabular-nums bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                Premio lordo: {fmtEuro(originalPremioLordo)} € → <strong>{fmtEuro(totaleLordo)} €</strong>
              </div>
            )}
            {locked && (
              <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                <Lock className="w-3 h-3" /> Premi bloccati (chiusa/incassata)
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Effetto</Label>
            <Input
              type="date"
              value={(titolo.garanzia_da as string) || ""}
              onChange={(e) => setTitolo({ ...titolo, garanzia_da: e.target.value })}
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scadenza copertura</Label>
            <Input
              type="date"
              value={(titolo.garanzia_a as string) || ""}
              onChange={(e) => setTitolo({ ...titolo, garanzia_a: e.target.value })}
              className="h-8 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scadenza polizza</Label>
            <Input
              type="date"
              value={(titolo.data_scadenza as string) || ""}
              onChange={(e) => setTitolo({ ...titolo, data_scadenza: e.target.value })}
              className="h-8 text-sm tabular-nums"
            />
          </div>
        </div>

        {showOggetto && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Oggetto assicurato</div>
            {veicolo ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Targa"
                  value={(veicolo.targa as string) || ""}
                  onChange={(e) => updateVeicoloField("targa", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Telaio"
                  value={(veicolo.telaio as string) || ""}
                  onChange={(e) => updateVeicoloField("telaio", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Marca"
                  value={(veicolo.marca as string) || ""}
                  onChange={(e) => updateVeicoloField("marca", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Modello"
                  value={(veicolo.modello as string) || ""}
                  onChange={(e) => updateVeicoloField("modello", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Versione / Allestimento"
                  value={(veicolo.versione as string) || ""}
                  onChange={(e) => updateVeicoloField("versione", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Tipo veicolo"
                  value={(veicolo.tipo_veicolo as string) || ""}
                  onChange={(e) => updateVeicoloField("tipo_veicolo", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Alimentazione"
                  value={(veicolo.tipo_alimentazione as string) || ""}
                  onChange={(e) => updateVeicoloField("tipo_alimentazione", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Cilindrata (cc)"
                  type="number"
                  inputMode="numeric"
                  value={veicolo.cc != null ? String(veicolo.cc) : ""}
                  onChange={(e) => updateVeicoloField("cc", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  placeholder="Potenza (kW)"
                  type="number"
                  inputMode="numeric"
                  value={veicolo.kw != null ? String(veicolo.kw) : ""}
                  onChange={(e) => updateVeicoloField("kw", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  placeholder="Potenza (CV)"
                  type="number"
                  inputMode="numeric"
                  value={veicolo.cv != null ? String(veicolo.cv) : ""}
                  onChange={(e) => updateVeicoloField("cv", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  placeholder="Posti"
                  type="number"
                  inputMode="numeric"
                  value={veicolo.posti != null ? String(veicolo.posti) : ""}
                  onChange={(e) => updateVeicoloField("posti", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  placeholder="Data immatricolazione"
                  type="date"
                  value={(veicolo.data_immatricolazione as string) || ""}
                  onChange={(e) => updateVeicoloField("data_immatricolazione", e.target.value)}
                  className="h-8 text-sm tabular-nums"
                />
                <Input
                  placeholder="Classe BM"
                  value={(veicolo.classe_bm as string) || ""}
                  onChange={(e) => updateVeicoloField("classe_bm", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Provincia circolazione"
                  value={(veicolo.provincia_circolazione as string) || ""}
                  onChange={(e) => updateVeicoloField("provincia_circolazione", e.target.value)}
                  maxLength={2}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Descrizione nuovo oggetto / partita"
                  value={(titolo.descrizione_polizza as string) || ""}
                  onChange={(e) => setTitolo({ ...titolo, descrizione_polizza: e.target.value })}
                  rows={2}
                  className="text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="Ubicazione / tratta del rischio"
                    value={oggettoExtra.ubicazione_rischio}
                    onChange={(e) => setOggettoExtra((p) => ({ ...p, ubicazione_rischio: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Valore assicurato (€)"
                    type="number"
                    step="0.01"
                    value={oggettoExtra.valore_assicurato}
                    onChange={(e) => setOggettoExtra((p) => ({ ...p, valore_assicurato: e.target.value }))}
                    className="h-8 text-sm tabular-nums"
                  />
                </div>
                <Input
                  placeholder="Riferimento (matricola / beneficiario)"
                  value={oggettoExtra.riferimento_oggetto}
                  onChange={(e) => setOggettoExtra((p) => ({ ...p, riferimento_oggetto: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Garanzie</div>
            {!locked && (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addGar}>
                <Plus className="w-3 h-3 mr-1" /> Aggiungi
              </Button>
            )}
          </div>
          {garanzie.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-2">Nessuna garanzia</div>
          ) : (
            <TableScrollArea className="">
          <table className="w-full min-w-max text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left font-medium py-1 pr-2">Garanzia</th>
                    <th className="text-right font-medium py-1 px-1">Netto</th>
                    <th className="text-right font-medium py-1 px-1">Rata</th>
                    <th className="text-right font-medium py-1 px-1">Tasse</th>
                    <th className="text-right font-medium py-1 px-1">SSN</th>
                    <th className="text-right font-medium py-1 px-1">Lordo</th>
                    {!locked && <th className="w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {garanzie.map((g, idx) => (
                    <tr key={g.id || `new-${idx}`} className="border-b last:border-0">
                      <td className="py-1 pr-2">
                        <Input
                          value={g.garanzia}
                          disabled={locked}
                          onChange={(e) => updateGar(idx, { garanzia: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </td>
                      {(["firma", "rata", "imposta_provinciale", "ssn"] as const).map((k) => (
                        <td key={k} className="py-1 px-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={g[k]}
                            disabled={locked}
                            onChange={(e) => updateGar(idx, { [k]: Number(e.target.value) || 0 })}
                            className={cn("h-7 text-xs text-right tabular-nums", compact ? "w-[4.5rem]" : "w-24")}
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={g.lordo_calcolato}
                          disabled={locked}
                          readOnly={!g.lordoManualOverride}
                          onChange={(e) => setLordoManuale(idx, Number(e.target.value) || 0)}
                          className={cn(
                            "h-7 text-xs text-right tabular-nums",
                            compact ? "w-[4.5rem]" : "w-24",
                            g.lordoManualOverride
                              ? "border-orange-400 focus-visible:ring-orange-400"
                              : "bg-muted/50",
                          )}
                        />
                      </td>
                      {!locked && (
                        <td className="py-1">
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleLordoManuale(idx)}
                              title={g.lordoManualOverride ? "Lordo manuale — clic per tornare automatico" : "Lordo automatico — clic per inserirlo a mano"}
                            >
                              {g.lordoManualOverride ? (
                                <LockOpen className="w-3.5 h-3.5 text-orange-500" />
                              ) : (
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeGar(idx)}
                              title="Rimuovi"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={5} className="text-right pt-2 pr-2">
                      Totale lordo:
                    </td>
                    <td className="text-right pt-2 px-1 tabular-nums">{fmtEuro(totaleLordo)} €</td>
                    {!locked && <td></td>}
                  </tr>
                </tbody>
              </table>
            </TableScrollArea>
          )}
        </div>
      </div>
    );
  },
);

PolizzaEditorInline.displayName = "PolizzaEditorInline";
