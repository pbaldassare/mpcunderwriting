import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { aggregateSinPerReparto, resolveReparto } from "@/lib/sinistriReparto";
import { fmtEuro0 as fmt } from "@/lib/formatCurrency";

type Sinistro = {
  id: string;
  stato?: string | null;
  reparto?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  importo_riserva?: number | null;
  importo_liquidato?: number | null;
};

interface Props {
  sinistri: Sinistro[];
}

export function SinistriPerRepartoChart({ sinistri }: Props) {
  const data = useMemo(() => aggregateSinPerReparto(sinistri), [sinistri]);
  const mappedCount = sinistri.filter((s) => resolveReparto(s) !== "Non specificato").length;

  if (!sinistri.length) {
    return <p className="text-sm text-muted-foreground text-center py-12">Nessun sinistro</p>;
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
          <XAxis dataKey="reparto" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "riserva" || name === "liquidato") return fmt(value);
              return value;
            }}
            labelFormatter={(label) => `Reparto: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="aperti" name="Aperti" stackId="a" fill="#ea580c" />
          <Bar dataKey="chiusi" name="Chiusi" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-600" />
          Aperti
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Chiusi
        </span>
        <span className="ml-auto">{mappedCount} di {sinistri.length} sinistri con reparto</span>
      </div>
    </div>
  );
}

export default SinistriPerRepartoChart;
