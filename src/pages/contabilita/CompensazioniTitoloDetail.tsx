import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TableScrollArea } from "@/components/shared/TableScrollArea";

/**
 * Pagina di dettaglio per le compensazioni contabili di un singolo titolo.
 * Aperta dal badge "Compensazioni" nelle liste Carico / Attive / Storico.
 */
const CompensazioniTitoloDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: titolo } = useQuery({
    queryKey: ["titolo-comp-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titoli")
        .select("id, numero_titolo, prodotto_nome, descrizione_polizza, premio_lordo, data_messa_cassa, garanzia_da, garanzia_a, clienti:cliente_anagrafica_id(nome, cognome, ragione_sociale), compagnie:compagnia_id(nome)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: righe = [] } = useQuery({
    queryKey: ["titolo-comp-rows", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select("id, causale_codice, causale_descrizione, segno, importo, note, created_at")
        .eq("titolo_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const totale = useMemo(
    () => righe.reduce((s: number, r: any) => s + (r.segno === "+" ? Number(r.importo) : -Number(r.importo)), 0),
    [righe],
  );
  const totalePos = righe.filter((r: any) => r.segno === "+").reduce((s: number, r: any) => s + Number(r.importo), 0);
  const totaleNeg = righe.filter((r: any) => r.segno === "-").reduce((s: number, r: any) => s + Number(r.importo), 0);

  const cliente = titolo?.clienti?.ragione_sociale || `${titolo?.clienti?.cognome || ""} ${titolo?.clienti?.nome || ""}`.trim();
  const periodoDa = righe.length > 0 ? righe[0].created_at : null;
  const periodoA = righe.length > 0 ? righe[righe.length - 1].created_at : null;

  const fmtEur = (n: number) => `€ ${Math.abs(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-teal-600" />
            Compensazioni Contabili
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Titolo <span className="font-mono">{titolo?.numero_titolo || ""}</span>
            {cliente && <> · {cliente}</>}
            {titolo?.compagnie?.nome && <> · {titolo.compagnie.nome}</>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Righe</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{righe.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">A favore (+)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-600">{fmtEur(totalePos)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">A carico (−)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-rose-600">{fmtEur(totaleNeg)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Netto</CardTitle></CardHeader>
          <CardContent className={`text-2xl font-bold ${totale >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {totale >= 0 ? "+" : "−"}{fmtEur(totale)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dettaglio righe</CardTitle>
          {periodoDa && (
            <p className="text-xs text-muted-foreground">
              Periodo: dal {format(new Date(periodoDa), "d MMM yyyy", { locale: it })} al{" "}
              {format(new Date(periodoA!), "d MMM yyyy", { locale: it })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <TableScrollArea className="rounded-md border border-border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-primary/10 text-primary">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Data</th>
                  <th className="text-left px-3 py-2 font-semibold">Causale</th>
                  <th className="text-left px-3 py-2 font-semibold">Descrizione</th>
                  <th className="text-center px-3 py-2 font-semibold">Segno</th>
                  <th className="text-right px-3 py-2 font-semibold">Importo</th>
                  <th className="text-left px-3 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {righe.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nessuna compensazione registrata</td></tr>
                )}
                {righe.map((r: any, i: number) => (
                  <tr key={r.id} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.created_at), "dd/MM/yyyy")}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.causale_codice}</td>
                    <td className="px-3 py-2">{r.causale_descrizione}</td>
                    <td className={`px-3 py-2 text-center font-bold ${r.segno === "+" ? "text-emerald-600" : "text-rose-600"}`}>{r.segno}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtEur(Number(r.importo))}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollArea>
        </CardContent>
      </Card>

      {titolo?.data_messa_cassa && (
        <p className="text-xs text-muted-foreground">
          Titolo messo a cassa il {format(new Date(titolo.data_messa_cassa), "dd/MM/yyyy")} ·
          Le compensazioni sono state contestualmente registrate come movimenti contabili.
        </p>
      )}
    </div>
  );
};

export default CompensazioniTitoloDetail;
