import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Search } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { SearchableSelect } from "@/components/SearchableSelect";

type MezzoRow = {
  id: string;
  targa: string | null;
  tipologia: string | null;
  descrizione: string | null;
  uso: string | null;
  data_immatricolazione: string | null;
  data_inclusione: string | null;
  n_progressivo: number | null;
  titolo_id: string;
  numero_titolo: string | null;
  prodotto_nome: string | null;
  compagnia: string | null;
};

const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd MMM yyyy", { locale: it }) : "—");

export default function ClienteParcoVeicoli() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [polizza, setPolizza] = useState("");

  const { data: mezzi = [], isLoading } = useQuery({
    queryKey: ["cliente-parco-veicoli", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MezzoRow[]> => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return [];

      const { data: titoli, error: tErr } = await supabase
        .from("titoli")
        .select("id, numero_titolo, prodotto_nome, libro_matricola, compagnie(nome)")
        .in("cliente_anagrafica_id", clienteIds as string[])
        .not("libro_matricola", "is", null)
        .neq("libro_matricola", "no");
      if (tErr) throw tErr;
      if (!titoli?.length) return [];

      const titoloIds = titoli.map((t) => t.id);
      const titoloMap = new Map(
        titoli.map((t: any) => [
          t.id,
          {
            numero_titolo: t.numero_titolo as string | null,
            prodotto_nome: t.prodotto_nome as string | null,
            compagnia: t.compagnie?.nome as string | null,
          },
        ]),
      );

      const { data: rows, error } = await supabase
        .from("libro_matricola_mezzi")
        .select("id, targa, tipologia, descrizione, uso, data_immatricolazione, data_inclusione, n_progressivo, titolo_id")
        .in("titolo_id", titoloIds)
        .is("data_esclusione", null)
        .order("n_progressivo", { ascending: true });
      if (error) throw error;

      return (rows ?? []).map((m) => {
        const t = titoloMap.get(m.titolo_id);
        return {
          ...m,
          numero_titolo: t?.numero_titolo ?? null,
          prodotto_nome: t?.prodotto_nome ?? null,
          compagnia: t?.compagnia ?? null,
        };
      });
    },
  });

  const tipi = useMemo(
    () => Array.from(new Set(mezzi.map((m) => m.tipologia).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "it")),
    [mezzi],
  );
  const polizze = useMemo(
    () => Array.from(new Set(mezzi.map((m) => m.numero_titolo).filter(Boolean) as string[])).sort(),
    [mezzi],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mezzi.filter((m) => {
      if (tipo && m.tipologia !== tipo) return false;
      if (polizza && m.numero_titolo !== polizza) return false;
      if (!q) return true;
      const hay = [m.targa, m.descrizione, m.tipologia, m.uso, m.numero_titolo, m.compagnia]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [mezzi, search, tipo, polizza]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-teal-700 flex items-center justify-center shadow-sm">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">Parco Veicoli</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Caricamento…" : `${filtered.length} di ${mezzi.length} mezzi sul libro matricola`}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cerca targa, modello, polizza…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <SearchableSelect
              options={tipi.map((t) => ({ value: t, label: t }))}
              value={tipo}
              onValueChange={setTipo}
              placeholder="Tipologia"
            />
            <SearchableSelect
              options={polizze.map((p) => ({ value: p, label: p }))}
              value={polizza}
              onValueChange={setPolizza}
              placeholder="Polizza"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Caricamento parco veicoli…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nessun mezzo trovato.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <Table>
              <TableHeader>
                <TableRow className="bg-teal-700 hover:bg-teal-700">
                  <TableHead className="text-white font-bold text-xs uppercase">#</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Targa</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Mezzo</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Tipologia</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Uso</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Immatricolazione</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Polizza</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase">Compagnia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m, idx) => (
                  <TableRow key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                    <TableCell className="text-xs text-muted-foreground">{m.n_progressivo ?? idx + 1}</TableCell>
                    <TableCell className="font-mono font-semibold">{m.targa || "—"}</TableCell>
                    <TableCell>{m.descrizione || "—"}</TableCell>
                    <TableCell>
                      {m.tipologia ? <Badge variant="outline">{m.tipologia}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{m.uso || "—"}</TableCell>
                    <TableCell>{fmtDate(m.data_immatricolazione)}</TableCell>
                    <TableCell>
                      {m.titolo_id ? (
                        <Link to={`/cliente/polizze/${m.titolo_id}`} className="text-teal-800 hover:underline font-mono text-xs">
                          {m.numero_titolo || "Apri"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{m.compagnia || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      )}
    </div>
  );
}
