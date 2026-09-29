import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, FileSpreadsheet, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { NidificazionePolizzePanel } from "@/components/estrazioni/NidificazionePolizzePanel";
import { useGruppiStatistici, useTitoliNidificazione } from "@/hooks/useLookupTables";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";
import { cn } from "@/lib/utils";
import {
  CATEGORIA_LABEL,
  NIDIFICAZIONE_CATEGORIE,
  buildNidificazioneForest,
  clienteDisplayName,
  flattenNidificazioneForest,
  type ClienteNidificazioneLite,
  type NidificazioneCategoria,
  type RelazioneNidificazione,
} from "@/lib/nidificazione";

export default function NidificazionePage() {
  const navigate = useNavigate();
  const { data: titoli = [] } = useTitoliNidificazione();
  const { data: gruppiStat = [] } = useGruppiStatistici();
  const [search, setSearch] = useState("");
  const [gruppo, setGruppo] = useState("");
  const [categoria, setCategoria] = useState<string>("tutte");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["estrazione-nidificazione"],
    queryFn: async () => {
      const { data: rel, error: e1 } = await supabase
        .from("clienti_relazioni")
        .select("id, cliente_id, cliente_collegato_id, tipo_relazione, note");
      if (e1) throw e1;
      const relazioni = (rel || []) as RelazioneNidificazione[];
      const ids = [...new Set(relazioni.flatMap((r) => [r.cliente_id, r.cliente_collegato_id]))];
      if (!ids.length) return { relazioni, clienti: [] as ClienteNidificazioneLite[] };
      const { data: cli, error: e2 } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, gruppo_statistico")
        .in("id", ids);
      if (e2) throw e2;
      return { relazioni, clienti: (cli || []) as ClienteNidificazioneLite[] };
    },
  });

  const rows = useMemo(() => {
    const clienti = data?.clienti || [];
    const relazioni = (data?.relazioni || []).filter((r) => {
      if (categoria === "tutte") return true;
      const t = titoli.find((x) => x.codice === r.tipo_relazione);
      return t?.categoria === categoria;
    });
    const forest = buildNidificazioneForest(clienti, relazioni, titoli);
    let flat = flattenNidificazioneForest(forest);
    if (gruppo) flat = flat.filter((r) => r.gruppo_statistico === gruppo);
    const q = search.trim().toLowerCase();
    if (q) {
      flat = flat.filter((r) =>
        clienteDisplayName(r.cliente).toLowerCase().includes(q)
        || (r.phrase || "").toLowerCase().includes(q)
        || (r.gruppo_statistico || "").toLowerCase().includes(q),
      );
    }
    return flat;
  }, [data, titoli, gruppo, categoria, search]);

  const exportXlsx = () => {
    if (!rows.length) {
      toast.error("Nessuna riga da esportare");
      return;
    }
    exportEstrazioneWorkbook({
      title: "Nidificazione clienti",
      subtitle: "Albero incarichi, familiari e societari",
      filtri: {
        "Gruppo statistico": gruppiStat.find((g) => g.value === gruppo)?.label || "Tutti",
        Categoria: categoria === "tutte" ? "Tutte" : CATEGORIA_LABEL[categoria as NidificazioneCategoria],
        Ricerca: search || "—",
      },
      dettaglio: {
        name: "Nidificazione",
        rows: rows.map((r) => ({
          Livello: r.depth,
          Cliente: clienteDisplayName(r.cliente),
          Nidificazione: r.phrase || clienteDisplayName(r.cliente),
          Categoria: r.categoria ? CATEGORIA_LABEL[r.categoria] : "",
          "Gruppo statistico": r.gruppo_statistico,
        })),
      },
      fileName: "nidificazione_clienti.xlsx",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" /> Nidificazione
          </h1>
          <p className="text-muted-foreground">
            Albero dei collegamenti tra clienti: incarichi (sindaco di…), titoli familiari (figlio di…) e rapporti societari.
            Clicca una riga per aprire le polizze (scadenza, numero, agenzia, premio, garanzia).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Estrazioni
          </Button>
          <Button onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Cerca cliente o frase…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <SearchableSelect
              options={gruppiStat}
              value={gruppo}
              onValueChange={setGruppo}
              placeholder="Gruppo statistico"
              clearable
              clearLabel="Tutti i gruppi"
              className="w-full"
            />
            <SearchableSelect
              options={[
                { value: "tutte", label: "Tutte le categorie" },
                ...NIDIFICAZIONE_CATEGORIE.map((c) => ({ value: c, label: CATEGORIA_LABEL[c] })),
              ]}
              value={categoria}
              onValueChange={setCategoria}
              className="w-full"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Cliente</TableHead>
                <TableHead>Nidificazione</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Gruppo statistico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Caricamento…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nessuna nidificazione trovata.</TableCell></TableRow>
              ) : (
                rows.map((r) => {
                  const rowKey = `${r.cliente.id}-${r.phrase || "root"}`;
                  const open = openKey === rowKey;
                  return (
                    <Fragment key={rowKey}>
                      <TableRow
                        className="cursor-pointer"
                        data-state={open ? "selected" : undefined}
                        onClick={() => setOpenKey(open ? null : rowKey)}
                      >
                        <TableCell className="w-8 pr-0">
                          <ChevronDown
                            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
                          />
                        </TableCell>
                        <TableCell style={{ paddingLeft: 12 + r.depth * 20 }} className="font-medium">
                          {clienteDisplayName(r.cliente)}
                        </TableCell>
                        <TableCell>{r.phrase || "— radice —"}</TableCell>
                        <TableCell>
                          {r.categoria ? <Badge variant="secondary">{CATEGORIA_LABEL[r.categoria]}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.gruppo_statistico || "—"}</TableCell>
                      </TableRow>
                      {open && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <NidificazionePolizzePanel clienteId={r.cliente.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
