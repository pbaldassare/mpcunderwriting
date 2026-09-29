import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  addRegolazioneFattoriRighe,
  createRegolazioneFattoriCartesian,
  fattoreRegolazioneLabel,
  fattoriDisponibiliPerAnni,
  formatAnnoSlotLabel,
  formatIsoDateIt,
  removeRegolazioneFattoreRiga,
  updateRegolazioneFattoreImporto,
  yearSlotsFromDatePresunte,
  type FattoreRegolazioneRef,
  type RegolazioneFattoreRiga,
} from "@/lib/regolazioneFattori";
import { fmtEuro } from "@/lib/formatCurrency";

type Props = {
  ramoId: string | null | undefined;
  datePresunte: string[];
  fattori: FattoreRegolazioneRef[];
  righe: RegolazioneFattoreRiga[];
  onChange: (righe: RegolazioneFattoreRiga[]) => void;
  fallbackAnno?: number;
  /** false = sola lettura */
  editable?: boolean;
  loading?: boolean;
};

/**
 * Lista esplicita importi esposti per fattore/anno.
 * Nessuna precompilazione dei 5 standard: si aggiunge con + e si rimuove con cestino.
 */
export function RegolazioneFattoriImportiGrid({
  ramoId,
  datePresunte,
  fattori,
  righe,
  onChange,
  fallbackAnno,
  editable = true,
  loading = false,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [pickFattoreIds, setPickFattoreIds] = useState<string[]>([]);
  const [pickAnni, setPickAnni] = useState<number[]>([]);

  const slots = useMemo(
    () => yearSlotsFromDatePresunte(datePresunte, fallbackAnno),
    [datePresunte, fallbackAnno],
  );

  const fattoriById = useMemo(
    () => new Map(fattori.map((f) => [f.id, f])),
    [fattori],
  );

  const fattoriDisponibili = useMemo(
    () => fattoriDisponibiliPerAnni(fattori, righe, pickAnni),
    [fattori, righe, pickAnni],
  );

  useEffect(() => {
    if (!addOpen) return;
    // I picker nativi `type=date` (Calcola da durata) dipingono l'icona
    // calendario sopra overlay/modale: nascondili finché il dialog è aperto.
    const style = document.createElement("style");
    style.setAttribute("data-regolazione-fattore-dialog", "");
    style.textContent = `
      input[type="date"]::-webkit-calendar-picker-indicator {
        visibility: hidden !important;
        pointer-events: none !important;
      }
      [data-radix-dialog-overlay] { z-index: 200; }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [addOpen]);

  const openAdd = () => {
    setPickAnni([]);
    setPickFattoreIds([]);
    setAddOpen(true);
  };

  const toggleAnno = (anno: number) => {
    setPickAnni((prev) => {
      const next = prev.includes(anno) ? prev.filter((x) => x !== anno) : [...prev, anno];
      const available = new Set(
        fattoriDisponibiliPerAnni(fattori, righe, next).map((f) => f.id),
      );
      setPickFattoreIds((ids) => ids.filter((id) => available.has(id)));
      return next;
    });
  };

  const toggleFattore = (id: string) => {
    setPickFattoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allDateSelected = slots.length > 0 && slots.every((s) => pickAnni.includes(s.anno));

  const toggleSelectAllDate = () => {
    if (allDateSelected) {
      setPickAnni([]);
      const available = new Set(
        fattoriDisponibiliPerAnni(fattori, righe, []).map((f) => f.id),
      );
      setPickFattoreIds((ids) => ids.filter((id) => available.has(id)));
    } else {
      const next = slots.map((s) => s.anno);
      setPickAnni(next);
      const available = new Set(
        fattoriDisponibiliPerAnni(fattori, righe, next).map((f) => f.id),
      );
      setPickFattoreIds((ids) => ids.filter((id) => available.has(id)));
    }
  };

  const allDisponibiliSelected =
    fattoriDisponibili.length > 0 &&
    fattoriDisponibili.every((f) => pickFattoreIds.includes(f.id));

  const toggleSelectAllFattori = () => {
    if (allDisponibiliSelected) {
      setPickFattoreIds([]);
    } else {
      setPickFattoreIds(fattoriDisponibili.map((f) => f.id));
    }
  };

  const selectedSlots = useMemo(
    () => slots.filter((s) => pickAnni.includes(s.anno)),
    [slots, pickAnni],
  );

  const selectedFattori = useMemo(
    () =>
      pickFattoreIds
        .map((fid) => fattoriById.get(fid))
        .filter((f): f is FattoreRegolazioneRef => !!f),
    [pickFattoreIds, fattoriById],
  );

  const nuovePreview = useMemo(
    () => createRegolazioneFattoriCartesian(selectedFattori, selectedSlots),
    [selectedFattori, selectedSlots],
  );

  const nuoveCount = addRegolazioneFattoriRighe(righe, nuovePreview).length - righe.length;

  const confirmAdd = () => {
    if (pickAnni.length === 0 || pickFattoreIds.length === 0) return;
    onChange(addRegolazioneFattoriRighe(righe, nuovePreview));
    setAddOpen(false);
  };

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground md:col-span-3">Caricamento fattori…</p>
    );
  }

  if (!fattori.length) {
    return (
      <div className="space-y-1 md:col-span-3">
        <p className="text-xs text-muted-foreground">
          Nessun fattore disponibile. Verifica il catalogo standard oppure aggiungi fattori custom in{" "}
          <span className="font-medium">Sistema → Tabelle di Base → Fattori regolazione</span>.
        </p>
      </div>
    );
  }

  const canConfirm = pickAnni.length > 0 && pickFattoreIds.length > 0;

  return (
    <div className="space-y-2 md:col-span-3">
      {!ramoId && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Seleziona il sottoramo per salvare gli importi dei fattori di regolazione.
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Importi esposti per fattore / anno</Label>
        {editable && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Aggiungi fattore
          </Button>
        )}
      </div>

      {righe.length === 0 ? (
        <div className="rounded-md border border-dashed bg-background/40 px-3 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Nessun fattore aggiunto. Usa <span className="font-medium">+</span> per selezionare
            fattore e anno.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-background/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Anno</TableHead>
                <TableHead>Fattore</TableHead>
                <TableHead className="w-40 text-right">Importo esposto</TableHead>
                {editable && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((r) => {
                const f = fattoriById.get(r.fattore_id);
                const label = fattoreRegolazioneLabel({
                  descrizione: r.fattore_descrizione || f?.descrizione,
                  codice: r.fattore_codice || f?.codice,
                });
                const dataIt = formatIsoDateIt(r.data_presunta);
                return (
                  <TableRow key={r.key}>
                    <TableCell className="font-mono text-xs">
                      {r.anno}
                      {dataIt ? (
                        <span className="block text-[10px] text-muted-foreground font-sans">
                          {dataIt}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{label}</TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-right tabular-nums"
                          value={Number.isFinite(r.importo_esposto) ? r.importo_esposto : 0}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            onChange(
                              updateRegolazioneFattoreImporto(
                                righe,
                                r.key,
                                Number.isFinite(n) ? n : 0,
                              ),
                            );
                          }}
                        />
                      ) : (
                        <span className="tabular-nums text-sm">{fmtEuro(r.importo_esposto)}</span>
                      )}
                    </TableCell>
                    {editable && (
                      <TableCell className="text-right p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Rimuovi fattore"
                          onClick={() => onChange(removeRegolazioneFattoreRiga(righe, r.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Aggiungi i fattori necessari con +. Puoi selezionare più date e più fattori: ogni
        combinazione viene aggiunta.
      </p>

      <Dialog open={addOpen} onOpenChange={setAddOpen} modal>
        <DialogContent
          className="z-[200] isolate w-[min(100vw-2rem,600px)] max-w-[600px] overflow-hidden sm:max-w-[600px]"
        >
          <DialogHeader>
            <DialogTitle>Aggiungi fattore</DialogTitle>
            <DialogDescription className="sr-only">
              Seleziona uno o più anni e uno o più fattori di regolazione da aggiungere.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="shrink-0 text-xs">Anno / data presunta</Label>
                {slots.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2.5 text-xs"
                    onClick={toggleSelectAllDate}
                  >
                    {allDateSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                  </Button>
                )}
              </div>
              {slots.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna data presunta disponibile.</p>
              ) : (
                <div className="max-h-44 overflow-x-hidden overflow-y-auto rounded-md border p-1.5">
                  {slots.map((s) => {
                    const checked = pickAnni.includes(s.anno);
                    const label = formatAnnoSlotLabel(s);
                    return (
                      <label
                        key={`${s.anno}-${s.data_presunta ?? ""}`}
                        className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-sm leading-snug hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleAnno(s.anno)}
                          aria-label={label}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1 whitespace-normal break-words">
                          {label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="shrink-0 text-xs">Fattori</Label>
                {fattoriDisponibili.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2.5 text-xs"
                    onClick={toggleSelectAllFattori}
                  >
                    {allDisponibiliSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                  </Button>
                )}
              </div>
              {fattoriDisponibili.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {pickAnni.length === 0
                    ? "Nessun fattore disponibile."
                    : "Nessun fattore disponibile per le date selezionate."}
                </p>
              ) : (
                <div className="max-h-56 overflow-x-hidden overflow-y-auto rounded-md border p-1.5">
                  {fattoriDisponibili.map((f) => {
                    const checked = pickFattoreIds.includes(f.id);
                    const label = fattoreRegolazioneLabel(f);
                    return (
                      <label
                        key={f.id}
                        className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-sm leading-snug hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleFattore(f.id)}
                          aria-label={label}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1 whitespace-normal break-words">
                          {label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={confirmAdd} disabled={!canConfirm}>
              {nuoveCount > 1 ? `Aggiungi (${nuoveCount})` : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
