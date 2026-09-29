import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Plus, Download, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { formatDateIT } from "@/lib/formatDate";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { OrdinanteCombobox } from "@/components/contabilita/OrdinanteCombobox";
import { StoricoCarichiMovimenti } from "@/components/contabilita/StoricoCarichiMovimenti";
import {
  DaRicongiungereTab,
  StoricoTab,
} from "@/pages/contabilita/RicongiungimentoBancarioPage";
import {
  resolveUfficioFromConto,
  resolveOrdinanteImport,
  readEstrattoBancarioRows,
  resolveImportoEstratto,
  parseDataBancaria,
  buildPreviewEstratto,
  buildMovimentoDedupKey,
  buildMovimentoContentDedupKey,
  buildMovimentoConstraintDedupKey,
  isMovimentoDedupHit,
  fetchExistingMovimentoDedupKeys,
  insertMovimentiBancariSkippingDedup,
  detectColonneEstratto,
  labelMotivoScarto,
  countByMotivo,
  fetchContoIdsForUfficio,
  type PreviewEstratto,
} from "@/lib/movimentiBancari";
import { Checkbox } from "@/components/ui/checkbox";
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
  eliminaMovimentiBancari,
  isMovimentoCancellabile,
} from "@/lib/eliminaMovimentiBancari";
import {
  matchClienteDaOrdinante,
  matchClientiDaOrdinantiBatch,
  normalizeNomeMatch,
  type ClienteOrdinanteMatch,
} from "@/lib/matchClienteOrdinante";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";

