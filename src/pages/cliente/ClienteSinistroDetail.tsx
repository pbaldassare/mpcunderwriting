import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, User, FileText, Shield, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import SinistroDocumentiCliente from "@/components/cliente/SinistroDocumentiCliente";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";
import { badgeClassStatoSinistro, labelStatoSinistro } from "@/lib/sinistriStati";

export default function ClienteSinistroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Lista completa per prev/next
  const { data: sinistri = [] } = useQuery({
    queryKey: ["cliente-sinistri", user?.id],
    queryFn: async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) return [];
      const { data } = await supabase
        .from("sinistri")
        .select("id, numero_sinistro")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .neq("stato", "archiviato")
        .order("data_apertura", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: s, isLoading } = useQuery({
    queryKey: ["cliente-sinistro-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sinistri")
        .select("*, compagnie(nome), titoli(id, numero_titolo), anagrafiche_professionali!sinistri_perito_id_fkey(nome, cognome, ragione_sociale)")
        .eq("id", id)
        .neq("stato", "archiviato")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { prev, next, currentIdx } = useMemo(() => {
    const idx = sinistri.findIndex((x: any) => x.id === id);
    return {
      currentIdx: idx,
      prev: idx > 0 ? sinistri[idx - 1] : null,
      next: idx >= 0 && idx < sinistri.length - 1 ? sinistri[idx + 1] : null,
    };
  }, [sinistri, id]);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!s) return <p className="text-muted-foreground">Sinistro non trovato.</p>;

  return (
    <div className="space-y-5">
      {/* Navigation bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link to="/cliente/sinistri">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Torna ai sinistri
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prev}
            onClick={() => prev && navigate(`/cliente/sinistri/${prev.id}`)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Precedente
          </Button>
          {currentIdx >= 0 && (
            <span className="text-xs text-muted-foreground px-1">
              {currentIdx + 1} di {sinistri.length}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!next}
            onClick={() => next && navigate(`/cliente/sinistri/${next.id}`)}
            className="gap-1"
          >
            Successivo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Header */}
      <Card className="border-l-4 border-l-orange-500">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sinistro</p>
                <h2 className="text-2xl font-bold text-foreground">{s.numero_sinistro || "—"}</h2>
                <p className="text-sm text-teal-700 font-medium mt-1">{s.ramo_sinistro || "—"}</p>
              </div>
            </div>
            <Badge className={`text-sm px-4 py-1.5 ${badgeClassStatoSinistro(s.stato)}`}>
              {labelStatoSinistro(s.stato)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Polizza collegata */}
      {s.titoli && (
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Polizza collegata</p>
                <p className="text-base font-semibold">{s.titoli.numero_titolo}</p>
              </div>
            </div>
            <Link to={`/cliente/polizze/${s.titoli.id}`}>
              <Button size="sm" variant="outline">Apri polizza</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Dinamica */}
      {s.dinamica && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dinamica del sinistro</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{s.dinamica}</p></CardContent>
        </Card>
      )}

      {/* Dettagli */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Luogo sinistro</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-0.5">
            {s.indirizzo_sinistro && <p>{s.indirizzo_sinistro}</p>}
            <p>{[s.cap_sinistro, s.citta_sinistro, s.provincia_sinistro ? `(${s.provincia_sinistro})` : null].filter(Boolean).join(" ") || s.luogo_sinistro || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><User className="h-4 w-4" /> Soggetti coinvolti</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {s.controparte && <p><span className="text-muted-foreground">Controparte:</span> {s.controparte}</p>}
            {s.medico_legale && <p><span className="text-muted-foreground">Medico legale:</span> {s.medico_legale}</p>}
            {s.anagrafiche_professionali && (
              <p><span className="text-muted-foreground">Perito:</span> {s.anagrafiche_professionali.cognome} {s.anagrafiche_professionali.nome}</p>
            )}
            {s.targa_veicolo && <p><span className="text-muted-foreground">Targa:</span> {s.targa_veicolo}</p>}
            {!s.controparte && !s.medico_legale && !s.anagrafiche_professionali && !s.targa_veicolo && (
              <p className="text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" /> Dettaglio economico</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {s.numero_sinistro_compagnia && <p><span className="text-muted-foreground">N° Compagnia:</span> {s.numero_sinistro_compagnia}</p>}
            {s.data_denuncia && <p><span className="text-muted-foreground">Data denuncia:</span> {format(new Date(s.data_denuncia), "dd/MM/yyyy")}</p>}
            {s.data_evento && <p><span className="text-muted-foreground">Data evento:</span> {format(new Date(s.data_evento), "dd/MM/yyyy")}</p>}
            {s.franchigia != null && s.franchigia > 0 && <p><span className="text-muted-foreground">Franchigia:</span> {fmt(s.franchigia)}</p>}
            {s.costo_preventivato != null && <p><span className="text-muted-foreground">Costo preventivato:</span> {fmt(s.costo_preventivato)}</p>}
            {s.costo_effettivo != null && <p><span className="text-muted-foreground">Costo effettivo:</span> {fmt(s.costo_effettivo)}</p>}
            {s.importo_riserva != null && s.importo_riserva > 0 && <p><span className="text-muted-foreground">Riserva:</span> {fmt(s.importo_riserva)}</p>}
            {s.importo_liquidato != null && s.importo_liquidato > 0 && <p className="text-emerald-700"><span className="text-muted-foreground">Liquidato:</span> {fmt(s.importo_liquidato)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Note perito */}
      {s.note_perito && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Note del perito</CardTitle></CardHeader>
          <CardContent><p className="text-sm italic">{s.note_perito}</p></CardContent>
        </Card>
      )}

      {/* Documenti */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documenti del sinistro</CardTitle>
        </CardHeader>
        <CardContent>
          <SinistroDocumentiCliente sinistroId={s.id} />
        </CardContent>
      </Card>
    </div>
  );
}
