import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { fmtEuro } from "@/lib/formatCurrency";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(173 58% 39%)",
  "hsl(197 37% 50%)",
  "hsl(43 74% 56%)",
  "hsl(27 87% 67%)",
  "hsl(12 76% 61%)",
  "hsl(280 50% 60%)",
  "hsl(340 60% 55%)",
];

interface DataPoint { name: string; value: number; }
interface TrendPoint { mese: string; value: number; }

const tooltipFmt = (v: number) => fmtEuro(v);

export const ProvvigioniBarChart = ({ title, data, color = "hsl(var(--primary))" }: { title: string; data: DataPoint[]; color?: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
    <CardContent className="h-[260px]">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nessun dato</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => tooltipFmt(v)} cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

export const ProvvigioniPieChart = ({ title, data }: { title: string; data: DataPoint[] }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
    <CardContent className="h-[260px]">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nessun dato</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => tooltipFmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);

export const ProvvigioniLineChart = ({ title, data }: { title: string; data: TrendPoint[] }) => (
  <Card>
    <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
    <CardContent className="h-[260px]">
      {data.length === 0 ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Nessun dato</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mese" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => tooltipFmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);
