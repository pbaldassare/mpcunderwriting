import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Trash2, Truck, Loader2, Upload, Download, FileSpreadsheet } from "lucide-react";
import { useLookupTipologiaVeicolo } from "@/hooks/useLookupTables";
import { useRcaUsi } from "@/hooks/useRcaLookups";
import { TIPI_VEICOLO } from "@/lib/rcaConstants";
import {
  downloadLibroMatricolaTemplate,
  parseLibroMatricolaExcel,
  type LibroMatricolaImportPreviewRow,
} from "@/lib/libroMatricolaImport";
import { toast } from "sonner";

export type LibroMatricolaRiga = {
  id?: string;
  n_progressivo?: number;
  targa: string;
  tipologia: string; // codice lookup_tipologia_veicolo
  descrizione: string;
  usoId: string; // rca_usi.id
  data_immatricolazione: string;
  data_inclusione: string;
  data_esclusione: string;
  note: string;
};

export const emptyMatricolaRiga = (): LibroMatricolaRiga => ({
  targa: "",
  tipologia: "",
  descrizione: "",
  usoId: "",
  data_immatricolazione: "",
  data_inclusione: "",
  data_esclusione: "",
  note: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  righe: LibroMatricolaRiga[];
  onChange: (righe: LibroMatricolaRiga[]) => void;
  readOnly?: boolean;
  onSave?: (righe: LibroMatricolaRiga[]) => Promise<void> | void;
  saving?: boolean;
}

export function LibroMatricolaDialog({
  open,
  onOpenChange,
  righe,
  onChange,
  readOnly,
  onSave,
  saving,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<LibroMatricolaImportPreviewRow[]>([]);

  const { data: tipiVeicoloLookup = [] } = useLookupTipologiaVeicolo();
  const tipologiaOpts = useMemo(
    () => (tipiVeicoloLookup.length > 0 ? tipiVeicoloLookup : TIPI_VEICOLO),
    [tipiVeicoloLookup],
  );

  const { data: rcaUsi = [] } = useRcaUsi();
  const usoOpts = useMemo(
    () =>
      rcaUsi.map((u) => ({
        value: u.value,
        label: u.label,
        codice: u.codice,
        descrizione: u.descrizione,
        searchText: `${u.codice || ""} ${u.descrizione || ""} ${u.label}`,
      })),
    [rcaUsi],
  );

  const updateRiga = (idx: number, patch: Partial<LibroMatricolaRiga>) => {
    onChange(righe.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const nextProgressivo = () => {
    const max = righe.reduce((m, r) => Math.max(m, r.n_progressivo || 0), 0);
    return max + 1;
  };

  const addRiga = () =>
    onChange([...righe, { ...emptyMatricolaRiga(), n_progressivo: nextProgressivo() }]);

  const removeRiga = (idx: number) => onChange(righe.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!onSave) {
      onOpenChange(false);
      return;
    }
    await onSave(filterRigheValide(righe));
  };

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseLibroMatricolaExcel(buf, tipologiaOpts, usoOpts);
      if (!parsed.length) {
        toast.error("Nessuna riga valida nel file");
        return;
      }
      setPreviewRows(parsed);
      setPreviewOpen(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore lettura Excel");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = () => {
    const okRows = previewRows.filter((r) => r._ok);
    if (!okRows.length) {
      toast.error("Nessuna riga valida da importare");
      return;
    }
    let prog = nextProgressivo();
    const mapped: LibroMatricolaRiga[] = okRows.map((r) => {
      const n = r.n_progressivo && r.n_progressivo > 0 ? r.n_progressivo : prog++;
      return {
        targa: r.targa,
        tipologia: r.tipologia,
        descrizione: r.descrizione,
        usoId: r.usoId,
        data_immatricolazione: r.data_immatricolazione,
        data_inclusione: r.data_inclusione,
        data_esclusione: r.data_esclusione,
        note: r.note,
        n_progressivo: n,
      };
    });
    // Merge by targa (update existing) or append
    const byTarga = new Map(righe.map((r, i) => [r.targa.trim().toUpperCase(), i] as const));
    const next = [...righe];
    for (const m of mapped) {
      const key = m.targa.trim().toUpperCase();
      const idx = key ? byTarga.get(key) : undefined;
      if (idx != null) {
        next[idx] = { ...next[idx], ...m, id: next[idx].id, n_progressivo: next[idx].n_progressivo || m.n_progressivo };
      } else {
        next.push(m);
      }
    }
    onChange(next);
    setPreviewOpen(false);
    setPreviewRows([]);
    toast.success(`Importate ${okRows.length} righe (anteprima in griglia — salva per confermare)`);
  };

  const okCount = previewRows.filter((r) => r._ok).length;
  const koCount = previewRows.length - okCount;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Libro Matricola — Elenco mezzi
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Tutti i campi sono opzionali. Le righe completamente vuote non verranno salvate.
              Inclusione ed esclusione restano modificabili anche dopo la creazione.
            </div>

            {!readOnly && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Importa Excel
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={downloadLibroMatricolaTemplate}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Template Excel
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </div>
            )}

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[52px] text-xs">N°</TableHead>
                    <TableHead className="min-w-[110px] text-xs">Targa</TableHead>
                    <TableHead className="min-w-[150px] text-xs">Tipologia</TableHead>
                    <TableHead className="min-w-[140px] text-xs">Descrizione</TableHead>
                    <TableHead className="min-w-[160px] text-xs">Uso</TableHead>
                    <TableHead className="min-w-[120px] text-xs">Data immatricolazione</TableHead>
                    <TableHead className="min-w-[120px] text-xs">Data inclusione</TableHead>
                    <TableHead className="min-w-[120px] text-xs">Data esclusione</TableHead>
                    <TableHead className="min-w-[100px] text-xs">Note</TableHead>
                    <TableHead className="w-[44px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righe.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-6">
                        Nessun mezzo. Clicca &quot;Aggiungi mezzo&quot; o importa un Excel.
                      </TableCell>
                    </TableRow>
                  ) : (
                    righe.map((r, idx) => (
                      <TableRow key={r.id ?? `new-${idx}`}>
                        <TableCell className="text-xs font-mono text-muted-foreground tabular-nums">
                          {r.n_progressivo ?? idx + 1}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.targa}
                            onChange={(e) => updateRiga(idx, { targa: e.target.value.toUpperCase() })}
                            disabled={readOnly}
                            className="h-8 text-xs uppercase"
                            placeholder="ES. AB123CD"
                          />
                        </TableCell>
                        <TableCell>
                          <SearchableSelect
                            options={tipologiaOpts}
                            value={r.tipologia}
                            onValueChange={(v) => updateRiga(idx, { tipologia: v })}
                            placeholder="Tipologia…"
                            clearable
                            disabled={readOnly}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.descrizione}
                            onChange={(e) => updateRiga(idx, { descrizione: e.target.value })}
                            disabled={readOnly}
                            className="h-8 text-xs"
                            placeholder="Descrizione"
                          />
                        </TableCell>
                        <TableCell>
                          <SearchableSelect
                            options={usoOpts}
                            value={r.usoId}
                            onValueChange={(v) => updateRiga(idx, { usoId: v })}
                            placeholder="Uso…"
                            clearable
                            disabled={readOnly}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.data_immatricolazione}
                            onChange={(e) => updateRiga(idx, { data_immatricolazione: e.target.value })}
                            disabled={readOnly}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.data_inclusione}
                            onChange={(e) => updateRiga(idx, { data_inclusione: e.target.value })}
                            disabled={readOnly}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.data_esclusione}
                            onChange={(e) => updateRiga(idx, { data_esclusione: e.target.value })}
                            disabled={readOnly}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.note}
                            onChange={(e) => updateRiga(idx, { note: e.target.value })}
                            disabled={readOnly}
                            className="h-8 text-xs"
                            placeholder="Note"
                          />
                        </TableCell>
                        <TableCell>
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeRiga(idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={addRiga} className="text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Aggiungi mezzo
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={!!saving}>
              {onSave ? "Annulla" : "Chiudi"}
            </Button>
            {onSave && !readOnly ? (
              <Button type="button" onClick={handleSave} disabled={!!saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salva mezzi
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Anteprima import Excel
            </DialogTitle>
            <DialogDescription>
              Controlla le righe prima di caricarle in griglia. Poi premi &quot;Salva mezzi&quot; per scrivere sul database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 text-sm">
            <Badge variant="default">{okCount} valide</Badge>
            {koCount > 0 && <Badge variant="destructive">{koCount} con errori</Badge>}
          </div>

          <Table containerClassName="border rounded-md max-h-[50vh]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Riga</TableHead>
                  <TableHead className="text-xs">Esito</TableHead>
                  <TableHead className="text-xs">Targa</TableHead>
                  <TableHead className="text-xs">Tipologia</TableHead>
                  <TableHead className="text-xs">Uso</TableHead>
                  <TableHead className="text-xs">Inclusione</TableHead>
                  <TableHead className="text-xs">Errori</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((r) => (
                  <TableRow key={r._rowNum} className={r._ok ? "" : "bg-destructive/5"}>
                    <TableCell className="text-xs font-mono">{r._rowNum}</TableCell>
                    <TableCell>
                      <Badge variant={r._ok ? "default" : "destructive"}>{r._ok ? "OK" : "KO"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{r.targa || "—"}</TableCell>
                    <TableCell className="text-xs">{r.tipologia || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {usoOpts.find((u) => u.value === r.usoId)?.label || r.usoId || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.data_inclusione || "—"}</TableCell>
                    <TableCell className="text-xs text-destructive">{r._errors.join("; ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={confirmImport} disabled={okCount === 0}>
              Carica {okCount} righe in griglia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function filterRigheValide(righe: LibroMatricolaRiga[]): LibroMatricolaRiga[] {
  return righe.filter(
    (r) =>
      !!(
        r.targa?.trim() ||
        r.tipologia?.trim() ||
        r.descrizione?.trim() ||
        r.usoId?.trim() ||
        r.data_immatricolazione ||
        r.data_inclusione ||
        r.data_esclusione ||
        r.note?.trim()
      ),
  );
}

export function mapDbToLibroMatricolaRiga(row: {
  id?: string;
  n_progressivo?: number | null;
  targa?: string | null;
  tipologia?: string | null;
  descrizione?: string | null;
  uso?: string | null;
  uso_id?: string | null;
  data_immatricolazione?: string | null;
  data_inclusione?: string | null;
  data_esclusione?: string | null;
  note?: string | null;
}): LibroMatricolaRiga {
  return {
    id: row.id,
    n_progressivo: row.n_progressivo ?? undefined,
    targa: row.targa || "",
    tipologia: row.tipologia || "",
    descrizione: row.descrizione || "",
    usoId: row.uso_id || "",
    data_immatricolazione: row.data_immatricolazione || "",
    data_inclusione: row.data_inclusione || "",
    data_esclusione: row.data_esclusione || "",
    note: row.note || "",
  };
}

export function rigaToDbPayload(r: LibroMatricolaRiga, titoloId: string) {
  return {
    titolo_id: titoloId,
    n_progressivo: r.n_progressivo ?? null,
    targa: r.targa?.trim() || null,
    tipologia: r.tipologia?.trim() || null,
    descrizione: r.descrizione?.trim() || null,
    uso_id: r.usoId?.trim() || null,
    uso: null as string | null, // legacy text column — uso ora in uso_id
    data_immatricolazione: r.data_immatricolazione || null,
    data_inclusione: r.data_inclusione || null,
    data_esclusione: r.data_esclusione || null,
    note: r.note?.trim() || null,
  };
}

/** Assegna n_progressivo mancanti in sequenza per la polizza. */
export function assignProgressivi(righe: LibroMatricolaRiga[]): LibroMatricolaRiga[] {
  let max = righe.reduce((m, r) => Math.max(m, r.n_progressivo || 0), 0);
  return righe.map((r) => {
    if (r.n_progressivo && r.n_progressivo > 0) return r;
    max += 1;
    return { ...r, n_progressivo: max };
  });
}
