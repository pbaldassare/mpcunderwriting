import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { fmtEuro } from "@/lib/formatCurrency";
import { useCfoFilters } from "@/hooks/useCfoFilters";
import { parseCfoJson, useCfoRpc } from "@/hooks/useCfoRpc";
import { CfoDrillTable, type DrillFilters } from "./CfoDrillTable";

const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" };
const euroFmt = (v: number) => fmtEuro(v);

function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Nessun dato nel periodo
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function CfoExplorer() {
  const { rpcParams } = useCfoFilters();
  const [drill, setDrill] = useState<DrillFilters | null>(null);

  const { data: compagnie = [] } = useQuery({
    queryKey: ["cfo-compagnie-map"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome");
      return data ?? [];
    },
  });

  const compagniaIdByName = useMemo(() => {
    const m = new Map<string, string>();
    compagnie.forEach((c) => m.set(c.nome, c.id));
    return m;
  }, [compagnie]);

  const { data: compagniaRaw } = useCfoRpc<unknown>("cfo_premi_per_compagnia", rpcParams);
  const { data: produttoreRaw } = useCfoRpc<unknown>("cfo_premi_per_produttore", rpcParams);
  const { data: ramoRaw } = useCfoRpc<unknown>("cfo_premi_per_ramo", rpcParams);
  const { data: trendRaw } = useCfoRpc<unknown>("cfo_trend_mensile", rpcParams);
  const yoyParams = useMemo(
    () => ({
      _ufficio_id: rpcParams._ufficio_id,
      _compagnia_id: rpcParams._compagnia_id,
    }),
    [rpcParams._ufficio_id, rpcParams._compagnia_id],
  );
  const { data: yoyRaw } = useCfoRpc<unknown>("cfo_yoy_mensile", yoyParams);

  const compagniaData = parseCfoJson<{ compagnia: string; totale: number }>(compagniaRaw).map((r) => ({
    name: r.compagnia,
    value: Number(r.totale),
  }));

  const produttoreData = parseCfoJson<{ produttore: string; totale: number }>(produttoreRaw).map((r) => ({
    name: r.produttore,
    value: Number(r.totale),
  }));

  const ramoData = parseCfoJson<{ ramo: string; totale: number }>(ramoRaw).map((r) => ({
    name: r.ramo,
    value: Number(r.totale),
  }));

  const trendData = parseCfoJson<{ mese: string; premi: number; provvigioni: number; margine: number }>(trendRaw);

  const yoyData = parseCfoJson<{ mese: string; anno_corrente: number; anno_precedente: number }>(yoyRaw).map(
    (r) => ({
      mese: r.mese,
      corrente: Number(r.anno_corrente),
      precedente: Number(r.anno_precedente),
    }),
  );

  const onBarClick = (type: "compagnia" | "produttore" | "ramo", name: string) => {
    if (type === "compagnia") {
      setDrill({
        compagniaId: compagniaIdByName.get(name),
        label: name,
      });
    } else if (type === "produttore") {
      setDrill({ produttoreNome: name, label: name });
    } else {
      setDrill({ ramo: name, label: name });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="compagnia">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="compagnia">Per Compagnia</TabsTrigger>
          <TabsTrigger value="produttore">Per Produttore</TabsTrigger>
          <TabsTrigger value="ramo">Per Ramo</TabsTrigger>
          <TabsTrigger value="trend">Trend mensile</TabsTrigger>
          <TabsTrigger value="yoy">YoY</TabsTrigger>
        </TabsList>

        <TabsContent value="compagnia" className="mt-4">
          <ChartCard title="Premi incassati per compagnia" empty={compagniaData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compagniaData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={70} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={euroFmt} contentStyle={tooltipStyle} />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d) => d?.name && onBarClick("compagnia", String(d.name))}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="produttore" className="mt-4">
          <ChartCard title="Premi incassati per produttore" empty={produttoreData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={produttoreData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={70} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={euroFmt} contentStyle={tooltipStyle} />
                <Bar
                  dataKey="value"
                  fill="hsl(173 58% 39%)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d) => d?.name && onBarClick("produttore", String(d.name))}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="ramo" className="mt-4">
          <ChartCard title="Premi incassati per ramo" empty={ramoData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ramoData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={euroFmt} contentStyle={tooltipStyle} />
                <Bar
                  dataKey="value"
                  fill="hsl(197 37% 50%)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d) => d?.name && onBarClick("ramo", String(d.name))}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="trend" className="mt-4">
          <ChartCard title="Trend mensile premi / provvigioni / margine" empty={trendData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={euroFmt} contentStyle={tooltipStyle} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="premi"
                  name="Premi"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    cursor: "pointer",
                    onClick: (_e, payload) => {
                      const mese = (payload as { payload?: { mese?: string } })?.payload?.mese;
                      if (mese) setDrill({ mese: String(mese), label: `Mese ${mese}` });
                    },
                  }}
                />
                <Line type="monotone" dataKey="provvigioni" name="Provvigioni" stroke="hsl(43 74% 56%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="margine" name="Margine" stroke="hsl(173 58% 39%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="yoy" className="mt-4">
          <ChartCard title="Confronto anno corrente vs precedente (premi)" empty={yoyData.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={euroFmt} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="corrente" name="Anno corrente" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="precedente" name="Anno precedente" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Clicca su una barra o sul trend premi per aprire il dettaglio titoli.
      </p>

      <CfoDrillTable drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
