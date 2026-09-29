import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { safeId } from "@/lib/safeId";
import {
  PremiGaranziaCardShell,
  emptyGaranziaRow,
  type GaranziaRow,
} from "./PremiGaranziaCardShell";
import {
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  resetQuietanzaRow,
  isQuietanzaSincronizzata,
  rowsAreEmpty,
} from "./premiSync";
import {
  isProvvigioniManualStored,
  provvigioniImportoFromManualPctNetto,
  provvigioniPctEffettivaBlocco,
  provvigioniPctFromImporto,
  resolveProvvigioniForSave as resolveProvvigioniForSavePure,
} from "@/lib/provvigioniManual";
import {
  calcProvvigioniGaranzia,
  resolveRowPctNetto,
  resolveRowPctAccessori,
  resolveRowPctNettoAgenzia,
  resolveRowPctAccessoriAgenzia,
  provvPctBreakdown,
  calcTasseRiga,
  calcTasseEffettiveRiga,
  isRigaEsclusaProvvigioni,
  type MatriceProvvAccessori,
  premioRigaDbImporto,
} from "@/lib/calcProvvigioniGaranzia";
import { logAttivita } from "@/lib/logAttivita";
import { copiaDatiPolizzaInQuietanza } from "@/lib/copiaDatiQuietanzaDb";
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
  buildGaranziaRowFromTitoliAggregati,
  fetchPremiGaranziaByTitolo,
  remapDbPremiTipo,
  titoliHaAggregatiPremi,
  type DbPremioLike,
} from "@/lib/premiGaranziaLoad";

/**
 * Sezione "Composizione Premio" (Firma + Quietanza) per TitoloDetail.
 *
 * Allinea la grafica e la logica alla pagina di immissione: stesso componente
 * `PremiGaranziaCardShell`, SSN per riga via flag `rami.ssn_attivo`,
 * provvigioni formattate a 2 decimali.
 *
 * Carica le righe esistenti da `premi_garanzia_polizza` e le mappa a
 * `GaranziaRow`, arricchendo con metadata del sottoramo (id, ssn, aliquota).
 * Su modifica esegue un upsert debounced e aggiorna i totali in `titoli`.
 */
export interface TitoloImportiPremiBlockProps {
  titoloId: string;
  gruppoRamoId: string | null;
  ramoDescrizione?: string | null;
  isLocked: boolean;
  /** Valori correnti su `titoli` per controllare gli input (controlled). */
  addizionaliFirma: number | null | undefined;
  addizionaliQuietanza: number | null | undefined;
  provvigioniFirma: number | null | undefined;
  provvigioniQuietanza: number | null | undefined;
  /** False su quietanza già incassata: nasconde card e sync verso quietanza successiva */
  showQuietanza?: boolean;
  /** Su quietanza rata 2+ nasconde la card Firma (conta solo il premio quietanza della rata) */
  hideFirma?: boolean;
  /** Appendice AM/PR/RG: un solo blocco premi, senza dualismo Firma/Quietanza */
  appendiceMode?: boolean;
  /** Titolo sorgente (madre / rata 1) per caricare premi se assenti sul titolo corrente */
  fallbackPremiTitoloId?: string | null;
  /** True solo in modalità Modifica Importi: abilita edit garanzie e salvataggio esplicito. */
  draftMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  /** Totali da righe garanzia (per allineare il riquadro Importi in alto). */
  onDisplayTotalsChange?: (totals: TitoloImportiPremiDisplayTotals) => void;
}

export type TitoloImportiPremiSaveStatus = "idle" | "saving";

export type TitoloImportiPremiBlockHandle = {
  /** Persiste firma + quietanza (chiamato dal pulsante Salva in alto). */
  saveDraft: () => Promise<void>;
  /** Annulla bozza locale e forza ricarico da DB. */
  revertDraft: () => Promise<void>;
  hasPendingChanges: () => boolean;
  /** Copia frontespizio → quietanza figlia (crea se manca, aggiorna se esiste). */
  copiaInQuietanza: () => Promise<void>;
};

/** Totali calcolati dalle righe garanzia (per riepilogo Importi e liste). */
export type PremiGaranziaDisplayTotals = {
  netto: number;
  accessori: number;
  tasse: number;
  ssn: number;
  lordo: number;
  provvigioni: number;
  hasRows: boolean;
};

export type TitoloImportiPremiDisplayTotals = {
  firma: PremiGaranziaDisplayTotals;
  quietanza: PremiGaranziaDisplayTotals;
};

type DbPremio = DbPremioLike & {
  id: string;
  titolo_id: string;
  ordine: number | null;
  tasse_rettifica?: number | null;
};

function dbPremioHasImporto(p: DbPremio, tipo: "firma" | "quietanza"): boolean {
  const stored = tipo === "firma" ? Number(p.firma ?? 0) : Number(p.rata ?? 0);
  return stored > 0 || Number(p.accessori ?? 0) > 0 || Number(p.ssn ?? 0) > 0;
}

function rowHasContent(r: GaranziaRow): boolean {
  return !!(r.sottoramoId || r.codice || r.descrizione.trim() || r.netto || (r.dirittiAgenzia && r.tasse));
}

function hasDraftRows(rows: GaranziaRow[]): boolean {
  return rows.some((r) => !rowHasContent(r));
}

