import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, UploadCloud, Loader2, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isDocumentUploadTooLarge, MAX_DOCUMENT_UPLOAD_MB } from "@/lib/uploadLimits";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchGaranzia, RCA_PRINCIPALE_CODE, type CatalogoVoce } from "@/lib/mapGaranzieRca";
import { cn } from "@/lib/utils";
import { fmtEuro as fmtEur } from "@/lib/formatCurrency";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

type AiVoce = {
  descrizione: string;
  codice_polizza?: string;
  premio_netto?: number;
  aliquota_tasse_pct?: number;
  premio_lordo?: number;
};

type Riga = {
  testo: string;
  codice_polizza?: string;
  codiceMappato: string; // "RCA" | catalogo.codice | ""
  netto: number;
  aliquota: number;
  includi: boolean;
  suggerimenti: { codice: string; descrizione: string }[];
};

const ALIQUOTA_DEFAULT = 13.5;

export function ImportPolizzaAiButton({
  titoloId,
  ramo,
  onImported,
}: {
  titoloId: string;
  ramo?: { codice?: string | null; descrizione?: string | null } | null;
  onImported?: () => void;
}) {
  const isNatante = (() => {
    const cod = String(ramo?.codice || "").toUpperCase();
    const desc = String(ramo?.descrizione || "").toUpperCase();
    if (["QN", "QT", "QNA", "DD", "DN", "DNA", "RV10", "RV11"].includes(cod)) return true;
    return /\bNATANT|\bNAUTIC|\bIMBARC|\bCORPI NAVI/.test(desc);
  })();
  const mainLabel = isNatante
    ? (["DD", "DN", "DNA"].includes(String(ramo?.codice || "").toUpperCase()) ? "Corpi Nautica" : "RC Natanti")
    : "RCA Auto";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [righe, setRighe] = useState<Riga[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["rca-garanzie-catalogo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_garanzie" as any)
        .select("codice, descrizione, aliquota_tasse")
        .eq("attivo", true)
        .order("codice");
      return (data as any as CatalogoVoce[]) || [];
    },
  });

  const reset = () => {
    setRighe([]);
    setFileName(null);
    setParsing(false);
    setSubmitting(false);
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (isDocumentUploadTooLarge(file.size)) {
      toast.error(`File troppo grande (max ${MAX_DOCUMENT_UPLOAD_MB} MB)`);
      return;
    }
    setFileName(file.name);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const { data, error } = await supabase.functions.invoke("parse-polizza-rca", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const voci: AiVoce[] = (data as any)?.data?.voci_garanzia || [];
      if (!voci.length) {
        toast.warning("Nessuna voce di garanzia rilevata nel documento");
      }
      const mapped: Riga[] = voci.map((v) => {
        const m = matchGaranzia(v.descrizione || "", v.codice_polizza, catalogo);
        return {
          testo: v.descrizione || "",
          codice_polizza: v.codice_polizza,
          codiceMappato: m.codice || "",
          netto: Number(v.premio_netto || 0),
          aliquota: Number(v.aliquota_tasse_pct ?? ALIQUOTA_DEFAULT),
          includi: true,
          suggerimenti: m.suggerimenti,
        };
      });
      setRighe(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error("Estrazione fallita: " + (e?.message || "errore"));
      setFileName(null);
    } finally {
      setParsing(false);
    }
  };

  const aggiorna = (i: number, patch: Partial<Riga>) => {
    setRighe((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const lordoRiga = (r: Riga) =>
    r.codiceMappato === RCA_PRINCIPALE_CODE
      ? r.netto // RCA: imposta provinciale calcolata altrove
      : Math.round((r.netto * (1 + r.aliquota / 100)) * 100) / 100;

  const incluse = righe.filter((r) => r.includi);
  const totNetto = incluse.reduce((a, r) => a + (Number(r.netto) || 0), 0);
  const totLordo = incluse.reduce((a, r) => a + lordoRiga(r), 0);
  const nonMappate = incluse.filter((r) => !r.codiceMappato).length;

  const carica = async () => {
    if (nonMappate > 0) {
      toast.error(`${nonMappate} voci selezionate non sono mappate al catalogo`);
      return;
    }
    setSubmitting(true);
    try {
      // Recupera voci esistenti (firma) per individuare riga RCA principale
      const { data: existing } = await supabase
        .from("premi_garanzia_polizza" as any)
        .select("id, codice_garanzia, is_rca_principale, ordine")
        .eq("titolo_id", titoloId)
        .eq("tipo_premio", "firma");
      const exArr = (existing as any[]) || [];
      const rcaRow = exArr.find((e) => e.is_rca_principale);
      const codiciEsistenti = new Map<string, any>();
      exArr.forEach((e) => {
        if (e.codice_garanzia) codiciEsistenti.set(String(e.codice_garanzia).toUpperCase(), e);
      });

      let nextOrdine = (exArr.reduce((m, e) => Math.max(m, e.ordine || 0), 0) || 0) + 1;

      for (const r of incluse) {
        if (r.codiceMappato === RCA_PRINCIPALE_CODE) {
          if (rcaRow) {
            await supabase
              .from("premi_garanzia_polizza" as any)
              .update({ firma: r.netto })
              .eq("id", rcaRow.id);
          } else {
            await supabase.from("premi_garanzia_polizza" as any).insert({
              titolo_id: titoloId,
              garanzia: mainLabel,
              codice_garanzia: "RCA",
              is_rca_principale: true,
              firma: r.netto,
              ordine: 0,
              tipo_premio: "firma",
            });
          }
          continue;
        }
        const cat = catalogo.find((c) => c.codice === r.codiceMappato);
        if (!cat) continue;
        const ex = codiciEsistenti.get(cat.codice.toUpperCase());
        if (ex) {
          await supabase
            .from("premi_garanzia_polizza" as any)
            .update({ firma: r.netto, aliquota_tasse_pct: r.aliquota })
            .eq("id", ex.id);
        } else {
          await supabase.from("premi_garanzia_polizza" as any).insert({
            titolo_id: titoloId,
            garanzia: cat.descrizione,
            codice_garanzia: cat.codice,
            aliquota_tasse_pct: r.aliquota,
            is_rca_principale: false,
            firma: r.netto,
            ordine: nextOrdine++,
            tipo_premio: "firma",
          });
        }
      }
      qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "firma"] });
      qc.invalidateQueries({ queryKey: ["voci-rca", titoloId, "quietanza"] });
      toast.success("Voci caricate nella card Firma");
      onImported?.();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error("Caricamento fallito: " + (e?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4 text-teal-600" />
          Scansione AI Polizza
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            Importa garanzie polizza con AI
          </DialogTitle>
          <DialogDescription>
            Trascina la copia di polizza (PDF o immagine). L'AI estrae le voci di premio; verrai
            mostrata l'anteprima e potrai mappare/modificare prima del caricamento. Le voci sono
            sempre limitate al catalogo garanzie esistente.
          </DialogDescription>
        </DialogHeader>

        {!righe.length && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileInput.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors",
              dragOver ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30" : "border-muted-foreground/30 hover:border-teal-400",
            )}
          >
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                <span>Analisi del documento in corso…</span>
                {fileName && <span className="text-xs">{fileName}</span>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <UploadCloud className="h-10 w-10 text-teal-600" />
                <span className="font-medium">Trascina qui la polizza oppure clicca per selezionare</span>
                <span className="text-xs">PDF o immagini, max {MAX_DOCUMENT_UPLOAD_MB} MB</span>
              </div>
            )}
          </div>
        )}

        {righe.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{righe.length} voci rilevate</Badge>
              {nonMappate > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {nonMappate} da mappare
                </Badge>
              )}
            </div>

            <TableScrollArea className="border rounded-lg">
          <table className="w-full min-w-max text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2 w-12">Inc.</th>
                    <th className="p-2">Testo dalla polizza</th>
                    <th className="p-2">Mappa a (catalogo)</th>
                    <th className="p-2 w-28">Netto €</th>
                    <th className="p-2 w-24">Aliq. %</th>
                    <th className="p-2 w-28 text-right">Lordo €</th>
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r, i) => {
                    const isRca = r.codiceMappato === RCA_PRINCIPALE_CODE;
                    const unmatched = !r.codiceMappato;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-t",
                          i % 2 === 1 && "bg-muted/20",
                          isRca && "bg-teal-50 dark:bg-teal-950/30",
                          unmatched && "bg-amber-50 dark:bg-amber-950/30",
                        )}
                      >
                        <td className="p-2">
                          <Switch checked={r.includi} onCheckedChange={(v) => aggiorna(i, { includi: v })} />
                        </td>
                        <td className="p-2">
                          <div className="font-medium">{r.testo}</div>
                          {r.codice_polizza && (
                            <div className="text-xs text-muted-foreground">codice: {r.codice_polizza}</div>
                          )}
                          {unmatched && r.suggerimenti.length > 0 && (
                            <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                              suggerito: {r.suggerimenti.map((s) => `${s.codice} ${s.descrizione}`).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <Select
                            value={r.codiceMappato || "__none"}
                            onValueChange={(v) => aggiorna(i, { codiceMappato: v === "__none" ? "" : v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Seleziona…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">— Da mappare —</SelectItem>
                              <SelectItem value="RCA">
                                <span className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-teal-600" /> {mainLabel} (principale)
                                </span>
                              </SelectItem>
                              {catalogo.map((c) => (
                                <SelectItem key={c.codice} value={c.codice}>
                                  {c.codice} — {c.descrizione}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={r.netto}
                            onChange={(e) => aggiorna(i, { netto: Number(e.target.value) || 0 })}
                            className="h-9"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={r.aliquota}
                            disabled={isRca}
                            onChange={(e) => aggiorna(i, { aliquota: Number(e.target.value) || 0 })}
                            className="h-9"
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {isRca ? "—" : fmtEur(lordoRiga(r))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/40 font-medium">
                  <tr className="border-t">
                    <td colSpan={3} className="p-2 text-right">Totali (selezionate):</td>
                    <td className="p-2 tabular-nums">{fmtEur(totNetto)}</td>
                    <td></td>
                    <td className="p-2 text-right tabular-nums">{fmtEur(totLordo)}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScrollArea>

            <p className="text-xs text-muted-foreground">
              Le voci verranno caricate nella card <strong>Firma</strong>. La <strong>Quietanza</strong>
              {" "}si sincronizza automaticamente.
            </p>
          </div>
        )}

        <DialogFooter>
          {righe.length > 0 && (
            <>
              <Button variant="outline" onClick={reset} disabled={submitting}>
                Cambia file
              </Button>
              <Button onClick={carica} disabled={submitting || nonMappate > 0 || incluse.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Carica nelle voci Firma
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
