import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ArrowDown, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

interface Props {
  anagraficaId: string | null;
  defaults: { base: string; consulenza: string; ra: string };
}

interface Ramo { codice: string; descrizione: string }
interface Row {
  ramo_codice: string;
  ramo_descr: string;
  percentuale_provvigione: string;
  percentuale_consulenza: string;
  percentuale_ra: string;
  exists: boolean;
  dirty: boolean;
}

const COLS = [
  { key: "percentuale_provvigione", label: "% Provvigione" },
  { key: "percentuale_consulenza", label: "% Consulenza" },
  { key: "percentuale_ra", label: "% RA" },
] as const;

type ColKey = typeof COLS[number]["key"];

export default function ProduttoreProvvigioniRamoTab({ anagraficaId, defaults }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const { data: rami = [] } = useQuery<Ramo[]>({
    queryKey: ["rami_attivi_for_ppr"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("codice, descrizione").eq("attivo", true).order("codice");
      return (data || []) as Ramo[];
    },
    staleTime: 300000 * 60 * 30,
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["produttori_provvigioni_ramo", anagraficaId],
    enabled: !!anagraficaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produttori_provvigioni_ramo" as any)
        .select("*")
        .eq("anagrafica_id", anagraficaId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Build rows from rami + existing
  useEffect(() => {
    if (!rami.length) return;
    const map = new Map(existing.map((e: any) => [e.ramo_codice, e]));
    setRows(rami.map((r) => {
      const ex = map.get(r.codice);
      return {
        ramo_codice: r.codice,
        ramo_descr: r.descrizione,
        percentuale_provvigione: ex?.percentuale_provvigione?.toString() ?? "",
        percentuale_consulenza: ex?.percentuale_consulenza?.toString() ?? "",
        percentuale_ra: ex?.percentuale_ra?.toString() ?? "",
        exists: !!ex,
        dirty: false,
      };
    }));
  }, [rami, existing]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (f && !r.ramo_codice.toLowerCase().includes(f) && !r.ramo_descr.toLowerCase().includes(f)) return false;
      if (onlyCustom && !r.percentuale_provvigione && !r.percentuale_consulenza && !r.percentuale_ra) return false;
      return true;
    });
  }, [rows, filter, onlyCustom]);

  const updateCell = (codice: string, col: ColKey, value: string) => {
    setRows((prev) => prev.map((r) => r.ramo_codice === codice ? { ...r, [col]: value, dirty: true } : r));
  };

  const fillColumn = (col: ColKey, fromDefault: boolean, onlyEmpty = false) => {
    const codes = new Set(filtered.map((r) => r.ramo_codice));
    const defaultMap: Record<ColKey, string> = {
      percentuale_provvigione: defaults.base,
      percentuale_consulenza: defaults.consulenza,
      percentuale_ra: defaults.ra,
    };
    setRows((prev) => prev.map((r) => {
      if (!codes.has(r.ramo_codice)) return r;
      if (onlyEmpty && r[col]) return r;
      const v = fromDefault ? defaultMap[col] : (filtered[0]?.[col] ?? "");
      return { ...r, [col]: v, dirty: true };
    }));
  };

  const handlePaste = (codice: string, col: ColKey) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/[\n\t]/.test(text)) return; // single value, default behaviour
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((_, i, a) => i < a.length - 1 || a[i] !== "");
    const startIdx = filtered.findIndex((r) => r.ramo_codice === codice);
    if (startIdx < 0) return;
    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, i) => {
        const target = filtered[startIdx + i];
        if (!target) return;
        const val = line.split("\t")[0].replace(",", ".").trim();
        const idx = next.findIndex((r) => r.ramo_codice === target.ramo_codice);
        if (idx >= 0) next[idx] = { ...next[idx], [col]: val, dirty: true };
      });
      return next;
    });
  };

  const copyLabel = async (r: Row, withDescr = true) => {
    await navigator.clipboard.writeText(withDescr ? `${r.ramo_codice} - ${r.ramo_descr}` : r.ramo_codice);
    toast.success(`Copiato: ${withDescr ? r.ramo_descr : r.ramo_codice}`);
  };

  const resetRow = (codice: string) => {
    setRows((prev) => prev.map((r) => r.ramo_codice === codice
      ? { ...r, percentuale_provvigione: "", percentuale_consulenza: "", percentuale_ra: "", dirty: true }
      : r));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!anagraficaId) throw new Error("Salva prima l'anagrafica");
      const dirty = rows.filter((r) => r.dirty);
      if (!dirty.length) return;

      const toUpsert = dirty
        .filter((r) => r.percentuale_provvigione || r.percentuale_consulenza || r.percentuale_ra)
        .map((r) => ({
          anagrafica_id: anagraficaId,
          ramo_codice: r.ramo_codice,
          percentuale_provvigione: r.percentuale_provvigione ? Number(r.percentuale_provvigione) : null,
          percentuale_consulenza: r.percentuale_consulenza ? Number(r.percentuale_consulenza) : null,
          percentuale_ra: r.percentuale_ra ? Number(r.percentuale_ra) : null,
        }));

      const toDelete = dirty
        .filter((r) => r.exists && !r.percentuale_provvigione && !r.percentuale_consulenza && !r.percentuale_ra)
        .map((r) => r.ramo_codice);

      if (toUpsert.length) {
        const { error } = await supabase.from("produttori_provvigioni_ramo" as any)
          .upsert(toUpsert, { onConflict: "anagrafica_id,ramo_codice" });
        if (error) throw error;
      }
      if (toDelete.length) {
        const { error } = await supabase.from("produttori_provvigioni_ramo" as any)
          .delete().eq("anagrafica_id", anagraficaId).in("ramo_codice", toDelete);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produttori_provvigioni_ramo", anagraficaId] });
      toast.success("Provvigioni per ramo salvate");
    },
    onError: (e: Error) => toast.error(e.message || "Errore salvataggio"),
  });

  if (!anagraficaId) {
    return <p className="text-sm text-muted-foreground p-4">Salva prima l'anagrafica per gestire le provvigioni per ramo.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Cerca ramo</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Codice o descrizione..." />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={onlyCustom} onCheckedChange={setOnlyCustom} id="only-custom" />
          <Label htmlFor="only-custom" className="text-xs">Solo personalizzati</Label>
        </div>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvo..." : "Salva provvigioni ramo"}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} rami {onlyCustom ? "personalizzati" : "totali"} · default produttore:
        {" "}P {defaults.base || "-"}% · C {defaults.consulenza || "-"}% · RA {defaults.ra || "-"}%
      </div>

      <div className="border rounded-md max-h-[400px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[260px]">Ramo</TableHead>
              {COLS.map((c) => (
                <TableHead key={c.key} className="w-[160px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs">{c.label}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Applica default a tutti i visibili"
                        onClick={() => fillColumn(c.key, true, false)}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-xs" title="Applica default solo dove vuoto"
                        onClick={() => fillColumn(c.key, true, true)}>
                        <span className="text-[9px] font-bold">∅↓</span>
                      </Button>
                    </div>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={r.ramo_codice} className={i % 2 ? "bg-muted/30" : ""}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs font-semibold">{r.ramo_codice}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]" title={r.ramo_descr}>{r.ramo_descr}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyLabel(r, false)} title="Copia codice">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                {COLS.map((c) => (
                  <TableCell key={c.key}>
                    <Input type="number" step="0.01" className="h-8" value={r[c.key]}
                      placeholder={c.key === "percentuale_provvigione" ? defaults.base : c.key === "percentuale_consulenza" ? defaults.consulenza : defaults.ra}
                      onChange={(e) => updateCell(r.ramo_codice, c.key, e.target.value)}
                      onPaste={handlePaste(r.ramo_codice, c.key)} />
                  </TableCell>
                ))}
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetRow(r.ramo_codice)} title="Resetta riga">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
