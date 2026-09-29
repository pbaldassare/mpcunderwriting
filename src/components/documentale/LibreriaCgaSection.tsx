import { useMemo, useState } from "react";
import { useLibreriaCga } from "@/hooks/useLibreriaCga";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileSearch, Library } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import LibreriaCgaDetailDialog from "./LibreriaCgaDetailDialog";
import { TableScrollArea } from "@/components/shared/TableScrollArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 25;

export default function LibreriaCgaSection() {
  const { data: rows, isLoading } = useLibreriaCga();
  const [search, setSearch] = useState("");
  const [compagnia, setCompagnia] = useState<string>("__all__");
  const [ramo, setRamo] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const compagnie = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.compagnia).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const rami = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.ramo).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (compagnia !== "__all__" && r.compagnia !== compagnia) return false;
      if (ramo !== "__all__" && r.ramo !== ramo) return false;
      if (q && !r.nome_prodotto?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, compagnia, ramo]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Libreria CGA</h2>
          <p className="text-xs text-muted-foreground">
            Catalogo condiviso delle Condizioni Generali di Assicurazione analizzate, per compagnia e prodotto.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome prodotto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <Select value={compagnia} onValueChange={(v) => { setCompagnia(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Compagnia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutte le compagnie</SelectItem>
            {compagnie.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ramo} onValueChange={(v) => { setRamo(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Garanzia" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i rami</SelectItem>
            {rami.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <TableScrollArea className="rounded-lg border">
          <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Compagnia</th>
              <th className="text-left p-3">Prodotto</th>
              <th className="text-left p-3">Garanzia</th>
              <th className="text-left p-3">Edizione</th>
              <th className="text-left p-3">Ultima analisi</th>
              <th className="text-center p-3">Versioni</th>
              <th className="text-right p-3">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                  Nessuna CGA trovata. Le CGA vengono salvate qui dopo l'analisi AI sulla scheda cliente.
                </td>
              </tr>
            ) : (
              paged.map((r, i) => (
                <tr key={r.id} className={i % 2 ? "bg-muted/30" : ""}>
                  <td className="p-3 font-medium">{r.compagnia ?? "—"}</td>
                  <td className="p-3">{r.nome_prodotto}</td>
                  <td className="p-3">{r.ramo ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.edizione ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {format(new Date(r.created_at), "dd MMM yyyy", { locale: it })}
                  </td>
                  <td className="p-3 text-center">
                    {r.versioni_count > 1 ? (
                      <Badge variant="secondary">v{r.versioni_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">v1</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(r.id)}>
                      <FileSearch className="h-4 w-4 mr-1" /> Apri
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollArea>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filtered.length} risultati · Pagina {page + 1} di {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Precedente
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              Successiva
            </Button>
          </div>
        </div>
      )}

      <LibreriaCgaDetailDialog
        cgaId={selectedId}
        open={!!selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onSelectVersion={(id) => setSelectedId(id)}
      />
    </div>
  );
}
