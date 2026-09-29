import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, Eye } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { formatDateIT } from "@/lib/formatDate";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";
import { labelMotivoScarto } from "@/lib/movimentiBancari";

const STATI_APERTI = ["importato", "matchato", "assegnato"] as const;
const STATI_CHIUSI = ["ricongiunti", "incassato"] as const;

type VistaDettaglio = "tutti" | "aperti" | "chiusi" | "scarti";

type CaricoRow = {
  id: string;
  nome_file: string;
  created_at: string;
  conto_bancario_id: string | null;
  righe_file: number;
  righe_inserite: number;
  righe_duplicati: number;
  righe_scartate: number;
  righe_senza_cliente: number;
  conto?: { etichetta?: string | null } | null;
};

const fmtDt = (iso: string) => {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: it });
  } catch {
    return iso;
  }
};

const exportRows = (rows: Record<string, unknown>[], sheet: string, filename: string) => {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, filename);
};

export function StoricoCarichiMovimenti() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: carichi = [], isLoading } = useQuery({
    queryKey: ["mov-bancari-carichi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_bancari_carichi" as any)
        .select("id, nome_file, created_at, conto_bancario_id, righe_file, righe_inserite, righe_duplicati, righe_scartate, righe_senza_cliente, conto:conti_bancari(etichetta)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data as unknown) as CaricoRow[]) ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Storico carichi
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Per ogni file Excel/CSV: totale caricato, da lavorare, ricongiunti e scarti di import. Export Excel dal dettaglio.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Caricamento…</p>
          ) : carichi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nessun carico ancora. Importa un Excel/CSV dalla tab Importazione.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Conto</TableHead>
                  <TableHead className="text-right">File</TableHead>
                  <TableHead className="text-right">Inseriti</TableHead>
                  <TableHead className="text-right">Duplicati</TableHead>
                  <TableHead className="text-right">Scarti</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carichi.map((c, i) => (
                  <TableRow key={c.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDt(c.created_at)}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={c.nome_file}>{c.nome_file}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.conto?.etichetta || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.righe_file}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{c.righe_inserite}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.righe_duplicati}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(c.righe_scartate || 0) > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">{c.righe_scartate}</Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSelectedId(c.id)}>
                        <Eye className="w-3 h-3" /> Apri
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DettaglioCaricoDialog caricoId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function DettaglioCaricoDialog({ caricoId, onClose }: { caricoId: string | null; onClose: () => void }) {
  const [vista, setVista] = useState<VistaDettaglio>("tutti");

  const { data: carico } = useQuery({
    queryKey: ["mov-bancari-carico", caricoId],
    enabled: !!caricoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_bancari_carichi" as any)
        .select("id, nome_file, created_at, righe_file, righe_inserite, righe_duplicati, righe_scartate, righe_senza_cliente, conto:conti_bancari(etichetta)")
        .eq("id", caricoId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as CaricoRow | null;
    },
  });

  const { data: movimenti = [], isFetching: loadingMov } = useQuery({
    queryKey: ["mov-bancari-carico-movs", caricoId],
    enabled: !!caricoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_bancari" as any)
        .select("id, data_movimento, importo, ordinante, descrizione, stato, cliente_id, cliente:clienti(ragione_sociale, nome, cognome)")
        .eq("carico_id", caricoId!)
        .order("data_movimento", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: scarti = [], isFetching: loadingScarti } = useQuery({
    queryKey: ["mov-bancari-carico-scarti", caricoId],
    enabled: !!caricoId && vista === "scarti",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_bancari_carichi_scarti" as any)
        .select("id, riga_excel, motivo, data_movimento, importo, ordinante, descrizione")
        .eq("carico_id", caricoId!)
        .order("riga_excel", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const aperti = useMemo(
    () => movimenti.filter((m) => STATI_APERTI.includes(m.stato)),
    [movimenti],
  );
  const chiusi = useMemo(
    () => movimenti.filter((m) => STATI_CHIUSI.includes(m.stato)),
    [movimenti],
  );

  const shown = vista === "aperti" ? aperti : vista === "chiusi" ? chiusi : movimenti;

  const cliNome = (m: any) =>
    m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—";

  const doExport = async (kind: VistaDettaglio) => {
    const base = (carico?.nome_file || "carico").replace(/\.[^.]+$/, "");
    const day = new Date().toISOString().slice(0, 10);
    if (kind === "scarti") {
      let rows = scarti;
      if (rows.length === 0 && caricoId) {
        const { data } = await supabase
          .from("movimenti_bancari_carichi_scarti" as any)
          .select("riga_excel, motivo, data_movimento, importo, ordinante, descrizione")
          .eq("carico_id", caricoId)
          .limit(5000);
        rows = (data as any[]) ?? [];
      }
      exportRows(
        rows.map((s: any) => ({
          Riga: s.riga_excel ?? "",
          Motivo: labelMotivoScarto(s.motivo),
          Codice: s.motivo,
          Data: formatDateIT(s.data_movimento),
          Importo: Number(s.importo) || 0,
          Ordinante: s.ordinante || "",
          Descrizione: s.descrizione || "",
        })),
        "Scarti",
        `scarti-${base}-${day}.xlsx`,
      );
      return;
    }
    const src = kind === "aperti" ? aperti : kind === "chiusi" ? chiusi : movimenti;
    exportRows(
      src.map((m: any) => ({
        Data: formatDateIT(m.data_movimento),
        Importo: Number(m.importo) || 0,
        Ordinante: m.ordinante || "",
        Descrizione: m.descrizione || "",
        Cliente: cliNome(m),
        Stato: m.stato,
      })),
      kind === "aperti" ? "Da lavorare" : kind === "chiusi" ? "Ricongiunti" : "Carico",
      `${kind === "aperti" ? "da-lavorare" : kind === "chiusi" ? "ricongiunti" : "completo"}-${base}-${day}.xlsx`,
    );
  };

  return (
    <Dialog open={!!caricoId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Dettaglio carico</DialogTitle>
          <DialogDescription>
            {carico ? (
              <>
                <span className="font-medium text-foreground">{carico.nome_file}</span>
                {" · "}
                {fmtDt(carico.created_at)}
                {carico.conto?.etichetta ? ` · ${carico.conto.etichetta}` : ""}
              </>
            ) : (
              "…"
            )}
          </DialogDescription>
        </DialogHeader>

        {carico && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            <KpiMini label="Righe file" value={carico.righe_file} />
            <KpiMini label="Inseriti" value={carico.righe_inserite} />
            <KpiMini label="Da lavorare" value={aperti.length} />
            <KpiMini label="Ricongiunti/chiusi" value={chiusi.length} />
            <KpiMini label="Scarti import" value={carico.righe_scartate} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <ToggleGroup
            type="single"
            value={vista}
            onValueChange={(v) => { if (v) setVista(v as VistaDettaglio); }}
            className="border rounded-md"
          >
            <ToggleGroupItem value="tutti" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Tutti ({movimenti.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="aperti" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Da lavorare ({aperti.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="chiusi" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Ricongiunti ({chiusi.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="scarti" className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Scarti ({carico?.righe_scartate ?? 0})
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => doExport(vista)}>
              <Download className="w-3 h-3 mr-1" /> Export vista
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => doExport("tutti")}>
              Export completo
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => doExport("aperti")}>
              Export da lavorare
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => doExport("scarti")}>
              Export scarti
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" asChild>
              <Link to="/contabilita/caricamento-mov-bancari?tab=da-ricongiungere">Da ricongiungere</Link>
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto border rounded-md">
          {vista === "scarti" ? (
            loadingScarti ? (
              <p className="text-sm text-muted-foreground p-6 text-center">Caricamento scarti…</p>
            ) : (
              <div className="space-y-3 p-2">
                {(() => {
                  const by: Record<string, number> = {};
                  for (const s of scarti as any[]) {
                    const m = s.motivo || "altro";
                    by[m] = (by[m] || 0) + 1;
                  }
                  if (Object.keys(by).length === 0) return null;
                  return (
                    <div className="rounded border bg-muted/30 p-2 space-y-1">
                      <p className="text-xs font-semibold">Riepilogo motivi</p>
                      {Object.entries(by).map(([m, n]) => (
                        <div key={m} className="flex justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">{labelMotivoScarto(m)}</span>
                          <Badge variant="destructive" className="text-[10px]">{n}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Riga</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Importo</TableHead>
                      <TableHead>Ordinante</TableHead>
                      <TableHead>Descrizione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scarti.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">{s.riga_excel ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[220px]">
                          <span className="text-destructive" title={s.motivo}>
                            {labelMotivoScarto(s.motivo)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{formatDateIT(s.data_movimento)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtEuro(Number(s.importo) || 0)}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{s.ordinante || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{s.descrizione || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {scarti.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nessuno scarto su questo carico</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )
          ) : loadingMov ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Caricamento movimenti…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ordinante</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateIT(m.data_movimento)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={m.ordinante || undefined}>{m.ordinante || "—"}</TableCell>
                    <TableCell className="text-xs">{cliNome(m)}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{fmtEuro(m.importo)}</TableCell>
                    <TableCell className="text-xs"><Badge variant="secondary">{m.stato}</Badge></TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nessun movimento in questa vista</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
