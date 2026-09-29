import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/** Filtri `ilike` (uno per match) sulla colonna `azione` di log_attivita per ogni operazione. */
const AZIONI_PER_OP: Record<string, string[]> = {
  appendice: ["appendice%"],
  storno: ["storno%"],
  rinnovo: ["rinnovo%"],
  duplica: ["titolo_duplicato%", "duplica%"],
  sostituzione: ["sostituzione%"],
  sospensione: ["polizza_sospesa%", "sospensione%"],
  riattivazione: ["polizza_riattivata%", "riattivazione%"],
  annulla: ["polizza_annullata%", "annulla_polizza%"],
  messa_cassa: ["messa_cassa%", "messa_a_cassa%"],
  annulla_messa_cassa: ["annulla_messa_cassa%"],
  carica_doc: ["documento%"],
  precontrattuale: ["precontrattuale%"],
};

interface Props {
  operationKey: string | null;
  operationLabel?: string;
}

export function AttivitaRecentiPanel({ operationKey, operationLabel }: Props) {
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ["log_attivita_gestione_polizze", operationKey],
    enabled: !!operationKey,
    queryFn: async () => {
      const patterns = AZIONI_PER_OP[operationKey!] || [];
      if (patterns.length === 0) return [];
      const orExpr = patterns.map((p) => `azione.ilike.${p}`).join(",");
      const { data, error } = await supabase
        .from("log_attivita")
        .select("id, created_at, azione, entita_id, dettagli_json, user_id")
        .eq("entita_tipo", "titolo")
        .or(orExpr)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;

      // arricchisci con N° polizza dai titoli
      const ids = Array.from(new Set((data || []).map((r: any) => r.entita_id))).filter(Boolean);
      const titMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: tit } = await supabase
          .from("titoli")
          .select("id, numero_titolo")
          .in("id", ids as string[]);
        (tit || []).forEach((t: any) => titMap.set(t.id, t.numero_titolo || ""));
      }
      const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id))).filter(Boolean);
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, nome, cognome")
          .in("id", userIds as string[]);
        (prof || []).forEach((p: any) =>
          userMap.set(p.id, `${p.nome ?? ""} ${p.cognome ?? ""}`.trim() || "—"),
        );
      }
      return (data || []).map((r: any) => ({
        ...r,
        numero_titolo: titMap.get(r.entita_id) || r.entita_id?.slice(0, 8),
        utente: userMap.get(r.user_id) || "—",
      }));
    },
  });

  if (!operationKey) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Activity className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold">
            Ultime attività{operationLabel ? ` — ${operationLabel}` : ""}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead>Azione</TableHead>
              <TableHead>Polizza</TableHead>
              <TableHead>Utente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Caricamento...
                </TableCell>
              </TableRow>
            )}
            {!isFetching && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">
                  Nessuna attività recente per questa operazione.
                </TableCell>
              </TableRow>
            )}
            {!isFetching &&
              data?.map((r: any, idx: number) => (
                <TableRow
                  key={r.id}
                  className={`cursor-pointer ${idx % 2 === 0 ? "" : "bg-muted/30"}`}
                  onClick={() => navigate(`/titoli/${r.entita_id}?tab=log`)}
                >
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("it-IT")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {r.azione}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-teal-700">
                    {r.numero_titolo}
                  </TableCell>
                  <TableCell className="text-xs">{r.utente}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
