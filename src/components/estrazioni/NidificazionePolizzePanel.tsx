import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtEuro } from "@/lib/formatCurrency";
import { garanziaCollegataLabel } from "@/lib/nidificazione";

type PolizzaNidificazione = {
  id: string;
  numero_titolo: string | null;
  data_scadenza: string | null;
  garanzia_a: string | null;
  premio_lordo: number | null;
  compagnia_nome: string | null;
  prodotto_nome: string | null;
  ramo_nome: string | null;
  garanzia_collegata: string;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}


export async function fetchPolizzeNidificazione(clienteId: string): Promise<PolizzaNidificazione[]> {
  const { data, error } = await supabase
    .from("v_portafoglio_titoli")
    .select(
      "id, numero_titolo, data_scadenza, garanzia_a, premio_lordo, compagnia_nome, prodotto_nome, ramo_nome",
    )
    .eq("cliente_anagrafica_id", clienteId)
    .is("sostituisce_polizza", null)
    .in("stato", ["attivo", "sospeso", "incassato", "scaduto"])
    .order("data_scadenza", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const rows = (data || []) as Array<Omit<PolizzaNidificazione, "garanzia_collegata">>;
  const ids = rows.map((r) => r.id).filter(Boolean);
  const garanzieByTitolo = new Map<string, string[]>();

  if (ids.length) {
    const { data: garanzie, error: gErr } = await supabase
      .from("premi_garanzia_polizza")
      .select("titolo_id, garanzia, ordine")
      .in("titolo_id", ids)
      .order("ordine", { ascending: true });
    if (gErr) throw gErr;
    for (const g of garanzie || []) {
      const titoloId = (g as { titolo_id: string }).titolo_id;
      const nome = ((g as { garanzia?: string | null }).garanzia || "").trim();
      if (!titoloId || !nome) continue;
      const list = garanzieByTitolo.get(titoloId) || [];
      list.push(nome);
      garanzieByTitolo.set(titoloId, list);
    }
  }

  return rows.map((r) => ({
    ...r,
    garanzia_collegata: garanziaCollegataLabel(
      garanzieByTitolo.get(r.id) || [],
      r.prodotto_nome,
      r.ramo_nome,
    ),
  }));
}

export function NidificazionePolizzePanel({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["nidificazione-polizze", clienteId],
    queryFn: () => fetchPolizzeNidificazione(clienteId),
  });

  if (isLoading) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Caricamento polizze…</p>;
  }
  if (error) {
    return (
      <p className="px-4 py-3 text-sm text-destructive">
        Impossibile caricare le polizze di questo cliente.
      </p>
    );
  }
  if (!data.length) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">Nessuna polizza collegata.</p>;
  }

  return (
    <div className="px-3 py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Data scadenza</TableHead>
            <TableHead className="text-xs">N. polizza</TableHead>
            <TableHead className="text-xs">Agenzia di riferimento</TableHead>
            <TableHead className="text-xs text-right">Premio lordo</TableHead>
            <TableHead className="text-xs">Garanzia collegata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/titoli/${p.id}`);
              }}
            >
              <TableCell className="text-xs">{fmtDate(p.garanzia_a || p.data_scadenza)}</TableCell>
              <TableCell className="text-xs font-mono">{p.numero_titolo || "—"}</TableCell>
              <TableCell className="text-xs">{p.compagnia_nome || "—"}</TableCell>
              <TableCell className="text-xs text-right tabular-nums">{fmtEuro(p.premio_lordo)}</TableCell>
              <TableCell className="text-xs">{p.garanzia_collegata}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