const STATO_LABEL: Record<string, { label: string; variant: "secondary" | "default" | "outline" | "destructive" }> = {
  importato: { label: "Importato", variant: "secondary" },
  matchato: { label: "Matchato", variant: "default" },
  assegnato: { label: "Assegnato", variant: "default" },
  ricongiunti: { label: "Ricongiunti", variant: "outline" },
  incassato: { label: "Incassato", variant: "outline" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseImporto = (raw: any): number => {
  // Usato anche dal dialog manuale
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  let s = String(raw).replace(/[€$\s]/g, "").trim();
  if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const TAB_VALUES = [
  "da-ricongiungere",
  "ricongiunti",
  "importazione",
  "storico-importazioni",
  "monitor",
] as const;
type TabValue = (typeof TAB_VALUES)[number];

const isTabValue = (v: string | null): v is TabValue =>
  !!v && (TAB_VALUES as readonly string[]).includes(v);

const SEDE_IMPORT_RUOLI = ["ufficio", "backoffice", "contabilita"] as const;

const Page = () => {
  const qc = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAll = isAdmin || isCfo;
  const canImport =
    seeAll ||
    (!!profile?.ruolo &&
      (SEDE_IMPORT_RUOLI as readonly string[]).includes(profile.ruolo));
  /** Monitor globale: solo admin/CFO */
  const canMonitor = seeAll;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const rawTab: TabValue = isTabValue(tabParam) ? tabParam : "da-ricongiungere";
  const resolveTab = (t: TabValue): TabValue => {
    if (t === "monitor" && !canMonitor) return canImport ? "importazione" : "da-ricongiungere";
    if ((t === "importazione" || t === "storico-importazioni") && !canImport) {
      return "da-ricongiungere";
    }
    return t;
  };
  const tab: TabValue = resolveTab(rawTab);
  const setTab = (v: string) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", v);
    setSearchParams(sp, { replace: true });
  };

  useEffect(() => {
    if (rawTab !== tab) setTab(tab);
  }, [rawTab, tab]);

  const [importing, setImporting] = useState(false);
  const [lastReport, setLastReport] = useState<{
    caricoId: string | null;
    inseriti: number;
    duplicati: number;
    scarti: number;
    senzaCliente: number;
    nomeFile: string;
    scartiByMotivo: Record<string, number>;
  } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [contoImportId, setContoImportId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewEstratto | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsingPreview, setParsingPreview] = useState(false);

  /** Solo anteprima: non scrive ancora sul DB. */
  const handleFile = useCallback(async (file: File) => {
    if (!contoImportId) {
      toast.error("Seleziona il conto bancario prima di importare");
      return;
    }
    setParsingPreview(true);
    try {
      const rows = await readEstrattoBancarioRows(file);
      if (rows.length === 0) {
        toast.error("Nessuna riga trovata nel file");
        return;
      }
      // Anteprima con anti-doppio: confronta anche movimenti già collegati sullo stesso conto
      const colsPreview = detectColonneEstratto(Object.keys(rows[0] || {}));
      const dates = Array.from(
        new Set(rows.map((r) => parseDataBancaria(colsPreview.data ? r[colsPreview.data] : null))),
      );
      const existingKeys = await fetchExistingMovimentoDedupKeys(contoImportId, dates);
      const p = buildPreviewEstratto(file.name, rows, {
        contoBancarioId: contoImportId,
        existingDedupKeys: existingKeys,
      });
      setPreview(p);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(`Errore lettura file: ${e.message ?? e}`);
    } finally {
      setParsingPreview(false);
    }
  }, [contoImportId]);

  /** Conferma dall'anteprima: scrive carico + movimenti + scarti motivati. */
  const confirmImport = useCallback(async () => {
    if (!preview || !contoImportId) return;
    setImporting(true);
    try {
      const rows = preview.rawRows;
      const cols = preview.colonne;
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id ?? null;
      if (!seeAll && profile?.ufficio_id) {
        const contiSede = await fetchContoIdsForUfficio(profile.ufficio_id);
        if (!contiSede.includes(contoImportId)) {
          toast.error("Puoi importare solo sui conti bancari della tua sede");
          return;
        }
      }
      const ufficioDaConto = await resolveUfficioFromConto(contoImportId);

      type Scarto = {
        riga_excel: number;
        motivo: string;
        data_movimento: string | null;
        importo: number | null;
        ordinante: string | null;
        descrizione: string | null;
        raw_json: Record<string, unknown>;
      };
      const scarti: Scarto[] = [];
      const records: any[] = [];

      rows.forEach((r, idx) => {
        const rigaExcel = idx + 2;
        const descrizione = cols.descrizione ? String(r[cols.descrizione] ?? "").trim() : "";
        const ordinante =
          resolveOrdinanteImport(cols.ordinante ? String(r[cols.ordinante] ?? "") : "", descrizione) || null;
        const dataMov = parseDataBancaria(cols.data ? r[cols.data] : null);
        const { importo, motivo } = resolveImportoEstratto(r, cols);
        if (!importo) {
          scarti.push({
            riga_excel: rigaExcel,
            motivo: motivo || "importo_zero_o_invalido",
            data_movimento: dataMov || null,
            importo: null,
            ordinante,
            descrizione: descrizione || null,
            raw_json: r,
          });
          return;
        }
        const rawCli = cols.clienteId ? String(r[cols.clienteId] ?? "").trim() : "";
        const cliente_id = UUID_RE.test(rawCli) ? rawCli : null;
        records.push({
          data_movimento: dataMov,
          importo,
          ordinante,
          descrizione: descrizione || null,
          cliente_id,
          conto_bancario_id: contoImportId,
          stato: (cliente_id ? "assegnato" : "importato") as "assegnato" | "importato",
          caricato_da: userId,
          _riga_excel: rigaExcel,
        });
      });

      const { data: caricoIns, error: errCarico } = await supabase
        .from("movimenti_bancari_carichi" as any)
        .insert({
          nome_file: preview.nomeFile,
          conto_bancario_id: contoImportId,
          caricato_da: userId,
          righe_file: rows.length,
          righe_inserite: 0,
          righe_duplicati: 0,
          righe_scartate: 0,
          righe_senza_cliente: 0,
          note: Object.keys(preview.scartiByMotivo).length
            ? `Anteprima scarti: ${JSON.stringify(preview.scartiByMotivo)}`
            : null,
        } as any)
        .select("id")
        .single();
      if (errCarico) throw errCarico;
      const caricoId = (caricoIns as any).id as string;

      if (records.length === 0) {
        if (scarti.length > 0) {
          await supabase.from("movimenti_bancari_carichi_scarti" as any).insert(
            scarti.map((s) => ({ ...s, carico_id: caricoId })) as any,
          );
        }
        await supabase.from("movimenti_bancari_carichi" as any).update({
          righe_scartate: scarti.length,
        } as any).eq("id", caricoId);
        const byMotivo = countByMotivo(scarti.map((s) => s.motivo));
        setLastReport({
          caricoId,
          inseriti: 0,
          duplicati: 0,
          scarti: scarti.length,
          senzaCliente: 0,
          nomeFile: preview.nomeFile,
          scartiByMotivo: byMotivo,
        });
        toast.info(`Nessuna riga importata · ${scarti.length} scarti (vedi motivi)`);
        setPreviewOpen(false);
        setPreview(null);
        qc.invalidateQueries({ queryKey: ["mov-bancari-carichi"] });
        setTab("storico-importazioni");
        return;
      }

      // Match ordinante → cliente/sede per righe senza Cliente ID (cache per ordinante normalizzato)
      const daMatchare = records.filter((r) => !r.cliente_id && r.ordinante);
      let matchMap = new Map<string, ClienteOrdinanteMatch>();
      if (daMatchare.length > 0) {
        try {
          matchMap = await matchClientiDaOrdinantiBatch(
            daMatchare.map((r) => ({ ordinante: r.ordinante, descrizione: r.descrizione })),
          );
        } catch (e: any) {
          console.warn("Match ordinante→cliente fallito, uso sede conto:", e?.message ?? e);
        }
      }
      let autoMatchati = 0;
      for (const r of records) {
        if (!r.cliente_id && r.ordinante) {
          const hit = matchMap.get(normalizeNomeMatch(r.ordinante));
          if (hit) {
            r.cliente_id = hit.cliente_id;
            r.stato = "matchato";
            (r as any).ufficio_id = hit.ufficio_id ?? ufficioDaConto;
            autoMatchati++;
          }
        }
      }

      const cliIds = Array.from(new Set(records.map((r) => r.cliente_id).filter(Boolean))) as string[];
      const ufficioMap = new Map<string, string | null>();
      if (cliIds.length > 0) {
        const { data: clienti } = await supabase.from("clienti").select("id, ufficio_id").in("id", cliIds as any);
        for (const c of (clienti as any[] ?? [])) ufficioMap.set(c.id, c.ufficio_id ?? null);
      }
      for (const r of records) {
        if (r.cliente_id) {
          const uCli = ufficioMap.get(r.cliente_id);
          (r as any).ufficio_id = uCli ?? (r as any).ufficio_id ?? ufficioDaConto;
        } else if ((r as any).ufficio_id == null) {
          (r as any).ufficio_id = ufficioDaConto;
        }
        (r as any).carico_id = caricoId;
      }

      const dates = Array.from(new Set(records.map((r) => r.data_movimento)));
      const existingKeys = await fetchExistingMovimentoDedupKeys(contoImportId, dates);

      const toInsert: any[] = [];
      for (const r of records) {
        const dedupPayload = {
          conto_bancario_id: contoImportId,
          data_movimento: r.data_movimento,
          importo: r.importo,
          descrizione: r.descrizione,
          ordinante: r.ordinante,
        };
        if (isMovimentoDedupHit(dedupPayload, existingKeys)) {
          scarti.push({
            riga_excel: r._riga_excel,
            motivo: "duplicato",
            data_movimento: r.data_movimento,
            importo: r.importo,
            ordinante: r.ordinante,
            descrizione: r.descrizione,
            raw_json: { data_movimento: r.data_movimento, importo: r.importo, ordinante: r.ordinante },
          });
        } else {
          const { _riga_excel, ...row } = r;
          toInsert.push(row);
          existingKeys.add(buildMovimentoConstraintDedupKey(dedupPayload));
          existingKeys.add(buildMovimentoDedupKey(dedupPayload));
          const ck = buildMovimentoContentDedupKey(dedupPayload);
          if (ck) existingKeys.add(ck);
        }
      }

      const senzaCliente = toInsert.filter((r) => !r.cliente_id).length;

      const CHUNK = 200;
      const { inseriti, saltatiDedup } = await insertMovimentiBancariSkippingDedup(toInsert, CHUNK);
      const duplicati = records.length - inseriti;
      // Duplicati intercettati solo a insert-time (race / vincolo globale non in anteprima)
      for (let s = 0; s < saltatiDedup; s++) {
        scarti.push({
          riga_excel: 0,
          motivo: "duplicato",
          data_movimento: null,
          importo: null,
          ordinante: null,
          descrizione: null,
          raw_json: { note: "saltato per vincolo uq_movimenti_bancari_dedup" },
        });
      }

      if (scarti.length > 0) {
        for (let i = 0; i < scarti.length; i += CHUNK) {
          const slice = scarti.slice(i, i + CHUNK).map((s) => ({ ...s, carico_id: caricoId }));
          const { error } = await supabase.from("movimenti_bancari_carichi_scarti" as any).insert(slice as any);
          if (error) throw error;
        }
      }

      await supabase.from("movimenti_bancari_carichi" as any).update({
        righe_inserite: inseriti,
        righe_duplicati: duplicati,
        righe_scartate: scarti.length,
        righe_senza_cliente: senzaCliente,
      } as any).eq("id", caricoId);

      const byMotivo = countByMotivo(scarti.map((s) => s.motivo));
      setLastReport({
        caricoId,
        inseriti,
        duplicati,
        scarti: scarti.length,
        senzaCliente,
        nomeFile: preview.nomeFile,
        scartiByMotivo: byMotivo,
      });
      const parts = [`${inseriti} movimenti caricati`];
      if (autoMatchati) parts.push(`${autoMatchati} con cliente/sede da ordinante`);
      if (duplicati) parts.push(`${duplicati} duplicati`);
      if (scarti.length) parts.push(`${scarti.length} scarti`);
      toast.success(parts.join(" · "));
      setPreviewOpen(false);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
      qc.invalidateQueries({ queryKey: ["mov-bancari-carichi"] });
      qc.invalidateQueries({ queryKey: ["ordinanti-suggeriti"] });
      setTab("storico-importazioni");
    } catch (e: any) {
      toast.error(`Errore import: ${e.message ?? e}`);
    } finally {
      setImporting(false);
    }
  }, [preview, contoImportId, qc, seeAll, profile?.ufficio_id]);

  const handleManualInsert = async (payload: ManualInsertPayload) => {
    if (!seeAll && profile?.ufficio_id) {
      if (!payload.conto_bancario_id) {
        toast.error("Seleziona un conto bancario della tua sede");
        throw new Error("conto obbligatorio");
      }
      const contiSede = await fetchContoIdsForUfficio(profile.ufficio_id);
      if (!contiSede.includes(payload.conto_bancario_id)) {
        toast.error("Puoi inserire solo sui conti bancari della tua sede");
        throw new Error("conto fuori sede");
      }
    }
    const { data: userResp } = await supabase.auth.getUser();
    const ufficioDaConto = payload.conto_bancario_id
      ? await resolveUfficioFromConto(payload.conto_bancario_id)
      : null;
    let cliente_id: string | null = null;
    let ufficio_id = ufficioDaConto;
    let stato: "importato" | "matchato" = "importato";
    try {
      const match = await matchClienteDaOrdinante(payload.ordinante, payload.descrizione);
      if (match) {
        cliente_id = match.cliente_id;
        ufficio_id = match.ufficio_id ?? ufficioDaConto;
        stato = "matchato";
      }
    } catch (e: any) {
      console.warn("Match ordinante→cliente fallito:", e?.message ?? e);
    }
    const { error } = await supabase.from("movimenti_bancari" as any).insert({
      data_movimento: payload.data_movimento,
      importo: payload.importo,
      ordinante: payload.ordinante,
      descrizione: payload.descrizione,
      note: payload.note,
      cliente_id,
      ufficio_id,
      conto_bancario_id: payload.conto_bancario_id,
      stato,
      caricato_da: userResp.user?.id ?? null,
    } as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success(
      cliente_id
        ? "Movimento creato con cliente/sede da ordinante"
        : "Movimento creato — disponibile in Da ricongiungere",
    );
    qc.invalidateQueries({ queryKey: ["mov-bancari"] });
    qc.invalidateQueries({ queryKey: ["ordinanti-suggeriti"] });
    qc.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
  };

  return (
    <RoleGuard
      allowedRoles={["admin", "cfo", "ufficio", "backoffice", "contabilita"]}
      permissionKey="contabilita"
    >
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Bonifici e Movimenti Bancari</h1>
          <p className="text-sm text-muted-foreground">
            Bonifici da ricongiungere e già collegati, poi import estratto conto e storico carichi.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="da-ricongiungere">Da ricongiungere</TabsTrigger>
              <TabsTrigger value="ricongiunti">Ricongiunti</TabsTrigger>
              {canImport && (
                <>
                  <TabsTrigger value="importazione">Importazioni</TabsTrigger>
                  <TabsTrigger value="storico-importazioni">Storico importazioni</TabsTrigger>
                  {canMonitor && (
                    <TabsTrigger value="monitor">Monitor Real-time</TabsTrigger>
                  )}
                </>
              )}
            </TabsList>
            {canImport && (tab === "importazione" || tab === "storico-importazioni") && (
              <Button onClick={() => setManualOpen(true)} size="sm" className="gap-1">
                <Plus className="w-4 h-4" /> Inserimento manuale
              </Button>
            )}
          </div>

          <TabsContent value="da-ricongiungere">
            <DaRicongiungereTab
              profileUfficio={profile?.ufficio_id ?? null}
              seeAll={seeAll}
            />
          </TabsContent>

          <TabsContent value="ricongiunti">
            <StoricoTab
              profileUfficio={profile?.ufficio_id ?? null}
              seeAll={seeAll}
            />
          </TabsContent>

          {canImport && (
            <>
              <TabsContent value="importazione" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Upload estratto conto (Excel / CSV)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Conto bancario *</Label>
                      <ContoBancarioSelect
                        value={contoImportId || null}
                        onChange={(id) => setContoImportId(id ?? "")}
                        tipi={["incasso_clienti", "generico"]}
                        autoSelectDefault
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        I movimenti senza cliente restano in coda nella tab Da ricongiungere.
                      </p>
                    </div>
                    <DropZone disabled={importing || parsingPreview || !contoImportId} onFile={handleFile} />
                    <p className="text-xs text-muted-foreground">
                      Formati: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code> (separatore <code>;</code> o <code>,</code>).
                      Dopo la selezione vedi l&apos;<strong>anteprima</strong> con le righe da importare e i motivi degli scarti, poi conferma.
                    </p>
                    {parsingPreview && (
                      <p className="text-sm text-muted-foreground">Lettura file in corso…</p>
                    )}
                    {lastReport && (
                      <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                        <div className="font-medium">Ultimo caricamento · {lastReport.nomeFile}</div>
                        <ul className="text-muted-foreground space-y-0.5">
                          <li>· {lastReport.inseriti} movimenti inseriti</li>
                          <li>· {lastReport.duplicati} duplicati</li>
                          <li>· {lastReport.scarti} scarti</li>
                          <li>· {lastReport.senzaCliente} senza Cliente ID (stato: Importato)</li>
                        </ul>
                        {Object.keys(lastReport.scartiByMotivo || {}).length > 0 && (
                          <div className="rounded border bg-background/60 p-2 space-y-1">
                            <p className="text-xs font-semibold text-foreground">Motivi scarto</p>
                            {Object.entries(lastReport.scartiByMotivo).map(([motivo, n]) => (
                              <div key={motivo} className="flex items-start justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">{labelMotivoScarto(motivo)}</span>
                                <Badge variant="destructive" className="text-[10px] shrink-0">{n}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs">
                          Dettaglio ed export nella tab{" "}
                          <button
                            type="button"
                            className="underline font-medium"
                            onClick={() => setTab("storico-importazioni")}
                          >
                            Storico importazioni
                          </button>
                          .
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="storico-importazioni">
                <StoricoCarichiMovimenti />
              </TabsContent>

              {canMonitor && (
                <TabsContent value="monitor">
                  <MonitorTab />
                </TabsContent>
              )}
            </>
          )}
        </Tabs>

        {canImport && (
          <>
            <InserimentoManualeDialog
              open={manualOpen}
              onOpenChange={setManualOpen}
              onSubmit={async (p) => { await handleManualInsert(p); setManualOpen(false); }}
            />

            <AnteprimaImportDialog
              open={previewOpen}
              preview={preview}
              importing={importing}
              onCancel={() => {
                if (importing) return;
                setPreviewOpen(false);
                setPreview(null);
              }}
              onConfirm={() => void confirmImport()}
            />
          </>
        )}
      </div>
    </RoleGuard>
  );
};

function AnteprimaImportDialog({
  open,
  preview,
  importing,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  preview: PreviewEstratto | null;
  importing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!preview) return null;
  const colHint = [
    preview.colonne.data && `Data: ${preview.colonne.data}`,
    preview.colonne.avere && `Avere: ${preview.colonne.avere}`,
    preview.colonne.dare && `Dare: ${preview.colonne.dare}`,
    preview.colonne.importo && `Importo: ${preview.colonne.importo}`,
    preview.colonne.descrizione && `Desc: ${preview.colonne.descrizione}`,
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Anteprima import · {preview.nomeFile}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded border px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">Righe file</div>
            <div className="font-bold tabular-nums">{preview.righeFile}</div>
          </div>
          <div className="rounded border px-2 py-1.5 border-emerald-300 bg-emerald-50/50">
            <div className="text-[10px] text-muted-foreground">Da importare</div>
            <div className="font-bold tabular-nums text-emerald-800">{preview.daImportare}</div>
          </div>
          <div className="rounded border px-2 py-1.5 border-destructive/40 bg-destructive/5">
            <div className="text-[10px] text-muted-foreground">Scarti previsti</div>
            <div className="font-bold tabular-nums text-destructive">{preview.scarti}</div>
          </div>
          <div className="rounded border px-2 py-1.5 border-amber-300 bg-amber-50/60">
            <div className="text-[10px] text-muted-foreground">Già in archivio</div>
            <div className="font-bold tabular-nums text-amber-900">
              {preview.scartiByMotivo.duplicato ?? 0}
            </div>
          </div>
          <div className="rounded border px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">Colonne rilevate</div>
            <div className="text-[11px] leading-snug truncate" title={colHint}>{colHint || "—"}</div>
          </div>
        </div>

        {Object.keys(preview.scartiByMotivo).length > 0 && (
          <div className="rounded-md border p-3 space-y-1.5">
            <p className="text-xs font-semibold">Perché verranno scartate</p>
            {Object.entries(preview.scartiByMotivo).map(([motivo, n]) => (
              <div key={motivo} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{labelMotivoScarto(motivo)}</span>
                <Badge variant="destructive" className="text-[10px] shrink-0">{n}</Badge>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">
              Gli scarti sono normali (uscite Dare, duplicati già presenti in qualsiasi stato). Verranno salvati nello storico con il motivo.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Anteprima max 40 righe (mix OK / scarto). I duplicati rispetto all&apos;archivio (qualsiasi stato e anche su altri conti, per vincolo anti-doppio globale) sono già calcolati qui: in conferma verranno importati solo i nuovi.
        </p>

        <div className="flex-1 min-h-0 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Riga</TableHead>
                <TableHead>Esito</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead>Ordinante</TableHead>
                <TableHead>Motivo / Descrizione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.preview.map((r) => (
                <TableRow key={r.riga} className={r.esito === "scarto" ? "bg-destructive/5" : undefined}>
                  <TableCell className="text-xs">{r.riga}</TableCell>
                  <TableCell>
                    {r.esito === "ok" ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] h-5">OK</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-5">Scarto</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateIT(r.data_movimento)}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {r.importo != null ? fmtEuro(r.importo) : "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate" title={r.ordinante || undefined}>
                    {r.ordinante || "—"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    {r.motivo ? (
                      <span className="text-destructive">{labelMotivoScarto(r.motivo)}</span>
                    ) : (
                      <span className="truncate block text-muted-foreground" title={r.descrizione || undefined}>
                        {r.descrizione || "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={importing}>
            Annulla
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={importing || (preview.daImportare === 0 && preview.scarti === 0)}
          >
            {importing
              ? "Importazione…"
              : preview.daImportare === 0
                ? preview.scarti > 0
                  ? `Registra solo scarti (${preview.scarti})`
                  : "Niente da importare"
                : `Conferma import (${preview.daImportare})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// === Drop zone ===
const DropZone = ({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) => {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition ${drag ? "border-primary bg-primary/5" : "border-muted-foreground/25"} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <FileSpreadsheet className="w-8 h-8 text-muted-foreground mb-2" />
      <span className="text-sm">
        {disabled ? "Attendere…" : "Trascina Excel/CSV o clicca — poi vedrai l'anteprima"}
      </span>
      <input type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
};

// === Monitor tab ===
type ManualInsertPayload = {
  conto_bancario_id: string | null;
  data_movimento: string;
  importo: number;
  ordinante: string;
  descrizione: string | null;
  note: string | null;
};

const MonitorTab = () => {
  const qc = useQueryClient();
  const [filtroUfficio, setFiltroUfficio] = useState("");
  const [filtroContoId, setFiltroContoId] = useState<string | null>(null);
  const [filtroOrdinante, setFiltroOrdinante] = useState("");
  const [filtroOrdinanteDebounced, setFiltroOrdinanteDebounced] = useState("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFiltroOrdinanteDebounced(filtroOrdinante.trim()), 350);
    return () => clearTimeout(t);
  }, [filtroOrdinante]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filtroUfficio, filtroContoId, filtroOrdinanteDebounced, dal, al]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    queryFn: async () => (await supabase.from("uffici").select("id, nome:nome_ufficio").order("nome_ufficio")).data ?? [],
  });

  const toggleSortData = () => setSortDirection((d) => (d === "asc" ? "desc" : "asc"));

  const SortableHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const Icon = sortDirection === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={`cursor-pointer select-none ${className || ""}`}
        onClick={toggleSortData}
      >
        <div className="flex items-center gap-1">
          {children}
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </TableHead>
    );
  };

  const { data: movs = [] } = useQuery({
    queryKey: ["mov-bancari", "monitor", filtroUfficio, filtroContoId, filtroOrdinanteDebounced, dal, al, sortDirection],
    queryFn: async () => {
      let q = supabase.from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, descrizione, stato, ufficio_id, cliente_id, conto_bancario_id, carico_id, cliente:clienti(ragione_sociale, nome, cognome), ufficio:uffici(nome:nome_ufficio), conto:conti_bancari(etichetta), movimenti_clienti(id, importo_assegnato, anticipo, ammanco, movimenti_polizze(id, importo, tipo, messo_a_cassa))")
        .order("data_movimento", { ascending: sortDirection === "asc" })
        .limit(1000);
      if (filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
      if (filtroContoId) q = q.eq("conto_bancario_id", filtroContoId);
      if (filtroOrdinanteDebounced) {
        const term = filtroOrdinanteDebounced.replace(/[%*,()]/g, " ").trim();
        if (term) {
          q = q.or(`ordinante.ilike.%${term}%,descrizione.ilike.%${term}%`);
        }
      }
      if (dal) q = q.gte("data_movimento", dal);
      if (al) q = q.lte("data_movimento", al);
      const { data } = await q;
      return (data as any[]) ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("monitor-mov-bancari")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimenti_bancari" }, () => qc.invalidateQueries({ queryKey: ["mov-bancari"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "movimenti_polizze" }, () => qc.invalidateQueries({ queryKey: ["mov-bancari"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const cancellabili = useMemo(
    () => movs.filter((m: any) => isMovimentoCancellabile(m.stato)),
    [movs],
  );
  const selectedCancellabili = useMemo(
    () => movs.filter((m: any) => selectedIds.has(m.id) && isMovimentoCancellabile(m.stato)),
    [movs, selectedIds],
  );

  const kpi = useMemo(() => {
    const by = { importato: 0, matchato: 0, assegnato: 0, ricongiunti: 0, incassato: 0 };
    let totIncassato = 0;
    for (const m of movs) {
      by[m.stato as keyof typeof by] = (by[m.stato as keyof typeof by] ?? 0) + 1;
      if (m.stato === "incassato") totIncassato += Number(m.importo) || 0;
    }
    return { ...by, totIncassato };
  }, [movs]);

  const toggleOne = (id: string, can: boolean) => {
    if (!can) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllCancellabili = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(cancellabili.map((m: any) => m.id)));
  };

  const handleDelete = async () => {
    if (selectedCancellabili.length === 0) return;
    setDeleting(true);
    try {
      const { ok, skipped } = await eliminaMovimentiBancari(selectedCancellabili, {
        motivo: "monitor_cancellazione_manuale",
      });
      toast.success(
        `${ok} moviment${ok === 1 ? "o cancellato" : "i cancellati"}` +
          (skipped ? ` · ${skipped} non cancellabili (già ricongiunti/incassati)` : ""),
      );
      setSelectedIds(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
      qc.invalidateQueries({ queryKey: ["incassi-bonifici-aperti"] });
      qc.invalidateQueries({ queryKey: ["ordinanti-suggeriti"] });
    } catch (e: any) {
      toast.error(`Errore cancellazione: ${e.message ?? e}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Kpi label="Importati" value={kpi.importato} />
        <Kpi label="Matchati" value={kpi.matchato} />
        <Kpi label="Assegnati" value={kpi.assegnato} />
        <Kpi label="Ricongiunti" value={kpi.ricongiunti} />
        <Kpi label="Incassati" value={`${kpi.incassato} · ${fmtEuro(kpi.totIncassato)}`} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label>Ordinante</Label>
              <Input
                value={filtroOrdinante}
                onChange={(e) => setFiltroOrdinante(e.target.value)}
                placeholder="Cerca nome / azienda…"
                className="h-9"
              />
            </div>
            <div className="min-w-[240px] flex-1">
              <Label>Conto corrente</Label>
              <ContoBancarioSelect
                value={filtroContoId}
                onChange={setFiltroContoId}
                tipi={["incasso_clienti", "generico"]}
                placeholder="Tutti i conti Consulbrokers…"
                showPreview={false}
                className="w-full"
              />
            </div>
            <div className="min-w-[200px]">
              <Label>Sede</Label>
              <FilterSearchableSelect
                value={filtroUfficio || null}
                onValueChange={(v) => setFiltroUfficio(v ?? "")}
                options={(uffici as any[]).map((u) => ({ value: u.id, label: u.nome || u.id }))}
                placeholder="Sede"
                allLabel="Tutti"
                className="w-full h-9"
              />
            </div>
            <div><Label>Dal</Label><Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" /></div>
            <div><Label>Al</Label><Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" /></div>
            <Button variant="outline" size="sm" onClick={() => {
              const rows = (movs as any[]).map((m: any) => {
                const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "";
                const polizze = (m.movimenti_clienti ?? []).flatMap((mc: any) => mc.movimenti_polizze ?? []);
                const aCassa = polizze.filter((p: any) => p.messo_a_cassa).reduce((s: number, p: any) => s + Number(p.importo || 0), 0);
                return {
                  Data: formatDateIT(m.data_movimento),
                  Ordinante: m.ordinante || "",
                  "Conto corrente": m.conto?.etichetta || "",
                  Cliente: cliNome,
                  Sede: m.ufficio?.nome || "",
                  Totale: Number(m.importo) || 0,
                  "A cassa": aCassa,
                  Polizze: polizze.length,
                  Stato: STATO_LABEL[m.stato]?.label ?? m.stato,
                };
              });
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Monitor");
              XLSX.writeFile(wb, `monitor-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`);
            }}><Download className="w-3 h-3 mr-1" />Export Excel</Button>
            {selectedCancellabili.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1"
                onClick={() => setConfirmOpen(true)}
                disabled={deleting}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Elimina ({selectedCancellabili.length})
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Si possono cancellare solo movimenti <strong>Importato / Matchato / Assegnato</strong>.
            Ricongiunti e Incassati restano protetti. Ogni eliminazione viene registrata nel log attività.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={cancellabili.length > 0 && selectedCancellabili.length === cancellabili.length}
                  onCheckedChange={(v) => toggleAllCancellabili(!!v)}
                  disabled={cancellabili.length === 0}
                  aria-label="Seleziona tutti i cancellabili"
                />
              </TableHead>
              <SortableHeader>Data</SortableHeader>
              <TableHead>Ordinante</TableHead>
              <TableHead>Conto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sede</TableHead>
              <TableHead className="text-right">Totale</TableHead>
              <TableHead className="text-right">A cassa</TableHead>
              <TableHead>Polizze</TableHead>
              <TableHead>Stato</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {movs.map((m: any, i: number) => {
                const cliNome = m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—";
                const polizze = (m.movimenti_clienti ?? []).flatMap((mc: any) => mc.movimenti_polizze ?? []);
                const aCassa = polizze.filter((p: any) => p.messo_a_cassa).reduce((s: number, p: any) => s + Number(p.importo || 0), 0);
                const can = isMovimentoCancellabile(m.stato);
                return (
                  <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        disabled={!can}
                        onCheckedChange={() => toggleOne(m.id, can)}
                        aria-label={can ? "Seleziona movimento" : "Non cancellabile"}
                      />
                    </TableCell>
                    <TableCell>{formatDateIT(m.data_movimento)}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={m.ordinante || undefined}>{m.ordinante || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate" title={m.conto?.etichetta || undefined}>{m.conto?.etichetta || "—"}</TableCell>
                    <TableCell className="text-sm">{cliNome}</TableCell>
                    <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEuro(aCassa)}</TableCell>
                    <TableCell className="text-sm">{polizze.length || "—"}</TableCell>
                    <TableCell><Badge variant={STATO_LABEL[m.stato]?.variant ?? "secondary"}>{STATO_LABEL[m.stato]?.label ?? m.stato}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {movs.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedCancellabili.length} moviment{selectedCancellabili.length === 1 ? "o" : "i"}?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;operazione è irreversibile. Verrà scritto un log con ordinante, importo, data e stato di ogni riga.
              I movimenti già ricongiunti o incassati non vengono toccati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminazione…" : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// === Inserimento manuale (dialog popup) ===
const InserimentoManualeDialog = ({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (p: ManualInsertPayload) => Promise<void> }) => {
  const [dataMov, setDataMov] = useState(todayISO());
  const [importo, setImporto] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [note, setNote] = useState("");
  const [contoId, setContoId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<{ ordinante?: boolean; data?: boolean; importo?: boolean; conto?: boolean }>({});

  const importoNum = parseImporto(importo);
  const errors = {
    conto: !contoId ? "Seleziona il conto bancario" : "",
    ordinante: !ordinante.trim() ? "Indica l'ordinante del bonifico" : "",
    data: !dataMov ? "Inserisci la data del movimento" : "",
    importo: !importo ? "Inserisci l'importo" : (importoNum <= 0 ? "L'importo deve essere maggiore di zero" : ""),
  };
  const hasErrors = !!(errors.conto || errors.ordinante || errors.data || errors.importo);
  const canSubmit = !hasErrors && !saving;

  const handleSubmit = async () => {
    setTouched({ ordinante: true, data: true, importo: true, conto: true });
    if (hasErrors) {
      toast.error(errors.conto || errors.ordinante || errors.data || errors.importo);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        conto_bancario_id: contoId || null,
        data_movimento: dataMov,
        importo: importoNum,
        ordinante: ordinante.trim(),
        descrizione: descrizione || null,
        note: note || null,
      });
      setContoId("");
      setDataMov(todayISO()); setImporto(""); setOrdinante(""); setDescrizione(""); setNote("");
      setTouched({});
    } catch { /* toast handled in caller */ }
    finally { setSaving(false); }
  };

  const errClass = (v: string | undefined) => v ? "border-destructive focus-visible:ring-destructive" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Inserimento manuale movimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Conto bancario *</Label>
            <ContoBancarioSelect
              value={contoId || null}
              onChange={(id) => {
                setContoId(id ?? "");
                setTouched((t) => ({ ...t, conto: true }));
              }}
              tipi={["incasso_clienti", "generico"]}
              autoSelectDefault
            />
            {touched.conto && errors.conto && (
              <p className="text-[11px] text-destructive mt-1">{errors.conto}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Ordinante *</Label>
            <OrdinanteCombobox
              value={ordinante}
              onChange={(v) => {
                setOrdinante(v);
                setTouched((t) => ({ ...t, ordinante: true }));
              }}
              className={touched.ordinante && errors.ordinante ? "border-destructive" : ""}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Nome come compare sul bonifico (lista o digita a mano). Se riconoscibile, cliente e sede vengono assegnati automaticamente.
            </p>
            {touched.ordinante && errors.ordinante && (
              <p className="text-[11px] text-destructive mt-1">{errors.ordinante}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Data *</Label>
            <Input
              type="date"
              value={dataMov}
              onChange={(e) => setDataMov(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, data: true }))}
              className={touched.data && errors.data ? errClass(errors.data) : ""}
            />
            {touched.data && errors.data && <p className="text-[11px] text-destructive mt-1">{errors.data}</p>}
          </div>
          <div>
            <Label className="text-xs">Importo € *</Label>
            <Input
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, importo: true }))}
              placeholder="0,00"
              className={touched.importo && errors.importo ? errClass(errors.importo) : ""}
            />
            {touched.importo && errors.importo && <p className="text-[11px] text-destructive mt-1">{errors.importo}</p>}
          </div>
          <div>
            <Label className="text-xs">Descrizione</Label>
            <Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" size="sm">Annulla</Button>
            <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1" size="sm">
              <Plus className="w-4 h-4 mr-1" /> {saving ? "Salvataggio…" : "Aggiungi"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Il movimento viene creato come <strong>Importato</strong> e compare in Incassi → Bonifici aperti.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Kpi = ({ label, value }: { label: string; value: number | string }) => (
  <Card><CardContent className="p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-bold tabular-nums">{value}</div>
  </CardContent></Card>
);

export default Page;
