import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SinistriImportPreviewTable from "@/components/sinistri/SinistriImportPreviewTable";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { fetchClientiSearch } from "@/hooks/useClienteSearch";
import { fetchPolizzeForCliente } from "@/lib/polizzeSearch";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import {
  applyPreviewPatch,
  buildPreviewRows,
  countByStatus,
  DESCRIZIONE_MIN_CHARS,
  downloadModuloSxTemplate,
  parseModuloSxExcel,
  type CompagniaImportMatch,
  type ImportRowStatus,
  type PolizzaImportMatch,
  type SinistroImportPreviewRow,
  type SinistroImportRaw,
} from "@/lib/sinistriImportExcel";

type Step = 1 | 2 | 3 | 4;
type ClienteLite = {
  id: string;
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
  tipo_cliente?: string | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
};

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Cliente" },
  { n: 2, label: "File Excel" },
  { n: 3, label: "Anteprima" },
  { n: 4, label: "Esito" },
];

const CREA_ALLOWED_STATI = new Set(["aperto", "in_valutazione"]);

export default function SinistriCaricamentoPage() {
  return (
    <RoleGuard
      allowedRoles={["admin", "cfo", "ufficio", "backoffice", "produttore"]}
      permissionKey="sinistri"
    >
      <SinistriCaricamentoPageInner />
    </RoleGuard>
  );
}

function SinistriCaricamentoPageInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get("cliente_id");

  const [step, setStep] = useState<Step>(1);
  const [selectedCliente, setSelectedCliente] = useState<ClienteLite | null>(null);
  const [clientiSearchText, setClientiSearchText] = useState("");
  const [clientiList, setClientiList] = useState<ClienteLite[]>([]);
  const [clientiLoading, setClientiLoading] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<SinistroImportRaw[]>([]);
  const [previewRows, setPreviewRows] = useState<SinistroImportPreviewRow[]>([]);
  const [polizze, setPolizze] = useState<PolizzaImportMatch[]>([]);
  const [compagnie, setCompagnie] = useState<CompagniaImportMatch[]>([]);
  const [matching, setMatching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"tutte" | ImportRowStatus>("tutte");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clienteNome = selectedCliente ? resolveClienteNome(selectedCliente) : "";

  useEffect(() => {
    if (!preselectedClienteId || selectedCliente) return;
    supabase
      .from("clienti")
      .select("id, cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva")
      .eq("id", preselectedClienteId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSelectedCliente(data as ClienteLite);
      });
  }, [preselectedClienteId, selectedCliente]);

  useEffect(() => {
    const raw = clientiSearchText.trim();
    if (!raw) {
      setClientiList([]);
      setClientiLoading(false);
      return;
    }
    const q = raw.replace(/[,()]/g, " ").trim();
    if (!q) {
      setClientiList([]);
      setClientiLoading(false);
      return;
    }
    setClientiLoading(true);
    const t = setTimeout(async () => {
      let data: Awaited<ReturnType<typeof fetchClientiSearch>> = [];
      let error: unknown = null;
      try {
        data = await fetchClientiSearch(q, { onlyAttivi: false, limit: 25 });
      } catch (e) {
        error = e;
      }
      if (error) console.error("Ricerca clienti error:", error);
      setClientiList((data || []) as ClienteLite[]);
      setClientiLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [clientiSearchText]);

  const resetFile = () => {
    setFileName(null);
    setRawRows([]);
    setPreviewRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const ok = /\.xlsx?$/i.test(file.name);
    if (!ok) {
      toast.error("Carica un file Excel (.xlsx o .xls) secondo il tracciato MODULO SX");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseModuloSxExcel(buf);
      if (!parsed.length) {
        toast.error("Nessuna riga dati trovata nel file");
        return;
      }
      setFileName(file.name);
      setRawRows(parsed);
      setPreviewRows([]);
      toast.success(`${parsed.length} riga${parsed.length === 1 ? "" : "he"} lette dal file`);
    } catch (err) {
      toast.error("Impossibile leggere il file: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const preparePreview = useCallback(async () => {
    if (!selectedCliente) return;
    setMatching(true);
    try {
      const [polizzeRes, compagnieRes] = await Promise.all([
        fetchPolizzeForCliente(selectedCliente.id, { soloMadri: false }),
        supabase.from("compagnie").select("id, nome, codice, tipo").order("nome").limit(1000),
      ]);
      const polizzeList = (polizzeRes || []) as PolizzaImportMatch[];
      const compagnieList = (compagnieRes.data || []) as CompagniaImportMatch[];
      if (compagnieRes.error) throw compagnieRes.error;
      setPolizze(polizzeList);
      setCompagnie(compagnieList);
      setPreviewRows(buildPreviewRows(rawRows, {
        clienteNome: resolveClienteNome(selectedCliente),
        polizze: polizzeList,
        compagnie: compagnieList,
      }));
    } catch (err) {
      toast.error("Errore nel collegamento polizze/compagnie: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setMatching(false);
    }
  }, [rawRows, selectedCliente]);

  const goNext = async () => {
    if (step === 1) {
      if (!selectedCliente) {
        toast.error("Seleziona un cliente in anagrafica");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!rawRows.length) {
        toast.error("Carica un Excel MODULO SX");
        return;
      }
      await preparePreview();
      setStep(3);
      return;
    }
  };

  const counts = useMemo(() => countByStatus(previewRows), [previewRows]);
  const visibleRows = filterStatus === "tutte"
    ? previewRows
    : previewRows.filter((r) => r.status === filterStatus);
  const canConfirm = previewRows.length > 0 && counts.blocked === 0 && !submitting;

  const patchRow = (id: string, patch: Partial<SinistroImportPreviewRow>) => {
    setPreviewRows((prev) =>
      prev.map((row) => (row.id === id ? applyPreviewPatch(row, patch, { polizze, compagnie }) : row)),
    );
  };

  const handleConfirm = async () => {
    if (!selectedCliente || !user) return;
    if (counts.blocked > 0) {
      toast.error("Correggi le righe bloccate prima di confermare");
      return;
    }
    setSubmitting(true);
    try {
      const nextRows = [...previewRows];
      for (let i = 0; i < nextRows.length; i++) {
        const row = nextRows[i];
        try {
          const isTerzi = row.sinistro_terzi || !row.titolo_id || row.titolo_id.startsWith("cga:");
          const titoloId = isTerzi ? null : row.titolo_id;
          const statoIniziale = CREA_ALLOWED_STATI.has(row.stato)
            ? row.stato
            : "aperto";
          const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
            body: {
              azione: "crea",
              sinistro_terzi: isTerzi,
              titolo_id: titoloId,
              cliente_anagrafica_id: selectedCliente.id,
              ...(row.compagnia_id ? { compagnia_id: row.compagnia_id } : {}),
              ...(row.ufficio_id && !isTerzi ? { ufficio_id: row.ufficio_id } : {}),
              data_evento: row.data_evento,
              data_denuncia: row.data_denuncia,
              descrizione: row.descrizione.trim(),
              dinamica: row.descrizione.trim(),
              ...(row.numero_sinistro_compagnia.trim()
                ? { numero_sinistro_compagnia: row.numero_sinistro_compagnia.trim() }
                : {}),
              ...(row.controparte.trim() ? { controparte: row.controparte.trim() } : {}),
              user_id: user.id,
              stato_iniziale: statoIniziale,
            },
          });
          if (invokeErr || !invokeRes?.success) {
            throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
          }
          const created = invokeRes.sinistro as { id: string; numero_sinistro: string };

          if (row.ramo_sinistro.trim()) {
            await supabase.from("sinistri").update({ ramo_sinistro: row.ramo_sinistro.trim() }).eq("id", created.id);
          }
          if (row.stato !== statoIniziale && row.stato !== "bozza") {
            await supabase.functions.invoke("gestione-sinistri", {
              body: {
                azione: "cambia_stato",
                sinistro_id: created.id,
                nuovo_stato: row.stato,
                user_id: user.id,
                note: "Stato impostato dal caricamento massivo Excel",
              },
            });
          }

          nextRows[i] = {
            ...row,
            importResult: { ok: true, numero: created.numero_sinistro, id: created.id },
          };
        } catch (err) {
          nextRows[i] = {
            ...row,
            importResult: { ok: false, error: err instanceof Error ? err.message : String(err) },
          };
        }
        setPreviewRows([...nextRows]);
      }
      qc.invalidateQueries({ queryKey: ["sinistri"] });
      const ok = nextRows.filter((r) => r.importResult?.ok).length;
      const ko = nextRows.length - ok;
      if (ko === 0) toast.success(`${ok} sinistr${ok === 1 ? "o creato" : "i creati"}`);
      else toast.error(`${ok} creati, ${ko} in errore`);
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" /> Caricamento massivo sinistri
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Carica un Excel secondo il tracciato MODULO SX per un cliente. Il sistema interpreta le colonne,
            normalizza date e stati e propone il collegamento alle polizze MPCUnderwriting — oppure come pratica senza polizza,
            come in apertura sinistro.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/sinistri")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Torna ai sinistri
        </Button>
      </div>

      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className={`rounded-lg border px-3 py-2 text-sm ${
              step === s.n ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground"
            }`}
          >
            <span className="mr-2">{s.n}.</span>
            {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Cliente in anagrafica</CardTitle>
            <CardDescription>
              Un file Excel viene collegato a un solo cliente. Cerca per ragione sociale, nome, CF o P.IVA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCliente ? (
              <div className="flex items-start justify-between gap-3 p-3 border rounded-lg bg-muted/30">
                <div>
                  <p className="font-semibold">{clienteNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selectedCliente.codice_fiscale, selectedCliente.partita_iva].filter(Boolean).join(" · ") || "Anagrafica selezionata"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCliente(null);
                    resetFile();
                  }}
                >
                  Cambia
                </Button>
              </div>
            ) : (
              <SearchableSelect
                options={clientiList.map((c) => ({
                  value: c.id,
                  label: resolveClienteNome(c),
                  description: [c.codice_fiscale, c.partita_iva].filter(Boolean).join(" · ") || undefined,
                  searchText: [c.nome, c.cognome, c.ragione_sociale, c.codice_fiscale, c.partita_iva]
                    .filter(Boolean)
                    .join(" "),
                }))}
                value=""
                onValueChange={(val) => {
                  const c = clientiList.find((x) => x.id === val);
                  if (c) {
                    setSelectedCliente(c);
                    resetFile();
                  }
                }}
                placeholder="Cerca cliente per nome, cognome, ragione sociale, CF o P.IVA..."
                searchPlaceholder="Digita almeno 2 caratteri…"
                searchValue={clientiSearchText}
                onSearchChange={setClientiSearchText}
                serverSideSearch
                emptyText={clientiLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
                className="w-full"
              />
            )}
            <div className="flex justify-end">
              <Button onClick={goNext} disabled={!selectedCliente}>
                Avanti <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. File Excel MODULO SX</CardTitle>
            <CardDescription>
              Colonne attese: data accadimento, data denuncia, cliente, n. polizza, n. sinistro compagnia,
              compagnia, agenzia, ramo, stato, descrizione.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadModuloSxTemplate}>
                <Download className="h-4 w-4 mr-1" /> Scarica modello MODULO SX
              </Button>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Trascina qui il file oppure clicca per selezionarlo</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx / .xls — tracciato MODULO SX</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {fileName && (
              <div className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{rawRows.length} righe interpretate</p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetFile}>Rimuovi</Button>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={goNext} disabled={!rawRows.length || matching}>
                {matching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Vai all&apos;anteprima <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Anteprima e collegamenti</CardTitle>
            <CardDescription>
              Cliente: <strong>{clienteNome}</strong>. Controlla le righe, collega le polizze MPCUnderwriting oppure
              marca come senza polizza. La conferma crea i sinistri solo se non ci sono righe bloccate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{counts.total} righe</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-800">{counts.ok} pronte</Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-800">{counts.warning} con avvisi</Badge>
              <Badge variant="outline" className="bg-red-50 text-red-800">{counts.blocked} bloccate</Badge>
              <div className="flex gap-1 ml-auto">
                {(["tutte", "ok", "warning", "blocked"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={filterStatus === f ? "default" : "outline"}
                    onClick={() => setFilterStatus(f)}
                  >
                    {f === "tutte" ? "Tutte" : f === "ok" ? "Pronte" : f === "warning" ? "Avvisi" : "Bloccate"}
                  </Button>
                ))}
              </div>
            </div>
            {counts.blocked > 0 && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Completa i campi obbligatori e il collegamento polizza (o senza polizza MPCUnderwriting) sulle righe bloccate.
              </p>
            )}
            <SinistriImportPreviewTable
              rows={visibleRows}
              polizze={polizze}
              compagnie={compagnie}
              disabled={submitting}
              onChange={patchRow}
            />
            <div className="flex justify-between">
              <Button variant="outline" disabled={submitting} onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={handleConfirm} disabled={!canConfirm}>
                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Conferma e crea {previewRows.length} sinistr{previewRows.length === 1 ? "o" : "i"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Esito caricamento</CardTitle>
            <CardDescription>Sinistri creati per {clienteNome}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {previewRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">
                      Riga {row.excelRow}
                      {row.n_polizza ? ` · polizza ${row.n_polizza}` : ""}
                      {row.sinistro_terzi ? " · senza polizza MPCUnderwriting" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{row.descrizione}</p>
                  </div>
                  {row.importResult?.ok && row.importResult.id ? (
                    <Link to={`/sinistri/${row.importResult.id}`} className="text-sm text-primary underline">
                      {row.importResult.numero}
                    </Link>
                  ) : (
                    <span className="text-sm text-destructive">{row.importResult?.error || "Non creato"}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetFile();
                  setStep(2);
                }}
              >
                Carica un altro file
              </Button>
              <Button onClick={() => navigate("/sinistri")}>Vai alla lista sinistri</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <p className="text-xs text-muted-foreground">
          Campi obbligatori per ogni riga: data accadimento, data denuncia, descrizione (min. {DESCRIZIONE_MIN_CHARS} caratteri)
          e collegamento a una polizza MPCUnderwriting oppure pratica senza polizza MPCUnderwriting.
        </p>
      )}
    </div>
  );
}
