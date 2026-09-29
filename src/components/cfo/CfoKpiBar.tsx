import { TrendingUp, Percent, Wallet, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtEuro } from "@/lib/formatCurrency";
import { useCfoFilters } from "@/hooks/useCfoFilters";
import { parseCfoObject, useCfoRpc } from "@/hooks/useCfoRpc";

interface CfoKpiData {
  totale_premi_incassati?: number;
  totale_provvigioni_generate?: number;
  totale_provvigioni_pagate?: number;
  [key: string]: unknown;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-28 mt-1" />
          ) : (
            <p className="text-xl font-bold tabular-nums">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CfoKpiBar() {
  const { rpcParams } = useCfoFilters();
  const { data, isLoading } = useCfoRpc<unknown>("cfo_kpi", rpcParams);
  const kpi = parseCfoObject<CfoKpiData>(data);

  const premi = Number(kpi?.totale_premi_incassati ?? 0);
  const provGen = Number(kpi?.totale_provvigioni_generate ?? 0);
  const provPagate = Number(kpi?.totale_provvigioni_pagate ?? 0);
  const margine = premi - provGen;
  const daPagare = provGen - provPagate;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard label="Premi incassati" value={fmtEuro(premi)} icon={TrendingUp} loading={isLoading} />
      <KpiCard label="Provvigioni generate" value={fmtEuro(provGen)} icon={Percent} loading={isLoading} />
      <KpiCard label="Margine" value={fmtEuro(margine)} icon={Wallet} loading={isLoading} />
      <KpiCard label="Provvigioni da pagare" value={fmtEuro(daPagare)} icon={Receipt} loading={isLoading} />
    </div>
  );
}
