import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, Pencil } from "lucide-react";
import { fmtEuro } from "@/lib/formatCurrency";
import { format } from "date-fns";
import { AzioniPolizzaToolbar, type ToolbarQuietanza } from "@/components/titolo/AzioniPolizzaToolbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");

const STATO_QUIETANZA: Record<string, { label: string; cls: string }> = {
  da_incassare: { label: "Da incassare", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  incassato: { label: "Incassata", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  sospesa: { label: "Sospesa", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  annullata: { label: "Annullata", cls: "bg-red-100 text-red-800 border-red-300" },
  stornata: { label: "Stornata", cls: "bg-orange-100 text-orange-800 border-orange-300" },
};

export default function QuietanzaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: q, isLoading } = useQuery({
    queryKey: ["quietanza", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select(`*,
          polizze:polizza_id (
            id, numero_polizza, stato, cliente_anagrafica_id, compagnia_id, ramo_id, ufficio_id,
            titolo_madre_id, regolazione,
            clienti:cliente_anagrafica_id (id, nome, cognome, ragione_sociale),
            compagnie:compagnia_id (id, nome),
            rami:ramo_id (id, codice, descrizione)
          )
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const polizzaId: string | undefined = (q as any)?.polizze?.id;

  const { data: quietanzeSorelle = [] } = useQuery({
    queryKey: ["polizza-quietanze", polizzaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quietanze")
        .select("id, numero_rata, numero_rate_totali, garanzia_da, garanzia_a, data_scadenza, premio_lordo, stato, data_messa_cassa, titolo_id")
        .eq("polizza_id", polizzaId!)
        .order("numero_rata", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!polizzaId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["quietanza", id] });
    if (polizzaId) qc.invalidateQueries({ queryKey: ["polizza-quietanze", polizzaId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Caricamento quietanza…
      </div>
    );
  }
  if (!q) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Quietanza non trovata.</p>
        <Button onClick={() => navigate("/portafoglio/attive")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna al portafoglio
        </Button>
      </div>
    );
  }

  const polizza: any = (q as any).polizze;
  const cliente: any = polizza?.clienti;
  const clienteNome = cliente?.ragione_sociale || [cliente?.cognome, cliente?.nome].filter(Boolean).join(" ") || "—";
  const stato = q.stato as string;
  const st = STATO_QUIETANZA[stato] || { label: stato, cls: "" };
  const titoloId: string | null = (q as any).titolo_id;
  const numPol = polizza?.numero_polizza || (q as any).numero_polizza_snapshot || "";

  const current: ToolbarQuietanza | null = {
    id: q.id,
    numero_rata: q.numero_rata,
    numero_rate_totali: q.numero_rate_totali,
    garanzia_da: q.garanzia_da,
    garanzia_a: q.garanzia_a,
    data_scadenza: q.data_scadenza,
    premio_lordo: q.premio_lordo,
    stato: q.stato,
    data_messa_cassa: q.data_messa_cassa,
    titolo_id: titoloId,
  };

  const clienteId = polizza?.cliente_anagrafica_id;
  const clienteHref = clienteId ? `/archivi/clienti/${clienteId}?tab=polizze` : null;
  const totLabel = q.numero_rate_totali ? `${q.numero_rata}/${q.numero_rate_totali}` : `${q.numero_rata}`;

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/archivi/clienti">Clienti</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {clienteHref && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={clienteHref}>{clienteNome}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={clienteHref}>Polizze</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          {polizza && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={`/polizze/${polizza.id}`}>Polizza {polizza.numero_polizza}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Quietanza {totLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 -ml-2"
              onClick={() => (clienteHref ? navigate(clienteHref) : navigate(-1))}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {clienteHref ? "Torna al cliente" : "Indietro"}
            </Button>
            <span>·</span>
            <span>Quietanza</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Rata {q.numero_rata}{q.numero_rate_totali ? ` / ${q.numero_rate_totali}` : ""}
            <Badge variant="outline" className={st.cls + " ml-2"}>{st.label}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Polizza{" "}
            {polizza ? (
              <Link to={`/polizze/${polizza.id}`} className="text-primary hover:underline font-medium">
                {polizza.numero_polizza}
              </Link>
            ) : "—"}{" "}
            · {clienteNome} · {polizza?.compagnie?.nome || "—"}
          </p>
        </div>
        {titoloId && (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/titoli/${titoloId}`}>
              <Pencil className="h-4 w-4 mr-2" /> Apri editing completo
            </Link>
          </Button>
        )}
      </div>

      {polizza && (
        <AzioniPolizzaToolbar
          polizzaId={polizza.id}
          numeroPolizza={numPol}
          statoPolizza={polizza.stato}
          titoloMadreId={polizza.titolo_madre_id ?? null}
          clienteId={polizza.cliente_anagrafica_id ?? null}
          uffizioId={polizza.ufficio_id ?? null}
          regolazione={!!polizza.regolazione}
          quietanze={quietanzeSorelle as ToolbarQuietanza[]}
          currentQuietanza={current}
          onRefresh={refresh}
        />
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <CompactCard title="Periodo & scadenze">
          <Field label="Decorrenza" value={fmtDate(q.garanzia_da)} />
          <Field label="Scadenza garanzia" value={fmtDate(q.garanzia_a)} />
          <Field label="Competenza" value={fmtDate(q.data_competenza)} />
          <Field label="Scadenza pagamento" value={fmtDate(q.data_scadenza)} />
          <Field label="Limite mora" value={fmtDate(q.limite_mora)} />
          <Field label="Giorni mora" value={q.mora_giorni?.toString()} />
        </CompactCard>

        <CompactCard title="Importi">
          <Field label="Premio netto" value={fmtEuro(q.premio_netto)} />
          <Field label="Tasse" value={fmtEuro(q.tasse)} />
          <Field label="Addizionali" value={fmtEuro(q.addizionali)} />
          <Field label="SSN" value={fmtEuro(q.ssn)} />
          <Field label="Premio lordo" value={fmtEuro(q.premio_lordo)} highlight />
          <Field label="Provv. firma" value={fmtEuro(q.provvigioni_firma)} />
          {stato !== "incassato" && !q.data_messa_cassa && (
            <Field label="Provv. quietanza" value={fmtEuro(q.provvigioni_quietanza)} />
          )}
        </CompactCard>

        <CompactCard title="Messa a cassa & incasso">
          <Field label="Data messa a cassa" value={fmtDate(q.data_messa_cassa)} />
          <Field label="Data pagamento" value={fmtDate(q.data_pagamento)} />
          <Field label="Data incasso" value={fmtDate(q.data_incasso)} />
          <Field label="Importo incassato" value={q.importo_incassato != null ? fmtEuro(q.importo_incassato) : "—"} highlight />
          <Field label="Tipo incasso" value={q.tipo_incasso} />
          <Field label="Conto incasso" value={q.conto_incasso} />
        </CompactCard>

        <CompactCard title="Riferimenti">
          <Field label="N° polizza (snapshot)" value={q.numero_polizza_snapshot} />
          <Field label="Appendice" value={q.appendice} />
          {titoloId && (
            <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Titolo legacy</span>
              <Link to={`/titoli/${titoloId}`} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> Apri
              </Link>
            </div>
          )}
        </CompactCard>
      </div>
    </div>
  );
}

function CompactCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={"text-right tabular-nums " + (highlight ? "font-bold text-foreground" : "font-medium")}>
        {value || value === 0 ? value : <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}
