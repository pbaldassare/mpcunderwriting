import { ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, ShieldCheck, Plus, Trash2, Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { parseDecimalIt, parseDecimalItOr } from "@/lib/number";
import { safeId } from "@/lib/safeId";
import {
  calcTasseRiga,
  calcLordoGaranziaRow,
  calcTasseEffettiveRiga,
  decomposeLordoToPremi,
} from "@/lib/calcProvvigioniGaranzia";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** True se netto o accessori hanno un importo non nullo (anche negativo / appendice a credito). */
function hasImponibile(netto: number, accessori: number): boolean {
  return Math.abs(netto) > 0.0001 || Math.abs(accessori) > 0.0001;
}

/** Normalizza una stringa numerica inserita dall'utente al blur: "476,5" → "476.50". */
function normalizeDecimalOnBlur(value: string, decimals = 2): string {
  if (value == null || value === "") return "";
  const n = parseDecimalIt(value);
  if (n === null) return value; // non valido: lasciamo com'è così l'utente vede il proprio input
  return n.toFixed(decimals);
}

export interface GaranziaRow {
  /** Id locale stabile per key React (non persistito su DB) */
  _localId?: string;
  /** Codice del sottoramo (rami.codice) o codice garanzia legacy */
  codice: string | null;
  descrizione: string;
  netto: string;
  /** Importo accessori per riga (imponibile = netto + accessori) */
  accessori?: string;
  tasse: string;
  /** Rettifica manuale tasse (€): si somma al calcolo auto, non influenza provvigioni. */
  tasseRettifica?: string;
  /**
   * True se l'utente ha attivato la modalità manuale delle tasse su questa riga:
   * la formula automatica (imponibile × aliquota) è sospesa e Netto/Tasse si editano
   * a mano. Lo stato non è persistito direttamente: al load viene dedotto da
   * `tasseRettifica != 0`.
   */
  tasseManualOverride?: boolean;
  aliquotaTasse: number;
  /** Override manuale % provvigione sul netto (valorizzato solo se `provvNettoPctOverride`). */
  provvNettoPct?: number | null;
  /** True se la % provvigione netto è stata sovrascritta a mano (scollegata dalla matrice agenzia). */
  provvNettoPctOverride?: boolean;
  /** Override manuale % provvigione su accessori (valorizzato solo se `provvAccessoriPctOverride`). */
  provvAccessoriPct?: number | null;
  /** True se la % provvigione accessori è stata sovrascritta a mano. */
  provvAccessoriPctOverride?: boolean;
  /** Id del sottoramo selezionato (rami.id). Usato per derivare titoli.ramo_id in immissione. */
  sottoramoId?: string | null;
  /** Contributo SSN per la riga (importo €) — popolato solo se il sottoramo ha ssn_attivo */
  ssn?: string;
  /** % SSN applicata (cache dal sottoramo, es. 10.50) */
  aliquotaSsn?: number;
  /** True se il sottoramo prevede SSN */
  ssnAttivo?: boolean;
  /** True se l'utente ha modificato manualmente l'importo SSN (no autorecalc) */
  ssnManualOverride?: boolean;
  /** True se il sottoramo è "esente" (Contributo Forzoso, Oneri): tasse e provvigioni forzate a 0 */
  escludiProvvigioni?: boolean;
  /** True se diritti di agenzia: solo importo tasse manuale, senza premio netto */
  dirittiAgenzia?: boolean;
  /**
   * Solo per righe di tipo "quietanza": true se l'utente ha modificato a mano la
   * riga, scollegandola dalla sincronizzazione automatica con la Firma.
   */
  quietanzaPersonalizzata?: boolean;
}

export const emptyGaranziaRow = (): GaranziaRow => ({
  _localId: safeId(),
  codice: null,
  descrizione: "",
  netto: "",
  accessori: "",
  tasse: "",
  aliquotaTasse: 0,
  sottoramoId: null,
  ssn: "",
  aliquotaSsn: 0,
  ssnAttivo: false,
  ssnManualOverride: false,
  escludiProvvigioni: false,
  dirittiAgenzia: false,
});

export interface PremiGaranziaCardShellProps {
  tipoPremio: "firma" | "quietanza";
  /** Gruppo Ramo selezionato sul titolo: filtra il catalogo garanzie selezionabili */
  gruppoRamoId?: string | null;
  /** Sottoramo di default proposto per le NUOVE righe (bottone "+"). Le righe esistenti restano invariate. */
  defaultSottoramoId?: string | null;
  rows: GaranziaRow[];
  onRowsChange: (next: GaranziaRow[]) => void;
  /** Somma accessori righe (read-only; legacy addizionali card) */
  addizionali: string;
  onAddizionaliChange?: (v: string) => void;
  provvigioni: number;
  /** Breakdown % provv netto vs accessori per footer (quando differiscono) */
  provvPctBreakdown?: { pctNetto: number; pctAccessori: number } | null;
  /** % provv accessori EFFETTIVA per riga (override o matrice) — abilita la colonna */
  rowPctAccessori?: (row: GaranziaRow) => number | null;
  /** % provv netto EFFETTIVA per riga (override o matrice) — abilita la colonna */
  rowPctNetto?: (row: GaranziaRow) => number | null;
  /** % netto da matrice agenzia (baseline, per confronto/reset) */
  rowAgencyPctNetto?: (row: GaranziaRow) => number | null;
  /** % accessori da matrice agenzia (baseline, per confronto/reset) */
  rowAgencyPctAccessori?: (row: GaranziaRow) => number | null;
  /** Sovrascrittura manuale % provvigione di riga (con conferma + log a monte). */
  onProvvPctOverride?: (idx: number, campo: "netto" | "accessori", nextPct: number | null) => void | Promise<void>;
  /** Riallinea la % di riga alla matrice agenzia (toglie l'override). */
  onProvvPctReset?: (idx: number, campo: "netto" | "accessori") => void | Promise<void>;
  /** Slot opzionale (es. pulsante "Importa con AI") */
  headerExtra?: ReactNode;
  /** Mostra badge "Sincronizzata" sulla Quietanza quando è uno specchio della Firma */
  sincronizzata?: boolean;
  /** % Provvigione Agenzia (string, controllata) — editabile inline */
  percentualeAgenzia?: string;
  onPercentualeAgenziaChange?: (v: string) => void;
  /** Override manuale importo provvigione (€): evita conversione euro→%→euro. */
  onProvvigioniImportoChange?: (importo: number) => void;
  /** Flag visivo "auto-popolata da Provvigioni per Ramo" */
  percentualeAgenziaAuto?: boolean;
  /** Etichetta del produttore (es. "Mario Rossi") o null se Sede 100% */
  produttoreLabel?: string | null;
  /** % spettante al commerciale (string). Se 100 o sede → no split */
  percentualeCommerciale?: string;
  /** True se il commerciale è la Sede (split nascosto) */
  produttoreIsSede?: boolean;
  /** Etichetta del ramo (es. "RC Generale") da mostrare nella ripartizione */
  ramoLabel?: string | null;
  /** True se la % Commerciale è stata letta dal DB (produttori_provvigioni_ramo / percentuale_base) */
  percentualeCommercialeAuto?: boolean;
  /** Descrizione fonte dell'auto-lookup (es. "match esatto rapporto+ramo+sottoramo") */
  fonteAuto?: string | null;
  /** Warning del resolver (es. "Seleziona il Sottoramo per la % esatta") */
  warningAuto?: string | null;
  /** Callback per riattivare auto dopo un override manuale */
  onResetAuto?: () => void;
  /**
   * Solo Quietanza: flag per riga che indica se la riga è personalizzata
   * (scollegata dalla sincronizzazione automatica con la Firma).
   */
  personalizzati?: boolean[];
  /** Solo Quietanza: riallinea la riga `idx` alla Firma (toglie la personalizzazione). */
  onResetRow?: (idx: number) => void;
  /** Override titolo card (es. etichette rateo) */
  titoloOverride?: string;
  /** Slot opzionale sotto i totali (es. riparto coassicurazione) */
  coassicurazioneBreakdown?: ReactNode;
  /** Blocco modifica (polizza incassata / messa a cassa / fuori da Modifica) */
  readOnly?: boolean;
}


export function PremiGaranziaCardShell({
  tipoPremio,
  gruppoRamoId,
  defaultSottoramoId,
  rows: rowsProp,
  onRowsChange,
  addizionali,
  onAddizionaliChange: _onAddizionaliChange,
  provvigioni,
  provvPctBreakdown,
  rowPctAccessori,
  rowPctNetto,
  rowAgencyPctNetto,
  rowAgencyPctAccessori,
  onProvvPctOverride,
  onProvvPctReset,
  headerExtra,
  sincronizzata,
  percentualeAgenzia,
  onPercentualeAgenziaChange,
  onProvvigioniImportoChange,
  percentualeAgenziaAuto,
  produttoreLabel,
  percentualeCommerciale,
  produttoreIsSede,
  ramoLabel,
  percentualeCommercialeAuto,
  fonteAuto,
  warningAuto,
  onResetAuto,
  personalizzati,
  onResetRow,
  titoloOverride,
  coassicurazioneBreakdown,
  readOnly = false,
}: PremiGaranziaCardShellProps) {

  const rows = Array.isArray(rowsProp) ? rowsProp : [];
  const isQuietanza = tipoPremio === "quietanza";
  // Draft locale per il campo Lordo: mentre l'utente digita teniamo la stringa
  // così com'è (es. "4", "47", "476,", "476,5"); il back-solve scatta solo onBlur.
  const [lordoDrafts, setLordoDrafts] = useState<Record<number, string>>({});
  // Draft locale per il campo Tasse in modalità manuale (stesso pattern del Lordo).
  const [tasseDrafts, setTasseDrafts] = useState<Record<number, string>>({});
  // Draft locale per le % provvigione (chiave `${idx}:netto` / `${idx}:accessori`).
  const [pctProvvDrafts, setPctProvvDrafts] = useState<Record<string, string>>({});

  const [totFocus, setTotFocus] = useState(false);
  const [totDraft, setTotDraft] = useState("");
  const [pctFocus, setPctFocus] = useState(false);
  const [pctDraft, setPctDraft] = useState("");
  const titolo = titoloOverride ?? (isQuietanza ? "Premi per Garanzia — Quietanza" : "Premi per Garanzia — Firma");

  const totNetto = rows.reduce((s, r) => s + parseDecimalItOr(r.netto), 0);
  const totAccessori = rows.reduce((s, r) => s + parseDecimalItOr(r.accessori), 0);
  const totTasse = rows.reduce((s, r) => s + calcTasseEffettiveRiga(r), 0);
  const totRettifica = rows.reduce((s, r) => s + parseDecimalItOr(r.tasseRettifica), 0);
  const totSsn = rows.reduce((s, r) => s + parseDecimalItOr(r.ssn), 0);
  const lordo = totNetto + totAccessori + totTasse + totSsn;
  const hasSsnRows = rows.some((r) => r.ssnAttivo);
  // Colonne provvigioni per voce (% + €): attive quando il parent fornisce le % effettive.
  const showProvvVoceCols = !!rowPctNetto || !!rowPctAccessori;
  const provvVoceEditable = showProvvVoceCols && !readOnly && !!onProvvPctOverride;
  const provvBreakdownVisible = !!provvPctBreakdown
    && (
      Math.abs(provvPctBreakdown.pctNetto - provvPctBreakdown.pctAccessori) > 0.0001
      || rows.some((r) => parseFloat((r.accessori || "0").replace(",", ".")) > 0)
    );

  // Catalogo sottorami filtrato per gruppo ramo selezionato.
  // I sottorami compongono le righe garanzia che formano il premio.
  const { data: catalogo = [] } = useQuery({
    queryKey: ["sottorami-catalogo-shell", gruppoRamoId || "none"],
    enabled: !!gruppoRamoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione, aliquota_tasse_ramo, ssn_attivo, aliquota_ssn, escludi_provvigioni, diritti_agenzia")
        .eq("attivo", true)
        .eq("gruppo_ramo_id", gruppoRamoId!)
        .order("codice");
      return (data as any[]) || [];
    },
  });

  const garanziaOptions = (catalogo as any[])
    .slice()
    .sort((a, b) => {
      const aDag = a.diritti_agenzia ? 0 : 1;
      const bDag = b.diritti_agenzia ? 0 : 1;
      if (aDag !== bDag) return aDag - bDag;
      return String(a.codice).localeCompare(String(b.codice), "it");
    })
    .map((s: any) => ({
    value: s.id as string,
    label: `${s.codice} — ${s.descrizione}${
      s.diritti_agenzia ? " · solo tasse" : s.escludi_provvigioni ? " · esente" : ""
    }`,
  }));

  const updateRow = (idx: number, patch: Partial<GaranziaRow>) => {
    if (readOnly) return;
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onRowsChange(next);
  };

  /** Cella provvigioni per voce: % editabile (override→conferma+log a monte) + importo €. */
  const renderProvvVoceCell = (idx: number, r: GaranziaRow, campo: "netto" | "accessori") => {
    const esclusa = !!r.escludiProvvigioni || !!r.dirittiAgenzia;
    if (esclusa) {
      return (
        <TableCell key={campo} className="text-right">
          <span className="text-[10px] text-muted-foreground font-mono">—</span>
        </TableCell>
      );
    }
    const base = campo === "netto" ? parseDecimalItOr(r.netto) : parseDecimalItOr(r.accessori);
    const pctEff = campo === "netto" ? rowPctNetto?.(r) : rowPctAccessori?.(r);
    const pctAg = campo === "netto" ? rowAgencyPctNetto?.(r) : rowAgencyPctAccessori?.(r);
    const isOverride = campo === "netto" ? !!r.provvNettoPctOverride : !!r.provvAccessoriPctOverride;
    const euro = pctEff != null ? (base * pctEff) / 100 : 0;
    const draftKey = `${idx}:${campo}`;
    const shownPct = pctProvvDrafts[draftKey] ?? (pctEff != null ? pctEff.toFixed(2) : "");
    return (
      <TableCell key={campo} className="text-right">
        <div className="flex flex-col items-end gap-0.5">
          {provvVoceEditable ? (
            <Input
              type="text"
              inputMode="decimal"
              pattern="[0-9.,\-]*"
              value={shownPct}
              onChange={(e) => setPctProvvDrafts((d) => ({ ...d, [draftKey]: e.target.value }))}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const parsed = raw === "" ? null : parseDecimalIt(raw);
                setPctProvvDrafts((d) => {
                  const n = { ...d };
                  delete n[draftKey];
                  return n;
                });
                const current = pctEff ?? null;
                if (parsed == null && current == null) return;
                if (parsed != null && current != null && Math.abs(parsed - current) < 0.0001) return;
                void onProvvPctOverride?.(idx, campo, parsed);
              }}
              className={cn(
                "h-7 text-right font-mono w-[92px] text-xs",
                isOverride && "border-orange-300 focus-visible:ring-orange-400",
              )}
              title={pctAg != null ? `% agenzia: ${pctAg.toFixed(2)}%` : undefined}
            />
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground">
              {pctEff != null ? `${pctEff.toFixed(2)}%` : "—"}
            </span>
          )}
          <span className="text-[10px] font-mono tabular-nums" title="Provvigione € della voce">
            {euro.toFixed(2)} €
          </span>
          {isOverride && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-bold uppercase text-orange-600" title={pctAg != null ? `Agenzia: ${pctAg.toFixed(2)}%` : undefined}>
                override
              </span>
              {provvVoceEditable && onProvvPctReset && (
                <button
                  type="button"
                  onClick={() => { void onProvvPctReset(idx, campo); }}
                  className="text-[8px] font-bold uppercase text-muted-foreground hover:text-foreground underline"
                  title={pctAg != null ? `Riallinea a ${pctAg.toFixed(2)}% (agenzia)` : "Riallinea alla % agenzia"}
                >
                  ↻ agenzia
                </button>
              )}
            </div>
          )}
        </div>
      </TableCell>
    );
  };

  const buildRowFromSottoramo = (sottoramoId: string | null | undefined): GaranziaRow => {
    if (!sottoramoId) return emptyGaranziaRow();
    const sel = (catalogo as any[]).find((s: any) => s.id === sottoramoId);
    if (!sel) return emptyGaranziaRow();
    const escludi = !!sel.escludi_provvigioni;
    const diritti = !!sel.diritti_agenzia;
    const aliquota = escludi || diritti ? 0 : (Number(sel.aliquota_tasse_ramo) || 0);
    const ssnAttivo = !escludi && !diritti && !!sel.ssn_attivo;
    const aliquotaSsn = ssnAttivo ? (Number(sel.aliquota_ssn) || 10.5) : 0;
    return {
      ...emptyGaranziaRow(),
      sottoramoId: sel.id,
      codice: sel.codice,
      descrizione: sel.descrizione,
      aliquotaTasse: aliquota,
      aliquotaSsn,
      ssnAttivo,
      escludiProvvigioni: escludi,
      dirittiAgenzia: diritti,
      tasse: escludi ? "0" : "",
    };
  };

  const addRow = () => {
    if (readOnly) return;
    const row = buildRowFromSottoramo(defaultSottoramoId);
    row._localId = safeId();
    onRowsChange([...rows, row]);
  };

  const removeRow = (idx: number) => {
    if (readOnly) return;
    const r = rows[idx];
    const isEmpty = !r.codice && !r.descrizione && !r.netto && !r.tasse;
    if (!isEmpty) {
      const ok = window.confirm("Rimuovere questa garanzia?");
      if (!ok) return;
    }
    const next = rows.filter((_, i) => i !== idx);
    onRowsChange(next.length ? next : [buildRowFromSottoramo(defaultSottoramoId)]);
  };

  const calcSsn = (netto: number, _tasse: number, aliquotaSsn: number) =>
    aliquotaSsn > 0 ? +((netto * aliquotaSsn) / 100).toFixed(2) : 0;

  const handleGaranziaSelect = (idx: number, sottoramoId: string) => {
    const sel = (catalogo as any[]).find((s: any) => s.id === sottoramoId);
    if (!sel) return;
    const escludi = !!sel.escludi_provvigioni;
    const diritti = !!sel.diritti_agenzia;
    const aliquota = escludi || diritti ? 0 : (Number(sel.aliquota_tasse_ramo) || 0);
    const ssnAttivo = !escludi && !diritti && !!sel.ssn_attivo;
    const aliquotaSsn = ssnAttivo ? (Number(sel.aliquota_ssn) || 10.5) : 0;
    const netto = parseDecimalItOr(rows[idx]?.netto);
    const accessori = parseDecimalItOr(rows[idx]?.accessori);
    const tasseCalc = !escludi && !diritti && hasImponibile(netto, accessori) && aliquota > 0
      ? calcTasseRiga(netto, accessori, aliquota)
      : 0;
    updateRow(idx, {
      sottoramoId: sel.id,
      codice: sel.codice,
      descrizione: sel.descrizione,
      aliquotaTasse: aliquota,
      netto: diritti ? "" : rows[idx]?.netto || "",
      accessori: diritti ? "" : rows[idx]?.accessori || "",
      tasse: escludi ? "0" : diritti ? (rows[idx]?.tasse || "") : (hasImponibile(netto, 0) && aliquota > 0 ? tasseCalc.toFixed(2) : rows[idx]?.tasse || ""),
      ssnAttivo,
      aliquotaSsn,
      ssn: diritti ? "" : (ssnAttivo && Math.abs(netto) > 0.0001 ? calcSsn(netto, tasseCalc, aliquotaSsn).toFixed(2) : ""),
      ssnManualOverride: false,
      escludiProvvigioni: escludi,
      dirittiAgenzia: diritti,
    });
  };


  const recalcTasseSsn = (r: GaranziaRow | undefined, netto: number, accessori: number) => {
    if (r?.dirittiAgenzia) {
      return { tasseNew: null as number | null, ssnNew: "" };
    }
    const aliquota = r?.aliquotaTasse || 0;
    const tasseNew = r?.escludiProvvigioni ? 0 : calcTasseRiga(netto, accessori, aliquota);
    const ssnNew = r?.ssnAttivo && !r?.ssnManualOverride
      ? calcSsn(netto, tasseNew, r.aliquotaSsn || 0).toFixed(2)
      : (r?.ssn || "");
    return { tasseNew, ssnNew };
  };

  const handleNettoChange = (idx: number, value: string) => {
    const r = rows[idx];
    if (r?.dirittiAgenzia) return;
    if (r?.tasseManualOverride) {
      // Modalità manuale: le tasse le decide l'utente. Manteniamo costante la
      // tassa effettiva ricalcolando la rettifica sul nuovo importo auto.
      const effOld = calcTasseEffettiveRiga(r);
      const nettoNum = value === "" ? 0 : (parseDecimalIt(value) ?? 0);
      const accessoriNum = parseDecimalItOr(r?.accessori);
      const autoNew = calcTasseRiga(nettoNum, accessoriNum, r?.aliquotaTasse || 0);
      const rettNew = round2(effOld - autoNew);
      const ssnNew = r?.ssnAttivo && !r?.ssnManualOverride
        ? calcSsn(nettoNum, autoNew, r?.aliquotaSsn || 0).toFixed(2)
        : (r?.ssn || "");
      updateRow(idx, {
        netto: value,
        tasse: autoNew ? autoNew.toFixed(2) : "",
        tasseRettifica: rettNew !== 0 ? rettNew.toFixed(2) : "",
        ssn: ssnNew,
      });
      return;
    }
    if (value === "") {
      updateRow(idx, { netto: "", tasse: "", ssn: r?.ssnManualOverride ? r.ssn : "" });
      return;
    }
    const netto = parseDecimalIt(value);
    const accessori = parseDecimalItOr(r?.accessori);
    const hasNetto = netto !== null;
    const { tasseNew, ssnNew } = hasNetto
      ? recalcTasseSsn(r, netto!, accessori)
      : { tasseNew: null as number | null, ssnNew: r?.ssn || "" };
    updateRow(idx, {
      netto: value,
      tasse: tasseNew !== null ? tasseNew.toFixed(2) : (r?.tasse || ""),
      ssn: ssnNew,
    });
  };

  const handleAccessoriChange = (idx: number, value: string) => {
    const r = rows[idx];
    if (r?.dirittiAgenzia) return;
    if (r?.tasseManualOverride) {
      const effOld = calcTasseEffettiveRiga(r);
      const accessoriNum = value === "" ? 0 : (parseDecimalIt(value) ?? 0);
      const nettoNum = parseDecimalItOr(r?.netto);
      const autoNew = calcTasseRiga(nettoNum, accessoriNum, r?.aliquotaTasse || 0);
      const rettNew = round2(effOld - autoNew);
      const ssnNew = r?.ssnAttivo && !r?.ssnManualOverride
        ? calcSsn(nettoNum, autoNew, r?.aliquotaSsn || 0).toFixed(2)
        : (r?.ssn || "");
      updateRow(idx, {
        accessori: value,
        tasse: autoNew ? autoNew.toFixed(2) : "",
        tasseRettifica: rettNew !== 0 ? rettNew.toFixed(2) : "",
        ssn: ssnNew,
      });
      return;
    }
    if (value === "") {
      const netto = parseDecimalItOr(r?.netto);
      const { tasseNew, ssnNew } = recalcTasseSsn(r, netto, 0);
      updateRow(idx, { accessori: "", tasse: tasseNew.toFixed(2), ssn: ssnNew });
      return;
    }
    const accessori = parseDecimalIt(value);
    const netto = parseDecimalItOr(r?.netto);
    const hasAcc = accessori !== null;
    const { tasseNew, ssnNew } = hasAcc
      ? recalcTasseSsn(r, netto, accessori!)
      : { tasseNew: null as number | null, ssnNew: r?.ssn || "" };
    updateRow(idx, {
      accessori: value,
      tasse: tasseNew !== null ? tasseNew.toFixed(2) : (r?.tasse || ""),
      ssn: ssnNew,
    });
  };

  const handleTasseChange = (idx: number, value: string) => {
    const r = rows[idx];
    if (r?.dirittiAgenzia) {
      updateRow(idx, { tasse: value, netto: "", accessori: "", ssn: "" });
      return;
    }
    if (r?.tasseManualOverride) {
      // L'utente digita la tassa EFFETTIVA. La memorizziamo come rettifica sul
      // valore auto (imponibile × aliquota), così le provvigioni restano intatte.
      const auto = parseDecimalItOr(r?.tasse);
      const eff = value === "" ? 0 : parseDecimalIt(value);
      if (eff === null) return;
      const rett = round2(eff - auto);
      updateRow(idx, { tasseRettifica: rett !== 0 ? rett.toFixed(2) : "" });
      return;
    }
    // Standard: tasse auto — sola lettura in UI
  };

  const toggleTasseManual = (idx: number) => {
    if (readOnly) return;
    const r = rows[idx];
    if (!r || r.dirittiAgenzia || r.escludiProvvigioni) return;
    if (r.tasseManualOverride) {
      const netto = parseDecimalItOr(r.netto);
      const accessori = parseDecimalItOr(r.accessori);
      const autoTasse = calcTasseRiga(netto, accessori, r.aliquotaTasse || 0);
      const ssnAuto = r.ssnAttivo && !r.ssnManualOverride;
      const ssnVal = ssnAuto
        ? round2((netto * (r.aliquotaSsn || 0)) / 100)
        : parseDecimalItOr(r.ssn);
      updateRow(idx, {
        tasseManualOverride: false,
        tasseRettifica: "",
        tasse: hasImponibile(netto, accessori) && (r.aliquotaTasse || 0) > 0
          ? autoTasse.toFixed(2)
          : (r.tasse || ""),
        ssn: r.ssnAttivo ? ssnVal.toFixed(2) : (r.ssn || ""),
      });
    } else {
      updateRow(idx, { tasseManualOverride: true });
    }
  };

  const handleSsnChange = (idx: number, value: string) => {
    updateRow(idx, { ssn: value, ssnManualOverride: true });
  };

  const handleLordoChange = (idx: number, value: string) => {
    const r = rows[idx];
    if (r?.dirittiAgenzia) return;
    if (value === "") {
      updateRow(idx, { netto: "", accessori: "", tasse: "", ssn: r?.ssnManualOverride ? r.ssn : "" });
      return;
    }
    const lordo = parseDecimalIt(value);
    if (lordo === null) return;
    const aliquota = r?.aliquotaTasse || 0;
    const aliquotaSsn = r?.aliquotaSsn || 0;
    const accessori = parseDecimalItOr(r?.accessori);
    const ssnAuto = !!r?.ssnAttivo && !r?.ssnManualOverride && aliquotaSsn > 0;
    const ssnManuale = !ssnAuto && r?.ssnAttivo ? parseDecimalItOr(r?.ssn) : 0;
    const parts = decomposeLordoToPremi({
      lordo,
      accessori,
      aliquotaTassePct: aliquota,
      ssnAuto,
      aliquotaSsnPct: aliquotaSsn,
      ssnManuale,
    });
    updateRow(idx, {
      netto: parts.netto.toFixed(2),
      tasse: parts.tasse.toFixed(2),
      tasseRettifica: parts.tasseRettifica !== 0 ? parts.tasseRettifica.toFixed(2) : "",
      ssn: r?.ssnAttivo ? parts.ssn.toFixed(2) : (r?.ssn || ""),
    });
  };


  return (
    <Card className={cn("border-l-4 shadow-sm", isQuietanza ? "border-l-amber-500" : "border-l-teal-600")}>
      <CardHeader
        className={cn(
          "border-b py-3",
          isQuietanza ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-teal-50/60 dark:bg-teal-950/20",
        )}
      >
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-2">
          <CardTitle
            className={cn(
              "flex items-center gap-2 text-sm sm:text-base",
              isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100",
            )}
          >
            {isQuietanza ? <ShieldCheck className="h-4 w-4" /> : <Car className="h-4 w-4" />}
            {titolo}
            {isQuietanza && sincronizzata && (
              <Badge variant="outline" className="ml-1 text-[10px] border-emerald-400 text-emerald-800">
                Sincronizzata
              </Badge>
            )}
          </CardTitle>
          {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[30%]">Voce</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right w-[90px]">Accessori</TableHead>
                <TableHead className="text-right w-[80px]">Aliq%</TableHead>
                <TableHead className="text-right">Tasse</TableHead>
                {hasSsnRows && <TableHead className="text-right w-[100px]">SSN</TableHead>}
                {showProvvVoceCols && (
                  <>
                    <TableHead className="text-right w-[104px] text-[10px]">Prov. Netto<br />% · €</TableHead>
                    <TableHead className="text-right w-[104px] text-[10px]">Prov. Access.<br />% · €</TableHead>
                  </>
                )}
                <TableHead className="text-right">Lordo</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => {
                const netto = parseDecimalItOr(r.netto);
                const accessori = parseDecimalItOr(r.accessori);
                const taxEff = calcTasseEffettiveRiga(r);
                const ssnRow = parseDecimalItOr(r.ssn);
                const aliquotaFissa = r.dirittiAgenzia ? 0 : (r.aliquotaTasse || 0);
                const lordoRow = calcLordoGaranziaRow(r);
                // Il toggle "tasse manuali" non si applica a diritti agenzia (già input) né alle voci esenti.
                const manualEligible = !r.dirittiAgenzia && !r.escludiProvvigioni;
                const isManual = manualEligible && !!r.tasseManualOverride;
                const zebra = idx % 2 === 0
                  ? (isQuietanza ? "bg-amber-50/40 dark:bg-amber-950/10" : "bg-teal-50/50 dark:bg-teal-950/15")
                  : "bg-card";
                return (
                  <TableRow
                    key={r._localId ?? idx}
                    className={cn(zebra, isManual && "border-l-2 border-l-orange-400")}
                  >
                    <TableCell className="py-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className={cn("h-4 w-4 flex-shrink-0", isQuietanza ? "text-amber-700" : "text-teal-700")} />
                          {gruppoRamoId ? (
                            <SearchableSelect
                              options={garanziaOptions}
                              value={r.sottoramoId || ""}
                              onValueChange={(v) => handleGaranziaSelect(idx, v)}
                              placeholder={garanziaOptions.length ? "Seleziona garanzia…" : "Caricamento…"}
                              className="flex-1 min-w-[280px]"
                              disabled={readOnly}
                            />
                          ) : (
                            <Input
                              value={r.descrizione}
                              onChange={(e) => updateRow(idx, { descrizione: e.target.value })}
                              placeholder="Seleziona prima il Gruppo Ramo"
                              disabled
                              className="h-8 text-xs flex-1 min-w-[200px]"
                            />
                          )}
                        </div>
                        {isQuietanza && personalizzati?.[idx] && (
                          <div className="flex items-center gap-1.5 pl-7">
                            <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-800 dark:text-amber-200">
                              Personalizzato
                            </Badge>
                            {onResetRow && !readOnly && (
                              <button
                                type="button"
                                onClick={() => onResetRow(idx)}
                                className="inline-flex items-center rounded-sm bg-muted hover:bg-muted/70 text-muted-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase gap-1"
                                title="Riallinea questa voce alla Firma"
                              >
                                ↻ Sincronizza da Firma
                              </button>
                            )}
                          </div>
                        )}
                        {isManual && (
                          <div className="flex items-center gap-1.5 pl-7">
                            <Badge variant="outline" className="text-[9px] border-orange-400 text-orange-700 dark:text-orange-300">
                              Tasse manuali
                            </Badge>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => toggleTasseManual(idx)}
                                className="inline-flex items-center rounded-sm bg-muted hover:bg-muted/70 text-muted-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase gap-1"
                                title="Ripristina il calcolo automatico delle tasse"
                              >
                                ↻ auto
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.,\-]*"
                        value={r.dirittiAgenzia ? "" : r.netto}
                        onChange={(e) => handleNettoChange(idx, e.target.value)}
                        onBlur={(e) => {
                          handleNettoChange(idx, normalizeDecimalOnBlur(e.target.value));
                        }}
                        disabled={readOnly || r.dirittiAgenzia || r.escludiProvvigioni}
                        title={r.dirittiAgenzia ? "Diritti di agenzia: solo importo tasse" : undefined}
                        className="h-8 text-right font-mono ml-auto w-28"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.,\-]*"
                        value={r.dirittiAgenzia ? "" : (r.accessori || "")}
                        onChange={(e) => handleAccessoriChange(idx, e.target.value)}
                        onBlur={(e) => {
                          handleAccessoriChange(idx, normalizeDecimalOnBlur(e.target.value));
                        }}
                        disabled={readOnly || r.dirittiAgenzia || r.escludiProvvigioni}
                        className="h-8 text-right font-mono ml-auto w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-xs font-mono",
                          isManual ? "line-through text-muted-foreground/60" : "text-muted-foreground",
                        )}
                        title={isManual ? "Aliquota ignorata: tasse in modalità manuale" : undefined}
                      >
                        {r.dirittiAgenzia ? "—" : aliquotaFissa.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.escludiProvvigioni ? (
                        <span className="text-xs font-mono text-muted-foreground">0.00</span>
                      ) : r.dirittiAgenzia ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.,\-]*"
                          value={r.tasse}
                          onChange={(e) => handleTasseChange(idx, e.target.value)}
                          onBlur={(e) => {
                            handleTasseChange(idx, normalizeDecimalOnBlur(e.target.value));
                          }}
                          disabled={readOnly}
                          title="Importo diritti di agenzia (solo tasse)"
                          className="h-8 text-right font-mono ml-auto w-24"
                        />
                      ) : isManual ? (
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9.,\-]*"
                          value={tasseDrafts[idx] ?? (taxEff ? taxEff.toFixed(2) : "")}
                          onChange={(e) => setTasseDrafts((d) => ({ ...d, [idx]: e.target.value }))}
                          onBlur={(e) => {
                            const v = normalizeDecimalOnBlur(e.target.value);
                            handleTasseChange(idx, v);
                            setTasseDrafts((d) => {
                              const n = { ...d };
                              delete n[idx];
                              return n;
                            });
                          }}
                          disabled={readOnly}
                          title="Tasse manuali: importo inserito a mano (non ricalcolato dall'aliquota)"
                          className="h-8 text-right font-mono ml-auto w-24 border-orange-300 focus-visible:ring-orange-400"
                        />
                      ) : (
                        <span
                          className="text-xs font-mono text-muted-foreground tabular-nums"
                          title="Tasse calcolate su netto + accessori"
                        >
                          {taxEff > 0 ? taxEff.toFixed(2) : "—"}
                        </span>
                      )}
                    </TableCell>
                    {hasSsnRows && (
                      <TableCell className="text-right">
                        {r.ssnAttivo ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <Input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9.,\-]*"
                              value={r.ssn || ""}
                              onChange={(e) => handleSsnChange(idx, e.target.value)}
                              onBlur={(e) => {
                                handleSsnChange(idx, normalizeDecimalOnBlur(e.target.value));
                              }}
                              disabled={readOnly}
                              className="h-8 text-right font-mono ml-auto w-24"
                              title={`SSN ${(r.aliquotaSsn ?? 10.5).toFixed(2)}% sul lordo (netto+tasse)`}
                            />
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {(r.aliquotaSsn ?? 10.5).toFixed(2)}%{r.ssnManualOverride ? " · manuale" : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                {showProvvVoceCols && (
                  <>
                    {renderProvvVoceCell(idx, r, "netto")}
                    {renderProvvVoceCell(idx, r, "accessori")}
                  </>
                )}
                    <TableCell className="text-right">
                      {r.dirittiAgenzia || isManual ? (
                        <span
                          className="text-sm font-mono font-semibold"
                          title={isManual ? "Lordo = netto + accessori + tasse + SSN (derivato in modalità manuale)" : undefined}
                        >
                          {lordoRow ? lordoRow.toFixed(2) : "—"}
                        </span>
                      ) : (
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.,\-]*"
                        value={lordoDrafts[idx] ?? (lordoRow ? lordoRow.toFixed(2) : "")}
                        onChange={(e) =>
                          setLordoDrafts((d) => ({ ...d, [idx]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const v = normalizeDecimalOnBlur(e.target.value);
                          handleLordoChange(idx, v);
                          setLordoDrafts((d) => {
                            const n = { ...d };
                            delete n[idx];
                            return n;
                          });
                        }}
                        disabled={readOnly}
                        className="h-8 text-right font-mono font-semibold ml-auto w-28"
                      />
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      {!readOnly && (
                        <div className="flex items-center justify-end gap-0.5">
                          {manualEligible && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={cn(
                                "h-7 w-7",
                                isManual
                                  ? "text-orange-600 hover:text-orange-700"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                              onClick={() => toggleTasseManual(idx)}
                              aria-label={isManual ? "Torna al calcolo automatico delle tasse" : "Modifica manuale delle tasse"}
                              title={isManual ? "Tasse manuali attive — clicca per tornare all'automatico" : "Sblocca la modifica manuale delle tasse"}
                            >
                              {isManual ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(idx)}
                            aria-label="Rimuovi garanzia"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

        {!readOnly && (
        <div className="px-3 py-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Aggiungi voce
          </Button>
        </div>
        )}

        {/* Totali */}
        <div className={cn("grid grid-cols-2 gap-2 p-3 border-t bg-muted/20", hasSsnRows ? "md:grid-cols-6" : "md:grid-cols-5")}>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Netto</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{totNetto.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Accessori</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{totAccessori.toFixed(2)} €</p>
          </div>
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Totale Tasse</Label>
            <p className="text-sm font-mono font-semibold mt-0.5">{totTasse.toFixed(2)} €</p>
            {Math.abs(totRettifica) > 0.001 && (
              <p className="text-[9px] font-mono text-orange-600 dark:text-orange-400 mt-0.5">
                di cui {totRettifica > 0 ? "+" : ""}{totRettifica.toFixed(2)} man.
              </p>
            )}
          </div>
          {hasSsnRows && (
            <div className="rounded-md border bg-card p-2">
              <Label className="text-[10px] uppercase text-muted-foreground">Totale SSN</Label>
              <p className="text-sm font-mono font-semibold mt-0.5">{totSsn.toFixed(2)} €</p>
            </div>
          )}
          <div className="rounded-md border bg-card p-2">
            <Label className="text-[10px] uppercase text-muted-foreground" title="Somma accessori righe (sincronizzata su titoli.addizionali)">
              Addizionali
            </Label>
            <p className="text-sm font-mono font-semibold mt-0.5 text-muted-foreground" title="Read-only: somma degli accessori per riga">
              {totAccessori.toFixed(2)} €
            </p>
          </div>
          <div
            className={cn(
              "rounded-md border p-2",
              isQuietanza
                ? "bg-amber-50/60 border-amber-300 dark:bg-amber-950/20"
                : "bg-teal-50/60 border-teal-300 dark:bg-teal-950/20",
            )}
          >
            <Label
              className={cn(
                "text-[10px] uppercase",
                isQuietanza ? "text-amber-800 dark:text-amber-200" : "text-teal-800 dark:text-teal-200",
              )}
            >
              Premio Lordo
            </Label>
            <p
              className={cn(
                "text-sm font-mono font-bold mt-0.5",
                isQuietanza ? "text-amber-900 dark:text-amber-100" : "text-teal-900 dark:text-teal-100",
              )}
            >
              {lordo.toFixed(2)} €
            </p>
          </div>
        </div>

        {coassicurazioneBreakdown}

        {/* Provvigioni footer */}
        {(() => {
          const pctComm = produttoreIsSede ? 100 : (parseFloat(percentualeCommerciale || "0") || 0);
          const pctCB = Math.max(0, 100 - pctComm);
          const totProv = provvigioni;
          const quotaProd = totProv * pctComm / 100;
          const quotaCB = totProv - quotaProd;
          const editable = !!onPercentualeAgenziaChange && !readOnly;

          const totDisplay = totFocus ? totDraft : totProv.toFixed(2);
          const pctDisplay = pctFocus
            ? pctDraft
            : (percentualeAgenzia ?? "");

          const commitTot = (raw: string) => {
            if (!editable) return;
            const s = (raw ?? "").trim().replace(",", ".");
            if (s === "") {
              onProvvigioniImportoChange?.(0);
              onPercentualeAgenziaChange?.("");
              return;
            }
            const n = parseFloat(s);
            if (isNaN(n)) return;
            if (onProvvigioniImportoChange) {
              onProvvigioniImportoChange(n);
              return;
            }
            const base = totNetto + totAccessori;
            if (base <= 0) return;
            const newPct = (n / base) * 100;
            onPercentualeAgenziaChange!(String(newPct));
          };
          const commitPct = (raw: string) => {
            if (!editable) return;
            const s = (raw ?? "").trim().replace(",", ".");
            if (s === "") { onPercentualeAgenziaChange!(""); return; }
            const n = parseFloat(s);
            if (isNaN(n)) return;
            onPercentualeAgenziaChange!(String(n));
          };

          const showSplit = !!produttoreLabel || !!produttoreIsSede;
          return (
            <div
              className={cn(
                "border-t px-3 py-3 space-y-3",
                isQuietanza ? "bg-amber-50/30 dark:bg-amber-950/10" : "bg-teal-50/30 dark:bg-teal-950/10",
              )}
            >
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-xs font-bold uppercase flex items-center gap-2",
                    isQuietanza ? "text-amber-800 dark:text-amber-200" : "text-teal-800 dark:text-teal-200",
                  )}
                >
                  Provvigioni {isQuietanza ? "Quietanza" : "Firma"}
                  {percentualeAgenziaAuto ? (
                    <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase">auto</span>
                  ) : onResetAuto ? (
                    <button
                      type="button"
                      onClick={onResetAuto}
                      className="inline-flex items-center rounded-sm bg-muted hover:bg-muted/70 text-muted-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase gap-1"
                      title="Riattiva calcolo automatico"
                    >
                      ↻ Auto
                    </button>
                  ) : null}
                </p>
              </div>
              {percentualeAgenziaAuto && fonteAuto && (
                <p className={cn("text-[10px] italic -mt-1", warningAuto ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                  {warningAuto ? `⚠ ${warningAuto} ` : ""}Fonte: {fonteAuto}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold">Totale Provvigione (€)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={totDisplay}
                    onFocus={() => {
                      setTotDraft(totProv ? String(totProv) : "");
                      setTotFocus(true);
                    }}
                    onChange={(e) => setTotDraft(e.target.value)}
                    onBlur={(e) => { setTotFocus(false); commitTot(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    disabled={!editable}
                    className="h-9 text-base font-mono font-bold"
                    placeholder="0,00"
                  />
                  {editable && totNetto + totAccessori <= 0 && (
                    <p className="text-[10px] text-muted-foreground italic">Inserire prima un Netto o Accessori</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Provvigioni Medie</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={pctDisplay}
                    onFocus={() => {
                      setPctDraft(percentualeAgenzia ?? "");
                      setPctFocus(true);
                    }}
                    onChange={(e) => setPctDraft(e.target.value)}
                    onBlur={(e) => { setPctFocus(false); commitPct(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    disabled={!editable}
                    className="h-9 text-xs font-mono"
                    placeholder="0,00"
                  />
                  {provvBreakdownVisible && provvPctBreakdown && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Netto {provvPctBreakdown.pctNetto.toFixed(2)}% | Accessori {provvPctBreakdown.pctAccessori.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>

              {showSplit && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Ripartizione Provvigione
                  </p>
                  {produttoreIsSede ? (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏢</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">Sede</p>
                          <p className="text-[10px] text-muted-foreground">100% — nessuna ripartizione</p>
                        </div>
                      </div>
                      <span className="text-sm font-mono font-bold text-foreground">€ {totProv.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5">
                      {/* Produttore */}
                      <div className="rounded-md border border-border bg-background px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-base shrink-0">👤</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{produttoreLabel}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {percentualeCommercialeAuto ? "Da Provvigioni Ramo" : "Manuale"}
                              {ramoLabel ? ` · ${ramoLabel}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="inline-flex items-center rounded-sm bg-foreground/10 text-foreground px-1.5 py-0.5 text-[10px] font-bold font-mono">
                            {pctComm}%
                          </span>
                          <span className="text-sm font-mono font-bold text-foreground tabular-nums w-20 text-right">
                            € {quotaProd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {/* Consulbrokers */}
                      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-base shrink-0">🏢</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-primary truncate">Sede</p>
                            <p className="text-[10px] text-muted-foreground">Differenziale agenzia</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pl-2">
                          <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold font-mono">
                            {pctCB}%
                          </span>
                          <span className="text-sm font-mono font-bold text-primary tabular-nums w-20 text-right">
                            € {quotaCB.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export default PremiGaranziaCardShell;