/** Blocca re-idratazione DB solo se l'utente sta compilando una riga nuova accanto a righe già piene. */
function hasInProgressUserEdits(rows: GaranziaRow[]): boolean {
  if (rows.length === 0) return false;
  const filled = rows.filter(rowHasContent).length;
  return filled > 0 && filled < rows.length;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function rowsBase(rows: GaranziaRow[]): number {
  const netto = rows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const accessori = rows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  return netto + accessori;
}

export const TitoloImportiPremiBlock = forwardRef<TitoloImportiPremiBlockHandle, TitoloImportiPremiBlockProps>(
function TitoloImportiPremiBlock({
  titoloId,
  gruppoRamoId,
  ramoDescrizione,
  isLocked,
  addizionaliFirma,
  addizionaliQuietanza,
  provvigioniFirma,
  provvigioniQuietanza,
  showQuietanza = true,
  hideFirma = false,
  appendiceMode = false,
  fallbackPremiTitoloId = null,
  draftMode = false,
  onDirtyChange,
  onDisplayTotalsChange,
}, ref) {
  const qc = useQueryClient();
  const reconcileDoneRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiaBusy, setCopiaBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<TitoloImportiPremiSaveStatus>("idle");
  const savingRef = useRef(false);
  const tasseRettificaSupportedRef = useRef<boolean | null>(null);
  const draftBaselineRef = useRef("");

  // Catalogo sottorami del gruppo: serve a risolvere codice_garanzia → id/SSN/aliquota
  const { data: catalogo = [], isLoading: catalogoLoading } = useQuery({
    queryKey: ["sottorami-titolo-detail", gruppoRamoId || "none"],
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

  const { data: titoloMeta, isLoading: titoloMetaLoading } = useQuery({
    queryKey: ["titolo-meta-premi", titoloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select(
          "compagnia_rapporto_id, ramo_id, premio_netto, premio_netto_quietanza, tasse, tasse_quietanza, ssn_firma, ssn_quietanza, addizionali, addizionali_quietanza, provvigioni_firma, provvigioni_quietanza, premio_lordo, sostituisce_polizza, polizza_rateo, numero_titolo, stato",
        )
        .eq("id", titoloId)
        .maybeSingle();
      return data;
    },
  });

  const { data: provvMatrice = null } = useQuery({
    queryKey: ["provv-matrice-titolo", titoloMeta?.compagnia_rapporto_id, gruppoRamoId],
    enabled: !!titoloMeta?.compagnia_rapporto_id && !!gruppoRamoId,
    queryFn: async (): Promise<MatriceProvvAccessori | null> => {
      const { data } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("ramo_id, percentuale_provvigione, percentuale_provvigione_accessori")
        .eq("compagnia_rapporto_id", titoloMeta!.compagnia_rapporto_id!)
        .eq("gruppo_ramo_id", gruppoRamoId!)
        .eq("attiva", true);
      const rows = (data || []) as Array<{
        ramo_id: string | null;
        percentuale_provvigione: number;
        percentuale_provvigione_accessori: number | null;
      }>;
      if (!rows.length) return null;
      const pctByRamoId = new Map<string, number>();
      const pctAccessoriByRamoId = new Map<string, number>();
      let pctDefault: number | null = null;
      let pctAccessoriDefault: number | null = null;
      const counts = new Map<number, number>();
      for (const r of rows) {
        const p = Number(r.percentuale_provvigione);
        if (r.ramo_id) {
          pctByRamoId.set(r.ramo_id, p);
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriByRamoId.set(r.ramo_id, Number(r.percentuale_provvigione_accessori));
          }
        } else {
          pctDefault = p;
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriDefault = Number(r.percentuale_provvigione_accessori);
          }
        }
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      let bestP = 0, bestC = 0;
      for (const [p, c] of counts) if (c > bestC) { bestC = c; bestP = p; }
      return {
        pctByRamoId,
        pctAccessoriByRamoId,
        pctDefault,
        pctAccessoriDefault,
        pctPrevalente: bestP,
        isUniform: counts.size === 1,
      };
    },
  });

  const { data: premi = [], isLoading: premiLoading } = useQuery({
    queryKey: ["premi-garanzia-import", titoloId],
    queryFn: async () => {
      const { rows, hasTasseRettifica } = await fetchPremiGaranziaByTitolo(titoloId);
      tasseRettificaSupportedRef.current = hasTasseRettifica;
      return rows as DbPremio[];
    },
  });

  const hasQuietanzaPremi = (premi as DbPremio[]).some(
    (p) => p.tipo_premio === "quietanza" && dbPremioHasImporto(p, "quietanza"),
  );
  const needsFallbackPremi = !!fallbackPremiTitoloId && (premi.length === 0 || !hasQuietanzaPremi);
  const { data: fallbackPremi = [], isLoading: fallbackPremiLoading } = useQuery({
    queryKey: ["premi-garanzia-fallback", fallbackPremiTitoloId],
    enabled: needsFallbackPremi,
    queryFn: async () => {
      const { rows, hasTasseRettifica } = await fetchPremiGaranziaByTitolo(fallbackPremiTitoloId!);
      if (tasseRettificaSupportedRef.current === null) {
        tasseRettificaSupportedRef.current = hasTasseRettifica;
      }
      return rows as DbPremio[];
    },
  });

  const catByCodice = useMemo(() => {
    const m = new Map<string, any>();
    (catalogo as any[]).forEach((s: any) => m.set(s.codice, s));
    return m;
  }, [catalogo]);

  // Mappa DbPremio → GaranziaRow arricchita con metadata sottoramo
  const toGaranziaRow = (p: DbPremio): GaranziaRow => {
    const cat = p.codice_garanzia ? catByCodice.get(p.codice_garanzia) : undefined;
    const dirittiAgenzia = !!cat?.diritti_agenzia;
    const escludiProvvigioni = !!cat?.escludi_provvigioni;
    const aliquotaTasse = dirittiAgenzia || escludiProvvigioni
      ? 0
      : (Number(p.aliquota_tasse_pct ?? cat?.aliquota_tasse_ramo ?? 0) || 0);
    const ssnAttivo = !dirittiAgenzia && !escludiProvvigioni && !!cat?.ssn_attivo;
    const aliquotaSsn = ssnAttivo ? Number(cat?.aliquota_ssn ?? 10.5) || 10.5 : 0;
    const stored = p.tipo_premio === "firma" ? Number(p.firma ?? 0) : Number(p.rata ?? 0);
    const rettifica = Number((p as DbPremio).tasse_rettifica ?? 0);
    if (dirittiAgenzia) {
      return {
        _localId: safeId(),
        codice: p.codice_garanzia || null,
        descrizione: cat?.descrizione || p.garanzia || "",
        netto: "",
        accessori: "",
        tasse: stored ? stored.toFixed(2) : "",
        tasseRettifica: "",
        aliquotaTasse: 0,
        sottoramoId: cat?.id || null,
        ssn: "",
        aliquotaSsn: 0,
        ssnAttivo: false,
        ssnManualOverride: false,
        escludiProvvigioni: false,
        dirittiAgenzia: true,
        provvNettoPct: p.provvigione_netto_pct_override && p.provvigione_netto_pct != null ? Number(p.provvigione_netto_pct) : undefined,
        provvNettoPctOverride: !!p.provvigione_netto_pct_override,
        provvAccessoriPct: p.provvigione_accessori_pct_override && p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
        provvAccessoriPctOverride: !!p.provvigione_accessori_pct_override,
        quietanzaPersonalizzata: p.tipo_premio === "quietanza" ? !!p.quietanza_personalizzata : undefined,
      };
    }
    const netto = stored;
    const accessori = Number(p.accessori ?? 0);
    const ssn = p.ssn != null ? Number(p.ssn) : 0;
    const ssnAuto = ssnAttivo ? round2((netto * aliquotaSsn) / 100) : 0;
    const ssnManualOverride = ssnAttivo && Math.abs(ssn - ssnAuto) > 0.01;
    const tasseCalc = aliquotaTasse > 0 && (Math.abs(netto) > 0.0001 || Math.abs(accessori) > 0.0001)
      ? calcTasseRiga(netto, accessori, aliquotaTasse)
      : 0;
    return {
      _localId: safeId(),
      codice: p.codice_garanzia || null,
      descrizione: cat?.descrizione || p.garanzia || "",
      netto: Math.abs(netto) > 0.0001 ? netto.toFixed(2) : "",
      accessori: Math.abs(accessori) > 0.0001 ? accessori.toFixed(2) : "",
      tasse: escludiProvvigioni ? "0" : (Math.abs(tasseCalc) > 0.0001 ? tasseCalc.toFixed(2) : ""),
      tasseRettifica: rettifica !== 0 ? rettifica.toFixed(2) : "",
      tasseManualOverride: !escludiProvvigioni && rettifica !== 0,
      aliquotaTasse,
      sottoramoId: cat?.id || null,
      ssn: Math.abs(ssn) > 0.0001 ? ssn.toFixed(2) : "",
      aliquotaSsn,
      ssnAttivo,
      ssnManualOverride,
      escludiProvvigioni,
      dirittiAgenzia: false,
      provvNettoPct: p.provvigione_netto_pct_override && p.provvigione_netto_pct != null ? Number(p.provvigione_netto_pct) : undefined,
      provvNettoPctOverride: !!p.provvigione_netto_pct_override,
      provvAccessoriPct: p.provvigione_accessori_pct_override && p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
      provvAccessoriPctOverride: !!p.provvigione_accessori_pct_override,
      quietanzaPersonalizzata: p.tipo_premio === "quietanza" ? !!p.quietanza_personalizzata : undefined,
    };
  };

  const [firmaRows, setFirmaRows] = useState<GaranziaRow[]>([]);
  const [quietanzaRows, setQuietanzaRows] = useState<GaranziaRow[]>([]);
  const firmaRowsRef = useRef(firmaRows);
  const quietanzaRowsRef = useRef(quietanzaRows);
  firmaRowsRef.current = firmaRows;
  quietanzaRowsRef.current = quietanzaRows;
  /** false = provvigioni impostate manualmente (% o totale €), non ricalcolate dalla matrice */
  const [provvFirmaAuto, setProvvFirmaAuto] = useState(true);
  const [provvQuietanzaAuto, setProvvQuietanzaAuto] = useState(true);
  const provvFirmaAutoRef = useRef(true);
  const provvQuietanzaAutoRef = useRef(true);
  const manualPctFirmaRef = useRef("");
  const manualPctQuietanzaRef = useRef("");
  /** Importo € digitato a mano (priorità sul ricalcolo da %). */
  const manualImportoFirmaRef = useRef<number | null>(null);
  const manualImportoQuietanzaRef = useRef<number | null>(null);
  const manualFromEuroFirmaRef = useRef(false);
  const manualFromEuroQuietanzaRef = useRef(false);
  const manualUserEditFirmaRef = useRef(false);
  const manualUserEditQuietanzaRef = useRef(false);
  const [, bumpProvvDisplay] = useState(0);

  const setProvvAuto = (tipo: "firma" | "quietanza", auto: boolean) => {
    if (tipo === "firma") {
      provvFirmaAutoRef.current = auto;
      setProvvFirmaAuto(auto);
    } else {
      provvQuietanzaAutoRef.current = auto;
      setProvvQuietanzaAuto(auto);
    }
  };

  // Refresh state quando arrivano i dati DB o cambia il catalogo
  const lastSnapRef = useRef<string>("");
  useEffect(() => {
    lastSnapRef.current = "";
    setFirmaRows([]);
    setQuietanzaRows([]);
    manualUserEditFirmaRef.current = false;
    manualUserEditQuietanzaRef.current = false;
  }, [titoloId]);

  const enrichGaranziaRow = (r: GaranziaRow): GaranziaRow => {
    // Deriva solo il sottoramo se mancante; le % provvigioni si risolvono via
    // resolver (matrice agenzia o override di riga), non vanno "congelate" qui.
    if (r.sottoramoId || !titoloMeta?.ramo_id) return r;
    return { ...r, sottoramoId: titoloMeta.ramo_id as string };
  };

  useEffect(() => {
    if (draftMode) return;
    if (savingRef.current) return;
    if (hasInProgressUserEdits(firmaRowsRef.current) || hasInProgressUserEdits(quietanzaRowsRef.current)) return;

    if (titoloMetaLoading || premiLoading) return;
    if (!titoloMeta) return;
    if (needsFallbackPremi && fallbackPremiLoading) return;

    const mightSynthFromAggregati =
      titoliHaAggregatiPremi(titoloMeta, hideFirma ? "quietanza" : "firma") ||
      titoliHaAggregatiPremi(titoloMeta, "quietanza");
    if (
      gruppoRamoId &&
      catalogoLoading &&
      premi.length === 0 &&
      !fallbackPremi.length &&
      mightSynthFromAggregati
    ) {
      return;
    }

    let fRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "firma");
    let qRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza");
    if (qRaw.length && qRaw.every((p) => !dbPremioHasImporto(p, "quietanza"))) {
      qRaw = [];
    }

    // Fallback: premi da madre / rata 1 se assenti sul titolo corrente
    if (fallbackPremi.length) {
      if (!fRaw.length && !hideFirma) {
        fRaw = (fallbackPremi as DbPremio[]).filter((p) => p.tipo_premio === "firma");
      }
      if (!qRaw.length) {
        qRaw = (fallbackPremi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza");
        if (!qRaw.length && hideFirma) {
          qRaw = remapDbPremiTipo(fallbackPremi as DbPremio[], "quietanza", "quietanza") as DbPremio[];
          if (!qRaw.length) {
            qRaw = remapDbPremiTipo(fallbackPremi as DbPremio[], "firma", "quietanza") as DbPremio[];
          }
        } else if (!qRaw.length && fRaw.length) {
          qRaw = remapDbPremiTipo(fRaw, "firma", "quietanza") as DbPremio[];
        }
      }
    }

    const snap = JSON.stringify({
      f: fRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.firma, t: p.aliquota_tasse_pct, s: p.ssn })),
      q: qRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn, pz: p.quietanza_personalizzata })),
      cat: catalogo.length,
      fb: fallbackPremiTitoloId,
      hide: hideFirma,
    });
    if (snap === lastSnapRef.current) return;
    lastSnapRef.current = snap;

    let firmaMapped = fRaw.length ? fRaw.map(toGaranziaRow) : [emptyGaranziaRow()];
    let quietanzaMapped = qRaw.length
      ? qRaw.map(toGaranziaRow)
      : fRaw.length && !hideFirma
        ? mirrorAllFromFirma(firmaMapped)
        : [emptyGaranziaRow()];

    // Fix: quietanza "sincronizzata" ma con zeri mentre la Firma ha importi
    if (
      !hideFirma &&
      fRaw.length &&
      rowsAreEmpty(quietanzaMapped) &&
      !rowsAreEmpty(firmaMapped) &&
      isQuietanzaSincronizzata(quietanzaMapped)
    ) {
      quietanzaMapped = mirrorAllFromFirma(firmaMapped);
    }

    // Fallback da aggregati su titoli (quietanze auto-generate spesso non hanno righe in premi_garanzia_polizza)
    if (titoloMeta) {
      if (!fRaw.length && !hideFirma) {
        const synth = buildGaranziaRowFromTitoliAggregati("firma", titoloMeta, catalogo as any[]);
        if (synth) firmaMapped = [synth];
      }
      if (!qRaw.length) {
        const synthQ = buildGaranziaRowFromTitoliAggregati("quietanza", titoloMeta, catalogo as any[]);
        if (synthQ) quietanzaMapped = [synthQ];
      }
    }

    firmaMapped = firmaMapped.map(enrichGaranziaRow);
    quietanzaMapped = quietanzaMapped.map(enrichGaranziaRow);

    setFirmaRows(firmaMapped);
    setQuietanzaRows(quietanzaMapped);

    // Se il valore salvato su titoli diverge dal calcolo matrice → override manuale (importo esatto)
    const calcF = provvMatrice ? round2(calcProvvigioniGaranzia(firmaMapped, provvMatrice)) : 0;
    const calcQ = provvMatrice ? round2(calcProvvigioniGaranzia(quietanzaMapped, provvMatrice)) : 0;
    const storedF = Number(provvigioniFirma) || 0;
    const storedQ = Number(provvigioniQuietanza) || 0;

    if (manualUserEditFirmaRef.current || isProvvigioniManualStored(storedF, calcF)) {
      manualImportoFirmaRef.current = storedF;
      manualFromEuroFirmaRef.current = true;
      manualPctFirmaRef.current = "";
      setProvvAuto("firma", false);
    } else {
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualPctFirmaRef.current = "";
      manualUserEditFirmaRef.current = false;
      setProvvAuto("firma", true);
    }

    if (manualUserEditQuietanzaRef.current || isProvvigioniManualStored(storedQ, calcQ)) {
      manualImportoQuietanzaRef.current = storedQ;
      manualFromEuroQuietanzaRef.current = true;
      manualPctQuietanzaRef.current = "";
      setProvvAuto("quietanza", false);
    } else {
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualPctQuietanzaRef.current = "";
      manualUserEditQuietanzaRef.current = false;
      setProvvAuto("quietanza", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    premi,
    premiLoading,
    catalogo,
    catalogoLoading,
    provvMatrice,
    provvigioniFirma,
    provvigioniQuietanza,
    fallbackPremi,
    fallbackPremiLoading,
    fallbackPremiTitoloId,
    needsFallbackPremi,
    hideFirma,
    titoloMeta,
    titoloMetaLoading,
    gruppoRamoId,
    draftMode,
  ]);

  const serializeDraft = () =>
    JSON.stringify({
      f: firmaRowsRef.current,
      q: quietanzaRowsRef.current,
      pf: manualPctFirmaRef.current,
      pq: manualPctQuietanzaRef.current,
      mif: manualImportoFirmaRef.current,
      miq: manualImportoQuietanzaRef.current,
      eff: manualFromEuroFirmaRef.current,
      efq: manualFromEuroQuietanzaRef.current,
      af: provvFirmaAutoRef.current,
      aq: provvQuietanzaAutoRef.current,
    });

  useEffect(() => {
    if (!draftMode) {
      draftBaselineRef.current = "";
      return;
    }
    draftBaselineRef.current = serializeDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMode]);

  const isDirty =
    draftMode && !!draftBaselineRef.current && serializeDraft() !== draftBaselineRef.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const resolveProvvigioniImporto = (
    tipo: "firma" | "quietanza",
    rows: GaranziaRow[],
  ): number => {
    const auto = tipo === "firma" ? provvFirmaAutoRef.current : provvQuietanzaAutoRef.current;
    if (auto) return round2(calcProvvigioniGaranzia(rows, provvMatrice));
    const fromEuro = tipo === "firma" ? manualFromEuroFirmaRef.current : manualFromEuroQuietanzaRef.current;
    const importo = tipo === "firma" ? manualImportoFirmaRef.current : manualImportoQuietanzaRef.current;
    if (fromEuro && importo != null) return importo;
    const pct = tipo === "firma" ? manualPctFirmaRef.current : manualPctQuietanzaRef.current;
    return round2(provvigioniImportoFromManualPctNetto(rows, pct, provvMatrice));
  };

  const resetManualProvvToAuto = (tipo: "firma" | "quietanza") => {
    if (tipo === "firma") {
      manualPctFirmaRef.current = "";
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualUserEditFirmaRef.current = false;
      setProvvAuto("firma", true);
    } else {
      manualPctQuietanzaRef.current = "";
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualUserEditQuietanzaRef.current = false;
      setProvvAuto("quietanza", true);
    }
    bumpProvvDisplay((n) => n + 1);
  };

  /** Unica verità = totale blocco (mai somma righe/matrice). */
  const resolveProvvigioniForSave = (
    tipo: "firma" | "quietanza",
    rows: GaranziaRow[],
  ): number => resolveProvvigioniForSavePure(resolveProvvigioniImporto(tipo, rows));

  const totNettoProvvEligible = (rows: GaranziaRow[]) =>
    rows.reduce((s, r) => {
      if (isRigaEsclusaProvvigioni(r)) return s;
      return s + (parseFloat(r.netto || "0") || 0);
    }, 0);

  /** Dopo save su titoli: allinea quietanze (+ madre se quietanza-as-titolo, anche il premio). */
  const syncProvvigioniQuietanzeAfterSave = async (updates: Record<string, number>) => {
    const pf = updates.provvigioni_firma;
    const pq = updates.provvigioni_quietanza;
    const premioKeys = [
      "premio_lordo",
      "premio_netto",
      "addizionali",
      "tasse",
      "ssn_firma",
      "premio_netto_quietanza",
      "addizionali_quietanza",
      "tasse_quietanza",
      "ssn_quietanza",
    ] as const;
    const hasPremio = premioKeys.some((k) => updates[k] != null);
    if (pf == null && pq == null && !hasPremio) return;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (pf != null) patch.provvigioni_firma = pf;
    if (pq != null) patch.provvigioni_quietanza = pq;
    for (const k of premioKeys) {
      if (updates[k] != null) patch[k] = updates[k];
    }

    const { error: qErr } = await (supabase.from("quietanze") as any)
      .update(patch)
      .eq("titolo_id", titoloId);
    if (qErr) {
      console.warn("[syncProvvigioniQuietanze] quietanze corrente:", qErr.message);
    }

    const sost = titoloMeta?.sostituisce_polizza;
    if (!sost) return;

    const madreNumero = String(titoloMeta?.numero_titolo || sost).trim();
    const { data: madre, error: madreErr } = await supabase
      .from("titoli")
      .select("id")
      .eq("numero_titolo", madreNumero)
      .is("sostituisce_polizza", null)
      .maybeSingle();
    if (madreErr || !madre?.id) {
      if (madreErr) console.warn("[syncProvvigioniQuietanze] madre:", madreErr.message);
      return;
    }

    const { error: tErr } = await supabase.from("titoli").update(patch as any).eq("id", madre.id);
    if (tErr) console.warn("[syncProvvigioniQuietanze] update madre:", tErr.message);

    const { error: qmErr } = await (supabase.from("quietanze") as any)
      .update(patch)
      .eq("titolo_id", madre.id);
    if (qmErr) console.warn("[syncProvvigioniQuietanze] quietanze madre:", qmErr.message);

    await qc.invalidateQueries({ queryKey: ["titolo", madre.id] });
    await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", madre.id] });
    await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
    await qc.invalidateQueries({ queryKey: ["portafoglio-carico"] });
  };

  const copyProvvFirmaToQuietanza = () => {
    provvQuietanzaAutoRef.current = provvFirmaAutoRef.current;
    setProvvQuietanzaAuto(provvFirmaAutoRef.current);
    manualPctQuietanzaRef.current = manualPctFirmaRef.current;
    manualImportoQuietanzaRef.current = manualImportoFirmaRef.current;
    manualFromEuroQuietanzaRef.current = manualFromEuroFirmaRef.current;
    manualUserEditQuietanzaRef.current = manualUserEditFirmaRef.current;
    bumpProvvDisplay((n) => n + 1);
  };

  // Persist esplicito (solo da saveDraft)
  const persistRows = async (rows: GaranziaRow[], tipo: "firma" | "quietanza") => {
    const validRows = rows.filter(rowHasContent);
    if (validRows.length < rows.length) {
      throw new Error("Completa o rimuovi le righe garanzia vuote prima di salvare.");
    }

    savingRef.current = true;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const blockProvv = resolveProvvigioniForSave(tipo, rows);
      const auto =
        tipo === "firma" ? provvFirmaAutoRef.current : provvQuietanzaAutoRef.current;
      const nettoEligible = totNettoProvvEligible(rows);
      const blockPctNetto =
        !auto && nettoEligible > 0
          ? round2(provvigioniPctEffettivaBlocco(blockProvv, nettoEligible))
          : null;

      const payload = validRows.map((r, idx) => {
        const importo = premioRigaDbImporto(r);
        return {
          titolo_id: titoloId,
          tipo_premio: tipo,
          garanzia: (r.descrizione && r.descrizione.trim()) || r.codice || "Premio",
          codice_garanzia: r.codice || null,
          capitale: 0,
          tasso: 0,
          firma: tipo === "firma" ? importo : 0,
          rata: tipo === "quietanza" ? importo : 0,
          accessori: parseFloat(r.accessori || "0") || 0,
          annuo: 0,
          ordine: idx,
          aliquota_tasse_pct: r.aliquotaTasse || null,
          ssn: parseFloat(r.ssn || "0") || 0,
          tasse_rettifica: parseFloat(r.tasseRettifica || "0") || 0,
          // In manuale blocco: % riga = % effettiva blocco (non matrice)
          provvigione_netto_pct:
            blockPctNetto != null ? blockPctNetto : resolveRowPctNetto(r, provvMatrice).pct,
          provvigione_accessori_pct: resolveRowPctAccessori(r, provvMatrice).pct,
          provvigione_netto_pct_override: !!r.provvNettoPctOverride,
          provvigione_accessori_pct_override: !!r.provvAccessoriPctOverride,
          ...(tipo === "quietanza" ? { quietanza_personalizzata: !!r.quietanzaPersonalizzata } : {}),
        };
      });

      const sum = (rs: GaranziaRow[], k: "netto" | "ssn" | "accessori") =>
        rs.reduce((s, r) => s + (parseFloat(r[k] || "0") || 0), 0);
      const totNetto = round2(sum(rows, "netto"));
      const totAccessori = round2(sum(rows, "accessori"));
      const totTasse = round2(rows.reduce((s, r) => s + calcTasseEffettiveRiga(r), 0));
      const totSsn = round2(sum(rows, "ssn"));
      const lordo = round2(totNetto + totAccessori + totTasse + totSsn);
      const updates: Record<string, number> = {};

      if (tipo === "firma") {
        updates.premio_netto = totNetto;
        updates.addizionali = totAccessori;
        updates.tasse = totTasse;
        updates.ssn_firma = totSsn;
        updates.premio_lordo = lordo;
        updates.provvigioni_firma = blockProvv;
      } else {
        updates.premio_netto_quietanza = totNetto;
        updates.addizionali_quietanza = totAccessori;
        updates.tasse_quietanza = totTasse;
        updates.ssn_quietanza = totSsn;
        updates.provvigioni_quietanza = blockProvv;
        updates.premio_lordo = lordo;
        // Su quietanza/rata: allinea anche i campi operativi usati da incasso e liste
        if (hideFirma || !!titoloMeta?.sostituisce_polizza) {
          updates.premio_netto = totNetto;
          updates.addizionali = totAccessori;
          updates.tasse = totTasse;
          updates.ssn_firma = totSsn;
          updates.provvigioni_firma = updates.provvigioni_quietanza;
        }
      }

      const rpcRows = payload.map(({ titolo_id: _tid, tipo_premio: _tp, ...rest }) => {
        if (tasseRettificaSupportedRef.current === false) {
          const { tasse_rettifica: _t, ...noRettifica } = rest;
          return noRettifica;
        }
        return rest;
      });

      const { error: rpcErr } = await (supabase.rpc as any)("salva_premi_garanzia_titolo", {
        p_titolo_id: titoloId,
        p_tipo_premio: tipo,
        p_rows: rpcRows,
        p_titolo_updates: updates,
      });
      if (rpcErr) {
        toast.error("Errore salvataggio premi: " + rpcErr.message);
        throw rpcErr;
      }

      await syncProvvigioniQuietanzeAfterSave(updates);

      lastSnapRef.current = JSON.stringify({
        f: tipo === "firma"
          ? validRows.map((r) => ({ c: r.codice, n: parseFloat(r.netto || "0") || 0, t: r.aliquotaTasse, s: parseFloat(r.ssn || "0") || 0 }))
          : (premi as DbPremio[]).filter((p) => p.tipo_premio === "firma").map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.firma, t: p.aliquota_tasse_pct, s: p.ssn })),
        q: tipo === "quietanza"
          ? validRows.map((r) => ({ c: r.codice, n: parseFloat(r.netto || "0") || 0, t: r.aliquotaTasse, s: parseFloat(r.ssn || "0") || 0, pz: !!r.quietanzaPersonalizzata }))
          : (premi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza").map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn, pz: p.quietanza_personalizzata })),
        cat: catalogo.length,
        fb: fallbackPremiTitoloId,
        hide: hideFirma,
      });
      await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
      await qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
      await qc.invalidateQueries({ queryKey: ["premi-garanzia", titoloId] });
      await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
      await qc.invalidateQueries({ queryKey: ["riparto", titoloId] });
      await qc.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      if (tipo === "firma" && !provvFirmaAutoRef.current) {
        manualUserEditFirmaRef.current = true;
      }
      if (tipo === "quietanza" && !provvQuietanzaAutoRef.current) {
        manualUserEditQuietanzaRef.current = true;
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSaveStatus("idle");
    }
  };

  const saveDraft = async () => {
    if (isLocked || !draftMode) return;
    const firma = firmaRowsRef.current;
    let quietanza = quietanzaRowsRef.current;
    if (!hideFirma && showQuietanza && isQuietanzaSincronizzata(quietanza)) {
      quietanza = syncQuietanzaFromFirma(firma, quietanza);
      setQuietanzaRows(quietanza);
    }
    if (!hideFirma) await persistRows(firma, "firma");
    if (showQuietanza) await persistRows(quietanza, "quietanza");
    draftBaselineRef.current = serializeDraft();
  };

  const revertDraft = async () => {
    lastSnapRef.current = "";
    draftBaselineRef.current = "";
    manualPctFirmaRef.current = "";
    manualPctQuietanzaRef.current = "";
    manualImportoFirmaRef.current = null;
    manualImportoQuietanzaRef.current = null;
    manualFromEuroFirmaRef.current = false;
    manualFromEuroQuietanzaRef.current = false;
    manualUserEditFirmaRef.current = false;
    manualUserEditQuietanzaRef.current = false;
    setProvvAuto("firma", true);
    setProvvAuto("quietanza", true);
    bumpProvvDisplay((n) => n + 1);
    await qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
    await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
  };

  const hasPendingChanges = () => isDirty;

  const onFirmaChange = (next: GaranziaRow[]) => {
    if (!draftMode || isLocked) return;
    setFirmaRows(next);

    if (hideFirma || !showQuietanza) return;

    const syncedQuietanza = syncQuietanzaFromFirma(next, quietanzaRows);
    setQuietanzaRows(syncedQuietanza);
    if (isQuietanzaSincronizzata(syncedQuietanza)) {
      copyProvvFirmaToQuietanza();
    }
  };

  const onQuietanzaChange = (next: GaranziaRow[]) => {
    if (!draftMode || isLocked) return;
    const marked = markQuietanzaEdits(quietanzaRows, next);
    setQuietanzaRows(marked);
  };

  const resyncAllFromFirma = () => {
    if (isLocked || !draftMode) return;
    const mirrored = mirrorAllFromFirma(firmaRows);
    setQuietanzaRows(mirrored);
    copyProvvFirmaToQuietanza();
  };

  const resyncRowFromFirma = (idx: number) => {
    if (isLocked || !draftMode) return;
    const updated = resetQuietanzaRow(firmaRows, quietanzaRows, idx);
    setQuietanzaRows(updated);
  };

  const isMadreTitolo = !titoloMeta?.sostituisce_polizza && !appendiceMode;
  const madreStornata = String(titoloMeta?.stato || "").toLowerCase() === "stornato";

  const handleCopiaInQuietanza = async () => {
    if (draftMode && !isLocked) {
      resyncAllFromFirma();
    }
    if (!isMadreTitolo) {
      if (draftMode && !isLocked) toast.success("Quietanza riallineata alla Firma");
      return;
    }
    setCopiaBusy(true);
    try {
      if (draftMode && !isLocked) {
        await saveDraft();
      }
      const res = await copiaDatiPolizzaInQuietanza(titoloId);
      toast.success(
        res.action === "create"
          ? "Quietanza creata dai dati della polizza"
          : "Quietanza aggiornata dai dati della polizza",
      );
      await qc.invalidateQueries({ queryKey: ["catena-titoli"] });
      await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
      await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
      await qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
    } catch (e: any) {
      toast.error(e?.message || "Copia in quietanza non riuscita");
      throw e;
    } finally {
      setCopiaBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({ saveDraft, revertDraft, hasPendingChanges, copiaInQuietanza: handleCopiaInQuietanza }), [
    isLocked,
    draftMode,
    hideFirma,
    showQuietanza,
    isDirty,
    titoloId,
    isMadreTitolo,
  ]);

  const accessoriFirmaNum = firmaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const accessoriQuietanzaNum = quietanzaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const rowPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessori(row, provvMatrice).pct;
  const rowAgencyPctNettoFn = (row: GaranziaRow) => resolveRowPctNettoAgenzia(row, provvMatrice).pct;
  const rowAgencyPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
  const provvBreakdownFirma = provvPctBreakdown(firmaRows, provvMatrice);
  const provvBreakdownQuietanza = provvPctBreakdown(quietanzaRows, provvMatrice);

  // --- Override % provvigioni per voce (con conferma + log attività) -------
  type PctOverridePending = {
    tipo: "firma" | "quietanza";
    idx: number;
    campo: "netto" | "accessori";
    voce: string;
    from: number;
    to: number;
    agency: number;
  };
  const [pctOverride, setPctOverride] = useState<PctOverridePending | null>(null);

  const patchRowProvv = (
    row: GaranziaRow,
    campo: "netto" | "accessori",
    pct: number | null,
    override: boolean,
  ): GaranziaRow =>
    campo === "netto"
      ? { ...row, provvNettoPct: override ? pct : undefined, provvNettoPctOverride: override }
      : { ...row, provvAccessoriPct: override ? pct : undefined, provvAccessoriPctOverride: override };

  const applyProvvPct = async (
    tipo: "firma" | "quietanza",
    idx: number,
    campo: "netto" | "accessori",
    pct: number | null,
    override: boolean,
    agency: number,
    prevEff: number,
    voce: string,
  ) => {
    const baseRows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const nextRows = baseRows.map((r, i) => {
      if (i !== idx) return r;
      const nr = patchRowProvv(r, campo, pct, override);
      // Su quietanza: l'override scollega la voce dalla sincronizzazione automatica.
      return tipo === "quietanza" ? { ...nr, quietanzaPersonalizzata: true } : nr;
    });
    if (tipo === "firma") {
      setFirmaRows(nextRows);
      if (!hideFirma && showQuietanza) {
        setQuietanzaRows(syncQuietanzaFromFirma(nextRows, quietanzaRowsRef.current));
      }
    } else {
      setQuietanzaRows(nextRows);
    }
    if (override) {
      resetManualProvvToAuto(tipo);
      if (tipo === "firma" && !hideFirma && showQuietanza) {
        const syncedQ = syncQuietanzaFromFirma(nextRows, quietanzaRowsRef.current);
        if (isQuietanzaSincronizzata(syncedQ)) {
          resetManualProvvToAuto("quietanza");
        }
      }
    }
    await logAttivita({
      azione: override ? "override_provvigione_voce" : "reset_provvigione_voce",
      entita_tipo: "titolo",
      entita_id: titoloId,
      dettagli_json: {
        tipo_premio: tipo,
        voce,
        campo,
        pct_agenzia: round2(agency),
        pct_precedente: round2(prevEff),
        pct_nuova: override && pct != null ? round2(pct) : round2(agency),
      },
      severity: "warning",
    });
  };

  const requestProvvPctOverride = (
    tipo: "firma" | "quietanza",
    idx: number,
    campo: "netto" | "accessori",
    nextPct: number | null,
  ) => {
    if (garanzieReadOnly) return;
    const rows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const row = rows[idx];
    if (!row) return;
    const voce = row.descrizione?.trim() || row.codice || "Voce";
    const agency =
      campo === "netto"
        ? resolveRowPctNettoAgenzia(row, provvMatrice).pct
        : resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
    const current =
      campo === "netto"
        ? resolveRowPctNetto(row, provvMatrice).pct
        : resolveRowPctAccessori(row, provvMatrice).pct;
    const wasOverride = campo === "netto" ? !!row.provvNettoPctOverride : !!row.provvAccessoriPctOverride;

    // Torna al valore agenzia → reset dell'override (log, nessuna conferma).
    if (nextPct == null || Math.abs(nextPct - agency) < 0.0001) {
      if (!wasOverride) return;
      void applyProvvPct(tipo, idx, campo, null, false, agency, current, voce);
      return;
    }
    if (Math.abs(nextPct - current) < 0.0001) return;
    setPctOverride({ tipo, idx, campo, voce, from: current, to: nextPct, agency });
  };

  const resetProvvPct = (tipo: "firma" | "quietanza", idx: number, campo: "netto" | "accessori") => {
    if (garanzieReadOnly) return;
    const rows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const row = rows[idx];
    if (!row) return;
    const voce = row.descrizione?.trim() || row.codice || "Voce";
    const agency =
      campo === "netto"
        ? resolveRowPctNettoAgenzia(row, provvMatrice).pct
        : resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
    const current =
      campo === "netto"
        ? resolveRowPctNetto(row, provvMatrice).pct
        : resolveRowPctAccessori(row, provvMatrice).pct;
    void applyProvvPct(tipo, idx, campo, null, false, agency, current, voce);
  };

  const confirmPctOverride = () => {
    if (!pctOverride) return;
    const { tipo, idx, campo, from, to, agency, voce } = pctOverride;
    void applyProvvPct(tipo, idx, campo, to, true, agency, from, voce);
    setPctOverride(null);
  };

  const totNettoFirma = firmaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totNettoQui = quietanzaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totAccessoriFirmaRows = firmaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const totAccessoriQuiRows = quietanzaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const totTasseFirmaRows = firmaRows.reduce((s, r) => s + calcTasseEffettiveRiga(r), 0);
  const totTasseQuiRows = quietanzaRows.reduce((s, r) => s + calcTasseEffettiveRiga(r), 0);
  const totSsnFirmaRows = firmaRows.reduce((s, r) => s + (parseFloat(r.ssn || "0") || 0), 0);
  const totSsnQuiRows = quietanzaRows.reduce((s, r) => s + (parseFloat(r.ssn || "0") || 0), 0);
  const totBaseFirma = totNettoFirma + accessoriFirmaNum;
  const totBaseQui = totNettoQui + accessoriQuietanzaNum;
  const displayProvvFirma = resolveProvvigioniImporto("firma", firmaRows);
  const displayProvvQuietanza = resolveProvvigioniImporto("quietanza", quietanzaRows);

  const displayTotals: TitoloImportiPremiDisplayTotals = useMemo(() => {
    const build = (
      rows: GaranziaRow[],
      netto: number,
      accessori: number,
      tasse: number,
      ssn: number,
      provvigioni: number,
    ): PremiGaranziaDisplayTotals => {
      const hasRows = rows.some(rowHasContent);
      const lordo = round2(netto + accessori + tasse + ssn);
      return {
        netto: round2(netto),
        accessori: round2(accessori),
        tasse: round2(tasse),
        ssn: round2(ssn),
        lordo,
        provvigioni: round2(provvigioni),
        hasRows,
      };
    };
    return {
      firma: build(
        firmaRows,
        totNettoFirma,
        totAccessoriFirmaRows,
        totTasseFirmaRows,
        totSsnFirmaRows,
        displayProvvFirma,
      ),
      quietanza: build(
        quietanzaRows,
        totNettoQui,
        totAccessoriQuiRows,
        totTasseQuiRows,
        totSsnQuiRows,
        displayProvvQuietanza,
      ),
    };
  }, [
    firmaRows,
    quietanzaRows,
    totNettoFirma,
    totNettoQui,
    totAccessoriFirmaRows,
    totAccessoriQuiRows,
    totTasseFirmaRows,
    totTasseQuiRows,
    totSsnFirmaRows,
    totSsnQuiRows,
    displayProvvFirma,
    displayProvvQuietanza,
  ]);

  useEffect(() => {
    onDisplayTotalsChange?.(displayTotals);
  }, [displayTotals, onDisplayTotalsChange]);

  /** Allinea campi aggregati su `titoli` quando le garanzie hanno importi ma il titolo no (es. import). */
  useEffect(() => {
    if (draftMode || isLocked || premiLoading || titoloMetaLoading || catalogoLoading) return;
    if (!titoloMeta) return;
    const key = `${titoloId}:${displayTotals.firma.provvigioni}:${displayTotals.quietanza.provvigioni}:${displayTotals.firma.lordo}:${displayTotals.quietanza.lordo}`;
    if (reconcileDoneRef.current === key) return;

    const drift = (stored: number, computed: number) => Math.abs(round2(stored) - round2(computed)) > 0.009;
    const patch: Record<string, number> = {};
    const isQuietanzaTitolo = !!titoloMeta.sostituisce_polizza;

    const applyBlock = (
      block: PremiGaranziaDisplayTotals,
      fields: {
        netto: string;
        accessori: string;
        tasse: string;
        ssn: string;
        provvigioni: string;
        lordo?: string;
      },
    ) => {
      if (!block.hasRows || (block.netto <= 0 && block.provvigioni <= 0 && block.tasse <= 0)) return;
      const curNetto = Number((titoloMeta as any)[fields.netto]) || 0;
      const curTasse = Number((titoloMeta as any)[fields.tasse]) || 0;
      const curProvv = Number((titoloMeta as any)[fields.provvigioni]) || 0;
      const curLordo = fields.lordo != null ? Number((titoloMeta as any)[fields.lordo]) || 0 : null;
      // Solo se manca provvigione/tasse (tipico import) oppure lordo = netto senza tasse
      const needsProvv = block.provvigioni > 0 && (curProvv === 0 || drift(curProvv, block.provvigioni));
      const needsTasse = block.tasse > 0 && curTasse === 0;
      const needsLordo =
        fields.lordo != null &&
        block.lordo > 0 &&
        (curLordo === 0 || (curTasse === 0 && block.tasse > 0 && Math.abs(curLordo - block.netto) < 0.02));
      if (!needsProvv && !needsTasse && !needsLordo) return;
      if (needsProvv) patch[fields.provvigioni] = block.provvigioni;
      if (needsTasse || needsLordo) {
        patch[fields.netto] = block.netto;
        patch[fields.accessori] = block.accessori;
        patch[fields.tasse] = block.tasse;
        patch[fields.ssn] = block.ssn;
        if (fields.lordo) patch[fields.lordo] = block.lordo;
      } else if (needsProvv && curNetto === 0 && block.netto > 0) {
        patch[fields.netto] = block.netto;
      }
    };

    if (!hideFirma) {
      applyBlock(displayTotals.firma, {
        netto: "premio_netto",
        accessori: "addizionali",
        tasse: "tasse",
        ssn: "ssn_firma",
        provvigioni: "provvigioni_firma",
        lordo: "premio_lordo",
      });
    }
    if (showQuietanza) {
      applyBlock(displayTotals.quietanza, {
        netto: "premio_netto_quietanza",
        accessori: "addizionali_quietanza",
        tasse: "tasse_quietanza",
        ssn: "ssn_quietanza",
        provvigioni: "provvigioni_quietanza",
        lordo: hideFirma || isQuietanzaTitolo ? "premio_lordo" : undefined,
      });
    }
    // Quietanza con sole righe Firma (import): copia provvigioni operative
    if (
      isQuietanzaTitolo &&
      displayTotals.firma.hasRows &&
      displayTotals.firma.provvigioni > 0 &&
      (Number(titoloMeta.provvigioni_quietanza) || 0) === 0
    ) {
      patch.provvigioni_quietanza = displayTotals.firma.provvigioni;
      if ((Number(titoloMeta.provvigioni_firma) || 0) === 0) {
        patch.provvigioni_firma = displayTotals.firma.provvigioni;
      }
    }

    if (Object.keys(patch).length === 0) {
      reconcileDoneRef.current = key;
      return;
    }

    reconcileDoneRef.current = key;
    void (async () => {
      const { error } = await supabase
        .from("titoli")
        .update({ ...patch, updated_at: new Date().toISOString() } as any)
        .eq("id", titoloId);
      if (error) {
        console.warn("[reconcilePremiTitolo]", error.message);
        reconcileDoneRef.current = null;
        return;
      }
      await syncProvvigioniQuietanzeAfterSave(patch);
      await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
      await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
      await qc.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      await qc.invalidateQueries({ queryKey: ["compensazioni-by-titoli"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftMode,
    isLocked,
    premiLoading,
    titoloMetaLoading,
    catalogoLoading,
    titoloId,
    hideFirma,
    showQuietanza,
    displayTotals,
    titoloMeta,
  ]);
  const nettoEligibleFirma = totNettoProvvEligible(firmaRows);
  const nettoEligibleQui = totNettoProvvEligible(quietanzaRows);
  const blockPctFirma = !provvFirmaAuto
    ? provvigioniPctEffettivaBlocco(displayProvvFirma, nettoEligibleFirma)
    : null;
  const blockPctQui = !provvQuietanzaAuto
    ? provvigioniPctEffettivaBlocco(displayProvvQuietanza, nettoEligibleQui)
    : null;
  /** In manuale: % riga segue il blocco; in auto: matrice/override riga. */
  const rowPctNettoFirmaFn = (row: GaranziaRow) =>
    blockPctFirma != null ? blockPctFirma : resolveRowPctNetto(row, provvMatrice).pct;
  const rowPctNettoQuietanzaFn = (row: GaranziaRow) =>
    blockPctQui != null ? blockPctQui : resolveRowPctNetto(row, provvMatrice).pct;
  const pctFirma = !provvFirmaAuto
    ? (manualFromEuroFirmaRef.current && manualImportoFirmaRef.current != null
      ? provvigioniPctFromImporto(manualImportoFirmaRef.current, totBaseFirma)
      : manualPctFirmaRef.current)
    : provvBreakdownFirma
      ? String(provvBreakdownFirma.pctNetto)
      : "";
  const pctQui = !provvQuietanzaAuto
    ? (manualFromEuroQuietanzaRef.current && manualImportoQuietanzaRef.current != null
      ? provvigioniPctFromImporto(manualImportoQuietanzaRef.current, totBaseQui)
      : manualPctQuietanzaRef.current)
    : provvBreakdownQuietanza
      ? String(provvBreakdownQuietanza.pctNetto)
      : "";

  const setProvvigioniManualPct = (tipo: "firma" | "quietanza", v: string) => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualPctFirmaRef.current = v;
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualUserEditFirmaRef.current = true;
    } else {
      manualPctQuietanzaRef.current = v;
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualUserEditQuietanzaRef.current = true;
    }
    setProvvAuto(tipo, false);
    bumpProvvDisplay((n) => n + 1);
  };

  const setProvvigioniManualImporto = (tipo: "firma" | "quietanza", importo: number) => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualImportoFirmaRef.current = importo;
      manualFromEuroFirmaRef.current = true;
      manualPctFirmaRef.current = "";
      manualUserEditFirmaRef.current = true;
    } else {
      manualImportoQuietanzaRef.current = importo;
      manualFromEuroQuietanzaRef.current = true;
      manualPctQuietanzaRef.current = "";
      manualUserEditQuietanzaRef.current = true;
    }
    setProvvAuto(tipo, false);
    bumpProvvDisplay((n) => n + 1);
  };

  const resetProvvigioniAuto = (tipo: "firma" | "quietanza") => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualPctFirmaRef.current = "";
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualUserEditFirmaRef.current = false;
    } else {
      manualPctQuietanzaRef.current = "";
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualUserEditQuietanzaRef.current = false;
    }
    setProvvAuto(tipo, true);
    bumpProvvDisplay((n) => n + 1);
  };

  const onPercentualeAgenziaFirma = (v: string) => { setProvvigioniManualPct("firma", v); };
  const onPercentualeAgenziaQuietanza = (v: string) => { setProvvigioniManualPct("quietanza", v); };
  const onImportoProvvigioniFirma = (importo: number) => { setProvvigioniManualImporto("firma", importo); };
  const onImportoProvvigioniQuietanza = (importo: number) => { setProvvigioniManualImporto("quietanza", importo); };

  // Specchio perfetto: nessuna riga Quietanza personalizzata.
  const sincronizzata = isQuietanzaSincronizzata(quietanzaRows);
  const personalizzati = quietanzaRows.map((r) => !!r.quietanzaPersonalizzata);

  const saveStatusLabel = (() => {
    if (!draftMode || isLocked) return null;
    if (saveStatus === "saving") return "Salvataggio…";
    if (isDirty) return "Modifiche non salvate";
    return null;
  })();

  const garanzieReadOnly = isLocked || !draftMode;
  const copiaDisabled = copiaBusy || madreStornata || (!isMadreTitolo && garanzieReadOnly);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground flex-1 min-w-[240px]">
          ℹ️ Le voci di garanzia disponibili sono filtrate sul <strong>Gruppo Ramo</strong> della polizza
          ({ramoDescrizione || "—"}).
          {hideFirma ? (
            <> Modifica il <strong>premio quietanza</strong> di questa rata. I dati vengono caricati dal titolo o dalla polizza madre se non ancora salvati per garanzia.</>
          ) : appendiceMode ? (
            <> L&apos;appendice ha un <strong>unico premio</strong> (non genera quietanze). Compila le voci di garanzia qui sotto.</>
          ) : showQuietanza ? (
            <> La <strong>Quietanza</strong> si sincronizza <strong>automaticamente</strong> con
            la <strong>Firma</strong>: ogni voce modificata a mano nella Quietanza diventa
            <strong> personalizzata</strong> e smette di aggiornarsi (puoi riallinearla con “↻ Sincronizza da Firma”).</>
          ) : (
            <> Questa quietanza è già incassata: viene mostrato solo il premio alla <strong>Firma</strong> della rata.</>
          )}
          {!isLocked && draftMode && (
            <> Premi e provvigioni si salvano con <strong>Salva</strong> in alto (valuta e brokeraggio inclusi).</>
          )}
          {!isLocked && !draftMode && (
            <> Premi e garanzie in sola lettura: premi <strong>Modifica</strong> in alto per modificare.</>
          )}
        </p>
        {saveStatusLabel && (
          <span
            className={`text-xs shrink-0 px-2 py-1 rounded-md border ${
              isDirty
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                : saveStatus === "saving"
                  ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                  : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {saveStatusLabel}
          </span>
        )}
      </div>

      {!hideFirma && (
      <PremiGaranziaCardShell
        tipoPremio="firma"
        gruppoRamoId={gruppoRamoId}
        rows={firmaRows}
        onRowsChange={onFirmaChange}
        readOnly={garanzieReadOnly}
        addizionali={String(round2(accessoriFirmaNum))}
        provvigioni={displayProvvFirma}
        provvPctBreakdown={provvBreakdownFirma}
        rowPctAccessori={rowPctAccessoriFn}
        rowPctNetto={rowPctNettoFirmaFn}
        rowAgencyPctNetto={rowAgencyPctNettoFn}
        rowAgencyPctAccessori={rowAgencyPctAccessoriFn}
        onProvvPctOverride={(idx, campo, next) => requestProvvPctOverride("firma", idx, campo, next)}
        onProvvPctReset={(idx, campo) => resetProvvPct("firma", idx, campo)}
        percentualeAgenzia={pctFirma}
        onPercentualeAgenziaChange={onPercentualeAgenziaFirma}
        onProvvigioniImportoChange={onImportoProvvigioniFirma}
        percentualeAgenziaAuto={provvFirmaAuto}
        onResetAuto={() => { resetProvvigioniAuto("firma"); }}
        headerExtra={
          showQuietanza || isMadreTitolo ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 text-xs"
            disabled={copiaDisabled}
            onClick={() => { void handleCopiaInQuietanza(); }}
            title={
              isMadreTitolo
                ? "Copia i dati della polizza nella quietanza figlia (crea se manca, aggiorna se esiste e non è a cassa)"
                : "Riallinea l'intera Quietanza alla Firma, azzerando le personalizzazioni"
            }
          >
            {copiaBusy ? "Copia…" : "Copia in Quietanza"}
          </Button>
          ) : undefined
        }
      />
      )}

      {showQuietanza && (
      <PremiGaranziaCardShell
        tipoPremio="quietanza"
        gruppoRamoId={gruppoRamoId}
        rows={quietanzaRows}
        onRowsChange={onQuietanzaChange}
        readOnly={garanzieReadOnly}
        titoloOverride={
          appendiceMode
            ? "Premi per Garanzia — Appendice"
            : hideFirma
              ? "Premi per Garanzia — Rata"
              : undefined
        }
        addizionali={String(round2(accessoriQuietanzaNum))}
        provvigioni={displayProvvQuietanza}
        provvPctBreakdown={provvBreakdownQuietanza}
        rowPctAccessori={rowPctAccessoriFn}
        rowPctNetto={rowPctNettoQuietanzaFn}
        rowAgencyPctNetto={rowAgencyPctNettoFn}
        rowAgencyPctAccessori={rowAgencyPctAccessoriFn}
        onProvvPctOverride={(idx, campo, next) => requestProvvPctOverride("quietanza", idx, campo, next)}
        onProvvPctReset={(idx, campo) => resetProvvPct("quietanza", idx, campo)}
        percentualeAgenzia={pctQui}
        onPercentualeAgenziaChange={onPercentualeAgenziaQuietanza}
        onProvvigioniImportoChange={onImportoProvvigioniQuietanza}
        percentualeAgenziaAuto={provvQuietanzaAuto}
        onResetAuto={() => { resetProvvigioniAuto("quietanza"); }}
        sincronizzata={sincronizzata}
        personalizzati={personalizzati}
        onResetRow={hideFirma ? undefined : resyncRowFromFirma}
        headerExtra={
          hideFirma ? undefined : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={garanzieReadOnly || sincronizzata}
            onClick={resyncAllFromFirma}
            title="Riallinea tutte le voci alla Firma, azzerando le personalizzazioni"
          >
            Sincronizza da Firma
          </Button>
          )
        }
      />
      )}

      <AlertDialog open={!!pctOverride} onOpenChange={(o) => { if (!o) setPctOverride(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sovrascrivere la % provvigione?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Voce <strong>{pctOverride?.voce}</strong> ·{" "}
                  {pctOverride?.campo === "netto" ? "provvigione sul netto" : "provvigione sugli accessori"} ·{" "}
                  {pctOverride?.tipo === "firma" ? "Firma" : "Quietanza"}
                </p>
                <p className="font-mono">
                  {pctOverride?.from.toFixed(2)}% → <strong className="text-orange-600">{pctOverride?.to.toFixed(2)}%</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  La % dell'agenzia è {pctOverride?.agency.toFixed(2)}%. La voce verrà scollegata dalla
                  matrice agenzia e la modifica sarà registrata nel log attività.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPctOverride}>Conferma override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

TitoloImportiPremiBlock.displayName = "TitoloImportiPremiBlock";

export default TitoloImportiPremiBlock;
